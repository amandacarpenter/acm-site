import type { ReactNode } from "react";
import { Link } from "wouter";

export interface BlogResource {
  label: string;
  href: string;
  publisher: string;
  note: string;
}

export interface RelatedGuide {
  id: string;
  title: string;
}

export interface BlogPostContent {
  body: ReactNode;
  resources: BlogResource[];
  relatedGuides: RelatedGuide[];
  cta: { heading: string; body: string; action: string };
}

/* ------------------------------------------------------------------ */
/* Small prose primitives so every article shares the same typography. */
/* ------------------------------------------------------------------ */

function H2({ id, children }: { id: string; children: ReactNode }) {
  return (
    <h2 id={id} className="mt-12 mb-4 text-2xl sm:text-[1.75rem] font-bold text-[#111827] leading-snug scroll-mt-28">
      {children}
    </h2>
  );
}

function H3({ children }: { children: ReactNode }) {
  return <h3 className="mt-8 mb-3 text-lg font-bold text-[#0f766e] leading-snug">{children}</h3>;
}

function P({ children }: { children: ReactNode }) {
  return <p className="mb-5 text-[1.0625rem] leading-[1.75] text-gray-800">{children}</p>;
}

function UL({ children }: { children: ReactNode }) {
  return (
    <ul className="mb-6 pl-5 list-disc space-y-2 text-[1.0625rem] leading-[1.7] text-gray-800 marker:text-[#0f766e]">
      {children}
    </ul>
  );
}

function OL({ children }: { children: ReactNode }) {
  return (
    <ol className="mb-6 pl-5 list-decimal space-y-3 text-[1.0625rem] leading-[1.7] text-gray-800 marker:text-[#0f766e] marker:font-bold">
      {children}
    </ol>
  );
}

/** Inline citation to an external, authoritative source. */
function Cite({ href, children }: { href: string; children: string }) {
  return (
    <a
      href={href}
      target="_blank"
      rel="noopener noreferrer"
      aria-label={`${children} (opens in a new tab)`}
      className="font-semibold text-[#0f766e] underline underline-offset-2 hover:text-[#115e59] focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[#0f766e]"
    >
      {children}
    </a>
  );
}

/** Inline link to another page on remedy508.com. */
function Internal({ href, children }: { href: string; children: ReactNode }) {
  return (
    <Link href={href} className="font-semibold text-[#0f766e] underline underline-offset-2 hover:text-[#115e59] focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[#0f766e]">
      {children}
    </Link>
  );
}

function Callout({ title, children }: { title: string; children: ReactNode }) {
  return (
    <div className="my-8 border border-[#0f766e]/20 bg-gray-50 px-5 py-4">
      <p className="text-sm font-bold uppercase tracking-wide text-[#0f766e] mb-2">{title}</p>
      <div className="text-[1rem] leading-relaxed text-gray-800 [&>p:last-child]:mb-0">{children}</div>
    </div>
  );
}

/**
 * A content-bearing editorial figure built from HTML and CSS rather than a
 * decorative illustration. Each row states what a checker can decide on its
 * own and what a person still has to decide.
 */
