
import sys, json, os, re, base64
from bs4 import BeautifulSoup
sys.path.insert(0, sys.argv[2])
from figure_html_normalize import normalize_figures
from complex_pdf_images import embed_page_images, validate_rendered_images

data = json.loads(sys.stdin.read())
output_path = sys.argv[1]
pages = data['pages']
doc_title = data['title']

def clean_html(raw_html, page_images, source_text, screenshot, page_width, page_height):
    soup = BeautifulSoup(raw_html, 'html.parser')
    for tag in soup.find_all(['style', 'script']): tag.decompose()
    # Repair cell-in-cell nesting caused by an unclosed <td>/<th> tag in the
    # model's raw output. html.parser (unlike a browser or html5lib) does NOT
    # auto-close unclosed block tags -- a model that forgets a closing tag,
    # e.g. writes <td>text<td>more text</td></tr> instead of
    # <td>text</td><td>more text</td></tr>, ends up with the second cell
    # nested INSIDE the first rather than as its sibling. This silently
    # breaks every downstream cell-counting step (colspan splitting, row-
    # width padding, header/Row-TH association) because find_all(...,
    # recursive=False) never sees the nested cell as a cell of the row at
    # all -- confirmed as the root cause of residual 'Headers' failures in
    # real VPAT-style tables with long multi-paragraph Remarks cells (where
    # the model is more likely to lose track of a closing tag). Detect any
    # <td>/<th> containing a direct <td>/<th> child and pull the inner
    # cell(s) back out to be proper siblings in the row, preserving order.
    _nest_repair_changed = True
    while _nest_repair_changed:
        _nest_repair_changed = False
        for _cell in soup.find_all(['td', 'th']):
            _inner_cells = _cell.find_all(['td', 'th'], recursive=False)
            if _inner_cells:
                _parent_row = _cell.parent
                if _parent_row is None or _parent_row.name != 'tr':
                    continue
                for _inner in _inner_cells:
                    _inner.extract()
                    _cell.insert_after(_inner)
                _nest_repair_changed = True
                break
    # WeasyPrint bug: a <td>/<th> whose content MIXES a bare text node with
    # a block-level child (most commonly <p>) causes its tagged-PDF box-tree
    # builder to emit a spurious NESTED /TD (or /TH) inside the real one --
    # confirmed by isolating this exact minimal case and inspecting the
    # resulting struct tree directly (weasyprint/pdf/tags.py's box walker
    # mis-tags the anonymous block box WeasyPrint creates to wrap the bare
    # text alongside the real <p> sibling). This produces cells that Acrobat
    # correctly flags as missing /Headers, since the nested /TD is never
    # seen as a real cell of the row by any downstream tooling (including
    # WeasyPrint's own Headers-linking pass). This is the actual root cause
    # of the residual 'Headers'-failed cells in real VPAT-style tables --
    # NOT an unclosed source tag (that repair pass above is retained as a
    # defensive no-op; it does not fire on real pipeline output). It bites
    # both cells the model emits with this shape natively, and cells this
    # code appends a continuation <p> onto (the orphan-row merge below, and
    # any other future direct '.append(new_tag)' onto a cell that already
    # has bare text). Fix at the source: normalize every <td>/<th> so its
    # direct children are ONLY block-level elements -- wrap any bare text
    # node (or inline element run) that is a direct child into its own <p>,
    # preserving order relative to existing block children.
    _INLINE_MIX_BLOCK_TAGS = ['p', 'div', 'ul', 'ol', 'table']

    def _normalize_cell_content(cell):
        _has_inline_run = any(
            (isinstance(_c, str) and _c.strip())
            or (getattr(_c, 'name', None) is not None and _c.name not in _INLINE_MIX_BLOCK_TAGS)
            for _c in cell.contents
        )
        _has_block_child = cell.find(_INLINE_MIX_BLOCK_TAGS, recursive=False) is not None
        if not (_has_inline_run and _has_block_child):
            return
        _run = []
        _new_children = []
        for _c in list(cell.contents):
            _is_block = getattr(_c, 'name', None) in _INLINE_MIX_BLOCK_TAGS
            if _is_block:
                if _run:
                    _p = soup.new_tag('p')
                    for _r in _run:
                        _p.append(_r.extract() if hasattr(_r, 'extract') else _r)
                    _new_children.append(_p)
                    _run = []
                _new_children.append(_c.extract())
            else:
                _run.append(_c)
        if _run:
            _p = soup.new_tag('p')
            for _r in _run:
                _p.append(_r.extract() if hasattr(_r, 'extract') else _r)
            _new_children.append(_p)
        cell.clear()
        for _nc in _new_children:
            cell.append(_nc)
    for _cell in soup.find_all(['td', 'th']):
        _normalize_cell_content(_cell)
    # Strip table sub-elements that have no row/cell content, and unwrap
    # any table that ends up with no actual rows -- WeasyPrint's tagged-PDF
    # box-tree walker raises 'Table wrapper without a table' when a table
    # display box has no TableBox child (e.g. a table left with only a
    # caption/colgroup after a page-split repair, or entirely empty).
    for table in soup.find_all('table'):
        if not table.find_all('tr'):
            table.unwrap()
    # Orphaned row/cell fragments outside any table (can appear when a table
    # spans two Claude-extracted pages and each half is parsed independently)
    # also trip the same WeasyPrint code path -- drop them defensively.
    for orphan in soup.find_all(['tr', 'thead', 'tbody', 'tfoot', 'td', 'th']):
        if not orphan.find_parent('table'):
            orphan.unwrap()
    # Acrobat's 'Regularity' check fails if rows in the same table don't all
    # have the same number of columns (very common with real-world tables
    # that have merged/missing cells in the source PDF). Pad short rows with
    # empty <td> cells so every row in a table matches the widest row's
    # column count. Cells with colspan count toward the total.
    # WeasyPrint's tagged-PDF struct-tree builder does not implement colspan
    # or rowspan at all (confirmed via its own source: weasyprint/pdf/tags.py
    # has a literal "# TODO: handle rowspan and colspan values." comment) --
    # a <td colspan="3"> renders visually as one wide cell but is tagged in
    # the PDF struct tree as a row with just ONE /TD, while sibling rows in
    # the same table have three. Acrobat's Regularity/Headers checks then
    # correctly flag that row (uneven cell count, and the lone cell can only
    # ever link to one column's header even though it visually spans all
    # three). Real-world cause seen in practice: Claude Vision extracts a
    # VPAT criterion whose Level/Remarks are blank/merged into a single
    # descriptive cell using colspan. Fix at the HTML level, before
    # WeasyPrint ever sees it: split every colspan>1 cell into the real cell
    # plus (colspan-1) empty filler cells of the same type, and drop the
    # colspan attribute -- this guarantees every row's real cell COUNT
    # matches, independent of whatever WeasyPrint does/doesn't do with
    # colspan, since we no longer rely on it being interpreted at all.
    for table in soup.find_all('table'):
        for row in table.find_all('tr'):
            for cell in row.find_all(['td', 'th'], recursive=False):
                try:
                    span = int(cell.get('colspan', 1))
                except (TypeError, ValueError):
                    span = 1
                if span > 1:
                    del cell['colspan']
                    for _ in range(span - 1):
                        filler = soup.new_tag(cell.name)
                        filler.string = ''
                        cell.insert_after(filler)
    for table in soup.find_all('table'):
        rows = table.find_all('tr')
        if not rows:
            continue
        def row_width(row):
            width = 0
            for cell in row.find_all(['td', 'th'], recursive=False):
                try:
                    width += int(cell.get('colspan', 1))
                except (TypeError, ValueError):
                    width += 1
            return width
        widths = [row_width(r) for r in rows]
        max_width = max(widths) if widths else 0
        for row, w in zip(rows, widths):
            for _ in range(max_width - w):
                filler = soup.new_tag('td')
                filler.string = ''
                row.append(filler)
        # Acrobat's 'Headers' check fails if a table has no <th> cells at all.
        # If Claude omitted a header row, promote the first row's <td>s to
        # <th scope="col"> so the table has a real header association.
        if not table.find('th'):
            first_row = rows[0]
            for cell in first_row.find_all('td'):
                cell.name = 'th'
                cell['scope'] = 'col'
        # WeasyPrint's tagged-PDF builder only registers a <th> as a ROW
        # header when it has scope="row" -- any <th> with no scope (or
        # scope="col") is treated as a COLUMN header keyed by its column
        # index. Claude sometimes marks first-column row-label cells as
        # <th> (correctly identifying them as headers) but omits the scope
        # attribute, which silently mis-tags them as column headers and
        # breaks the Headers association Acrobat checks for. Fix up both
        # directions here as a safety net:
        #  1. Any <th> in the first column of a body row (not the header
        #     row) with no scope -> scope="row".
        #  2. Any <th> in the header row (first row of thead, or first row
        #     of tbody when no thead) with no scope -> scope="col".
        #  3. Any other <th> still missing scope -> default to "col" (safe
        #     fallback matching WeasyPrint's own default behavior).
        thead = table.find('thead')
        header_row = thead.find('tr') if thead else rows[0]
        for row in rows:
            cells = row.find_all(['td', 'th'], recursive=False)
            if not cells:
                continue
            first_cell = cells[0]
            if first_cell.name == 'th' and not first_cell.get('scope') and row is not header_row:
                first_cell['scope'] = 'row'
        for th in table.find_all('th'):
            if not th.get('scope'):
                th['scope'] = 'col'
    recovered = embed_page_images(soup, page_images, screenshot, page_width, page_height)
    if recovered:
        print('Image review required (description/reading order): ' + ', '.join(recovered), file=sys.stderr)
    # Vision HTML is untrusted. Rebuild figures so alternative descriptions
    # remain metadata and only source-validated captions remain visible.
    normalize_figures(soup, source_text)
    return str(soup)

