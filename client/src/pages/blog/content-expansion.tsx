// Remedy508 Insights - August 2026 expansion set.
//
// Ten editorial articles that pair with the existing Insights posts. Prose
// primitives come from ./prose so the type scale, citation styling, and table
// treatment stay identical across the whole blog. Every factual claim carries
// an inline citation to the authoritative page it came from, and each article
// repeats those sources in its resources list.
import {
  Callout,
  Cite,
  H2,
  H3,
  Internal,
  OL,
  P,
  SimpleTable,
  UL,
  type BlogPostContent,
} from "./prose";

/* ------------------------------------------------------------------ */
/* 1. How to check a PDF for accessibility                             */
/* ------------------------------------------------------------------ */

const pdfAccessibilityChecklist: BlogPostContent = {
  body: (
    <>
      <P>
        Checking a PDF for accessibility means confirming two separate things: that the file carries
        the machine-readable structure assistive technology needs, and that the structure actually
        describes the document a person sees. The first part is largely mechanical. The second part
        is judgment, and no tool does it for you.
      </P>
      <P>
        The sequence below follows the order federal reviewers use, which is also the order that
        wastes the least time. It starts with the cheap disqualifying checks, moves into structure,
        and finishes with the automated report rather than starting there.
      </P>

      <H2 id="the-checklist">How to check a PDF for accessibility</H2>
      <OL>
        <li>Confirm the document has a descriptive title set to display in the window bar.</li>
        <li>Confirm the file is tagged and has a specified document language.</li>
        <li>Confirm content copying for accessibility is allowed in the security settings.</li>
        <li>Read the tags tree and check headings, lists, and logical reading order.</li>
        <li>Check every image for alternative text or correct decorative treatment.</li>
        <li>Check tables for real header cells with the correct scope.</li>
        <li>Tab through form fields and hover each one to read its tooltip.</li>
        <li>Run the automated check last, then triage each reported status by hand.</li>
      </OL>

      <H2 id="what-checking-means">What a check can and cannot settle</H2>
      <P>
        Automated tools cannot check every accessibility requirement, human judgment is required,
        and tools can produce results that are false or misleading, as the{" "}
        <Cite href="https://www.w3.org/WAI/test-evaluate/tools/selecting/">
          W3C Web Accessibility Initiative
        </Cite>{" "}
        states plainly in its guidance on selecting evaluation tools. A checklist is a way of
        routing your attention, not a conformance verdict.
      </P>
      <P>
        It helps to know what standard the check is measured against. Federal public-facing
        electronic content, PDFs included, is expected to conform to the Section 508 Standards and
        WCAG 2.0 Level AA according to{" "}
        <Cite href="https://www.section508.gov/test/documents/">Section508.gov</Cite>. If you work
        for a state or local government body, a different version applies, which our post on{" "}
        <Internal href="/blog/pdf-ua-vs-wcag-vs-section-508">
          PDF/UA, WCAG, and Section 508
        </Internal>{" "}
        untangles.
      </P>

      <H2 id="step-one">Step 1: document properties</H2>
      <P>
        Open File then Properties. Section508.gov's{" "}
        <Cite href="https://www.section508.gov/training/pdfs/aed-cop-pdf02/">
          module on testing a PDF
        </Cite>{" "}
        asks for a descriptive file name, tags, permission to copy content for accessibility, and a
        specified language. Four fields, and three of them can disqualify the file outright.
      </P>
      <UL>
        <li>
          <strong>Title.</strong> In the Description tab, check for a descriptive Title, then open
          Initial View and confirm Show is set to Document Title. If it is not, the PDF is treated
          as not accessible until that is corrected (
          <Cite href="https://www.section508.gov/training/pdfs/aed-cop-pdf02/">Section508.gov</Cite>
          ).
        </li>
        <li>
          <strong>Tagged PDF.</strong> Still in Description, if Tagged PDF reads No, the document
          has no structure tree and is not accessible until it is tagged (
          <Cite href="https://www.section508.gov/training/pdfs/aed-cop-pdf02/">Section508.gov</Cite>
          ).
        </li>
        <li>
          <strong>Content copying for accessibility.</strong> In the Security tab, if this is Not
          Allowed, assistive technology cannot reach the content (
          <Cite href="https://www.section508.gov/training/pdfs/aed-cop-pdf02/">Section508.gov</Cite>
          ). Adobe explains the mechanism: screen readers must copy or extract text in order to
          convert it to speech, so restrictive security settings interfere with them (
          <Cite href="https://helpx.adobe.com/acrobat/using/create-verify-pdf-accessibility.html">
            Adobe
          </Cite>
          ).
        </li>
        <li>
          <strong>Language.</strong> A specified document language is one of the properties the
          testing process asks for (
          <Cite href="https://www.section508.gov/training/pdfs/aed-cop-pdf02/">Section508.gov</Cite>
          ), and it is what lets a screen reader select the correct speech synthesizer (
          <Cite href="https://www.section508.gov/training/pdfs/aed-cop-pdf03/">Section508.gov</Cite>
          ).
        </li>
      </UL>

      <H2 id="step-two">Step 2: structure and reading order</H2>
      <P>
        Open the tags pane and read the document through it. You are looking for headings that
        follow the visual hierarchy, paragraphs tagged as paragraphs rather than as one long block,
        lists that are real list structures, and a tag order that matches the order a person would
        read the page in.
      </P>
      <P>
        This is the step where a file most often looks fine and reads badly. A two-column newsletter
        whose tags run straight across both columns can clear an automated check and still be
        incoherent out loud. Our guide on{" "}
        <Internal href="/accessibility-guides/articles/fixing-reading-order">
          fixing reading order in a remediated PDF
        </Internal>{" "}
        walks through the repair, and{" "}
        <Internal href="/blog/pdf-tags-explained-structure-screen-readers-use">
          our explainer on PDF tags
        </Internal>{" "}
        covers what each tag type is doing.
      </P>

      <H2 id="step-three">Step 3: images, tables, links, and color</H2>
      <P>
        Every image needs either a text alternative or explicit decorative treatment. The choice
        depends on the image's purpose: informative images need a short description of the essential
        information, decorative images take a null text alternative, functional images describe the
        function, and complex images need a full text equivalent elsewhere, per the{" "}
        <Cite href="https://www.w3.org/WAI/tutorials/images/">W3C images tutorial</Cite>.
      </P>
      <P>
        For tables, check that header cells are marked as headers rather than styled to look bold.
        Read one full row and one full column and ask whether the data still makes sense without the
        visual grid. Our post on{" "}
        <Internal href="/blog/accessible-pdf-tables-what-tools-detect">
          what accessible PDF tables require
        </Internal>{" "}
        covers the cases automated tools cannot see.
      </P>
      <P>
        For links, read the link text on its own and ask whether it says where it goes. For color,
        check whether any instruction depends on color, size, shape, or position alone.
      </P>

      <H2 id="step-four">Step 4: form fields</H2>
      <P>
        If the document has fillable fields, press Tab to move through them, hover each field to
        reveal its tooltip, confirm the tooltip matches the visible label or instruction, and
        confirm the tab order matches the visual and logical order of the page (
        <Cite href="https://www.section508.gov/training/pdfs/aed-cop-pdf02/">Section508.gov</Cite>
        ). This takes a minute on a short form and is the only reliable way to catch a field whose
        tooltip says "Text1".{" "}
        <Internal href="/blog/accessible-pdf-forms-labels-instructions-keyboard-order">
          Our article on accessible PDF forms
        </Internal>{" "}
        goes deeper on labels, instructions, and error handling.
      </P>

      <H2 id="step-five">Step 5: run the automated check, then triage</H2>
      <P>
        Now run the tool. Acrobat's accessibility check returns four statuses: Passed, Skipped By
        User, Needs Manual Check, and Failed, where Needs Manual Check means the tool could not
        evaluate the item automatically (
        <Cite href="https://helpx.adobe.com/acrobat/using/create-verify-pdf-accessibility.html">
          Adobe
        </Cite>
        ). Adobe also notes that the check does not distinguish between essential and nonessential
        content, that some reported issues may not affect readability, and that every issue should
        be reviewed so you can decide which ones need correcting (
        <Cite href="https://helpx.adobe.com/acrobat/using/create-verify-pdf-accessibility.html">
          Adobe
        </Cite>
        ).
      </P>
      <Callout title="Read the statuses as work categories">
        <p>
          Failed items are your queue. Needs Manual Check items are your reading list. Skipped items
          are a decision someone made, and that decision should be recorded rather than inherited
          silently.
        </p>
      </Callout>

      <H2 id="what-it-cannot-tell-you">What the checklist will not tell you</H2>
      <P>
        A complete pass through this list tells you the document is structurally sound and worth a
        human read. It does not tell you the alt text is accurate, that the reading order matches
        the author's intent, or that the document conforms to a standard. Preliminary checks give a
        rough idea and content can appear to pass while still presenting significant barriers, as
        WAI notes in its{" "}
        <Cite href="https://www.w3.org/WAI/test-evaluate/preliminary/">Easy Checks</Cite> guidance.
      </P>
      <P>
        Escalate when the file is scan-only, when it uses XFA or LiveCycle forms, when tables are
        heavily merged, or when the document is central to a service people must use. Those are the
        cases where a rebuild from source is usually faster than PDF surgery, a tradeoff our{" "}
        <Internal href="/blog/free-check-to-remediation-workflow">
          remediation workflow post
        </Internal>{" "}
        works through.
      </P>
    </>
  ),
  resources: [
    {
      label: "Module 2: Testing a PDF for Accessibility",
      href: "https://www.section508.gov/training/pdfs/aed-cop-pdf02/",
      publisher: "Section508.gov",
      note: "The federal testing sequence for document properties, structure, and form fields.",
    },
    {
      label: "Module 3: Remediating PDFs",
      href: "https://www.section508.gov/training/pdfs/aed-cop-pdf03/",
      publisher: "Section508.gov",
      note: "The repair steps behind the checks, including tags, reading order, and language.",
    },
    {
      label: "Images Tutorial",
      href: "https://www.w3.org/WAI/tutorials/images/",
      publisher: "W3C Web Accessibility Initiative",
      note: "How to decide what alt text an image needs based on its purpose.",
    },
    {
      label: "Create and verify PDF accessibility (Acrobat Pro)",
      href: "https://helpx.adobe.com/acrobat/using/create-verify-pdf-accessibility.html",
      publisher: "Adobe",
      note: "Definitions of the four checker statuses and Adobe's caveats about them.",
    },
    {
      label: "Selecting Web Accessibility Evaluation Tools",
      href: "https://www.w3.org/WAI/test-evaluate/tools/selecting/",
      publisher: "W3C Web Accessibility Initiative",
      note: "Why tools cannot determine accessibility on their own.",
    },
    {
      label: "Easy Checks: A First Review of Web Accessibility",
      href: "https://www.w3.org/WAI/test-evaluate/preliminary/",
      publisher: "W3C Web Accessibility Initiative",
      note: "A preliminary review method, with an explicit warning about its limits.",
    },
    {
      label: "Electronic Documents: Testing and Requirements",
      href: "https://www.section508.gov/test/documents/",
      publisher: "Section508.gov",
      note: "Which standard federal electronic documents are measured against.",
    },
  ],
  relatedGuides: [
    { id: "running-acrobat-checker", title: "Running Acrobat's Accessibility Checker on your result" },
    { id: "fixing-reading-order", title: "Fixing reading order in a remediated PDF" },
    {
      id: "how-to-check-your-output-is-accessible",
      title: "How to check that your output is actually accessible",
    },
  ],
  cta: {
    heading: "Start with the structural pass",
    body: "Run your PDF through the free checker to see which items clear automatically, so your reading time goes to the ones that need a person.",
    action: "Open the free checker",
  },
};

/* ------------------------------------------------------------------ */
/* 2. What is PDF remediation                                          */
/* ------------------------------------------------------------------ */