function DetectionTable({
  caption,
  rows,
}: {
  caption: string;
  rows: { item: string; automated: string; human: string }[];
}) {
  return (
    <figure className="my-8">
      <div className="overflow-x-auto border border-gray-200">
        <table className="w-full border-collapse text-left text-[0.95rem]">
          <caption className="sr-only">{caption}</caption>
          <thead>
            <tr className="bg-[#3a485b] text-white">
              <th scope="col" className="px-4 py-3 font-bold">
                What you are checking
              </th>
              <th scope="col" className="px-4 py-3 font-bold">
                A tool can decide
              </th>
              <th scope="col" className="px-4 py-3 font-bold">
                A person must decide
              </th>
            </tr>
          </thead>
          <tbody>
            {rows.map((row, index) => (
              <tr key={row.item} className={index % 2 === 1 ? "bg-gray-50" : "bg-white"}>
                <th scope="row" className="px-4 py-3 align-top font-semibold text-[#111827]">
                  {row.item}
                </th>
                <td className="px-4 py-3 align-top text-gray-800">{row.automated}</td>
                <td className="px-4 py-3 align-top text-gray-800">{row.human}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
      <figcaption className="mt-2 text-sm text-gray-700">{caption}</figcaption>
    </figure>
  );
}

/* ------------------------------------------------------------------ */
/* Article bodies                                                      */
/* ------------------------------------------------------------------ */

const checkerDifferences: BlogPostContent = {
  body: (
    <>
      <P>
        You run a PDF through one accessibility checker and it reports four issues. You run the same
        file through a second tool and it reports nineteen. Nothing about the document changed
        between the two runs, so one of the tools must be wrong.
      </P>
      <P>
        Usually neither is. The two tools are answering different questions, against different
        models of the same file, with different ideas about what counts as a finding. Once you can
        name those differences, a disagreement stops being noise and becomes one of the more useful
        signals you get during a review.
      </P>

      <H2 id="not-the-same-question">The tools are not asking the same question</H2>
      <P>
        The W3C Web Accessibility Initiative maintains a list of well over one hundred evaluation
        tools, and its guidance on{" "}
        <Cite href="https://www.w3.org/WAI/test-evaluate/tools/selecting/">
          selecting web accessibility evaluation tools
        </Cite>{" "}
        is blunt about the tradeoff: tools differ in the guidelines they check, the formats they
        support, and how they report what they find. Two products can both be accurate and still
        produce different reports, because they were built to serve different reviews.
      </P>
      <P>
        Broadly, a document checker is doing four things: parsing the file into a structure it can
        reason about, running a rule set against that structure, deciding how confident it is in
        each result, and then choosing how to present it. Each of those four steps is a place where
        two tools can legitimately diverge.
      </P>

      <H3>Different rule sets</H3>
      <P>
        Some checkers test against{" "}
        <Cite href="https://www.w3.org/WAI/standards-guidelines/wcag/">WCAG 2</Cite> success
        criteria. Some test against PDF/UA, the ISO standard for universally accessible PDF that the{" "}
        <Cite href="https://pdfa.org/resource/pdfua-in-a-nutshell/">PDF Association summarises</Cite>{" "}
        as a full definition of the file-format requirements for tagged, accessible PDF. Some test
        against an internal product checklist that blends both. A file can satisfy one framing and
        fall short on another, and the report will reflect whichever framing the tool was built
        around.
      </P>

      <H3>Different document models</H3>
      <P>
        A PDF is not a single tidy structure. There is the page content, the tag tree that describes
        reading order and semantics, the object hierarchy, and, in many real-world files, several
        inconsistent generations of all three. A tool that reads the tag tree first will report
        heading problems differently from a tool that reconstructs headings from font sizes and
        spacing. Neither is cheating. They are looking at different layers of the same document.
      </P>

      <H3>Different thresholds for a finding</H3>
      <P>
        One tool flags a suspicious alt text string as a failure. Another files it under manual
        review. A third stays silent because it only reports missing alt text, not questionable alt
        text. The underlying observation can be identical while the severity label is completely
        different, and severity labels are what people usually compare.
      </P>

      <H3>Different scope</H3>
      <P>
        Page-level checks, document-level checks, and sampled checks all produce different totals. A
        tool that reports one finding per affected element will always look harsher than a tool that
        groups every instance of the same problem into a single line item. Before comparing two
        numbers, check whether they count the same way.
      </P>

      <Callout title="A quick sanity check">
        <p>
          When two reports disagree, count issue types rather than issue instances. Type counts
          usually converge much more closely than raw totals, and the remaining gaps are the ones
          worth investigating.
        </p>
      </Callout>

      <H2 id="what-tools-cannot-decide">What no checker can settle on its own</H2>
      <P>
        There is a second, more important reason for divergence: a meaningful share of accessibility
        is not machine-decidable at all. WAI's guidance on evaluation tools is explicit that
        automated tools cannot determine accessibility on their own, and its{" "}
        <Cite href="https://www.w3.org/WAI/test-evaluate/conformance/wcag-em/">
          WCAG-EM evaluation methodology
        </Cite>{" "}
        is built around structured human review for exactly that reason. The federal guidance for
        US agencies takes the same position: the{" "}
        <Cite href="https://www.section508.gov/test/testing-overview/">
          Section508.gov overview of testing methods
        </Cite>{" "}
        pairs automated tooling with manual and assistive-technology testing rather than treating
        any one of them as sufficient.
      </P>

      <DetectionTable
        caption="Where automated checks are reliable, and where a reviewer has to make the call."
        rows={[
          {
            item: "Alternative text",
            automated: "Whether an alt attribute or /Alt entry exists at all.",
            human: "Whether the description conveys the purpose of the image in context.",
          },
          {
            item: "Headings",
            automated: "Whether heading tags exist and whether levels skip.",
            human: "Whether the headings describe the actual structure of the content.",
          },
          {
            item: "Tables",
            automated: "Whether table tags, header cells, and associations are present.",
            human: "Whether the associations match how the table is meant to be read.",
          },
          {
            item: "Reading order",
            automated: "Whether a tag order exists and where it is obviously broken.",
            human: "Whether the order makes sense to someone hearing it read aloud.",
          },
          {
            item: "Link text",
            automated: "Whether link text is empty or a bare URL.",
            human: "Whether the text describes where the link actually goes.",
          },
        ]}
      />

      <H2 id="how-to-use-disagreement">How to use a disagreement productively</H2>
      <OL>
        <li>
          <strong>Normalise the inputs.</strong> Confirm both tools received the same file. A
          re-exported or re-saved copy is a different document, and export settings routinely change
          the tag tree.
        </li>
        <li>
          <strong>Map findings to criteria, not to labels.</strong> Line the two reports up by WCAG
          success criterion or PDF/UA requirement. Vendor severity names rarely translate directly.
        </li>
        <li>
          <strong>Treat the union as your work queue.</strong> If either tool found something real,
          it is real. The union of two reports is a better starting list than the intersection.
        </li>
        <li>
          <strong>Verify the contested items by hand.</strong> Open the tag tree, or read the page
          with a screen reader. Contested findings are usually the interesting ones, and they are
          where a human decision changes the outcome.
        </li>
        <li>
          <strong>Record why you resolved it that way.</strong> Six months later, the reason matters
          more than the score, especially if someone asks how a document was evaluated.
        </li>
      </OL>

      <H2 id="picking-a-baseline">Pick one baseline, then add tools deliberately</H2>
      <P>
        The practical answer is not to chase agreement between tools. It is to choose one primary
        test method as your baseline, document it, and then use additional tools to widen coverage
        rather than to arbitrate. US federal teams have a ready-made model for this in the{" "}
        <Cite href="https://ictbaseline.access-board.gov/">Section 508 ICT Testing Baseline</Cite>,
        which describes a consistent, repeatable set of test procedures. Adobe documents its own
        approach for PDF in the Acrobat guidance on{" "}
        <Cite href="https://helpx.adobe.com/acrobat/using/create-verify-pdf-accessibility.html">
          creating and verifying PDF accessibility
        </Cite>
        . Either can anchor a review as long as the choice is deliberate and written down.
      </P>
      <P>
        A second tool is still worth running. It just plays a different role: not a tiebreaker, but
        a second pass over a file that no single rule set fully describes. If you want a fast,
        no-signup starting point, the{" "}
        <Internal href="/accessibility-checker">free Remedy508 accessibility checker</Internal>{" "}
        reports machine-detectable structure issues in PDFs and Word files and keeps document
        contents in your browser.
      </P>
    </>
  ),
  resources: [
    {
      label: "Selecting Web Accessibility Evaluation Tools",
      href: "https://www.w3.org/WAI/test-evaluate/tools/selecting/",
      publisher: "W3C Web Accessibility Initiative",
      note: "What evaluation tools can and cannot do, and the features to compare when choosing one.",
    },
    {
      label: "Web Accessibility Evaluation Tools List",
      href: "https://www.w3.org/WAI/test-evaluate/tools/list/",
      publisher: "W3C Web Accessibility Initiative",
      note: "A filterable directory of evaluation tools, useful for seeing how differently they scope their checks.",
    },
    {
      label: "WCAG-EM: Website Accessibility Conformance Evaluation Methodology",
      href: "https://www.w3.org/WAI/test-evaluate/conformance/wcag-em/",
      publisher: "W3C Web Accessibility Initiative",
      note: "A structured evaluation procedure that combines tooling with human review.",
    },
    {
      label: "Overview of Testing Methods for 508 Conformance",
      href: "https://www.section508.gov/test/testing-overview/",
      publisher: "Section508.gov",
      note: "How US federal guidance combines automated, manual, and assistive-technology testing.",
    },
    {
      label: "PDF/UA in a Nutshell",
      href: "https://pdfa.org/resource/pdfua-in-a-nutshell/",
      publisher: "PDF Association",
      note: "A short explanation of ISO 14289 and what it requires of a tagged PDF.",
    },
    {
      label: "Create and verify PDF accessibility (Acrobat Pro)",
      href: "https://helpx.adobe.com/acrobat/using/create-verify-pdf-accessibility.html",
      publisher: "Adobe",
      note: "Adobe's own description of what its Full Check reports and what it leaves to manual review.",
    },
  ],
  relatedGuides: [
    { id: "running-acrobat-checker", title: "Running Acrobat's Accessibility Checker on your result" },
    {
      id: "how-to-check-your-output-is-accessible",
      title: "How to check that your output is actually accessible",
    },
    { id: "accessibility-101-wcag", title: "Accessibility 101: What WCAG 2.1 AA actually means" },
  ],
  cta: {
    heading: "Run a second opinion on one of your documents",
    body: "The free Remedy508 checker reports machine-detectable structure issues in PDFs and Word files. No account, no upload of document contents, no credits used.",
    action: "Open the free checker",
  },
};

const beyondPassingCheck: BlogPostContent = {
  body: (
    <>
      <P>
        A clean automated report feels like an ending. The bar turns green, the issue count reads
        zero, and the file looks ready to publish. That result is genuinely worth having. It is also
        a narrower claim than most people hear when they see it.
      </P>
      <P>
        What a passing automated check tells you is that a specific set of machine-detectable
        conditions was satisfied. What it does not tell you is whether the document makes sense when
        it is read aloud, navigated by keyboard, or reflowed on a small screen. Those are different
        questions, and they are the ones that decide whether the document actually works for
        someone.
      </P>

      <H2 id="what-green-covers">What a green result actually covers</H2>
      <P>
        Automated checks are very good at presence, absence, and structure. Does every image carry
        an alt entry. Is there a document title. Is a language set. Do heading levels descend
        without skipping. Are table cells tagged as header or data cells. These are exactly the
        checks that scale, and they catch the failures that appear most often in the wild. WebAIM's
        annual{" "}
        <Cite href="https://webaim.org/projects/million/">WebAIM Million</Cite> analysis of the top
        one million home pages keeps finding the same short list of detectable failure types
        dominating the results, year after year, which is a good argument for running the automated
        pass first.
      </P>
      <P>
        The limit is stated plainly in WAI's guidance on{" "}
        <Cite href="https://www.w3.org/WAI/test-evaluate/tools/selecting/">
          selecting evaluation tools
        </Cite>
        : automated tools cannot determine accessibility on their own, and results always need human
        interpretation. That is not a criticism of the tools. It is a description of the problem
        space.
      </P>

      <H2 id="four-things">Four things a passing report does not tell you</H2>

      <H3>1. Whether the alt text is useful</H3>
      <P>
        A checker can confirm that an alt entry exists. It cannot judge whether "image1.png",
        "chart", or "photo of a graph showing results" tells a reader what they need. WAI's guidance
        on{" "}
        <Cite href="https://www.w3.org/WAI/tips/writing/">writing for web accessibility</Cite> is a
        good calibration point: the description has to carry the purpose of the content in its
        context, which is a judgment about meaning, not markup. Our guide on{" "}
        <Internal href="/accessibility-guides/articles/writing-good-alt-text">writing good alt text</Internal> works
        through the common cases.
      </P>

      <H3>2. Whether the reading order matches the visual order</H3>
      <P>
        Tag order and visual layout can disagree completely while every automated rule still passes.
        Multi-column layouts, sidebars, pull quotes, and captions are the usual culprits. The only
        reliable test is to follow the tag order, or listen to the document, and confirm it tracks
        the way a sighted reader would move through the page. Acrobat's{" "}
        <Cite href="https://helpx.adobe.com/acrobat/using/touch-reading-order-tool-pdfs.html">
          Reading Order tool
        </Cite>{" "}
        is built for exactly this inspection.
      </P>

      <H3>3. Whether the table relationships are the right ones</H3>
      <P>
        Header cells can be tagged correctly and still be associated with the wrong cells. WCAG
        success criterion 1.3.1,{" "}
        <Cite href="https://www.w3.org/WAI/WCAG22/Understanding/info-and-relationships.html">
          Info and Relationships
        </Cite>
        , asks that the relationships conveyed visually are also available programmatically, and
        "available" is not the same as "correct". A person has to read the table and confirm the
        associations describe the data.
      </P>

      <H3>4. Whether the content itself is understandable</H3>
      <P>
        Link text that reads "click here", a form field whose visible label and programmatic name
        disagree, a colour-coded status that is never stated in words: some of these are partially
        detectable, and all of them are best confirmed by a person. This is why WAI's{" "}
        <Cite href="https://www.w3.org/WAI/test-evaluate/preliminary/">Easy Checks</Cite> guidance
        exists as a first manual review that anyone on a team can run.
      </P>

      <Callout title="A short human pass">
        <p>
          Read the document top to bottom with the tag tree or a screen reader. Check every image
          description, follow the tab order through any interactive elements, read one full row and
          one full column of each table, and confirm the document title and language are set. Ten to
          fifteen minutes on a typical file catches most of what automation leaves behind.
        </p>
      </Callout>

      <H2 id="how-to-talk-about-it">How to describe the result honestly</H2>
      <P>
        The wording matters more than teams expect, because a passing report often becomes a
        sentence in an email that someone else relies on later. Two phrasings that hold up:
      </P>
      <UL>
        <li>
          "This document passed automated structure checks. Manual review of alt text, reading
          order, and tables is complete or still outstanding."
        </li>
        <li>
          "No machine-detectable issues remain. Conformance has not been formally evaluated for this
          document."
        </li>
      </UL>
      <P>
        Both are accurate, both are useful to the next person, and neither promises a legal outcome.
        If you need to explain the underlying obligations to colleagues, Section508.gov's summary of{" "}
        <Cite href="https://www.section508.gov/manage/laws-and-policies/">
          IT accessibility laws and policies
        </Cite>{" "}
        is a more reliable reference than a tool's score.
      </P>

      <H2 id="where-this-leaves-you">Where this leaves you</H2>
      <P>
        Run the automated check first. It is fast, it is repeatable, and it removes the noisy
        failures that would otherwise dominate a manual review. Then spend your human attention on
        the four areas above, where judgment is the only thing that resolves the question. That
        sequence is what makes a document queue manageable without pretending the automated result
        is the whole answer.
      </P>
    </>
  ),
  resources: [
    {
      label: "Easy Checks: A First Review of Web Accessibility",
      href: "https://www.w3.org/WAI/test-evaluate/preliminary/",
      publisher: "W3C Web Accessibility Initiative",
      note: "A manual first-pass review that non-specialists can run without tooling.",
    },
    {
      label: "Writing for Web Accessibility",
      href: "https://www.w3.org/WAI/tips/writing/",
      publisher: "W3C Web Accessibility Initiative",
      note: "Practical guidance on descriptive text, link purpose, and clear language.",
    },
    {
      label: "Understanding Success Criterion 1.3.1: Info and Relationships",
      href: "https://www.w3.org/WAI/WCAG22/Understanding/info-and-relationships.html",
      publisher: "W3C Web Accessibility Initiative",
      note: "Why visual structure has to be available programmatically, with examples.",
    },
    {
      label: "Reading Order tool for PDFs (Acrobat Pro)",
      href: "https://helpx.adobe.com/acrobat/using/touch-reading-order-tool-pdfs.html",
      publisher: "Adobe",
      note: "How to inspect and correct the order in which a PDF is read out.",
    },
    {
      label: "The WebAIM Million",
      href: "https://webaim.org/projects/million/",
      publisher: "WebAIM",
      note: "An annual automated analysis of one million home pages, useful for seeing which failures dominate.",
    },
  ],
  relatedGuides: [
    { id: "writing-good-alt-text", title: "Writing good alt text: a quick guide" },
    {
      id: "how-to-check-your-output-is-accessible",
      title: "How to check that your output is actually accessible",
    },
    { id: "fixing-reading-order", title: "Fixing reading order in a remediated PDF" },
  ],
  cta: {
    heading: "Start with the automated pass",
    body: "Use the free checker to clear machine-detectable issues first, then spend your review time on the judgment calls that need a person.",
    action: "Open the free checker",
  },
};

const pdfTables: BlogPostContent = {
  body: (
    <>
      <P>
        Tables are where document accessibility stops being general advice and turns into structure
        work. A heading is a single tag. A table is a grid of relationships, and every one of those
        relationships has to survive the trip from your authoring tool into the PDF tag tree.
      </P>
      <P>
        This is also where automated checking is at its most and least useful at the same time. A
        tool can verify a great deal about a table's markup. It cannot verify that the markup
        describes the table you actually meant to publish.
      </P>

      <H2 id="what-a-table-needs">What an accessible PDF table needs</H2>
      <P>
        In a tagged PDF, a data table is a structure, not a picture of a grid. The{" "}
        <Cite href="https://pdfa.org/resource/tagged-pdf-best-practice-guide-syntax/">
          PDF Association's Tagged PDF Best Practice Guide
        </Cite>{" "}
        sets out the syntax in detail. In practice, five things have to be right.
      </P>
      <UL>
        <li>
          <strong>Real table tags.</strong> A Table element containing TR rows, with TH header cells
          and TD data cells. Text laid out in columns with tabs or spaces is not a table, no matter
          how it looks on the page.
        </li>
        <li>
          <strong>Header cells identified as headers.</strong> Every column header and, where the
          table has them, every row header must be a TH rather than a styled TD.
        </li>
        <li>
          <strong>Associations between headers and data.</strong> Simple tables use a Scope
          attribute of Row or Column. Complex tables need explicit Headers and ID associations so a
          screen reader can announce the right headers for each cell.
        </li>
        <li>
          <strong>Sensible row grouping.</strong> THead, TBody, and TFoot help when a table runs
          across pages, and they keep repeated header rows from being read as data.
        </li>
        <li>
          <strong>A caption or a summary where the table needs explaining.</strong> A Caption element
          gives the table a name. For genuinely complex tables, a plain-language explanation nearby
          is often more useful than any amount of markup.
        </li>
      </UL>
      <P>
        The underlying requirement is the same one that governs every other kind of structure. WCAG
        success criterion 1.3.1,{" "}
        <Cite href="https://www.w3.org/WAI/WCAG22/Understanding/info-and-relationships.html">
          Info and Relationships
        </Cite>
        , asks that relationships conveyed visually are also conveyed programmatically. WAI's{" "}
        <Cite href="https://www.w3.org/WAI/tutorials/tables/">tables tutorial</Cite> is written for
        HTML, but the model of headers, scope, and associated cells maps directly onto the PDF tag
        tree and is the clearest explanation of the concepts available.
      </P>

      <H2 id="where-tables-break">Where tables break</H2>

      <H3>Layout tables that were never data</H3>
      <P>
        Tables used purely to position content are a recurring problem. They add rows and columns
        that mean nothing when read aloud. If the grid carries no data relationships, it should not
        be tagged as a table.
      </P>

      <H3>Merged and split cells</H3>
      <P>
        Merged cells are legitimate, but they require ColSpan or RowSpan values that match the
        visual layout exactly. When a merge is faked visually, or when the span values drift out of
        sync with the grid, the announced position of every following cell can be wrong.
      </P>

      <H3>Tables that span pages</H3>
      <P>
        A long table split across three pages often becomes three unrelated tables in the tag tree,
        each losing its header association. This is one of the most common structural defects in
        converted reports.
      </P>

      <H3>Images of tables</H3>
      <P>
        A screenshot of a spreadsheet has no rows and no columns as far as the file is concerned. It
        has an alt entry at best. Data that matters should be re-created as a real table.
      </P>

      <H3>Headers that are only visual</H3>
      <P>
        Bold text with a shaded background reads as a header to a sighted user and as ordinary data
        to everyone else. This is the single most frequent table defect we see in documents that
        otherwise look well built.
      </P>

      <H2 id="what-tools-detect">What an automated checker can and cannot see</H2>
      <P>
        Automated table checking is genuinely strong on syntax. Adobe documents what its Full Check
        covers in the guidance on{" "}
        <Cite href="https://helpx.adobe.com/acrobat/using/create-verify-pdf-accessibility.html">
          creating and verifying PDF accessibility
        </Cite>
        , and open validators such as{" "}
        <Cite href="https://verapdf.org/">veraPDF</Cite> check file-format conformance against
        PDF/UA rules. What none of them do is read your data.
      </P>

      <DetectionTable
        caption="Table checks split cleanly into syntax, which tools verify, and meaning, which they cannot."
        rows={[
          {
            item: "Table tagging",
            automated: "Whether Table, TR, TH, and TD elements exist and nest correctly.",
            human: "Whether the content should have been a table at all.",
          },
          {
            item: "Header cells",
            automated: "Whether any TH cells are present in the table.",
            human: "Whether the right cells were marked as headers.",
          },
          {
            item: "Scope and associations",
            automated: "Whether Scope, Headers, and ID values are present and well formed.",
            human: "Whether each data cell points at the headers that actually describe it.",
          },
          {
            item: "Spans",
            automated: "Whether ColSpan and RowSpan produce a consistent grid.",
            human: "Whether the merged layout still reads sensibly cell by cell.",
          },
          {
            item: "Tables across pages",
            automated: "Whether separate Table elements exist.",
            human: "Whether they are one logical table that needs to be rejoined.",
          },
        ]}
      />

      <Callout title="The two-minute table review">
        <p>
          Pick the least obvious cell in the table. Read it out loud with the headers a screen reader
          would announce for it. If that sentence would let a listener place the value correctly,
          the associations are doing their job. Repeat for one merged cell and one cell on a
          continuation page.
        </p>
      </Callout>

      <H2 id="fixing-tables">Fixing tables in the right order</H2>
      <OL>
        <li>
          <strong>Fix it at the source when you can.</strong> A table built properly in Word or
          InDesign, with a designated header row, usually exports with most of its structure intact.
          Repairing the PDF afterwards is slower and more fragile.
        </li>
        <li>
          <strong>Establish the grid before the details.</strong> Get the table, rows, and cell
          count right first. Scope and header associations applied over a broken grid will not hold.
        </li>
        <li>
          <strong>Mark headers, then associate.</strong> Set TH cells, then apply Scope for simple
          tables or Headers and ID for anything with two header levels.
        </li>
        <li>
          <strong>Rejoin split tables.</strong> Merge continuation fragments into one Table element
          so the headers apply across the whole run.
        </li>
        <li>
          <strong>Re-run the checker, then read it.</strong> The tool confirms the syntax survived.
          Reading one row and one column confirms the meaning did.
        </li>
      </OL>
      <P>
        For federal document work, Section508.gov's guidance on{" "}
        <Cite href="https://www.section508.gov/create/pdfs/">creating accessible PDFs</Cite> includes
        authoring and testing steps that cover tables specifically. Our step-by-step guide on{" "}
        <Internal href="/accessibility-guides/articles/making-tables-accessible">making tables accessible</Internal>{" "}
        walks through the same work in the tools most teams already have, and the{" "}
        <Internal href="/accessibility-checker">free Remedy508 checker</Internal> will tell you
        quickly whether a PDF's tables are tagged and whether header associations are present.
      </P>
    </>
  ),
  resources: [
    {
      label: "Tables Tutorial",
      href: "https://www.w3.org/WAI/tutorials/tables/",
      publisher: "W3C Web Accessibility Initiative",
      note: "The clearest available explanation of header cells, scope, and complex table associations.",
    },
    {
      label: "Tagged PDF Best Practice Guide: Syntax",
      href: "https://pdfa.org/resource/tagged-pdf-best-practice-guide-syntax/",
      publisher: "PDF Association",
      note: "Reference syntax for tagged PDF structure elements, including tables.",
    },
    {
      label: "PDF/UA in a Nutshell",
      href: "https://pdfa.org/resource/pdfua-in-a-nutshell/",
      publisher: "PDF Association",
      note: "What ISO 14289 requires of an accessible PDF at the file-format level.",
    },
    {
      label: "Create Accessible PDFs",
      href: "https://www.section508.gov/create/pdfs/",
      publisher: "Section508.gov",
      note: "Authoring and testing guidance for PDFs used in US federal contexts.",
    },
    {
      label: "veraPDF",
      href: "https://verapdf.org/",
      publisher: "veraPDF Consortium",
      note: "Open-source PDF/A and PDF/UA validation, useful as an independent structural check.",
    },
  ],
  relatedGuides: [
    { id: "making-tables-accessible", title: "Making tables accessible" },
    { id: "fixing-reading-order", title: "Fixing reading order in a remediated PDF" },
    { id: "opening-remediated-pdf-acrobat", title: "Opening your remediated PDF in Adobe Acrobat" },
  ],
  cta: {
    heading: "Check whether your tables are tagged",
    body: "The free checker reports on PDF table tags and header associations, so you know which files need structure work before you open them.",
    action: "Open the free checker",
  },
};

const remediationWorkflow: BlogPostContent = {
  body: (
    <>
      <P>
        Most teams we talk to do not have a tooling problem. They have an ordering problem. Files
        arrive from a dozen sources, someone runs a check, the report is long, and the work stalls
        because nobody agreed what happens after the report.
      </P>
      <P>
        The workflow below is deliberately plain. Five stages, each with a clear exit condition, so
        a document can only be in one place at a time and anyone can pick it up.
      </P>

      <H2 id="stage-one">Stage one: triage with a fast check</H2>
      <P>
        Start by finding out what you have. Run every candidate file through a quick automated check
        and record three fields: whether the file is tagged at all, the count of machine-detectable
        issues, and how the document is used. That third field is the one teams skip, and it is the
        one that should drive priority. A syllabus that three hundred students open in week one
        outranks an archived memo with a worse score.
      </P>
      <P>
        The{" "}
        <Internal href="/accessibility-checker">free Remedy508 accessibility checker</Internal> is
        built for this stage: no account, no credits, and document contents stay in your browser.
        Whatever you use, keep the triage pass shallow. You are sorting, not fixing.
      </P>
      <Callout title="Exit condition">
        <p>Every file has a tagged or untagged flag, an issue count, and a priority tier.</p>
      </Callout>

      <H2 id="stage-two">Stage two: decide the repair path</H2>
      <P>
        Before anyone opens a tag tree, decide which of three paths each file takes.
      </P>
      <UL>
        <li>
          <strong>Fix at the source.</strong> If the original Word, PowerPoint, or InDesign file
          still exists, repairing there and re-exporting is almost always faster and produces
          cleaner structure. Our guide on{" "}
          <Internal href="/accessibility-guides/articles/save-word-doc-as-pdf">
            saving a Word doc as a PDF, and when not to
          </Internal>{" "}
          covers the export settings that matter.
        </li>
        <li>
          <strong>Remediate the PDF.</strong> When the source is gone, the work happens in the tag
          tree. This is the slowest path per file and the one to reserve for documents that justify
          it.
        </li>
        <li>
          <strong>Replace the format.</strong> Some documents should not be PDFs. A three-paragraph
          notice is better as a web page, and a data table is better as an accessible spreadsheet or
          an HTML table. Deciding this early saves the most time of any step in the workflow.
        </li>
      </UL>
      <Callout title="Exit condition">
        <p>Each file has an assigned path and an owner.</p>
      </Callout>

      <H2 id="stage-three">Stage three: repair structure in a fixed order</H2>
      <P>
        Structure work has a dependency chain. Doing it out of order means redoing it. This sequence
        holds up across most document types:
      </P>
      <OL>
        <li>
          <strong>Tags and reading order.</strong> Nothing else is stable until the document has a
          tag tree in the correct order. Acrobat's{" "}
          <Cite href="https://helpx.adobe.com/acrobat/using/touch-reading-order-tool-pdfs.html">
            Reading Order tool
          </Cite>{" "}
          is the standard place to do this, and our guide on{" "}
          <Internal href="/accessibility-guides/articles/fixing-reading-order">fixing reading order</Internal> walks
          through it.
        </li>
        <li>
          <strong>Headings.</strong> Correct levels, no skips, and headings that describe the actual
          sections. See{" "}
          <Internal href="/accessibility-guides/articles/heading-structure-matters">
            why heading structure matters
          </Internal>
          .
        </li>
        <li>
          <strong>Tables.</strong> Grid first, then header cells, then associations. Tables are the
          most expensive element to redo, so get them right before moving on.
        </li>
        <li>
          <strong>Images and alt text.</strong> Describe purpose, mark decorative images as
          artifacts, and give complex charts a longer description nearby.
        </li>
        <li>
          <strong>Links, lists, and language.</strong> Descriptive link text, real list structures,
          and a document language setting.
        </li>
        <li>
          <strong>Document properties.</strong> Title, language, and a title that displays instead
          of the filename. Small, fast, and frequently forgotten.
        </li>
      </OL>
      <Callout title="Exit condition">
        <p>An automated re-check returns no machine-detectable structural issues.</p>
      </Callout>

      <H2 id="stage-four">Stage four: verify with a person</H2>
      <P>
        This is the stage that turns a passing report into a usable document, and it is short. Read
        the document in tag order or with a screen reader. Check every image description against the
        surrounding text. Read one full row and one full column of each table. Tab through any form
        fields and confirm the labels announce correctly.
      </P>
      <P>
        If you need a structured method rather than a habit, WAI's{" "}
        <Cite href="https://www.w3.org/WAI/test-evaluate/conformance/wcag-em/">WCAG-EM</Cite>{" "}
        describes a repeatable evaluation procedure, and the{" "}
        <Cite href="https://ictbaseline.access-board.gov/">Section 508 ICT Testing Baseline</Cite>{" "}
        provides test procedures that federal teams can adopt directly. Section508.gov's{" "}
        <Cite href="https://www.section508.gov/test/documents/">
          electronic documents testing guidance
        </Cite>{" "}
        is the closest thing to an official checklist for document work specifically.
      </P>
      <Callout title="Exit condition">
        <p>
          A named reviewer has read the document and signed off, with any residual issues written
          down rather than left implicit.
        </p>
      </Callout>

      <H2 id="stage-five">Stage five: publish and record</H2>
      <P>
        Record what was done, by whom, with which method, and what remains open. This takes a minute
        per document and is the difference between a defensible process and a folder of files nobody
        can account for. Keep the remediated source file, not only the exported PDF, so the next
        revision does not start from zero.
      </P>
      <P>
        Section508.gov's overview of{" "}
        <Cite href="https://www.section508.gov/manage/laws-and-policies/">
          IT accessibility laws and policies
        </Cite>{" "}
        is a useful reference when you are deciding how much documentation your context calls for.
      </P>
      <Callout title="Exit condition">
        <p>The file is published and there is a record of how it was evaluated.</p>
      </Callout>

      <H2 id="the-backlog">What to do about the backlog</H2>
      <P>
        Almost nobody starts this workflow with an empty queue. Two things make a backlog tractable.
        First, sort by use rather than by score, so the documents people actually open get fixed
        first. Second, cap the work in progress. A team that finishes ten documents completely is
        further ahead than a team that has forty documents half-repaired, because half-repaired
        files carry no evidence and often get re-checked from scratch.
      </P>
      <P>
        The steady state matters more than the sprint. Once new documents enter through stage one
        automatically, the backlog stops growing, and that is usually the point at which the work
        starts feeling finite. If a file comes out of stage three still imperfect, our guide on{" "}
        <Internal href="/accessibility-guides/articles/what-to-do-if-not-perfect">
          what to do when remediation is not perfect
        </Internal>{" "}
        covers the judgment calls.
      </P>
    </>
  ),
  resources: [
    {
      label: "Electronic Documents: Testing and Requirements",
      href: "https://www.section508.gov/test/documents/",
      publisher: "Section508.gov",
      note: "Applicability, exceptions, and testing guidance for electronic documents.",
    },
    {
      label: "Create Accessible PDFs",
      href: "https://www.section508.gov/create/pdfs/",
      publisher: "Section508.gov",
      note: "Authoring and testing steps for PDFs, including source-file guidance.",
    },
    {
      label: "Section 508 ICT Testing Baseline",
      href: "https://ictbaseline.access-board.gov/",
      publisher: "US Access Board",
      note: "Repeatable test procedures you can adopt as your documented baseline method.",
    },
    {
      label: "WCAG-EM: Conformance Evaluation Methodology",
      href: "https://www.w3.org/WAI/test-evaluate/conformance/wcag-em/",
      publisher: "W3C Web Accessibility Initiative",
      note: "A structured procedure for evaluating and reporting on conformance.",
    },
    {
      label: "Create and verify PDF accessibility (Acrobat Pro)",
      href: "https://helpx.adobe.com/acrobat/using/create-verify-pdf-accessibility.html",
      publisher: "Adobe",
      note: "Adobe's reference for the repair and verification steps in stages three and four.",
    },
  ],
  relatedGuides: [
    { id: "fixing-reading-order", title: "Fixing reading order in a remediated PDF" },
    { id: "what-to-do-if-not-perfect", title: "What to do if the remediation isn't perfect" },
    {
      id: "how-to-check-your-output-is-accessible",
      title: "How to check that your output is actually accessible",
    },
  ],
  cta: {
    heading: "Put stage one to work today",
    body: "Triage a handful of documents with the free checker and see how many need source repair rather than PDF surgery.",
    action: "Open the free checker",
  },
};

export const BLOG_CONTENT: Record<string, BlogPostContent> = {
  "why-accessibility-checkers-disagree": checkerDifferences,
  "passing-automated-check-is-not-the-finish-line": beyondPassingCheck,
  "accessible-pdf-tables-what-tools-detect": pdfTables,
  "free-check-to-remediation-workflow": remediationWorkflow,
};