html_parts = data.get('preparedSections', [])
for pg in pages:
    page_html = pg.get('html', '')
    page_images = pg.get('images', [])
    source_text = pg.get('sourceText', '')
    html_parts.append('<div class="page">' + clean_html(
        page_html, page_images, source_text, pg.get('screenshot'),
        pg.get('pageWidth', 612), pg.get('pageHeight', 792)
    ) + '</div>')

if data.get('prepareOnly'):
    with open(output_path, 'w', encoding='utf-8') as f:
        f.write(''.join(html_parts))
    print('ok')
    sys.exit(0)

# Document-level heading normalization. Each page is extracted by Claude
# independently, so heading levels are only consistent WITHIN a page --
# concatenating pages can produce skips (e.g. one page ends at h2, the next
# starts at h3 with no h2, or worse, jumps to h1). Acrobat's 'Appropriate
# nesting' check fails on any level skip greater than 1. Walk all headings in
# document order and clamp each one so it's never more than one level deeper
# than the previous heading, while preserving same-level and shallower jumps.
# Each page's HTML is generated by an independent Claude call with no
# visibility into neighboring pages, so a single real table that happens to
# span a page boundary can come back as two separate <table> elements.
# Detect and merge these before final assembly using two signals, since
# relying on the model to self-report a continuation marker is unreliable:
#   1. Explicit signal: matching data-pdf-table-id on consecutive tables
#      (the vision prompt asks the model to reuse the same ID on a
#      continuation fragment that has no <thead> of its own).
#   2. Structural fallback: two ADJACENT tables (no other table in between,
#      only page/section wrappers) where the first has no closing/total row
#      and the second has the exact same column count and no <thead> of its
#      own (i.e. its first row is plain <td> data, not <th> headers) -- this
#      is the shape of a real continued table even when the model didn't
#      tag it explicitly.
_pre_merge_soup = BeautifulSoup(''.join(html_parts), 'html.parser')
_all_tables = _pre_merge_soup.find_all('table')
for _i in range(len(_all_tables) - 1, 0, -1):
    _cur = _all_tables[_i]
    _prev = _all_tables[_i - 1]
    _cur_id = _cur.get('data-pdf-table-id')
    _prev_id = _prev.get('data-pdf-table-id')
    _id_match = bool(_cur_id) and _cur_id == _prev_id
    _prev_row = _prev.find('tr')
    _prev_cols = len(_prev_row.find_all(['th', 'td'])) if _prev_row else 0
    _cur_has_thead = _cur.find('thead') is not None
    _cur_first_row = _cur.find('tr')
    _cur_cols = len(_cur_first_row.find_all(['th', 'td'])) if _cur_first_row else 0
    _cur_first_row_is_data = _cur_first_row is not None and _cur_first_row.find('th') is None
    _same_width = _prev_cols > 0 and _prev_cols == _cur_cols
    _structural_match = _same_width and not _cur_has_thead and _cur_first_row_is_data
    if _id_match or _structural_match:
        _prev_tbody = _prev.find('tbody') or _prev
        _cur_tbody = _cur.find('tbody') or _cur
        for _row in _cur_tbody.find_all('tr', recursive=False):
            _prev_tbody.append(_row.extract())
        _cur.decompose()