const whatIsPdfRemediation: BlogPostContent = {
  body: (
    <>
      <P>
        PDF remediation is the process of adding or correcting the structural information in an
        existing PDF so assistive technology can present it accurately. In practice that means
        fixing document properties, adding and adjusting tags, correcting reading and tab order,
        writing alternative text, and setting the document language (
        <Cite href="https://www.section508.gov/training/pdfs/aed-cop-pdf03/">Section508.gov</Cite>
        ).
      </P>
      <P>
        The word remediation matters. You are repairing a file that was produced without structure,
        which is a different job from authoring an accessible document in the first place. The
        second job is almost always cheaper, and knowing why is the key to scoping the first one.
      </P>

      <H2 id="the-sequence">What the work actually involves</H2>
      <P>
        A typical remediation moves through the same stages regardless of who does it. Properties
        first, because they are quick and disqualifying. Then tags, either generated and corrected
        or built by hand. Then reading order, alternative text, tables, and forms. Then a check, a
        human read, and a record of what was done.
      </P>
      <P>
        Autotagging is where expectations and reality separate. Acrobat can add a tag tree
        automatically, but the resulting tags may be incorrect and have to be examined and manually
        corrected wherever they misrepresent the structure (
        <Cite href="https://www.section508.gov/training/pdfs/aed-cop-pdf03/">Section508.gov</Cite>
        ). Adobe is specific about the failure modes: automatic tagging cannot always interpret
        closely spaced columns, irregular text alignment, non-fillable form fields, and tables
        without borders, and the result can be improperly combined elements or tags that appear out
        of sequence (
        <Cite href="https://helpx.adobe.com/acrobat/using/creating-accessible-pdfs.html">Adobe</Cite>
        ).
      </P>

      <H2 id="cost-drivers">What drives PDF remediation cost</H2>
      <UL>
        <li>
          <strong>Whether an editable source exists.</strong> A Word original can be repaired
          upstream and re-exported. A scan-only file cannot.
        </li>
        <li>
          <strong>Structural complexity.</strong> Data tables, nested lists, multi-column layouts,
          and mixed-language passages all add manual steps.
        </li>
        <li>
          <strong>Interactivity.</strong> Every form field needs a tag, a tooltip, and a place in
          the tab order.
        </li>
        <li>
          <strong>Design decisions baked into the layout.</strong> Meaning carried by color, shape,
          or position often has to be fixed in the source rather than in the PDF.
        </li>
        <li>
          <strong>Volume and review.</strong> Page count, revision cycles, and how much verification
          your process requires.
        </li>
      </UL>

      <H3>Source availability</H3>
      <P>
        Scanned pages add an entire stage before tagging can begin: optical character recognition,
        correction of OCR suspects, and page enhancement (
        <Cite href="https://www.section508.gov/training/pdfs/aed-cop-pdf04/">Section508.gov</Cite>
        ). If your backlog is heavy on archived scans, that pre-stage is the single largest variable
        in your estimate, and{" "}
        <Internal href="/blog/scanned-pdf-accessibility-ocr-manual-review">
          our article on scanned PDFs
        </Internal>{" "}
        breaks the stage down.
      </P>

      <H3>Structural complexity</H3>
      <P>
        Data tables are the classic example. Header cells have to be set as Table Header with Scope
        set to Column Header or Row Header, and Span set for merged cells, before Table Header and
        Table Regularity errors will clear (
        <Cite href="https://www.section508.gov/training/pdfs/aed-cop-pdf03/">Section508.gov</Cite>
        ). That is per table, not per document. Forms scale the same way: every field must be tagged
        as Form, carry a descriptive tooltip, and sit in a logical tab order (
        <Cite href="https://www.section508.gov/training/pdfs/aed-cop-pdf03/">Section508.gov</Cite>
        ).
      </P>
      <P>
        There is also a threshold effect. When enough elements are mis-tagged, it can be faster to
        delete the whole tag tree, clear the page structure, and retag manually with the Touch-Up
        Reading Order tool (
        <Cite href="https://www.section508.gov/training/pdfs/aed-cop-pdf03/">Section508.gov</Cite>
        ). That is a labor step that scales directly with page count, which is why two files of the
        same length can differ enormously in effort.
      </P>

      <H3>Content that cannot be fixed in the PDF</H3>
      <P>
        Content that relies on color, size, shape, or location to convey meaning may require
        redesigning the source file and re-converting to PDF rather than editing the PDF (
        <Cite href="https://www.section508.gov/training/pdfs/aed-cop-pdf03/">Section508.gov</Cite>
        ). A chart whose legend is color only is not a tagging problem.
      </P>

      <H2 id="upstream">Why fixing it upstream is cheaper</H2>
      <P>
        Microsoft states that the fastest and easiest way to ensure an accessible PDF is to run the
        Accessibility Checker before saving as PDF, after which Microsoft 365 uses that information
        to create accessibility tags in the exported file (
        <Cite href="https://support.microsoft.com/en-us/office/create-accessible-pdfs-064625e0-56ea-4e16-ad71-3aa33bb4b7ed">
          Microsoft
        </Cite>
        ). Adobe makes the same argument from the other side: tagging during conversion produces a
        more accurate structure tree than after-the-fact autotagging because the converter can use
        the authoring application's paragraph styles (
        <Cite href="https://helpx.adobe.com/acrobat/using/creating-accessible-pdfs.html">Adobe</Cite>
        ).
      </P>
      <P>
        For a team with a recurring publication cycle, that changes where the budget goes. Author
        training and export settings reduce the size of next year's queue.{" "}
        <Internal href="/blog/accessible-word-document-before-pdf-export">
          Our Word article
        </Internal>{" "}
        covers the specific settings.
      </P>

      <H2 id="quotes">Why per-page quotes vary so much</H2>
      <P>
        We are not going to publish a market average per page, because the drivers above mean a
        page number on its own does not describe the work. A 40-page policy PDF exported from a
        well-structured Word file and a 40-page scanned handbook with 12 tables are not the same
        purchase.
      </P>
      <P>Ask a vendor these questions instead of asking for a per-page rate in isolation.</P>
      <OL>
        <li>What happens if the source file is unavailable or the pages are scanned?</li>
        <li>Which checks are automated and which are performed by a person?</li>
        <li>Are tables, forms, and complex figures priced differently?</li>
        <li>What does the deliverable include besides the PDF, such as a report or the source?</li>
        <li>How are revisions handled after your review?</li>
      </OL>
      <P>
        For context on the scale of the wider problem rather than document-level pricing, the
        Department of Justice estimated the 2024 Title II rule's ten-year average annualized costs
        at $3,249 million, with first-year implementation costs of $16,949 million across covered
        entities (
        <Cite href="https://www.ada.gov/assets/pdfs/2026-ifr.pdf">DOJ Interim Final Rule</Cite>
        ). Those are economy-wide regulatory estimates and say nothing about what any single
        document costs.
      </P>

      <H2 id="timeline">Scoping a timeline you can defend</H2>
      <P>
        Triage by use rather than by folder. Documents people are actively using to apply for or
        participate in a service come first, then high-traffic public documents, then the archive.
        Sequencing that way gives you a defensible order if anyone asks how you prioritized, and it
        gets the highest-impact files fixed while the rest of the plan is still being written.
      </P>
      <P>
        Cap the work in progress. Ten documents finished completely are worth more than forty
        half-repaired ones, because a half-repaired file carries no evidence and usually gets
        re-checked from scratch. If you want the operational version of this, read our{" "}
        <Internal href="/blog/free-check-to-remediation-workflow">
          five-stage remediation workflow
        </Internal>
        , and see <Internal href="/pricing">our pricing page</Internal> for how Remedy508 structures
        the automated portion of the work.
      </P>
    </>
  ),
  resources: [
    {
      label: "Module 3: Remediating PDFs",
      href: "https://www.section508.gov/training/pdfs/aed-cop-pdf03/",
      publisher: "Section508.gov",
      note: "The remediation sequence, including tags, tables, forms, and retagging.",
    },
    {
      label: "Module 4: Scanned Documents",
      href: "https://www.section508.gov/training/pdfs/aed-cop-pdf04/",
      publisher: "Section508.gov",
      note: "The OCR pre-stage that scanned pages add before tagging can start.",
    },
    {
      label: "Creating accessible PDFs",
      href: "https://helpx.adobe.com/acrobat/using/creating-accessible-pdfs.html",
      publisher: "Adobe",
      note: "Documented limits of automatic tagging and the case for tagging at conversion.",
    },
    {
      label: "Create accessible PDFs",
      href: "https://support.microsoft.com/en-us/office/create-accessible-pdfs-064625e0-56ea-4e16-ad71-3aa33bb4b7ed",
      publisher: "Microsoft",
      note: "Export settings that carry structure from Office files into the PDF.",
    },
    {
      label: "Interim Final Rule, 28 CFR Part 35 (April 2026)",
      href: "https://www.ada.gov/assets/pdfs/2026-ifr.pdf",
      publisher: "U.S. Department of Justice",
      note: "Source of the economy-wide cost estimates cited in this article.",
    },
  ],
  relatedGuides: [
    { id: "save-word-doc-as-pdf", title: "How to save a Word doc as a PDF (and when NOT to)" },
    { id: "what-to-do-if-not-perfect", title: "What to do if the remediation isn't perfect" },
    { id: "document-fixer-word-doc", title: "Remedy Docs: remediate a Word doc or PDF" },
  ],
  cta: {
    heading: "Find out which path your files need",
    body: "A free structural check tells you quickly whether a document needs light fixes or a rebuild from source, which is the number that actually drives your estimate.",
    action: "Open the free checker",
  },
};

/* ------------------------------------------------------------------ */
/* 3. PDF/UA vs WCAG vs Section 508                                    */
/* ------------------------------------------------------------------ */

