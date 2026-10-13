/** Use the same finite page budget for the grid and every cell. AutoFit is
 * disabled by the caller so long content cannot expand the table off the page.
 */
export function wordTablePlan(table: Element) {
  const rows = Array.from(table.querySelectorAll("tr")).filter(row => row.closest("table") === table);
  if (table.querySelector("table")) throw new Error("Nested Word tables require review before export.");
  const occupied: number[] = [];
  const planned = rows.map((row, rowIndex) => {
    let column = 0;
    const cells = Array.from(row.children).filter(cell => /^(TD|TH)$/.test(cell.tagName));
    return cells.map(cell => {
      while ((occupied[column] || 0) > rowIndex) column++;
      const span = (name: string) => {
        const value = Number(cell.getAttribute(name) || 1);
        if (!Number.isInteger(value) || value < 1 || value > 24) throw new Error("Unsupported table span; review the table before export.");
        return value;
      };
      const colSpan = span("colspan"), rowSpan = span("rowspan"), start = column;
      for (let c = start; c < start + colSpan; c++) {
        if ((occupied[c] || 0) > rowIndex) throw new Error("Overlapping table cells; review the table before export.");
        occupied[c] = rowIndex + rowSpan;
      }
      column += colSpan;
      return { cell, start, colSpan, rowSpan };
    });
  });
  const columns = occupied.length;
  if (columns > 24) throw new Error("This table is too wide for readable Word pages. Split it into smaller tables before exporting.");
  const landscape = columns >= 7;
  const width = landscape ? 14000 : 9200;
  const widths = Array.from({ length: columns }, (_, i) => Math.floor(width / columns) + (i < width % columns ? 1 : 0));
  return { rows: planned, columns, landscape, width, widths };
}