# Safety net for a distinct model failure mode, seen in real VPAT-style
# documents: when one row's Remarks/description cell is a long paragraph,
# the source PDF sometimes draws that cell tall enough that a follow-on
# paragraph *within the same logical cell* lands in its own ruled grid band.
# The vision model can misread that visual band as a brand-new <tr>, so it
# emits a row where the row-label column (and any other leading columns) are
# empty but the LAST column has real text -- a row with no row identity at
# all. The prompt above now tells the model not to do this, but since
# compliance isn't guaranteed, catch and repair it here too: any <tr> whose
# leading cells (all but the last) are empty/whitespace-only, in a table
# where at least one other row DOES have real content in those leading
# columns, is treated as orphaned continuation text and its last cell's
# content is appended into the same-index cell of the immediately preceding
# row (joined as a new paragraph), then the orphan row is removed entirely.
for _t in _pre_merge_soup.find_all('table'):
    _body_rows = [_r for _r in _t.find_all('tr') if _r.find_parent('thead') is None]
    _rows_have_real_leading_label = any(
        (_r.find(['th', 'td']) and _r.find(['th', 'td']).get_text(strip=True))
        for _r in _body_rows
    )
    if not _rows_have_real_leading_label:
        continue
    _prev_real_row = None
    for _r in _body_rows:
        _cells = _r.find_all(['th', 'td'], recursive=False)
        if len(_cells) < 2:
            _prev_real_row = _r
            continue
        _leading_empty = all(not _c.get_text(strip=True) for _c in _cells[:-1])
        _last_has_text = bool(_cells[-1].get_text(strip=True))
        if _leading_empty and _last_has_text and _prev_real_row is not None:
            _prev_cells = _prev_real_row.find_all(['th', 'td'], recursive=False)
            if len(_prev_cells) == len(_cells):
                _target = _prev_cells[-1]
                # Appending a <p> here can leave _target with MIXED bare
                # text + block content (e.g. the model emitted the cell's
                # first paragraph as plain text, no <p> wrapper) -- this
                # exact shape is what triggers WeasyPrint's nested-/TD
                # tagging bug (see _normalize_cell_content above). Wrap any
                # existing bare text into its own <p> first so the cell only
                # ever has block-level direct children after this append.
                _existing_bare_text = [
                    _c for _c in list(_target.contents)
                    if isinstance(_c, str) and _c.strip()
                ]
                if _existing_bare_text:
                    _wrap_p = _pre_merge_soup.new_tag('p')
                    for _bt in _existing_bare_text:
                        _wrap_p.append(_bt.extract())
                    _target.insert(0, _wrap_p)
                _new_p = _pre_merge_soup.new_tag('p')
                _new_p.string = _cells[-1].get_text(' ', strip=True)
                _target.append(_new_p)
                _r.decompose()
                continue
        _prev_real_row = _r

# WeasyPrint bug workaround (see get_wrapped_table patch below for the full
# explanation): when a table's box tree fragments across a page break in a
# certain way, the fragment WeasyPrint creates for one side of the break can
# end up with zero TableBox children, and the crash-avoidance patch below
# substitutes a synthetic EMPTY TableBox for that fragment -- silently
# dropping that fragment's real header/data cells from the accessibility
# tree even though the content still renders visually on the page. This is
# confirmed to happen on genuinely small tables (e.g. a 5-row, 2-column
# table) that simply straddle a page boundary by a line or two -- there is
# no reason a short table like that needs to split at all. Rather than try
# to patch WeasyPrint's internal fragment-to-struct-element mapping (fragile,
# version-specific), prevent the split from happening in the first place for
# any table small enough to plausibly fit in the remaining space on one
# page: mark it with CSS 'break-inside: avoid' so WeasyPrint pushes the
# whole table onto the next page instead of fragmenting it. Large multi-page
# tables (VPAT criteria tables can run 16+ rows across several pages) must
# NOT get this treatment -- forcing those to stay unbroken would push them
# into a single unbreakable block that overflows the page entirely. Use row
# count as the threshold: tables with a small number of rows are exactly the
# ones short enough to avoid breaking AND the ones most likely to be pushed
# right up against a page boundary by preceding content.
#
# IMPORTANT correction: putting break-inside directly on the <table>
# element alone is NOT sufficient -- confirmed on a real document that
# several small captioned tables still fragmented and hit the
# crash-avoidance substitution even with this style present, because
# WeasyPrint's table-wrapper box sits ABOVE the <table> element and can
# still split independently of it. Wrapping the whole table (including its
# <caption>) in a block-level <div> that itself carries break-inside: avoid
# is what actually prevents the fragmentation -- confirmed via direct
# WeasyPrint struct-tree inspection on this real document: 5 real
# fragmentation cases went from 5 -> 0 with the div-wrapper approach, vs.
# table-level style alone which still hit all 5.
_SMALL_TABLE_MAX_ROWS = 8
for _t in _pre_merge_soup.find_all('table'):
    _row_count = len(_t.find_all('tr'))
    if 0 < _row_count <= _SMALL_TABLE_MAX_ROWS:
        _wrapper = _pre_merge_soup.new_tag('div')
        _wrapper['style'] = 'break-inside: avoid; page-break-inside: avoid;'
        _t.wrap(_wrapper)