const pdfUaWcagSection508: BlogPostContent = {
  body: (
    <>
      <P>
        PDF/UA, WCAG, and Section 508 get used interchangeably in policies and contracts, and they
        are not interchangeable. One is a technical file-format standard, one is a set of content
        guidelines, and one is a United States legal standard that borrows from the second. Naming
        the wrong one in a specification produces work nobody needed or gaps nobody noticed.
      </P>

      <SimpleTable
        caption="The three standards at a glance."
        headers={["Standard", "What it is", "Who requires it"]}
        rows={[
          [
            "WCAG",
            "W3C guidelines with testable success criteria",
            "Referenced by laws and policies worldwide",
          ],
          [
            "Section 508",
            "US federal standard incorporating WCAG by reference",
            "Federal agencies and their suppliers",
          ],
          [
            "PDF/UA",
            "ISO standard for how tagged PDF must be used",
            "Voluntary, used in specs and tooling",
          ],
        ]}
      />

      <H2 id="wcag">WCAG: the content guidelines everything else points at</H2>
      <P>
        WCAG 2.2 has 13 guidelines organized under four principles, perceivable, operable,
        understandable, and robust, with testable success criteria at Levels A, AA, and AAA (
        <Cite href="https://www.w3.org/WAI/standards-guidelines/wcag/">W3C WAI</Cite>). The version
        history matters when you are writing a policy: WCAG 2.0 was published on 11 December 2008,
        WCAG 2.1 on 5 June 2018, and WCAG 2.2 on 5 October 2023, with a WCAG 2.2 update republished
        on 12 December 2024 (
        <Cite href="https://www.w3.org/WAI/standards-guidelines/wcag/">W3C WAI</Cite>;{" "}
        <Cite href="https://www.w3.org/TR/WCAG22/">W3C</Cite>).
      </P>
      <P>
        Later versions add success criteria without changing existing ones, with one exception:
        success criterion 4.1.1 Parsing is obsolete in WCAG 2.2 (
        <Cite href="https://www.w3.org/WAI/standards-guidelines/wcag/">W3C WAI</Cite>). That
        additive design is why a document built to satisfy 2.1 does not become non-conforming when
        2.2 arrives.
      </P>
      <P>
        WCAG was written for web content, so applying it to a PDF or a desktop application takes a
        translation layer. That layer is WCAG2ICT, which is a W3C Group Note rather than a
        Recommendation and provides informative, non-normative guidance on applying WCAG 2.0, 2.1,
        and 2.2 to non-web documents and software (
        <Cite href="https://www.w3.org/TR/wcag2ict-22/">W3C</Cite>). Useful, but not something to
        cite as a requirement.
      </P>

      <H2 id="section-508">Section 508: the legal standard for federal content</H2>
      <P>
        Section 508's provision E205.4 requires electronic content to conform to WCAG Level A and AA
        success criteria and conformance requirements, and WCAG 2.0 is incorporated by reference at
        702.10.1 (<Cite href="https://www.section508.gov/test/documents/">Section508.gov</Cite>).
        Four success criteria do not apply to non-web documents under Section 508: 2.4.1 Bypass
        Blocks, 2.4.5 Multiple Ways, 3.2.3 Consistent Navigation, and 3.2.4 Consistent
        Identification (<Cite href="https://www.section508.gov/test/documents/">Section508.gov</Cite>
        ). Those four are about moving between pages of a site, which a single document does not do.
      </P>
      <P>
        For state and local government, including public colleges and universities, the DOJ Title II
        rule requires WCAG 2.1 Level AA, and its definition of web content includes documents (
        <Cite href="https://www.ada.gov/resources/2024-03-08-web-rule/">ADA.gov</Cite>). Different
        version, different scope, same family.{" "}
        <Internal href="/blog/doj-title-ii-web-accessibility-deadlines-higher-education">
          Our Title II article
        </Internal>{" "}
        covers the current compliance dates.
      </P>

      <H2 id="pdf-ua">PDF/UA: how tagging must be done</H2>
      <P>
        ISO 14289-1:2014, known as PDF/UA-1, defines the use of tagged PDF in files conforming to
        ISO 32000-1:2008, which is PDF 1.7. ISO 14289-2:2024, or PDF/UA-2, is the revision aligned
        with PDF 2.0 (<Cite href="https://pdfa.org/resource/iso-14289-pdfua/">PDF Association</Cite>
        ). Where WCAG says a heading must be programmatically determinable, PDF/UA says what a
        conforming PDF file has to contain for that to be true.
      </P>
      <P>
        The PDF Association is direct about the boundary: conformity to PDF/UA by itself does not
        necessarily ensure the accessibility of a document's content, and issues such as
        inaccessible use of color and contrast, ECMAScript behavior, and cognitive accessibility
        fall outside its scope (
        <Cite href="https://pdfa.org/resource/iso-14289-pdfua/">PDF Association</Cite>). A PDF/UA
        conforming file with unreadable contrast is still unreadable.
      </P>

      <H2 id="overlap">Where they overlap, and where people get it wrong</H2>
      <P>
        The most common specification error is requiring PDF/UA as if Section 508 demanded it. Under
        the Revised 508 Standards, WCAG 2.0 is the sole standard for PDF files. PDF/UA-1 was not
        retained as an alternate conformance standard, although the Access Board notes it can still
        be useful to agencies conducting assessments of PDF files to ensure WCAG 2.0 conformance (
        <Cite href="https://www.access-board.gov/ict/">U.S. Access Board</Cite>).
      </P>
      <P>
        PDF/UA does appear in the Revised 508 Standards in one specific place. Section 504.2.2
        requires authoring tools that export PDF to conform to PDF 1.7, ISO 32000-1, and to be
        capable of exporting PDFs conforming to PDF/UA-1 (
        <Cite href="https://www.access-board.gov/ict/">U.S. Access Board</Cite>). That is a
        requirement on tools, not on every document you publish.
      </P>

      <H2 id="which-to-name">Which one to name in your policy or RFP</H2>
      <UL>
        <li>
          <strong>Public colleges and state or local agencies.</strong> Name WCAG 2.1 Level AA,
          because that is what the Title II rule requires (
          <Cite href="https://www.ada.gov/resources/2024-03-08-web-rule/">ADA.gov</Cite>).
        </li>
        <li>
          <strong>Federal agencies and their suppliers.</strong> Name the Revised Section 508
          Standards, which carry WCAG 2.0 Level A and AA by reference (
          <Cite href="https://www.section508.gov/test/documents/">Section508.gov</Cite>).
        </li>
        <li>
          <strong>Technical remediation specifications.</strong> PDF/UA is a reasonable additional
          requirement for how files must be tagged, stated alongside a WCAG level rather than
          instead of one.
        </li>
      </UL>
      <P>
        None of this is legal advice, and the right answer for your institution depends on facts a
        blog post cannot see. Treat it as vocabulary, then check with the people who own the policy.
      </P>

      <H2 id="documenting">Say which standard your claim is measured against</H2>
      <P>
        Whatever you name, name it precisely, and record the level and the version. "Meets
        accessibility standards" is not a claim anyone can verify or dispute. "Evaluated against
        WCAG 2.1 Level AA in June 2026, using automated checks plus manual screen reader review" is.
      </P>
      <P>
        The same precision helps when a vendor's report arrives. If a supplier tells you a product
        or a document set conforms, ask which standard, which version, which level, and how it was
        tested. WCAG2ICT is worth knowing about here too, because a vendor applying WCAG to a
        desktop application or a document is relying on interpretive guidance rather than on the
        specification alone (<Cite href="https://www.w3.org/TR/wcag2ict-22/">W3C</Cite>). Our{" "}
        <Internal href="/blog/vpat-vs-acr-what-buyers-should-request">article on VPATs and ACRs</Internal>{" "}
        covers how to read the answer you get back.
      </P>

      <H2 id="tools">Why your tools disagree about all of this</H2>
      <P>
        Different checkers implement different rule sets drawn from these different standards, which
        is a large part of why the same file scores differently in two products. We wrote about that
        in{" "}
        <Internal href="/blog/why-accessibility-checkers-disagree">
          why two accessibility checkers give you two different answers
        </Internal>
        . If you want the plain-language versions of the underlying criteria, the{" "}
        <Internal href="/accessibility-guides">Accessibility Guides</Internal> hub covers them, and{" "}
        <Internal href="/accessibility-checker">the free checker</Internal> shows which structural
        items a tool can settle on its own.
      </P>
    </>
  ),
  resources: [
    {
      label: "WCAG 2 Overview",
      href: "https://www.w3.org/WAI/standards-guidelines/wcag/",
      publisher: "W3C Web Accessibility Initiative",
      note: "Versions, principles, conformance levels, and what changed between them.",
    },
    {
      label: "Web Content Accessibility Guidelines (WCAG) 2.2",
      href: "https://www.w3.org/TR/WCAG22/",
      publisher: "W3C",
      note: "The normative specification and its publication history.",
    },
    {
      label: "WCAG2ICT",
      href: "https://www.w3.org/TR/wcag2ict-22/",
      publisher: "W3C",
      note: "Non-normative guidance on applying WCAG to non-web documents and software.",
    },
    {
      label: "Electronic Documents: Testing and Requirements",
      href: "https://www.section508.gov/test/documents/",
      publisher: "Section508.gov",
      note: "E205.4, the WCAG 2.0 incorporation, and the four criteria that do not apply.",
    },
    {
      label: "Information and Communication Technology (ICT) Standards and Guidelines",
      href: "https://www.access-board.gov/ict/",
      publisher: "U.S. Access Board",
      note: "Why PDF/UA-1 was not retained as an alternate conformance standard.",
    },
    {
      label: "ISO 14289 (PDF/UA)",
      href: "https://pdfa.org/resource/iso-14289-pdfua/",
      publisher: "PDF Association",
      note: "What PDF/UA-1 and PDF/UA-2 define, and what they deliberately leave out.",
    },
    {
      label: "Fact Sheet: New Rule on the Accessibility of Web Content and Mobile Apps",
      href: "https://www.ada.gov/resources/2024-03-08-web-rule/",
      publisher: "ADA.gov",
      note: "The WCAG version and scope that apply to state and local government.",
    },
  ],
  relatedGuides: [
    { id: "accessibility-101-wcag", title: "Accessibility 101: What WCAG 2.1 AA actually means" },
    { id: "accessibility-law-title-ii", title: "Accessibility & the law: Title II, Section 508, ADA" },
    { id: "common-accessibility-myths", title: "Common accessibility myths, debunked" },
  ],
  cta: {
    heading: "See which structures your file already has",
    body: "Standards describe outcomes. A structural check shows you what is actually present in the document you are about to publish.",
    action: "Open the free checker",
  },
};

/* ------------------------------------------------------------------ */
/* 4. Scanned PDFs, OCR, and manual review                             */
/* ------------------------------------------------------------------ */

const scannedPdfOcr: BlogPostContent = {
  body: (
    <>
      <P>
        A scanned page is a photograph of text. It looks like a document and behaves like an image,
        which is why a screen reader announces nothing useful when it reaches one. If a PDF has no
        searchable text, people relying on screen readers will be unable to read or interact with
        the content (
        <Cite href="https://www.section508.gov/training/pdfs/aed-cop-pdf04/">Section508.gov</Cite>
        ).
      </P>
      <P>
        Optical character recognition is the way out, and it is the first step rather than the whole
        job. The sequence below is the one federal document teams use, and it ends with tagging and
        testing for a reason.
      </P>

      <H2 id="the-sequence">How to make a scanned PDF accessible</H2>
      <OL>
        <li>Detect which pages are image only rather than assuming the whole file is.</li>
        <li>Improve scan quality before recognition, or rescan at a higher resolution.</li>
        <li>Run OCR with the correct language and output settings.</li>
        <li>Review and correct every OCR suspect the software flags.</li>
        <li>Validate the recognized text against the visible page.</li>
        <li>Tag the document and add alternative text to real images.</li>
        <li>Test the result rather than trusting the conversion.</li>
      </OL>

      <H2 id="detect">Detecting scan-only pages</H2>
      <P>
        Mixed files are common: a born-digital report with three scanned appendices, or a memo whose
        last page is a signature. Look for blurry or handwritten pages, then check Acrobat's Content
        pane. If it contains only figure information, those pages have no renderable text and OCR is
        required (
        <Cite href="https://www.section508.gov/training/pdfs/aed-cop-pdf04/">Section508.gov</Cite>
        ). A quicker informal test is to try selecting a line of text with the cursor.
      </P>

      <H2 id="quality">Scan quality decides how much correction you will do</H2>
      <P>
        Recognition accuracy is largely set before the software runs. Adobe recommends 300 DPI for
        grayscale content and 600 DPI for color content when scanning for OCR (
        <Cite href="https://www.section508.gov/training/pdfs/aed-cop-pdf04/">Section508.gov</Cite>
        ). OCR will not process content at all if the scan quality is too low, or if the page
        already contains renderable text (
        <Cite href="https://www.section508.gov/training/pdfs/aed-cop-pdf04/">Section508.gov</Cite>
        ).
      </P>
      <P>
        If the original paper document still exists and the scan is poor, rescanning is usually
        faster than correcting thousands of misread characters. Our guide on{" "}
        <Internal href="/accessibility-guides/articles/scan-paper-document-to-pdf">
          scanning a paper document into a usable PDF
        </Internal>{" "}
        covers the capture settings.
      </P>

      <H2 id="ocr">Running recognition</H2>
      <P>
        In Acrobat, Recognize Text converts text images into searchable, selectable text, with the
        language and output type chosen in the tool's settings (
        <Cite href="https://helpx.adobe.com/acrobat/using/scan-documents-pdf.html">Adobe</Cite>
        ). Set the language to match the document, not your interface. Recognition against the wrong
        language model produces text that looks plausible and reads as nonsense.
      </P>

      <H2 id="suspects">Correcting OCR suspects</H2>
      <P>
        OCR software is not perfect, and the text strings in the Content pane may not match what
        appears on the page (
        <Cite href="https://www.section508.gov/training/pdfs/aed-cop-pdf04/">Section508.gov</Cite>
        ). Acrobat marks characters it is unsure about as suspects. Review them one at a time using
        Recognize Text and Correct Recognized Text, then either accept the suggestion or retype the
        word (
        <Cite href="https://www.section508.gov/training/pdfs/aed-cop-pdf04/">Section508.gov</Cite>
        ).
      </P>
      <Callout title="Where OCR errors hide">
        <p>
          Suspect review catches what the software doubts. It does not catch confident mistakes, and
          those are the dangerous ones, because an incorrect but confidently recognized word passes
          an automated accessibility check without comment.
        </p>
      </Callout>
      <P>
        For a second pass, export the recognized PDF to Microsoft Word using Tools, Export PDF, Word
        Document, and compare the exported content against the page (
        <Cite href="https://www.section508.gov/training/pdfs/aed-cop-pdf04/">Section508.gov</Cite>
        ). Reading the text stripped of its layout makes recognition errors obvious in a way that
        reading the PDF does not.
      </P>

      <H2 id="actual-text">When to use the Actual Text field</H2>
      <P>
        Some blocks resist correction: stylized headers, stamps, degraded type. For large blocks of
        misrecognized text, the recommended approach is to put the corrected wording in the tag's
        Actual Text field. This does not change the visual page, but assistive technology reads the
        Actual Text instead (
        <Cite href="https://www.section508.gov/training/pdfs/aed-cop-pdf04/">Section508.gov</Cite>
        ). It is a targeted repair, not a general substitute for accurate recognition.
      </P>

      <H2 id="signatures">The signed-memo pattern</H2>
      <P>
        A common institutional habit destroys accessibility for no benefit: print an accessible Word
        file, sign it in ink, then scan the whole thing back in. Doing that causes the document to
        lose its structure and markup, and the recommended pattern is to scan only the signature
        pages and merge them into the accessible PDF (
        <Cite href="https://www.section508.gov/training/pdfs/aed-cop-pdf04/">Section508.gov</Cite>
        ). One image page inside a tagged document is a small, describable exception. An entire
        scanned document is a rebuild.
      </P>

      <H2 id="finish">Recognition is not the finish line</H2>
      <P>
        After OCR and correction, the PDF still has to be tagged, given alternative text on its
        images, and tested for Section 508 conformance (
        <Cite href="https://www.section508.gov/training/pdfs/aed-cop-pdf04/">Section508.gov</Cite>
        ). A recognized page has words a screen reader can speak, but no headings to navigate by, no
        table relationships, and no reading order beyond whatever the recognition engine inferred.
      </P>
      <P>
        This is exactly the situation our post on{" "}
        <Internal href="/blog/passing-automated-check-is-not-the-finish-line">
          passing automated checks
        </Internal>{" "}
        describes. A recognized file can clear a checker while containing text that does not match
        the page. Only a person comparing the two catches that.
      </P>

      <H2 id="planning">Plan the batch before you start it</H2>
      <P>
        Scanned collections reward a little planning. Sort by document type first, because pages
        that share a layout tend to share the same recognition problems and the same fixes.
        Establish the settings and the correction habits on a small sample, then apply them across
        the batch rather than rediscovering them file by file. Record what you did, including the
        recognition language and the pages you had to correct heavily, so the next person does not
        repeat the investigation.
      </P>

      <H2 id="archives">Deciding which scans to fix first</H2>
      <P>
        Not every archived scan needs the same treatment, and the Title II rule draws a relevant
        line. Content that is kept only for reference in an archive area, was created before the
        compliance date, and has not been changed since being archived may fall under the archived
        content exception, while a document still being used to apply for or participate in a
        service generally does not (
        <Cite href="https://www.ada.gov/resources/2024-03-08-web-rule/">ADA.gov</Cite>). Those
        conditions travel together, so read them as a set rather than as a general exemption for old
        files.
      </P>
      <P>
        Practically, that means the scanned application form in current use outranks the 2009 board
        minutes. Our{" "}
        <Internal href="/blog/document-accessibility-program-colleges-universities">
          program-building article
        </Internal>{" "}
        covers how to run that triage across an institution, and{" "}
        <Internal href="/accessibility-checker">the free checker</Internal> is a fast way to confirm
        whether a given file contains real text at all.
      </P>
    </>
  ),
  resources: [
    {
      label: "Module 4: Scanned Documents",
      href: "https://www.section508.gov/training/pdfs/aed-cop-pdf04/",
      publisher: "Section508.gov",
      note: "Detection, scan resolution, OCR suspects, Actual Text, and the signature-page pattern.",
    },
    {
      label: "Scan documents to PDF and OCR",
      href: "https://helpx.adobe.com/acrobat/using/scan-documents-pdf.html",
      publisher: "Adobe",
      note: "How Recognize Text works and where the language and output settings live.",
    },
    {
      label: "Module 3: Remediating PDFs",
      href: "https://www.section508.gov/training/pdfs/aed-cop-pdf03/",
      publisher: "Section508.gov",
      note: "The tagging work that follows recognition.",
    },
    {
      label: "Fact Sheet: New Rule on the Accessibility of Web Content and Mobile Apps",
      href: "https://www.ada.gov/resources/2024-03-08-web-rule/",
      publisher: "ADA.gov",
      note: "The archived content exception and the conditions attached to it.",
    },
  ],
  relatedGuides: [
    { id: "scan-paper-document-to-pdf", title: "How to scan a paper document into a usable PDF" },
    { id: "writing-good-alt-text", title: "Writing good alt text: a quick guide" },
    { id: "fixing-reading-order", title: "Fixing reading order in a remediated PDF" },
  ],
  cta: {
    heading: "Check whether the text is really there",
    body: "Run one file from your scanned archive through the free checker to see whether it contains real text and structure before you plan the rest of the batch.",
    action: "Open the free checker",
  },
};

/* ------------------------------------------------------------------ */
/* 5. Accessible PDF forms                                             */
/* ------------------------------------------------------------------ */

const accessiblePdfForms: BlogPostContent = {
  body: (
    <>
      <P>
        A PDF form is accessible when every control announces what it is and what it wants, the
        whole sequence can be completed with a keyboard, instructions arrive before people need
        them, and errors are described in text rather than in color. Those four things fail
        independently, and a form can satisfy three of them and still be unusable.
      </P>
      <UL>
        <li>Every field has a tooltip that matches its visible label.</li>
        <li>Instructions and required-field information appear before the field, not after.</li>
        <li>Tab order follows the visual and logical order of the page.</li>
        <li>All functionality works from the keyboard, with no trapped focus.</li>
        <li>Errors are identified in text and describe how to fix them.</li>
      </UL>

      <H2 id="name-role-value">Name, role, value: what a control has to expose</H2>
      <P>
        WCAG success criterion 4.1.2 Name, Role, Value requires that for user interface components
        including form elements, the name and role can be programmatically determined, and that
        states, properties, and values that can be set by the user can be programmatically set (
        <Cite href="https://www.w3.org/TR/WCAG22/">W3C</Cite>). W3C also draws a distinction that
        confuses a lot of teams: a label is presented to all users, while a name may be hidden and
        exposed only to assistive technology (
        <Cite href="https://www.w3.org/TR/WCAG22/">W3C</Cite>). In a well-built form they say the
        same thing.
      </P>

      <H3>Tooltips are the label in a PDF</H3>
      <P>
        In PDF forms, the tooltip carries the programmatic name. Each form field element must
        contain a tooltip and appear in a logical tab order (
        <Cite href="https://www.section508.gov/training/pdfs/aed-cop-pdf02/">Section508.gov</Cite>
        ). During remediation, all form fields must be tagged as Form, given a descriptive tooltip,
        and placed in a logical tab order, with tooltips set in Prepare Form, then the field's
        Properties, then General (
        <Cite href="https://www.section508.gov/training/pdfs/aed-cop-pdf03/">Section508.gov</Cite>
        ).
      </P>
      <P>
        Write tooltips as the label a person would read aloud. "Date of birth, month day year" tells
        someone what to type. "Text3" tells them nothing, and it is what an untouched field
        detection pass usually produces.
      </P>

      <H2 id="instructions">Instructions before failure, not after</H2>
      <P>
        WCAG 3.3.2 Labels or Instructions requires that labels or instructions are provided when
        content requires user input (<Cite href="https://www.w3.org/TR/WCAG22/">W3C</Cite>). W3C's
        forms tutorial expands that into a working practice: identify each control with a label,
        group related controls, provide instructions for the form as a whole and for individual
        controls, validate input, offer a way to undo or confirm, notify people of success as well
        as errors, and give instructions for correcting mistakes (
        <Cite href="https://www.w3.org/WAI/tutorials/forms/">W3C WAI</Cite>).
      </P>
      <P>
        The tutorial has two structural recommendations worth applying to long institutional forms:
        split them into a series of logical steps with progress information, and avoid time limits
        or let people turn them off or extend them (
        <Cite href="https://www.w3.org/WAI/tutorials/forms/">W3C WAI</Cite>).
      </P>

      <H3>Group the controls that belong together</H3>
      <P>
        Individual labels are not enough when a question is answered by a set of controls. A group
        of radio buttons for enrollment status, or a set of checkboxes for accommodations requested,
        needs the question itself associated with the group rather than repeated inside every
        option. W3C's forms guidance calls for grouping related controls alongside labeling each one
        (<Cite href="https://www.w3.org/WAI/tutorials/forms/">W3C WAI</Cite>). In a PDF, that usually
        means giving related fields a shared name where the format supports it, and writing tooltips
        that carry the question and the option, so "Enrollment status: part time" reads as a
        complete answer on its own.
      </P>

      <H2 id="keyboard">Keyboard order and how it differs from reading order</H2>
      <P>
        WCAG 2.1.1 Keyboard requires all functionality to be operable through a keyboard interface,
        and 2.1.2 No Keyboard Trap requires that focus can always be moved away from a component (
        <Cite href="https://www.w3.org/TR/WCAG22/">W3C</Cite>). In a PDF, tab order is a separate
        property from the tags tree, which is why a form can read correctly and tab chaotically.
      </P>
      <P>
        Tab order is adjusted in Form Edit Mode using More, then Show Tab Numbers, then dragging
        fields into the right sequence. For documents that contain links or form fields, set Page
        Properties, then Tab Order, to Use Document Structure (
        <Cite href="https://www.section508.gov/training/pdfs/aed-cop-pdf03/">Section508.gov</Cite>
        ). That setting ties the two orders together and stops them drifting apart on the next edit.
        Our guide on{" "}
        <Internal href="/accessibility-guides/articles/fixing-reading-order">reading order</Internal>{" "}
        covers the tags side of the same problem.
      </P>

      <H2 id="errors">Errors people can actually recover from</H2>
      <P>
        Error handling is where forms most often fail people using screen readers, because the
        feedback is frequently visual only. Following the W3C guidance, notify people of both errors
        and success, describe the problem in text, and provide instructions for correcting it (
        <Cite href="https://www.w3.org/WAI/tutorials/forms/">W3C WAI</Cite>).
      </P>
      <P>
        For PDF forms specifically, prefer a formatting hint in the tooltip over a validation script
        that fires silently. A field that states the expected format up front produces fewer errors
        to recover from.
      </P>

      <H2 id="testing">Testing a form by hand</H2>
      <P>
        The manual test is short and not optional. Press Tab to reach each field, hover to reveal
        its tooltip, check the tooltip matches the label or instruction, and check the tab order
        matches the visual and logical order (
        <Cite href="https://www.section508.gov/training/pdfs/aed-cop-pdf02/">Section508.gov</Cite>
        ). An automated checker can tell you a tooltip exists. It cannot tell you the tooltip is the
        right words, or that field seven should come before field eight.
      </P>

      <H2 id="hard-cases">The hard cases</H2>
      <P>
        Some forms need a different approach entirely. If the PDF Producer is Adobe LiveCycle
        Designer, the standard testing process is not sufficient, and testers are advised to rely on
        user testing with assistive technologies until harmonized processes are published (
        <Cite href="https://www.section508.gov/training/pdfs/aed-cop-pdf02/">Section508.gov</Cite>
        ). If you inherit an XFA-based application form, plan for a rebuild rather than a patch.
      </P>
      <P>
        The Access Board's Appendix D, at section 1194.22(n), frames the underlying expectation:
        online electronic forms must allow people using assistive technology to access the
        information, field elements, and functionality required for completion and submission,
        including all directions and cues (
        <Cite href="https://www.access-board.gov/ict/">U.S. Access Board</Cite>). Directions and cues
        are named explicitly, which is a useful line to quote when someone argues that labeling the
        fields is enough.
      </P>
      <P>
        If a form is central to admissions, financial aid, or benefits, treat it as a priority
        document rather than as one more PDF in the queue. Our{" "}
        <Internal href="/blog/free-check-to-remediation-workflow">remediation workflow</Internal>{" "}
        covers how to sequence that work, and{" "}
        <Internal href="/blog/how-to-check-pdf-accessibility-checklist">
          the PDF checking checklist
        </Internal>{" "}
        gives you the wider pass to run around it.
      </P>
    </>
  ),
  resources: [
    {
      label: "Module 2: Testing a PDF for Accessibility",
      href: "https://www.section508.gov/training/pdfs/aed-cop-pdf02/",
      publisher: "Section508.gov",
      note: "The tab-and-hover manual test and the LiveCycle caveat.",
    },
    {
      label: "Module 3: Remediating PDFs",
      href: "https://www.section508.gov/training/pdfs/aed-cop-pdf03/",
      publisher: "Section508.gov",
      note: "Where tooltips are set and how tab order is corrected in Acrobat.",
    },
    {
      label: "Web Content Accessibility Guidelines (WCAG) 2.2",
      href: "https://www.w3.org/TR/WCAG22/",
      publisher: "W3C",
      note: "Success criteria 2.1.1, 2.1.2, 3.3.2, and 4.1.2 in their normative wording.",
    },
    {
      label: "Forms Tutorial",
      href: "https://www.w3.org/WAI/tutorials/forms/",
      publisher: "W3C Web Accessibility Initiative",
      note: "Labels, grouping, instructions, validation, and error recovery.",
    },
    {
      label: "Information and Communication Technology (ICT) Standards and Guidelines",
      href: "https://www.access-board.gov/ict/",
      publisher: "U.S. Access Board",
      note: "Appendix D language on electronic forms, directions, and cues.",
    },
  ],
  relatedGuides: [
    { id: "fixing-reading-order", title: "Fixing reading order in a remediated PDF" },
    { id: "running-acrobat-checker", title: "Running Acrobat's Accessibility Checker on your result" },
    { id: "what-to-do-if-not-perfect", title: "What to do if the remediation isn't perfect" },
  ],
  cta: {
    heading: "Check the form before the term starts",
    body: "Run your fillable PDF through the free checker for the structural pass, then walk it once with the keyboard to confirm the parts a tool cannot judge.",
    action: "Open the free checker",
  },
};

/* ------------------------------------------------------------------ */
/* 6. Accessible Word documents before export                          */
/* ------------------------------------------------------------------ */