# Wide tables (many columns -- nutrition-facts posters, comparison grids,
# multi-attribute spec sheets) were silently overflowing past the page's
# right margin with zero warning: a fixed 'width: 100%' table on a portrait
# letter page (6.5in usable width after 1in margins) simply cannot fit more
# than about 6-8 readable columns before WeasyPrint's default overflow
# behavior clips every column past that point off the visible/printable
# page -- no error is raised, no page break happens, the extra columns just
# render outside the page box and vanish. Confirmed on a real 15-column
# nutrition-facts table (Fruits/Calories/Calories from Fat/Total Fat/
# Sodium/Potassium/Total Carbohydrate/Dietary Fiber/Sugars/Protein/
# Vitamin A/Vitamin C/Calcium/Iron): only the first ~8 columns were visible
# in the output PDF, the remaining 6-7 columns were completely missing on
# every page of the table, with no visual indication anything was cut.
#
# Fix: any table with more columns than comfortably fit in portrait width
# gets flagged and rendered on a landscape page instead (11in wide usable
# vs 6.5in), with a smaller font/padding as an extra safety margin for
# genuinely dense tables. WeasyPrint supports switching an individual
# block's page orientation via a named @page selector (the 'page' CSS
# property) -- confirmed via isolated test that a div with 'page: <name>'
# renders on its own named page with that page's size/margins, and that
# WeasyPrint's own struct-tree tagger (pdf_tags=True) tags content on named
# pages identically to ordinary pages, since it walks the same box tree
# regardless of which @page rule produced it.
_WIDE_TABLE_MIN_COLUMNS = 8
for _t in _pre_merge_soup.find_all('table'):
    _header_row = _t.find('tr')
    if not _header_row:
        continue
    _col_count = 0
    for _cell in _header_row.find_all(['th', 'td'], recursive=False):
        _col_count += int(_cell.get('colspan', 1) or 1)
    if _col_count < _WIDE_TABLE_MIN_COLUMNS:
        continue
    # Reuse the small-table wrapper div if one was just added above (avoid
    # nested divs); otherwise wrap fresh. Either way, the wide-table classes
    # go on the OUTER div so the landscape page assignment covers the whole
    # unbreakable unit (caption + table together), matching how the small-
    # table break-inside wrapper already treats caption+table as one block.
    _existing_wrapper = _t.parent if _t.parent and _t.parent.name == 'div' else None
    _wide_wrapper = _existing_wrapper if _existing_wrapper is not None else _pre_merge_soup.new_tag('div')
    if _existing_wrapper is None:
        _t.wrap(_wide_wrapper)
    _prior_style = _wide_wrapper.get('style', '')
    _wide_wrapper['style'] = (_prior_style + '; ' if _prior_style else '') + 'page: wide-table;'
    # Graceful degradation for extreme column counts: the shared wide-table
    # CSS rule below sets 9pt as the baseline for any 8+ column table, but a
    # single fixed size doesn't scale -- a 30-column table at 9pt would be
    # just as likely to overflow landscape's ~9in usable width as an 8-column
    # table was to overflow portrait's 6.5in, silently recreating the exact
    # bug this whole fix exists to prevent. Instead, shrink font size on a
    # sliding scale keyed to column count, down to a 6pt hard floor -- below
    # 6pt, text stops being legible at all (accessibility purpose defeated),
    # so extremely dense tables (40+ columns) rely on the universal overflow
    # backstop (below) to hard-fail rather than ship an illegible result.
    if _col_count >= 12:
        if _col_count >= 32:
            _wide_font_pt = 6.0
        elif _col_count >= 24:
            _wide_font_pt = 6.5
        elif _col_count >= 20:
            _wide_font_pt = 7.0
        elif _col_count >= 16:
            _wide_font_pt = 7.5
        else:  # 12-15 columns
            _wide_font_pt = 8.0
        _t['style'] = (_t.get('style', '') + '; ' if _t.get('style') else '') + f'font-size: {_wide_font_pt}pt;'
        # Extreme counts also need tighter cell padding to reclaim a bit more
        # horizontal room per column -- the shared 3pt/4pt wide-table padding
        # is still comparatively roomy once font size has dropped this far.
        if _col_count >= 20:
            for _cell in _t.find_all(['th', 'td']):
                _cell['style'] = (_cell.get('style', '') + '; ' if _cell.get('style') else '') + 'padding: 1.5pt 2pt;'

html_parts = [str(_pre_merge_soup)]

combined_for_headings = BeautifulSoup(''.join(html_parts), 'html.parser')
prev_level = 1
seen_h1 = False
for h in combined_for_headings.find_all(['h1', 'h2', 'h3', 'h4', 'h5', 'h6']):
    level = int(h.name[1])
    if level == 1:
        if seen_h1:
            level = 2  # only the document's first h1 stays an h1
            h.name = 'h2'
        else:
            seen_h1 = True
    elif level > prev_level + 1:
        level = prev_level + 1
        h.name = 'h%d' % level
    prev_level = level
html_parts = [str(combined_for_headings)]

css_rules = [
    '@page { size: letter; margin: 1in; }',
    # Named landscape page for wide tables (see wide-table detection loop
    # above): 11in wide vs. portrait's 8.5in gives ~9in usable width
    # instead of 6.5in, enough headroom for tables with 8+ columns that
    # were previously overflowing off the right edge of a portrait page
    # with no warning. Smaller 0.5in margins reclaim a bit more width for
    # genuinely dense tables (12+ columns also get a font-size reduction
    # on the table element itself, applied in the detection loop).
    '@page wide-table { size: letter landscape; margin: 0.5in; }',
    'body { font-family: DejaVu Sans, Arial, sans-serif; font-size: 11pt; line-height: 1.4; color: #000; }',
    'h1 { font-size: 18pt; font-weight: bold; margin: 12pt 0 6pt 0; }',
    'h2 { font-size: 15pt; font-weight: bold; margin: 10pt 0 5pt 0; }',
    'h3 { font-size: 13pt; font-weight: bold; margin: 8pt 0 4pt 0; }',
    'h4, h5, h6 { font-size: 11pt; font-weight: bold; margin: 6pt 0 3pt 0; }',
    'p { margin: 0 0 6pt 0; }',
    'ul, ol { margin: 4pt 0 4pt 18pt; padding: 0; }',
    'li { margin-bottom: 2pt; }',
    'table { border-collapse: collapse; width: 100%; margin: 8pt 0; font-size: 10pt; }',
    'th { background: #f0f0f0; border: 1px solid #999; padding: 4pt 6pt; text-align: left; font-weight: bold; }',
    'td { border: 1px solid #ccc; padding: 4pt 6pt; vertical-align: top; }',
    # Wide tables get smaller font/padding and fixed table-layout so
    # WeasyPrint distributes the available landscape width evenly across
    # all columns instead of letting any single column's content push the
    # table wider than the page (table-layout: auto sizes columns by
    # content, which is exactly the behavior that let columns push past
    # the page edge in the first place).
    'div[style*="page: wide-table"] table { table-layout: fixed; font-size: 9pt; word-wrap: break-word; overflow-wrap: break-word; }',
    'div[style*="page: wide-table"] th, div[style*="page: wide-table"] td { padding: 3pt 4pt; }',
    'blockquote { margin: 6pt 0 6pt 24pt; border-left: 2pt solid #999; padding-left: 8pt; }',
    'figure { margin: 8pt 0; }',
    'figcaption { font-size: 9pt; color: #555; margin-top: 3pt; }',
    'img { max-width: 100%; height: auto; }',
    '.equation { font-style: italic; }',
]
css = ' '.join(css_rules)

full_html = (
    '<!DOCTYPE html><html lang="en"><head><meta charset="UTF-8"/>'
    '<title>' + doc_title + '</title>'
    '<style>' + css + '</style></head><body>'
    + ''.join(html_parts)
    + '</body></html>'
)

tmp_html = output_path + '.html'
with open(tmp_html, 'w', encoding='utf-8') as f:
    f.write(full_html)

if data.get('htmlOnly'):
    with open(output_path, 'w', encoding='utf-8') as f:
        f.write(full_html)
    print('ok')
    sys.exit(0)

import traceback as _tb

def _find_table_wrapper_culprit(html_source):
    # Best-effort localization: find which <table>...</table> block in the
    # source HTML has zero real <tr> rows post-render, which is the only
    # known trigger for WeasyPrint's box-tree 'Table wrapper without a
    # table' error. Returns a short excerpt for the error message.
    for m in re.finditer(r'<table[^>]*>.*?</table>', html_source, re.DOTALL):
        frag = m.group(0)
        if not re.search(r'<tr[s>]', frag):
            return frag[:300]
    return None

from weasyprint import HTML
from weasyprint.formatting_structure import boxes as _wp_boxes

# WeasyPrint bug workaround: when a table's rendered box tree is fragmented
# across a page break in a certain way, the tagged-PDF builder's
# get_wrapped_table() can find zero TableBox children on a wrapper box and
# raise 'Table wrapper without a table' (a case the WeasyPrint authors
# themselves marked '# pragma: no cover' as believed-impossible, but it is
# reachable with real multi-table, multi-page documents). Rather than
# aborting the whole render, patch this one lookup to fall back to a synthetic
# empty TableBox for that fragment -- the table's actual rows are still fully
# tagged wherever the real TableBox fragment lives; this only prevents the
# crash on wrapper fragments that carry no rows of their own (e.g. a
# continuation wrapper WeasyPrint created for pagination bookkeeping).
def _patched_get_wrapped_table(self):
    for child in self.children:
        if isinstance(child, _wp_boxes.TableBox):
            return child
    synthetic = _wp_boxes.TableBox.anonymous_from(self, [])
    synthetic.is_table_wrapper = False
    return synthetic

_wp_boxes.ParentBox.get_wrapped_table = _patched_get_wrapped_table