const accessibleWordDocument: BlogPostContent = {
  body: (
    <>
      <P>
        Most PDF accessibility problems are Word problems that were exported. Headings that are only
        bold text, images with no description, tables with merged cells, links that say "click
        here": all of them survive the conversion, and each one costs more to fix in the PDF than it
        would have cost in the source.
      </P>
      <P>
        The work below takes a few minutes on a typical document and removes most of the remediation
        queue before it forms.
      </P>

      <H2 id="before-export">Make a Word document accessible before exporting</H2>
      <OL>
        <li>Use the built-in Title, Subtitle, and heading styles in logical order.</li>
        <li>Give every meaningful image alt text and mark decorative ones as decorative.</li>
        <li>Keep tables simple, with a header row and no merged, split, or nested cells.</li>
        <li>Write link text that describes the destination.</li>
        <li>Never let color alone carry meaning, and check contrast.</li>
        <li>Run Review, then Check Accessibility, and clear the errors and warnings.</li>
        <li>Export with document structure tags for accessibility enabled.</li>
        <li>Open the exported PDF and verify the structure survived.</li>
      </OL>

      <H2 id="structure">Structure comes from styles, not formatting</H2>
      <P>
        Microsoft's guidance is to use the built-in Title, Subtitle, and heading styles, because
        logical heading order and Word's built-in formatting preserve tab order and make documents
        easier for screen readers to work with (
        <Cite href="https://support.microsoft.com/en-us/office/make-your-word-documents-accessible-to-people-with-disabilities-d9bf3683-87ac-47ea-b91a-78dcacb3c66d">
          Microsoft
        </Cite>
        ). Text made large and bold looks like a heading and exports as a paragraph, which is the
        most common single source of an unnavigable PDF.
      </P>
      <P>
        Our guide on{" "}
        <Internal href="/accessibility-guides/articles/heading-structure-matters">
          why heading structure matters
        </Internal>{" "}
        covers the hierarchy rules, including why skipping from Heading 1 to Heading 3 causes
        trouble.
      </P>

      <H2 id="images">Images: describe the purpose, not the picture</H2>
      <P>
        Alt text decisions follow what the image is for. Informative images need a short description
        of the essential information, decorative images take a null text alternative, functional
        images describe the function rather than the appearance, and complex images such as charts
        need a full text equivalent nearby (
        <Cite href="https://www.w3.org/WAI/tutorials/images/">W3C WAI</Cite>). Word's Accessibility
        Checker finds missing alt text (
        <Cite href="https://support.microsoft.com/en-us/office/make-your-word-documents-accessible-to-people-with-disabilities-d9bf3683-87ac-47ea-b91a-78dcacb3c66d">
          Microsoft
        </Cite>
        ), but only a person can judge whether the text that is there is the right text.
      </P>

      <H2 id="tables">Tables: simple structure wins</H2>
      <P>
        The checker flags tables with split cells, merged cells, or nested tables, along with
        missing alt text and insufficient color contrast (
        <Cite href="https://support.microsoft.com/en-us/office/make-your-word-documents-accessible-to-people-with-disabilities-d9bf3683-87ac-47ea-b91a-78dcacb3c66d">
          Microsoft
        </Cite>
        ). The reason is mechanical. Screen readers track position in a table by counting cells, so
        nested tables, merged cells, or split cells make the reader lose count, and blank cells can
        make it sound as though the table has ended (
        <Cite href="https://support.microsoft.com/en-us/office/make-your-word-documents-accessible-to-people-with-disabilities-d9bf3683-87ac-47ea-b91a-78dcacb3c66d">
          Microsoft
        </Cite>
        ).
      </P>
      <P>
        Two simple tables usually beat one clever table. If the data genuinely needs a complex
        layout, our post on{" "}
        <Internal href="/blog/accessible-pdf-tables-what-tools-detect">
          what accessible PDF tables require
        </Internal>{" "}
        explains what has to be true after export.
      </P>

      <H2 id="lists">Lists, columns, and templates</H2>
      <P>
        Use the real list buttons rather than typing dashes or manual numbers, and use Word's column
        and page break features instead of pressing Enter until the text moves. Both choices matter
        after export, because the exported tags mirror the structures the source actually contains
        rather than the layout it appears to have.
      </P>
      <P>
        If your team publishes on a cycle, put this work in a template once. A departmental template
        with correct heading styles, a defined table style, and a set of accessible color pairings
        removes the same decisions from every future document, which is what makes the practice
        stick beyond the first enthusiastic month.
      </P>

      <H2 id="links-color">Links, color, and contrast</H2>
      <P>
        Use meaningful hyperlink text and ScreenTips, and do not rely on color alone. Add a second
        visual indicator such as an underline or a shape so the information survives for readers who
        do not perceive the color difference (
        <Cite href="https://support.microsoft.com/en-us/office/make-your-word-documents-accessible-to-people-with-disabilities-d9bf3683-87ac-47ea-b91a-78dcacb3c66d">
          Microsoft
        </Cite>
        ). The{" "}
        <Internal href="/accessibility-guides/articles/color-contrast-rule">contrast guide</Internal>{" "}
        covers the ratios in practice.
      </P>

      <H2 id="checker">Run the Accessibility Checker</H2>
      <P>
        Word's Accessibility Checker runs automatically in the background and shows a status bar
        reminder when it detects issues (
        <Cite href="https://support.microsoft.com/en-us/office/make-your-word-documents-accessible-to-people-with-disabilities-d9bf3683-87ac-47ea-b91a-78dcacb3c66d">
          Microsoft
        </Cite>
        ). Run it deliberately from Review, then Check Accessibility. The Accessibility pane lists
        errors and warnings with recommended actions and shows the location of each affected object
        (
        <Cite href="https://support.microsoft.com/en-us/office/improve-accessibility-with-the-accessibility-checker-a16f6de0-2f39-4a2b-8bd8-5ad801426c7f">
          Microsoft
        </Cite>
        ).
      </P>
      <P>
        A useful extra pass is to listen to the draft. Microsoft suggests View, then Immersive
        Reader, then Read Aloud, or navigating the file with VoiceOver on iOS or TalkBack on Android
        (
        <Cite href="https://support.microsoft.com/en-us/office/make-your-word-documents-accessible-to-people-with-disabilities-d9bf3683-87ac-47ea-b91a-78dcacb3c66d">
          Microsoft
        </Cite>
        ). Hearing a document read in order exposes ordering problems that no panel highlights.
      </P>

      <H2 id="export">Export so the structure travels</H2>
      <P>
        On Windows, use File, Save As, PDF, then More options, then Options, and select Document
        structure tags for accessibility (
        <Cite href="https://support.microsoft.com/en-us/office/create-accessible-pdfs-064625e0-56ea-4e16-ad71-3aa33bb4b7ed">
          Microsoft
        </Cite>
        ). On Mac, choose the option described as best for electronic distribution and accessibility
        to ensure the PDF is tagged. Microsoft notes that this option uses a Microsoft online
        service, that the file is sent there for conversion, and that it is not stored on Microsoft
        servers (
        <Cite href="https://support.microsoft.com/en-us/office/create-accessible-pdfs-064625e0-56ea-4e16-ad71-3aa33bb4b7ed">
          Microsoft
        </Cite>
        ). If your document is sensitive, factor that routing into the decision.
      </P>
      <P>
        Those tags are what make navigation possible. Accessibility tags let screen reader users
        move through a PDF using tables of contents, hyperlinks, bookmarks, and alternative text (
        <Cite href="https://support.microsoft.com/en-us/office/create-accessible-pdfs-064625e0-56ea-4e16-ad71-3aa33bb4b7ed">
          Microsoft
        </Cite>
        ). Adobe recommends tagging during conversion for a related reason: the converter can use
        the authoring application's paragraph styles to build a logical structure tree with an
        accurate reading order, and it interprets complex layouts better than autotagging applied
        afterwards (
        <Cite href="https://helpx.adobe.com/acrobat/using/creating-accessible-pdfs.html">Adobe</Cite>
        ).
      </P>

      <H2 id="verify">Verify the PDF, not just the Word file</H2>
      <P>
        A clean Accessibility Checker result in Word is a good sign rather than a guarantee about
        the exported PDF. The checker reports the issues it comes across (
        <Cite href="https://support.microsoft.com/en-us/office/make-your-word-documents-accessible-to-people-with-disabilities-d9bf3683-87ac-47ea-b91a-78dcacb3c66d">
          Microsoft
        </Cite>
        ), and Adobe documents specific layouts where tagging still goes wrong (
        <Cite href="https://helpx.adobe.com/acrobat/using/creating-accessible-pdfs.html">Adobe</Cite>
        ). Open the PDF, check the tags, and read it once.
      </P>
      <P>
        This matters beyond PDFs, because the Word file itself counts. Federal guidance treats
        electronic documents, word processing files included, as subject to Section 508 conformance
        when they are publicly available or used in official agency communication (
        <Cite href="https://www.section508.gov/test/documents/">Section508.gov</Cite>), and
        Section508.gov publishes authoring guidance for those formats (
        <Cite href="https://www.section508.gov/create/documents/">Section508.gov</Cite>). If you post
        the .docx, it is in scope too.
      </P>
      <P>
        For the export step in detail, see our guide on{" "}
        <Internal href="/accessibility-guides/articles/save-word-doc-as-pdf">
          saving a Word doc as a PDF
        </Internal>
        , then run{" "}
        <Internal href="/blog/how-to-check-pdf-accessibility-checklist">
          the PDF checking checklist
        </Internal>{" "}
        against the file you produce.
      </P>
    </>
  ),
  resources: [
    {
      label: "Make your Word documents accessible to people with disabilities",
      href: "https://support.microsoft.com/en-us/office/make-your-word-documents-accessible-to-people-with-disabilities-d9bf3683-87ac-47ea-b91a-78dcacb3c66d",
      publisher: "Microsoft",
      note: "Styles, alt text, table rules, links, color, and the read-aloud check.",
    },
    {
      label: "Improve accessibility with the Accessibility Checker",
      href: "https://support.microsoft.com/en-us/office/improve-accessibility-with-the-accessibility-checker-a16f6de0-2f39-4a2b-8bd8-5ad801426c7f",
      publisher: "Microsoft",
      note: "How to run the checker and how to read the Accessibility pane.",
    },
    {
      label: "Create accessible PDFs",
      href: "https://support.microsoft.com/en-us/office/create-accessible-pdfs-064625e0-56ea-4e16-ad71-3aa33bb4b7ed",
      publisher: "Microsoft",
      note: "Windows and Mac export settings, and what accessibility tags enable.",
    },
    {
      label: "Creating accessible PDFs",
      href: "https://helpx.adobe.com/acrobat/using/creating-accessible-pdfs.html",
      publisher: "Adobe",
      note: "Why tagging at conversion beats autotagging after the fact.",
    },
    {
      label: "Images Tutorial",
      href: "https://www.w3.org/WAI/tutorials/images/",
      publisher: "W3C Web Accessibility Initiative",
      note: "How to choose alt text based on the purpose of the image.",
    },
    {
      label: "Create Accessible Documents",
      href: "https://www.section508.gov/create/documents/",
      publisher: "Section508.gov",
      note: "Federal authoring guidance for electronic documents, including Office files.",
    },
    {
      label: "Electronic Documents: Testing and Requirements",
      href: "https://www.section508.gov/test/documents/",
      publisher: "Section508.gov",
      note: "When Office files and PDFs fall under Section 508 conformance expectations.",
    },
  ],
  relatedGuides: [
    { id: "save-word-doc-as-pdf", title: "How to save a Word doc as a PDF (and when NOT to)" },
    { id: "heading-structure-matters", title: "Why heading structure matters (and how to do it right)" },
    { id: "writing-good-alt-text", title: "Writing good alt text: a quick guide" },
  ],
  cta: {
    heading: "Confirm the structure survived the export",
    body: "Upload the exported PDF for a free structural check so you can see whether the headings, alt text, and tags made it through.",
    action: "Open the free checker",
  },
};

/* ------------------------------------------------------------------ */
/* 7. DOJ Title II deadlines for higher education                      */
/* ------------------------------------------------------------------ */

const titleIiDeadlines: BlogPostContent = {
  body: (
    <>
      <P>
        As of August 12, 2026, public institutions covered by the ADA Title II web rule are working
        toward one of two compliance dates: April 26, 2027 or April 26, 2028, depending on the
        population of the government they are part of. Those dates come from an Interim Final Rule
        the Department of Justice published on April 20, 2026 (
        <Cite href="https://www.ada.gov/resources/2024-03-08-web-rule/">ADA.gov</Cite>).
      </P>

      <SimpleTable
        caption="Title II web accessibility compliance dates as stated by ADA.gov and the April 2026 Interim Final Rule."
        headers={["Covered entity", "Compliance date"]}
        rows={[
          ["Total population of 50,000 or more", "April 26, 2027"],
          ["Under 50,000, and special district governments", "April 26, 2028"],
        ]}
      />

      <H2 id="what-the-rule-requires">What the 2024 rule requires</H2>
      <P>
        DOJ's final rule was published in the Federal Register on April 24, 2024, and requires state
        and local government web content and mobile apps to meet WCAG 2.1 Level AA (
        <Cite href="https://www.ada.gov/resources/2024-03-08-web-rule/">ADA.gov</Cite>). Public
        universities and community colleges are explicitly listed among the covered state and local
        government entities (
        <Cite href="https://www.ada.gov/resources/2024-03-08-web-rule/">ADA.gov</Cite>).
      </P>
      <P>
        Documents are not a side issue here. The rule's definition of web content includes
        documents, and content provided under an arrangement with a third party, such as a
        vendor-operated site or platform, is also covered (
        <Cite href="https://www.ada.gov/resources/2024-03-08-web-rule/">ADA.gov</Cite>). For most
        campuses that means the PDF library is in scope alongside the website.
      </P>

      <H2 id="what-changed">What changed in April 2026</H2>
      <P>
        The Interim Final Rule, filed under Docket No. CRT150, RIN 1190-AA82, amending 28 CFR Part
        35, took effect on April 20, 2026. It amended 28 CFR 35.200(b)(1) and (b)(2) so that each
        category of covered entity received a one-year extension (
        <Cite href="https://www.ada.gov/assets/pdfs/2026-ifr.pdf">DOJ Interim Final Rule</Cite>).
      </P>
      <P>
        What it did not do matters just as much. The IFR does not alter other provisions of the 2024
        rule, does not impose new substantive requirements, and does not expand the rule's scope,
        and covered entities retain their ongoing Title II obligations regardless of the compliance
        dates (
        <Cite href="https://www.ada.gov/assets/pdfs/2026-ifr.pdf">DOJ Interim Final Rule</Cite>). The
        technical standard is unchanged: it is still WCAG 2.1 Level AA.
      </P>

      <H2 id="which-date">Which date applies to your institution</H2>
      <P>
        The test is population based, and it is not your enrollment. DOJ's own worked example
        describes a state university with 40,000 students in a state with a 2020 Census population
        of 6,000,000, and gives it the April 2027 date, because the university is part of the state
        rather than a standalone jurisdiction (
        <Cite href="https://www.ada.gov/resources/web-rule-first-steps/">ADA.gov</Cite>).
      </P>
      <P>
        So the first question is not how many students you enroll. It is which government your
        institution is part of, and what population that government has, since the rule sets the
        earlier date for entities with a total population of 50,000 or more and the later one for
        smaller entities and special district governments (
        <Cite href="https://www.ada.gov/resources/2024-03-08-web-rule/">ADA.gov</Cite>). If that
        answer is not obvious for your institution, it is a question for your counsel rather than
        for a vendor.
      </P>

      <H2 id="documents">Documents, and the limits of the exceptions</H2>
      <P>
        Preexisting conventional electronic documents, meaning word processing, presentation, PDF,
        and spreadsheet files posted before the compliance date, usually do not need to meet WCAG
        2.1 AA. The exception falls away if those documents are currently used to apply for, access,
        or participate in a service, program, or activity (
        <Cite href="https://www.ada.gov/resources/2024-03-08-web-rule/">ADA.gov</Cite>). An old
        scholarship application that people still fill out is in scope.
      </P>
      <P>
        Exceptions also do not remove other duties. They do not eliminate obligations for effective
        communication, reasonable modifications, or equal opportunity, and an accessible format may
        still be required on request (
        <Cite href="https://www.ada.gov/resources/2024-03-08-web-rule/">ADA.gov</Cite>). Reading the
        exceptions as permission to ignore a category of files gets that backwards.
      </P>

      <H2 id="open-questions">What is still open</H2>
      <P>
        The IFR requested public comments with a deadline of June 22, 2026, identified by RIN
        1190-AA82 or Docket No. CRT150 (
        <Cite href="https://www.ada.gov/assets/pdfs/2026-ifr.pdf">DOJ Interim Final Rule</Cite>). In
        May 2026, the National Federation of the Blind, represented in part by Democracy Forward,
        sued the Department of Justice and the Department of Health and Human Services, alleging the
        extension violated the Administrative Procedure Act and asking a court to vacate the Interim
        Final Rule (
        <Cite href="https://www.route-fifty.com/customer-experience/2026/05/disability-advocates-sue-over-website-accessibility-delays/413781/">
          Route Fifty
        </Cite>
        ).
      </P>
      <Callout title="Verify before you plan around a date">
        <p>
          The dates in this article are what ADA.gov and the Interim Final Rule state as of August
          12, 2026. We could not confirm any final resolution of that litigation or any post-comment
          final rule superseding the IFR, so treat the current dates as the working assumption and
          re-check{" "}
          <Cite href="https://www.ada.gov/resources/2024-03-08-web-rule/">ADA.gov</Cite> before you
          commit a plan or a budget to them. This article is general information rather than legal
          advice, and ADA.gov describes its own guidance as informal guidance that does not have the
          force of law (
          <Cite href="https://www.ada.gov/resources/web-rule-first-steps/">ADA.gov</Cite>).
        </p>
      </Callout>
      <P>
        For context on scale rather than on obligation, DOJ's economic analysis of the delay
        estimated present-value cost savings of $2.775 billion over ten years at a 7 percent
        discount rate, with about $1.47 billion, or 53 percent, attributed to small entities (
        <Cite href="https://www.ada.gov/assets/pdfs/2026-ifr.pdf">DOJ Interim Final Rule</Cite>).
      </P>

      <H2 id="planning">A practical way to use the extra year</H2>
      <P>
        The additional twelve months are most valuable if they are spent changing how documents are
        produced rather than only clearing the existing pile. A pile you clear without changing the
        intake refills.
      </P>
      <OL>
        <li>Inventory what is published, and record who owns each area.</li>
        <li>
          Rank by use: applications, forms, and current program pages before archives and
          newsletters.
        </li>
        <li>Baseline a representative sample so you know the shape of the problem.</li>
        <li>Train authors on source-file structure so new documents arrive tagged.</li>
        <li>Add accessibility language to procurement so new systems do not add to the queue.</li>
        <li>Re-check the official dates periodically, because this rule is still moving.</li>
      </OL>
      <P>
        Our{" "}
        <Internal href="/blog/document-accessibility-program-colleges-universities">
          program-building article
        </Internal>{" "}
        covers the governance side, the{" "}
        <Internal href="/blog/free-check-to-remediation-workflow">
          five-stage remediation workflow
        </Internal>{" "}
        covers the per-document side, and the{" "}
        <Internal href="/accessibility-guides">Accessibility Guides</Internal> are the training
        layer for the authors who will keep it from coming back.
      </P>
    </>
  ),
  resources: [
    {
      label: "Fact Sheet: New Rule on the Accessibility of Web Content and Mobile Apps",
      href: "https://www.ada.gov/resources/2024-03-08-web-rule/",
      publisher: "ADA.gov",
      note: "Scope, covered entities, WCAG 2.1 AA, exceptions, and the current compliance dates.",
    },
    {
      label: "First Steps Toward Complying with the Rule",
      href: "https://www.ada.gov/resources/web-rule-first-steps/",
      publisher: "ADA.gov",
      note: "DOJ's worked example of how a state university's date is determined.",
    },
    {
      label: "Interim Final Rule, 28 CFR Part 35 (April 2026)",
      href: "https://www.ada.gov/assets/pdfs/2026-ifr.pdf",
      publisher: "U.S. Department of Justice",
      note: "The extension itself, the comment deadline, and the economic analysis.",
    },
    {
      label: "Disability advocates sue over website accessibility delays",
      href: "https://www.route-fifty.com/customer-experience/2026/05/disability-advocates-sue-over-website-accessibility-delays/413781/",
      publisher: "Route Fifty",
      note: "Reporting on the May 2026 challenge to the Interim Final Rule.",
    },
  ],
  relatedGuides: [
    { id: "accessibility-law-title-ii", title: "Accessibility & the law: Title II, Section 508, ADA" },
    { id: "accessibility-101-wcag", title: "Accessibility 101: What WCAG 2.1 AA actually means" },
    { id: "common-accessibility-myths", title: "Common accessibility myths, debunked" },
  ],
  cta: {
    heading: "Start with the documents people actually use",
    body: "Check a handful of the applications, forms, and program pages your students rely on. That sample tells you more about the work ahead than a folder count does.",
    action: "Open the free checker",
  },
};

/* ------------------------------------------------------------------ */
/* 8. VPAT vs ACR                                                      */
/* ------------------------------------------------------------------ */

const vpatVsAcr: BlogPostContent = {
  body: (
    <>
      <P>
        A VPAT is the blank template. An ACR is the completed report about a specific product. Once
        a VPAT has been filled in for a particular product with documented testing results, it is
        called an Accessibility Conformance Report (
        <Cite href="https://www.itic.org/policy/accessibility/vpat">ITI</Cite>). If you ask a vendor
        for a VPAT and they send an empty template, they have technically answered you.
      </P>

      <SimpleTable
        caption="What to ask for, and what you should get back."
        headers={["Artifact", "What it is", "What it must contain"]}
        rows={[
          [
            "VPAT",
            "A free template published by ITI",
            "Empty criteria tables for the chosen standard",
          ],
          [
            "ACR",
            "A completed report for one product version",
            "Conformance levels, remarks, and evaluation methods",
          ],
        ]}
      />

      <H2 id="editions">Pick the right edition before you ask</H2>
      <P>
        The ITI VPAT is free, does not require ITI membership, and the version ITI identifies as
        current is VPAT 2.5Rev, dated April 2025 (
        <Cite href="https://www.itic.org/policy/accessibility/vpat">ITI</Cite>). Editions map to
        standards: 2.5 508 covers the Revised Section 508 standards, which incorporate WCAG 2.0; 2.5
        EU covers EN 301 549, which references WCAG 2.1; 2.5 WCAG covers WCAG 2.0, 2.1, and 2.2; and
        2.5 INT covers all three (
        <Cite href="https://www.itic.org/policy/accessibility/vpat">ITI</Cite>).
      </P>
      <P>
        When selling to the United States federal government, the Revised Section 508 Edition or the
        INT International Edition must be used (
        <Cite href="https://www.section508.gov/sell/how-to-create-acr-with-vpat/">Section508.gov</Cite>
        ). Buyers should name the edition in the request, because a report written against a
        different standard is hard to compare and easy to misread.
      </P>

      <H2 id="levels">Reading the four conformance levels</H2>
      <P>
        The levels are Supports, Partially Supports, Does Not Support, and Not Applicable. ITI notes
        that "partially supports" replaced the older phrase "supports with exceptions" at the
        request of U.S. Access Board representatives (
        <Cite href="https://www.itic.org/policy/accessibility/vpat">ITI</Cite>).
      </P>
      <P>
        Section508.gov defines the terms more tightly for federal use. Supports means at least one
        method of use meets the criterion without known defects, or meets it through equivalent
        facilitation. Does Not Support means the majority of the functionality does not meet the
        criterion. Not Evaluated may only be used in the Level AAA table (
        <Cite href="https://www.section508.gov/sell/how-to-create-acr-with-vpat/">Section508.gov</Cite>
        ).
      </P>
      <P>
        Partially Supports is the level that carries the most information, but only when the remarks
        column is filled in. Remarks and explanations are required whenever a product partially
        supports or does not support a criterion (
        <Cite href="https://www.section508.gov/sell/how-to-create-acr-with-vpat/">Section508.gov</Cite>
        ). A report with a column of Partially Supports and no remarks is not usable evidence.
      </P>

      <H2 id="complete-acr">What a complete ACR contains</H2>
      <P>
        Before you evaluate the criteria tables, check the title page. A complete ACR title page
        includes the organization name, product name, product version, report date given as month
        and year, a product description, contact information, notes, and the evaluation methods
        used, including whether testing was manual, automated, or both and which tools were used (
        <Cite href="https://www.section508.gov/sell/how-to-create-acr-with-vpat/">Section508.gov</Cite>
        ). For federal procurement purposes, only the Level A and Level AA tables are required, and
        the Level AAA table is optional (
        <Cite href="https://www.section508.gov/sell/how-to-create-acr-with-vpat/">Section508.gov</Cite>
        ).
      </P>
      <UL>
        <li>Does the version in the report match the version you are buying?</li>
        <li>Is the report date recent enough to describe that version?</li>
        <li>Do the evaluation methods name real testing, including manual testing?</li>
        <li>Do the remarks explain the gaps in terms a user would recognize?</li>
      </UL>

      <H2 id="procurement">Where the request fits in the buying process</H2>
      <P>
        Federal procurement guidance places the ACR request at step four of six in the pre-award
        sequence, described as requesting accessibility information from vendors. It follows
        determining requirements, conducting market research, and drafting solicitation language,
        and it is followed after award by a distinct step to validate contractor compliance (
        <Cite href="https://www.section508.gov/buy/">Section508.gov</Cite>).
      </P>
      <P>
        Two practical habits come from the same guidance. Request an ACR or VPAT, or other evidence
        of accessibility testing, for each ICT item that is developed, updated, configured, or
        offered as a substitution, based on the latest ITI VPAT version (
        <Cite href="https://www.section508.gov/buy/">Section508.gov</Cite>). And during market
        research, search for existing ACRs, try to identify at least two candidate solutions, and
        document the vendor, version, model, and how well each fits (
        <Cite href="https://www.section508.gov/buy/">Section508.gov</Cite>).
      </P>

      <H2 id="limits">What an ACR is not</H2>
      <P>
        There is no submission process, no certification, and no conformance logo attached to a
        completed VPAT; a vendor may simply post it publicly (
        <Cite href="https://www.itic.org/policy/accessibility/vpat">ITI</Cite>). ITI also states
        there is no pass or fail scale for determining whether a product is accessible or
        inaccessible, and that the criteria are meant to give a holistic picture (
        <Cite href="https://www.itic.org/policy/accessibility/vpat">ITI</Cite>).
      </P>
      <P>
        So an ACR is a structured, self-reported claim. That is genuinely useful, and it is not
        proof. The federal model keeps a separate post-award validation step for exactly that reason
        (<Cite href="https://www.section508.gov/buy/">Section508.gov</Cite>). Two credible vendors
        can also report different results for similar products because their testing methods differ,
        which is the same dynamic we described in{" "}
        <Internal href="/blog/why-accessibility-checkers-disagree">
          why two accessibility checkers disagree
        </Internal>
        .
      </P>

      <H2 id="aging">Reports age faster than products</H2>
      <P>
        An ACR describes one version of a product at one point in time, which is why the report date
        and the version number are part of the required title page information (
        <Cite href="https://www.section508.gov/sell/how-to-create-acr-with-vpat/">Section508.gov</Cite>
        ). A report written two major releases ago may describe an interface that no longer exists,
        in either direction: gaps may have been fixed, or new features may have introduced barriers
        nobody has tested yet.
      </P>
      <P>
        Treat renewals as a natural checkpoint. Asking for a refreshed ACR at renewal, and asking
        what changed since the previous one, keeps the conversation going without turning it into an
        audit. It also tells you something useful about the supplier: vendors who maintain their
        reports usually maintain the underlying work.
      </P>

      <H2 id="how-to-ask">How to ask</H2>
      <P>
        Keep the request specific and answerable. Name the edition, the version, and the evidence
        you want alongside the report.
      </P>
      <OL>
        <li>Ask for a current ACR based on the latest ITI VPAT version for the exact version offered.</li>
        <li>Ask which parts were tested manually and with which assistive technologies.</li>
        <li>Ask for remarks on every criterion marked partially supports or does not support.</li>
        <li>Ask what is on the roadmap for the known gaps, and by when.</li>
        <li>For document services, ask for a sample remediated file you can inspect yourself.</li>
      </OL>
      <P>
        If you are evaluating document remediation specifically, the underlying criteria are covered
        in the <Internal href="/accessibility-guides">Accessibility Guides</Internal>, our{" "}
        <Internal href="/blog/pdf-ua-vs-wcag-vs-section-508">standards explainer</Internal> tells
        you which standard to name, and <Internal href="/pricing">our pricing page</Internal> shows
        how Remedy508 structures its own service.
      </P>
    </>
  ),
  resources: [
    {
      label: "Voluntary Product Accessibility Template (VPAT)",
      href: "https://www.itic.org/policy/accessibility/vpat",
      publisher: "Information Technology Industry Council",
      note: "Editions, the current version, conformance levels, and the absence of certification.",
    },
    {
      label: "How to Create an Accessibility Conformance Report (ACR) with a VPAT",
      href: "https://www.section508.gov/sell/how-to-create-acr-with-vpat/",
      publisher: "Section508.gov",
      note: "Definitions of the conformance terms and the required title page contents.",
    },
    {
      label: "Buy Accessible ICT Products and Services",
      href: "https://www.section508.gov/buy/",
      publisher: "Section508.gov",
      note: "The six-step procurement sequence and where ACR requests belong in it.",
    },
    {
      label: "Information and Communication Technology (ICT) Standards and Guidelines",
      href: "https://www.access-board.gov/ict/",
      publisher: "U.S. Access Board",
      note: "The standards an ACR written for federal buyers is reporting against.",
    },
  ],
  relatedGuides: [
    { id: "accessibility-101-wcag", title: "Accessibility 101: What WCAG 2.1 AA actually means" },
    { id: "accessibility-law-title-ii", title: "Accessibility & the law: Title II, Section 508, ADA" },
    { id: "before-after-real-document", title: "Before & after: a real document remediated" },
  ],
  cta: {
    heading: "Test the claim on your own files",
    body: "Ask any vendor for a current ACR and a sample remediated file, then run a document you already publish through the free checker to see the baseline for yourself.",
    action: "Open the free checker",
  },
};