# Second WeasyPrint bug, found on real large multi-page tables (confirmed on
# a 27-row and a 10-row table in a real document): on the LAST page a large
# table fragments onto, WeasyPrint can emit a page-local "table wrapper" box
# whose only child is a TableCaptionBox -- a genuine visible caption
# fragment, but with NO TableBox sibling on that page (all its actual rows
# already rendered on the prior page). The crash-avoidance patch above
# still fires for this case since there's no real TableBox to return, and
# the caller (weasyprint/pdf/tags.py _build_box_tree, tag == 'Table' branch)
# then builds a struct element containing only that orphan Caption -- an
# empty /Table node in the accessibility tree with the real row/cell
# content silently missing (though the caption text does render on the
# page). This is NOT something break-inside/page-break-inside CSS can
# prevent -- these are large tables that MUST span multiple pages by design
# (forcing them onto one page would overflow it), and the orphan-caption
# fragment is a WeasyPrint pagination artifact independent of table size.
# Fixed below by folding into the combined _build_box_tree patch: when a
# box is a table wrapper with no real TableBox child, skip emitting a
# /Table struct element for that fragment and recurse directly into its
# children (the orphan Caption) instead of nesting them under a fabricated,
# contentless /Table.
#
# WeasyPrint bug: _build_box_tree() reads element.attrib.get('scope') off each
# <th> ONLY to decide internally whether that header groups into row_headers
# or column_headers (for building the /Headers array on <td> cells) -- it
# NEVER writes the scope value back out as a /Scope attribute on the <th>
# struct element itself. Verified directly: even a minimal <th scope="row">
# test document produces a tagged PDF where every /TH has no /A/Scope entry
# at all. PDF/UA explicitly states Headers/ID linking does NOT substitute for
# Scope (see ISO 32000-2 14.8.4.8.3, Note 4: "The use of Headers does not
# negate the need for Scope") -- so Acrobat's Headers check correctly fails
# even though our Headers/ID linking (which WeasyPrint DOES emit) is present.
# Patch: wrap the whole recursive tag-builder so that immediately after it
# creates a struct element for a <th>, we also set element['A'] = {'O':
# '/Table', 'S': '/Row' or '/Column'} based on the exact same attrib lookup
# WeasyPrint itself already performs, so Acrobat's Headers/Scope check has a
# real Scope value to find -- without touching any other behavior of the
# original recursive builder (delegates to it entirely, just augments the
# yielded TH elements before they're consumed by the caller). Both fixes are
# combined into one _build_box_tree wrapper since only one function can be
# installed at weasyprint.pdf.tags._build_box_tree.
import weasyprint.pdf.tags as _wp_tags
import pydyf as _pydyf

_original_build_box_tree = _wp_tags._build_box_tree

def _patched_build_box_tree(box, parent, pdf, page_number, nums, links, tags):
    is_orphan_table_wrapper = (
        getattr(box, 'is_table_wrapper', False)
        and not any(isinstance(c, _wp_boxes.TableBox) for c in box.children)
    )
    if is_orphan_table_wrapper:
        for child in box.children:
            yield from _patched_build_box_tree(
                child, parent, pdf, page_number, nums, links, tags)
        return
    for element in _original_build_box_tree(box, parent, pdf, page_number, nums, links, tags):
        try:
            if element.get('S') == '/TH' and box.element is not None:
                scope_attr = box.element.attrib.get('scope')
                pdf_scope = 'Row' if scope_attr == 'row' else 'Column'
                element['A'] = _pydyf.Dictionary({'O': '/Table', 'Scope': f'/{pdf_scope}'})
        except Exception:
            pass
        yield element

_wp_tags._build_box_tree = _patched_build_box_tree

try:
    HTML(filename=tmp_html).write_pdf(output_path, pdf_tags=True)
except ValueError as wp_val_err:
    # 'Table wrapper without a table' is a WeasyPrint box-tree edge case in
    # the tagged-PDF code path. Do NOT silently fall back to an untagged
    # render -- that ships a PDF that LOOKS successful (HTTP 200) but has
    # no StructTreeRoot at all, which is worse than failing loudly. Surface
    # the real cause so it can be fixed at the source instead of masked.
    culprit = _find_table_wrapper_culprit(full_html) if 'table' in str(wp_val_err).lower() else None
    try: os.unlink(tmp_html)
    except: pass
    detail = (' Suspect table fragment: ' + culprit) if culprit else ''
    raise RuntimeError('WeasyPrint tagged-PDF generation failed: ' + str(wp_val_err) + detail)
except Exception as wp_err:
    try: os.unlink(tmp_html)
    except: pass
    raise RuntimeError('WeasyPrint failed: ' + str(wp_err) + ' | ' + _tb.format_exc()[-500:])

# Post-pass: set DisplayDocTitle, and VERIFY WeasyPrint actually produced a
# real tagged structure. If pdf_tags=True silently produced a PDF with no
# StructTreeRoot (no exception raised, but tagging didn't happen), fail
# loudly here instead of returning an untagged PDF as if it succeeded --
# that mismatch (HTTP 200 but no real tags) is exactly what caused the
# 'same report every time' confusion. Better to error than lie.
import pikepdf
pp = pikepdf.open(output_path, allow_overwriting_input=True)
if '/StructTreeRoot' not in pp.Root:
    pp.close()
    raise RuntimeError(
        'WeasyPrint produced a PDF with no StructTreeRoot (tagging silently '
        'did not happen despite pdf_tags=True and no exception). This PDF '
        'would fail every Acrobat tag check. Aborting instead of returning '
        'a falsely-successful untagged file.'
    )
if '/ViewerPreferences' not in pp.Root:
    pp.Root['/ViewerPreferences'] = pikepdf.Dictionary()
pp.Root['/ViewerPreferences']['/DisplayDocTitle'] = pikepdf.Boolean(True)

# Universal overflow backstop: verify no rendered content (table borders,
# text, images) actually extends past the printable page bounds, on EVERY
# page, regardless of what caused it. This is deliberately independent of
# the wide-table fix above -- that fix targets one known cause (8+ column
# tables); this check catches ANY cause (a long unbroken URL, an oversized
# image, a future regression, a table width bug this code doesn't know
# about yet). Found via a real user-reported bug: a 15-column nutrition
# table rendered with columns pushed off the right edge of a portrait
# page with WeasyPrint raising no exception and no warning -- the PDF
# looked like a normal HTTP 200 success while silently dropping columns
# of data. Confirmed on that exact buggy output that table border/line
# drawings are the most reliable signal (they extend to the cell's true,
# unclipped geometry -- x1=918pt on a 612pt-wide page in the real case),
# more reliable than text word bboxes alone (renderers can clip glyphs
# at the page edge, masking the true overflow extent).
_OVERFLOW_TOLERANCE_PT = 3.0  # small allowance for antialiasing/rounding, not a loophole for real overflow
import fitz as _fitz_overflow_check
_overflow_doc = _fitz_overflow_check.open(output_path)
_overflow_findings = []
for _pg_idx, _pg in enumerate(_overflow_doc):
    _mb = _pg.mediabox
    _page_w, _page_h = _mb.width, _mb.height
    _max_x1, _worst_kind = 0.0, None
    # Table borders / lines / rects -- the most reliable overflow signal.
    for _d in _pg.get_drawings():
        _r = _d['rect']
        if _r.x1 > _max_x1:
            _max_x1, _worst_kind = _r.x1, 'drawing'
    # Text word boxes.
    for _w in _pg.get_text('words'):
        if _w[2] > _max_x1:
            _max_x1, _worst_kind = _w[2], 'text'
    # Placed images.
    for _img in _pg.get_images():
        for _r in _pg.get_image_rects(_img[0]):
            if _r.x1 > _max_x1:
                _max_x1, _worst_kind = _r.x1, 'image'
    if _max_x1 > _page_w + _OVERFLOW_TOLERANCE_PT:
        _overflow_findings.append(
            f'page {_pg_idx + 1}: {_worst_kind} extends to x={_max_x1:.1f}pt on a {_page_w:.0f}pt-wide page '
            f'(overflow of {_max_x1 - _page_w:.1f}pt)'
        )
_overflow_doc.close()
if _overflow_findings:
    pp.close()
    raise RuntimeError(
        'Overflow backstop: rendered content extends past the printable page on '
        + str(len(_overflow_findings)) + ' page(s) -- ' + '; '.join(_overflow_findings)
        + '. Aborting instead of returning a PDF that silently clips or drops content.'
    )

# PDF/UA-1 requires the document Catalog to contain a /Metadata key pointing
# to an XMP metadata stream (ISO 14289-1:2014 clause 7.1, test 8; also ISO
# 32000-1:2008 14.3.2). Confirmed via an independent, spec-based validator
# (veraPDF, PDF/UA-1 profile) run directly against a real generated PDF:
# 105/106 rules and 173,431/173,432 individual checks passed -- the ONE
# failing check across the entire document was exactly this missing
# Metadata stream, not Headers/Scope/Regularity (all of which passed
# cleanly under veraPDF, validating the three earlier fixes were correct
# and complete -- this is a separate, previously-undiscovered gap).
# WeasyPrint does not write a document-level XMP stream by default. Fix:
# use pikepdf's high-level metadata API (handles correct XMP packet framing,
# namespaces, and PDF/UA identification schema) to set the title and load
# the standard PDF/UA-1 identification extension schema.
with pp.open_metadata() as _pp_meta:
    _pp_meta.load_from_docinfo(pp.docinfo, delete_missing=False)
    if not _pp_meta.get('dc:title'):
        _pp_meta['dc:title'] = doc_title
    _pp_meta['pdfuaid:part'] = '1'
if '/MarkInfo' not in pp.Root:
    pp.Root['/MarkInfo'] = pikepdf.Dictionary()
pp.Root['/MarkInfo']['/Marked'] = pikepdf.Boolean(True)
if '/Info' not in pp.trailer:
    pp.trailer['/Info'] = pikepdf.Dictionary()
pp.trailer['/Info']['/Title'] = pikepdf.String(doc_title)

# ---------------------------------------------------------------------------
# Table Headers repair pass (fixes Acrobat "Headers" check under Tables).
#
# WeasyPrint's tagged-PDF builder (pdf/tags.py) computes each table's
# TH->TD /Headers associations PER STRUCT-TREE Table FRAGMENT: when one HTML
# <table> is split across a page boundary (or its own <thead> lives in a
# different fragment than data rows further down), the header-row lookup
# only sees the rows present in that fragment. Rows in a later fragment --
# or rows following an in-body "section label" row like
# <th colspan="3" scope="rowgroup">Section Title</th> -- end up with a TD
# /Headers array present but EMPTY, since no TH shares that fragment. Acrobat
# correctly flags this as a failed Headers check even though TH/TD tagging
# itself is otherwise correct.
#
# Fix: walk the struct tree in document order maintaining a running map of
# "current column headers" (col_idx -> TH /ID). Refresh the map whenever a
# TR is encountered whose cells are ALL /TH (a genuine multi-column header
# row, e.g. from <thead>). Any /TD encountered afterwards (in any table
# fragment) with an empty /Headers array gets backfilled from the running
# map, matched by its position among sibling cells in its own row. This
# survives WeasyPrint splitting one HTML table into multiple sibling /Table
# struct elements, since the header row and the orphaned data rows are still
# visited in the same document order.
# ---------------------------------------------------------------------------
def _pp_get_S(elem):
    s = elem.get('/S')
    return str(s) if s is not None else None

def _pp_get_kids(elem):
    kids = elem.get('/K')
    if kids is None:
        return []
    if isinstance(kids, pikepdf.Array):
        return [k for k in kids if isinstance(k, pikepdf.Dictionary)]
    if isinstance(kids, pikepdf.Dictionary):
        return [kids]
    return []

def _pp_get_attr(elem, create=False):
    attrs = elem.get('/A')
    if attrs is None:
        if create:
            d = pikepdf.Dictionary({'/O': pikepdf.Name('/Table'), '/Headers': pikepdf.Array([])})
            elem['/A'] = d
            return elem['/A']
        return None
    if isinstance(attrs, pikepdf.Array):
        for a in attrs:
            if isinstance(a, pikepdf.Dictionary):
                return a
        if create:
            d = pikepdf.Dictionary({'/O': pikepdf.Name('/Table'), '/Headers': pikepdf.Array([])})
            attrs.append(d)
            return attrs[-1]
        return None
    if isinstance(attrs, pikepdf.Dictionary):
        return attrs
    return None

_pp_current_headers = {}
_pp_headers_fixed = 0