/* ------------------------------------------------------------------ */
/* 9. PDF tags explained                                               */
/* ------------------------------------------------------------------ */

const pdfTagsExplained: BlogPostContent = {
  body: (
    <>
      <P>
        A PDF tag is a piece of hidden markup that says what a region of the page is: a heading, a
        paragraph, a list item, a table cell, a figure. Tags carry no visual weight. They exist so
        assistive technology can present the document as a structured text rather than as a picture
        of one.
      </P>
      <P>
        That distinction is the whole subject. Two files can look identical on screen and behave
        completely differently out loud, and the tags tree is where the difference lives.
      </P>

      <H2 id="why-tags">Why PDF needed tags at all</H2>
      <P>
        PDF was not originally designed with accessibility in mind. In 2000 the specification was
        extended with tagging in order to add structure and semantics to page content (
        <Cite href="https://pdfa.org/resource/pdfua-flyer/">PDF Association</Cite>). Before that, a
        PDF was a set of drawing instructions: put these glyphs at these coordinates. Nothing in the
        file said that a particular run of glyphs was a heading.
      </P>
      <P>
        Accessibility depends on semantic information that describes logical structure, including
        sections, paragraphs, lists, tables, and other structures, and the PDF feature that
        represents that information is Tagged PDF (
        <Cite href="https://pdfa.org/resource/iso-14289-pdfua/">PDF Association</Cite>).
      </P>

      <H2 id="tags-tree">The tags tree and reading order</H2>
      <P>
        The tags tree establishes the logical reading order for assistive technology, and it is the
        order of the tags that defines that reading order (
        <Cite href="https://www.section508.gov/training/pdfs/aed-cop-pdf03/">Section508.gov</Cite>
        ). Headings, figures, tables, form fields, and paragraphs should each receive individual
        tags (
        <Cite href="https://www.section508.gov/training/pdfs/aed-cop-pdf03/">Section508.gov</Cite>
        ).
      </P>
      <P>
        This is why a visually correct two-column layout can read as gibberish. The columns are
        drawn side by side, but if the tags run across the page instead of down each column, that
        crossing order is what gets spoken.
      </P>

      <H2 id="tag-types">The tags you will actually meet</H2>
      <P>
        Acrobat's Touch-Up Reading Order tool maps its buttons onto specific tags: Text becomes P,
        Heading 1 becomes H1, Figure becomes Figure, Table becomes Table with TR, TH, and TD
        children, Cell becomes TD, Formula becomes Formula, Form Field becomes Form, and Background
        marks content as an artifact (
        <Cite href="https://www.section508.gov/training/pdfs/aed-cop-pdf03/">Section508.gov</Cite>
        ).
      </P>

      <SimpleTable
        caption="Common PDF tags and what each one communicates to assistive technology."
        headers={["Tag", "What it means"]}
        rows={[
          ["P", "A paragraph of body text"],
          ["H1 to H6", "A heading at a given level in the outline"],
          ["Figure", "An image that needs a text alternative"],
          ["Table, TR, TH, TD", "A data table, its rows, header cells, and data cells"],
          ["L, LI", "A list and its individual items"],
          ["Link", "An active link, paired with its visible text"],
          ["Form", "An interactive form field"],
          ["Artifact", "Decoration or page furniture, skipped in reading"],
        ]}
      />

      <P>
        The Touch-Up Reading Order tool creates only a few basic tags. More detailed structures such
        as block quotes, notes, and references need Create Tag from Selection (
        <Cite href="https://www.section508.gov/training/pdfs/aed-cop-pdf03/">Section508.gov</Cite>
        ). Nested structures such as lists can require combining the New Tag tool with Create Tag
        from Selection and then dragging list item tags beneath the List tag (
        <Cite href="https://www.section508.gov/training/pdfs/aed-cop-pdf03/">Section508.gov</Cite>
        ).
      </P>

      <H2 id="two-orders">Content pane and tags tree are two different orders</H2>
      <P>
        A regular source of confusion during remediation: the Content view and the tags tree may not
        be aligned, and they do not necessarily need to be. The tags tree is what defines the
        reading order for assistive technology, and the Order pane is usually the easier way to fix
        it (
        <Cite href="https://www.section508.gov/training/pdfs/aed-cop-pdf03/">Section508.gov</Cite>
        ). Chasing agreement between the two panes wastes time that belongs in the tags tree.
      </P>
      <P>
        Our guide on{" "}
        <Internal href="/accessibility-guides/articles/fixing-reading-order">
          fixing reading order in a remediated PDF
        </Internal>{" "}
        walks through the panes with screenshots.
      </P>

      <H2 id="how-tags-break">How tags break</H2>
      <H3>Autotagging misreads the layout</H3>
      <P>
        Acrobat builds a tag tree by analyzing page elements, their hierarchy, and the intended
        reading order, but automatic tagging can misinterpret complex layouts and may tag items such
        as decorative page borders or drop caps as figures (
        <Cite href="https://helpx.adobe.com/acrobat/using/creating-accessible-pdfs.html">Adobe</Cite>
        ). Autotagging is a starting point, and the tags it produces have to be examined and
        manually corrected where they misrepresent the structure (
        <Cite href="https://www.section508.gov/training/pdfs/aed-cop-pdf03/">Section508.gov</Cite>
        ).
      </P>

      <H3>Empty tags accumulate after edits</H3>
      <P>
        Tags left without content after editing trigger accessibility errors in Acrobat's checker
        and should be deleted (
        <Cite href="https://www.section508.gov/training/pdfs/aed-cop-pdf03/">Section508.gov</Cite>
        ). They are a common leftover from cut-and-paste revisions to an already-remediated file.
      </P>

      <H3>Language is set separately</H3>
      <P>
        Setting the document language matters alongside the tags, because it lets a screen reader
        choose the correct speech synthesizer, and passages in another language need the language
        set on their own tags (
        <Cite href="https://www.section508.gov/training/pdfs/aed-cop-pdf03/">Section508.gov</Cite>
        ). A course catalog with Spanish program names benefits from per-tag language even when the
        document language is English.
      </P>

      <H3>Artifacts and the content that should be skipped</H3>
      <P>
        Not everything on a page is content. Running headers, page numbers, decorative rules, and
        watermarks are page furniture, and marking them as artifacts keeps them out of the reading
        sequence. Acrobat's Touch-Up Reading Order tool provides a Background control for exactly
        that purpose (
        <Cite href="https://www.section508.gov/training/pdfs/aed-cop-pdf03/">Section508.gov</Cite>
        ). Getting this wrong is quietly disruptive: a page number announced between every paragraph
        breaks the thread of a long document, and a decorative border tagged as a figure prompts a
        request for alt text that has nothing useful to say.
      </P>

      <H2 id="quality">Tagged is not the same as accessible</H2>
      <P>
        PDF/UA, defined in ISO 14289, describes the correct use of PDF tagging for maximum
        accessibility, and PDF/UA-1 defines the use of tagged PDF in ISO 32000-1, or PDF 1.7, files
        (<Cite href="https://pdfa.org/resource/pdfua-flyer/">PDF Association</Cite>;{" "}
        <Cite href="https://pdfa.org/resource/iso-14289-pdfua/">PDF Association</Cite>). Even so, the
        PDF Association states that conformity to PDF/UA by itself does not necessarily ensure the
        accessibility of a document's content (
        <Cite href="https://pdfa.org/resource/iso-14289-pdfua/">PDF Association</Cite>).
      </P>
      <P>
        Tags describe structure. They cannot make an unhelpful alt text accurate, or a heading label
        meaningful. For deeper syntax guidance, the PDF Association's Tagged PDF Best Practice
        Guide: Syntax, published in 2019 and updated on July 26, 2023, covers the standard structure
        types and attributes in PDF 1.7 along with forward-looking PDF 2.0 guidance, and notes that
        most PDF documents do not follow its recommendations (
        <Cite href="https://pdfa.org/resource/tagged-pdf-best-practice-guide-syntax/">
          PDF Association
        </Cite>
        ).
      </P>
      <P>
        If you want the specific case where this gets hardest, tables are it: our post on{" "}
        <Internal href="/blog/accessible-pdf-tables-what-tools-detect">
          accessible PDF tables
        </Internal>{" "}
        covers header cells and scope, and{" "}
        <Internal href="/blog/pdf-ua-vs-wcag-vs-section-508">the standards explainer</Internal>{" "}
        covers how tagging claims relate to WCAG and Section 508.
      </P>
    </>
  ),
  resources: [
    {
      label: "ISO 14289 (PDF/UA)",
      href: "https://pdfa.org/resource/iso-14289-pdfua/",
      publisher: "PDF Association",
      note: "What Tagged PDF represents and the limits of PDF/UA conformity.",
    },
    {
      label: "PDF/UA flyer",
      href: "https://pdfa.org/resource/pdfua-flyer/",
      publisher: "PDF Association",
      note: "The 2000 tagging extension and what PDF/UA sets out to define.",
    },
    {
      label: "Tagged PDF Best Practice Guide: Syntax",
      href: "https://pdfa.org/resource/tagged-pdf-best-practice-guide-syntax/",
      publisher: "PDF Association",
      note: "Structure types and attributes for PDF 1.7, with PDF 2.0 guidance.",
    },
    {
      label: "Module 3: Remediating PDFs",
      href: "https://www.section508.gov/training/pdfs/aed-cop-pdf03/",
      publisher: "Section508.gov",
      note: "Tag mappings, nested lists, empty tags, and language settings.",
    },
    {
      label: "Creating accessible PDFs",
      href: "https://helpx.adobe.com/acrobat/using/creating-accessible-pdfs.html",
      publisher: "Adobe",
      note: "How Acrobat builds a tag tree and where automatic tagging misreads a layout.",
    },
  ],
  relatedGuides: [
    { id: "fixing-reading-order", title: "Fixing reading order in a remediated PDF" },
    { id: "making-tables-accessible", title: "Making tables accessible" },
    { id: "heading-structure-matters", title: "Why heading structure matters (and how to do it right)" },
  ],
  cta: {
    heading: "See what your document's structure looks like",
    body: "Run a free check to find out whether your file is tagged at all, and which structures are present, missing, or mislabeled.",
    action: "Open the free checker",
  },
};

/* ------------------------------------------------------------------ */
/* 10. Building a document accessibility program                       */
/* ------------------------------------------------------------------ */

const documentAccessibilityProgram: BlogPostContent = {
  body: (
    <>
      <P>
        A document accessibility program is the set of policies, roles, training, and routines that
        keeps published files usable without depending on any one person's diligence. Campuses that
        treat documents as a subset of web accessibility usually find the documents come last,
        because they are produced by hundreds of people outside the web team.
      </P>
      <P>
        The framework below borrows from two public models: W3C's planning and managing guidance,
        and the federal Section 508 program management material. Neither is binding on a college.
        Both describe practices that have already been tested at scale.
      </P>

      <H2 id="how-to-build">How to build a document accessibility program</H2>
      <OL>
        <li>Assess the current state and build the case for the work.</li>
        <li>Write a policy that names a standard and a level.</li>
        <li>Assign responsibilities, including who signs off.</li>
        <li>Train the authors who create the documents.</li>
        <li>Triage the backlog by use rather than by folder.</li>
        <li>Monitor, measure, and report on progress.</li>
        <li>Put accessibility requirements into procurement.</li>
      </OL>

      <H2 id="understand">Start by understanding, not by buying</H2>
      <P>
        W3C's planning and managing framework groups the work into four areas. Developing
        understanding and enthusiasm covers learning the basics, exploring the current environment,
        setting objectives, developing the business case, raising awareness, and gathering support.
        Setting goals and a supportive environment covers creating an accessibility policy,
        assigning responsibilities, determining budget and resources, reviewing the environment and
        existing sites, establishing a monitoring framework, and engaging stakeholders. Ensuring
        capability covers building skills, integrating goals into policies, assigning tasks,
        evaluating early and regularly, prioritizing issues, and tracking and communicating
        progress. The fourth is continuing review (
        <Cite href="https://www.w3.org/WAI/planning-and-managing/">W3C WAI</Cite>).
      </P>
      <P>
        W3C also notes these activities are not necessarily sequential and are ideally repeated over
        time to raise capability (
        <Cite href="https://www.w3.org/WAI/planning-and-managing/">W3C WAI</Cite>). That framing is
        helpful when a program stalls because someone is waiting for the policy to be finished
        before doing anything else.
      </P>

      <H2 id="policy">Policy: reference standards rather than restating them</H2>
      <P>
        An accessibility policy can stand alone or be integrated into non-discrimination or equal
        opportunity policies, and accessibility should also appear in brand guidelines, coding
        standards, and project management frameworks (
        <Cite href="https://www.w3.org/WAI/planning/org-policies/">W3C WAI</Cite>). Policies should
        reference specific standards, and W3C notes that Level AA is the generally accepted
        conformance level in many countries, with the policy stating the level for each referenced
        standard (
        <Cite href="https://www.w3.org/WAI/planning/org-policies/">W3C WAI</Cite>).
      </P>
      <P>
        Because standards evolve, a policy should reference the W3C and WAI standards and define a
        mechanism for transitioning to newer versions rather than restating requirements that go
        stale (
        <Cite href="https://www.w3.org/WAI/planning/org-policies/">W3C WAI</Cite>). Scope should
        explicitly address third-party content, legacy content, and mobile content, and institutions
        should consider publishing an accessibility statement reflecting the policy, goals, and
        achievements (
        <Cite href="https://www.w3.org/WAI/planning/org-policies/">W3C WAI</Cite>).
      </P>
      <P>
        For public institutions, the standard named in policy usually tracks the Title II
        requirement of WCAG 2.1 Level AA (
        <Cite href="https://www.ada.gov/resources/2024-03-08-web-rule/">ADA.gov</Cite>). Our{" "}
        <Internal href="/blog/pdf-ua-vs-wcag-vs-section-508">standards explainer</Internal> covers
        how the standards relate to each other.
      </P>

      <H2 id="roles">Roles: someone has to own it</H2>
      <P>
        The federal program manager model is a useful template for what ownership means in practice.
        It includes leading policies across procurement, development, content publication, and site
        management; ensuring conformance claims are validated; ensuring staff have the training and
        tools they need; assessing program maturity and reporting on it; responding to complaints;
        and tracking remediation efforts (
        <Cite href="https://www.section508.gov/manage/program-manager-responsibilities/">
          Section508.gov
        </Cite>
        ).
      </P>
      <P>
        The same source lists the relationships such a role depends on: technology providers and
        development teams, operations, acquisition teams, communications and training, civil rights
        and accommodation officials, human resources, and legal (
        <Cite href="https://www.section508.gov/manage/program-manager-responsibilities/">
          Section508.gov
        </Cite>
        ). On a campus that maps onto IT, the provost's office, disability services, procurement,
        marketing and communications, HR, and general counsel. This is federal-agency guidance being
        borrowed as a practice model, not a legal requirement for colleges.
      </P>

      <H2 id="skills">Training and tooling</H2>
      <P>
        Author training is the highest-leverage part of a document program, because a document
        authored with real headings, real tables, and real alt text needs almost no remediation.
        Give authors a short, specific curriculum tied to the tools they actually use, and keep it
        current. The{" "}
        <Internal href="/accessibility-guides">Accessibility Guides</Internal> are built for that
        layer, and our{" "}
        <Internal href="/blog/accessible-word-document-before-pdf-export">Word article</Internal>{" "}
        covers the pre-export routine.
      </P>
      <P>
        Plan for mixed methods rather than a single tool. W3C states that tools cannot check
        everything automatically, that human judgment is required, that tools can produce misleading
        results, and that teams often benefit from a combination of tools used across different
        roles and stages (
        <Cite href="https://www.w3.org/WAI/test-evaluate/tools/selecting/">W3C WAI</Cite>).
        Preliminary checks are useful for triage but not conclusive: W3C's Easy Checks give a rough
        idea and warn explicitly that content can appear to pass and still have significant barriers
        (<Cite href="https://www.w3.org/WAI/test-evaluate/preliminary/">W3C WAI</Cite>).
      </P>

      <H2 id="triage">Triage by use, not by folder</H2>
      <P>
        There is a legal logic to prioritization for public institutions. Documents currently used
        to apply for, access, or participate in a service, program, or activity do not fall under
        the preexisting document exception even if they were posted before the compliance date (
        <Cite href="https://www.ada.gov/resources/2024-03-08-web-rule/">ADA.gov</Cite>). Public
        universities and community colleges are covered entities, with compliance dates of April 26,
        2027 or April 26, 2028 depending on the applicable population (
        <Cite href="https://www.ada.gov/resources/2024-03-08-web-rule/">ADA.gov</Cite>;{" "}
        <Cite href="https://www.ada.gov/resources/web-rule-first-steps/">ADA.gov</Cite>), and{" "}
        <Internal href="/blog/doj-title-ii-web-accessibility-deadlines-higher-education">
          our Title II article
        </Internal>{" "}
        covers the current state of those dates.
      </P>
      <P>
        In practice that produces a workable order: forms and applications people submit, current
        program and course documents, high-traffic public documents, then the archive.
      </P>

      <H2 id="monitor">Monitor and report honestly</H2>
      <P>
        Federal program management resources cover laws and policy quick references, developing a
        website accessibility statement, establishing a formal complaint process, training plans,
        and policy assessment frameworks, all of which translate reasonably well into campus
        governance documents (
        <Cite href="https://www.section508.gov/manage/">Section508.gov</Cite>).
      </P>
      <P>
        Report what you can defend: documents checked, documents remediated, authors trained, new
        publications arriving already tagged. Avoid a single percentage-conformant number for the
        whole institution, because no method produces that number reliably, and defending it later
        is harder than never publishing it.
      </P>

      <H2 id="procurement">Close the intake with procurement</H2>
      <P>
        Programs that only remediate never finish. The federal buying model runs six steps from
        determining accessibility requirements through validating contractor compliance after award,
        and asks buyers to request an ACR or VPAT for each ICT item (
        <Cite href="https://www.section508.gov/buy/">Section508.gov</Cite>). Applying that to systems
        that generate documents, such as an LMS, a CRM, or a form builder, stops the backlog
        regenerating faster than you clear it. Our{" "}
        <Internal href="/blog/vpat-vs-acr-what-buyers-should-request">VPAT and ACR article</Internal>{" "}
        covers what to ask for and how to read the answer, and{" "}
        <Internal href="/pricing">our pricing page</Internal> covers the outsourced-capacity part of
        a plan.
      </P>

      <H2 id="first-90">A first 90 days that works</H2>
      <OL>
        <li>Name an owner and a small working group with a standing meeting.</li>
        <li>Inventory the highest-use documents in three or four key areas.</li>
        <li>Baseline a sample so you can describe the problem with evidence.</li>
        <li>Draft the policy, naming a standard, a level, and a review mechanism.</li>
        <li>Run one author training session for the biggest publishing team.</li>
        <li>Add accessibility language to one procurement in flight.</li>
        <li>Publish a short internal progress note, then repeat the loop.</li>
      </OL>
      <P>
        None of this promises immunity from complaints, and it should not be sold that way
        internally. It reduces risk, improves service, and makes the work visible and repeatable,
        which is what actually sustains a program past its first year.
      </P>
    </>
  ),
  resources: [
    {
      label: "Planning and Managing Web Accessibility",
      href: "https://www.w3.org/WAI/planning-and-managing/",
      publisher: "W3C Web Accessibility Initiative",
      note: "The four-area framework this program structure is based on.",
    },
    {
      label: "Developing an Accessibility Policy",
      href: "https://www.w3.org/WAI/planning/org-policies/",
      publisher: "W3C Web Accessibility Initiative",
      note: "What a policy should reference, and how to scope legacy and third-party content.",
    },
    {
      label: "Section 508 Program Manager Responsibilities",
      href: "https://www.section508.gov/manage/program-manager-responsibilities/",
      publisher: "Section508.gov",
      note: "A role model for ownership, validation, training, and stakeholder relationships.",
    },
    {
      label: "Policy and Management",
      href: "https://www.section508.gov/manage/",
      publisher: "Section508.gov",
      note: "Accessibility statements, complaint processes, training plans, and assessments.",
    },
    {
      label: "Buy Accessible ICT Products and Services",
      href: "https://www.section508.gov/buy/",
      publisher: "Section508.gov",
      note: "The procurement steps that keep new systems from adding to the backlog.",
    },
    {
      label: "Selecting Web Accessibility Evaluation Tools",
      href: "https://www.w3.org/WAI/test-evaluate/tools/selecting/",
      publisher: "W3C Web Accessibility Initiative",
      note: "Why a program needs mixed methods rather than one tool.",
    },
    {
      label: "Fact Sheet: New Rule on the Accessibility of Web Content and Mobile Apps",
      href: "https://www.ada.gov/resources/2024-03-08-web-rule/",
      publisher: "ADA.gov",
      note: "Covered entities, document scope, and the preexisting document exception.",
    },
    {
      label: "First Steps Toward Complying with the Rule",
      href: "https://www.ada.gov/resources/web-rule-first-steps/",
      publisher: "ADA.gov",
      note: "How compliance dates are determined for institutions like public universities.",
    },
    {
      label: "Easy Checks: A First Review of Web Accessibility",
      href: "https://www.w3.org/WAI/test-evaluate/preliminary/",
      publisher: "W3C Web Accessibility Initiative",
      note: "A triage method, with an explicit warning about treating it as conclusive.",
    },
  ],
  relatedGuides: [
    { id: "accessibility-law-title-ii", title: "Accessibility & the law: Title II, Section 508, ADA" },
    { id: "accessibility-101-wcag", title: "Accessibility 101: What WCAG 2.1 AA actually means" },
    {
      id: "how-to-check-your-output-is-accessible",
      title: "How to check that your output is actually accessible",
    },
  ],
  cta: {
    heading: "Give your plan a real baseline",
    body: "Check a representative sample of the documents your students and applicants actually use. A sample with evidence behind it makes a far better case than an estimate.",
    action: "Open the free checker",
  },
};

export const EXPANSION_CONTENT: Record<string, BlogPostContent> = {
  "how-to-check-pdf-accessibility-checklist": pdfAccessibilityChecklist,
  "what-is-pdf-remediation-process-cost-drivers": whatIsPdfRemediation,
  "pdf-ua-vs-wcag-vs-section-508": pdfUaWcagSection508,
  "scanned-pdf-accessibility-ocr-manual-review": scannedPdfOcr,
  "accessible-pdf-forms-labels-instructions-keyboard-order": accessiblePdfForms,
  "accessible-word-document-before-pdf-export": accessibleWordDocument,
  "doj-title-ii-web-accessibility-deadlines-higher-education": titleIiDeadlines,
  "vpat-vs-acr-what-buyers-should-request": vpatVsAcr,
  "pdf-tags-explained-structure-screen-readers-use": pdfTagsExplained,
  "document-accessibility-program-colleges-universities": documentAccessibilityProgram,
};