def _pp_visit(elem):
    global _pp_current_headers, _pp_headers_fixed
    s = _pp_get_S(elem)
    if s == '/TR':
        cells = _pp_get_kids(elem)
        tags = [_pp_get_S(c) for c in cells]
        if cells and len(cells) > 1 and all(t == '/TH' for t in tags):
            new_map = {}
            for ci, c in enumerate(cells):
                idv = c.get('/ID')
                if idv is not None:
                    new_map[ci] = str(idv)
            if new_map:
                _pp_current_headers = new_map
        else:
            for ci, c in enumerate(cells):
                if _pp_get_S(c) != '/TD':
                    continue
                attrs = _pp_get_attr(c)
                current = attrs.get('/Headers') if attrs else None
                current_len = len(current) if current is not None else 0
                if current_len > 0:
                    continue
                th_id = _pp_current_headers.get(ci)
                if th_id is None:
                    continue
                attrs = _pp_get_attr(c, create=True)
                attrs['/Headers'] = pikepdf.Array([pikepdf.String(th_id)])
                _pp_headers_fixed += 1
        return
    for k in _pp_get_kids(elem):
        _pp_visit(k)

_pp_st = pp.Root['/StructTreeRoot']
for _pp_k in _pp_get_kids(_pp_st):
    _pp_visit(_pp_k)
print(f'headers-repair: fixed {_pp_headers_fixed} TD elements', file=sys.stderr)

# Safety net: verify every /TH actually got a /Scope from the monkeypatch
# above. If WeasyPrint's internal struct-tree shape ever changes such that
# the patched _build_box_tree stops firing for some TH (e.g. a future
# WeasyPrint version restructures how table cells are yielded), backfill any
# TH missing /A/S here using the same running-header-row logic already used
# for TD /Headers, rather than silently shipping a PDF that fails the
# Acrobat Headers check again with no visible signal.
_pp_th_total = 0
_pp_th_missing_scope = 0

def _pp_verify_scope(elem, in_header_row=False):
    global _pp_th_total, _pp_th_missing_scope
    s = _pp_get_S(elem)
    if s == '/TR':
        cells = _pp_get_kids(elem)
        tags = [_pp_get_S(c) for c in cells]
        all_th = bool(cells) and all(t == '/TH' for t in tags)
        for ci, c in enumerate(cells):
            if _pp_get_S(c) != '/TH':
                continue
            _pp_th_total += 1
            attrs = _pp_get_attr(c)
            has_scope = attrs is not None and '/Scope' in attrs
            if not has_scope:
                _pp_th_missing_scope += 1
                fallback_scope = 'Column' if (all_th or ci == 0) else 'Column'
                attrs = _pp_get_attr(c, create=True)
                attrs['/Scope'] = pikepdf.Name('/' + fallback_scope)
        return
    for k in _pp_get_kids(elem):
        _pp_verify_scope(k)

for _pp_k in _pp_get_kids(_pp_st):
    _pp_verify_scope(_pp_k)
print(f'scope-verify: {_pp_th_total} TH total, {_pp_th_missing_scope} were missing /Scope and backfilled', file=sys.stderr)
if _pp_th_total > 0 and _pp_th_missing_scope == _pp_th_total:
    print('scope-verify WARNING: monkeypatch appears to have not fired at all (100% missing) -- check WeasyPrint version compatibility', file=sys.stderr)

# CRITICAL gap, confirmed by direct inspection of weasyprint/pdf/tags.py
# source (zero occurrences of "IDTree" anywhere in that module): WeasyPrint
# assigns a unique /ID byte string directly on each /TH struct element, and
# writes /Headers arrays on /TD cells that reference those ID strings -- but
# it NEVER builds or attaches the /IDTree name tree that PDF/UA (ISO 32000-2
# 14.7.3.4, via the general name-tree mechanism in 7.9.6) requires on
# StructTreeRoot for those IDs to be considered resolvable. Confirmed via a
# real generated PDF: 400/400 TH have unique, non-colliding /ID values, and
# all 1,025 /Headers references correctly resolve to one of those IDs when
# walked directly -- yet StructTreeRoot has no /IDTree key at all. Acrobat's
# accessibility checker validates Headers/ID resolution through /IDTree, not
# by walking the struct tree the way our own diagnostics do, so it correctly
# flags every single Headers reference as unresolvable even though the
# struct tree itself is fully self-consistent. This is almost certainly the
# real, final cause of the persistent "Headers" failure -- the /Scope fix
# and the colspan fix were both real, necessary bugs, but neither could ever
# make Acrobat's Headers check pass while /IDTree was missing entirely.
# Fix: collect every struct element that has an /ID (currently just /TH),
# build a proper sorted name tree (PDF name trees require key-sorted /Names
# arrays alternating key/value), and attach it as StructTreeRoot/IDTree.
_pp_id_entries = []

def _pp_collect_ids(elem):
    if isinstance(elem, pikepdf.Dictionary) and '/ID' in elem:
        _pp_id_entries.append((bytes(elem.ID), elem))
    for k in _pp_get_kids(elem):
        _pp_collect_ids(k)

for _pp_k in _pp_get_kids(_pp_st):
    _pp_collect_ids(_pp_k)

if _pp_id_entries:
    _pp_id_entries.sort(key=lambda pair: pair[0])
    _pp_names_array = pikepdf.Array()
    for _pp_id_bytes, _pp_elem in _pp_id_entries:
        _pp_names_array.append(pikepdf.String(_pp_id_bytes))
        _pp_names_array.append(_pp_elem)
    _pp_st['/IDTree'] = pikepdf.Dictionary({'/Names': _pp_names_array})
print(f'idtree-build: registered {len(_pp_id_entries)} struct element IDs into StructTreeRoot/IDTree', file=sys.stderr)

from large_document_tags import normalize_list_bodies
print(f'large-list-tags: repaired {normalize_list_bodies(pp)} list bodies', file=sys.stderr)

pp.save(output_path)
pp.close()

validate_rendered_images(full_html, output_path)
print('ok')
