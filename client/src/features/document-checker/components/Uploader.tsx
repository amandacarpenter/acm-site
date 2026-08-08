import { useId, useRef, useState } from 'react';
import {
  TriangleAlert,
  Check,
  FileText,
  Image as ImageIcon,
  Languages,
  Link2,
  ListTree,
  Lock,
  ScanLine,
  Table2,
  CloudUpload,
} from 'lucide-react';
import { ACCEPTED_EXTENSIONS, validateFile, type ValidationError } from '../lib/analyze';

interface Props {
  onFile: (file: File) => void;
  error: ValidationError | null;
  setError: (e: ValidationError | null) => void;
}

const CHECKS = [
  {
    icon: ListTree,
    title: 'Structure and headings',
    body: 'Heading styles in Word, title placeholders in PowerPoint, and the document tag tree in PDF.',
  },
  {
    icon: ImageIcon,
    title: 'Alternative text',
    body: 'Images and shapes that carry no description, plus descriptions that look like auto-generated placeholders.',
  },
  {
    icon: ScanLine,
    title: 'Real text vs. images of text',
    body: 'Whether a selectable text layer exists, and which pages or slides appear to be scans.',
  },
  {
    icon: Link2,
    title: 'Link purpose',
    body: 'Links labelled “click here”, empty link text, and bare URLs read out character by character.',
  },
  {
    icon: Table2,
    title: 'Tables and forms',
    body: 'Word table header rows, PDF Table/TR/TH/TD nesting, PDF header associations, and form field labels.',
  },
  {
    icon: Languages,
    title: 'Language and metadata',
    body: 'Declared document language, document title, and bookmarks in longer PDFs.',
  },
];

export function Uploader({ onFile, error, setError }: Props) {
  const [dragging, setDragging] = useState(false);
  const inputRef = useRef<HTMLInputElement>(null);
  const inputId = useId();
  const descId = useId();

  function handleFiles(files: FileList | null) {
    setError(null);
    const file = files?.[0];
    if (!file) return;
    const problem = validateFile(file);
    if (problem) {
      setError(problem);
      return;
    }
    onFile(file);
  }

  return (
    <>
      <section className="hero" aria-labelledby="hero-title">
        <div className="wrap hero-grid">
          <div className="hero-copy">
            <p className="eyebrow">
              <Lock size={14} aria-hidden="true" />
              Free Document Accessibility Checker
            </p>
            <h1 className="hero-title" id="hero-title">
              Check your document for <span className="accent">accessibility problems</span>.
            </h1>
            <p className="hero-lede">
              Drop in a PDF, Word document, or PowerPoint deck. The Remedy508 Accessibility Checker inspects the file’s
              structure and returns a prioritized list of what to fix, usually in a few seconds.
            </p>
            <ul className="hero-points">
              <li>
                <Check size={18} aria-hidden="true" />
                <span>
                  Your file never leaves this device. Parsing happens locally with JavaScript; nothing is uploaded,
                  stored, or sent to a server.
                </span>
              </li>
              <li>
                <Check size={18} aria-hidden="true" />
                <span>
                  Findings are written in plain language and mapped to the WCAG 2.1 AA and Section 508 criteria they
                  relate to.
                </span>
              </li>
              <li>
                <Check size={18} aria-hidden="true" />
                <span>Free, no account, no email address required.</span>
              </li>
            </ul>
          </div>

          <div className="upload-card">
            <div
              className={`dropzone${dragging ? ' is-over' : ''}`}
              onDragOver={(e) => {
                e.preventDefault();
                setDragging(true);
              }}
              onDragLeave={() => setDragging(false)}
              onDrop={(e) => {
                e.preventDefault();
                setDragging(false);
                handleFiles(e.dataTransfer.files);
              }}
              data-testid="dropzone"
            >
              <CloudUpload className="dropzone-icon" size={38} aria-hidden="true" />
              <h2 id={`${inputId}-label`}>Check a document</h2>
              <p className="dropzone-hint" id={descId}>
                Drag a file here, or choose one from your device.
              </p>
              <label className="btn btn-primary btn-lg" htmlFor={inputId}>
                <FileText size={18} aria-hidden="true" />
                Choose a file
              </label>
              <input
                ref={inputRef}
                id={inputId}
                className="file-input"
                type="file"
                accept={ACCEPTED_EXTENSIONS.join(',')}
                aria-describedby={descId}
                data-testid="input-file"
                onChange={(e) => {
                  handleFiles(e.target.files);
                  e.target.value = '';
                }}
              />
            </div>

            <div className="upload-meta">
              <span>
                <FileText size={14} aria-hidden="true" />
                PDF, DOCX, PPTX
              </span>
              <span>Up to 50 MB</span>
              <span>No upload, no account</span>
            </div>

            <div role="alert" aria-live="assertive" data-testid="upload-error">
              {error && (
                <div className="alert">
                  <TriangleAlert size={18} aria-hidden="true" />
                  <span>
                    <strong>{error.title}</strong>
                    {error.message}
                  </span>
                </div>
              )}
            </div>

          </div>
        </div>
      </section>

      <section className="section" aria-labelledby="checks-title">
        <div className="wrap">
          <div className="section-head">
            <h2 id="checks-title">What this accessibility checker looks at</h2>
            <p>
              These are the properties an automated tool can read directly out of a document file. They catch the
              errors that block assistive technology most often — and they are the ones that are cheapest to fix
              before publication.
            </p>
          </div>
          <ul className="check-list">
            {CHECKS.map(({ icon: Icon, title, body }) => (
              <li key={title}>
                <Icon size={19} aria-hidden="true" />
                <div>
                  <h3>{title}</h3>
                  <p>{body}</p>
                </div>
              </li>
            ))}
          </ul>
        </div>
      </section>

      <section className="section" aria-labelledby="method-title">
        <div className="wrap">
          <div className="section-head">
            <h2 id="method-title">How the check works</h2>
            <p>
              Nothing here is a black box. Word and PowerPoint files are ZIP packages of XML, and PDFs expose their
              catalog through a browser PDF engine — so the whole inspection can run on your machine.
            </p>
          </div>
          <div className="method">
            <ol className="method-steps">
              <li>
                <div>
                  <h3>The file is opened locally</h3>
                  <p>
                    DOCX and PPTX packages are unzipped in memory with JSZip. PDFs are parsed with Mozilla’s pdf.js
                    and pdf-lib. No network request carries your document.
                  </p>
                </div>
              </li>
              <li>
                <div>
                  <h3>Structural properties are read</h3>
                  <p>
                    Heading styles, slide titles, alt text attributes, hyperlink targets, table structures and header
                    associations, form field tooltips, language values, and text layers are pulled from the file.
                  </p>
                </div>
              </li>
              <li>
                <div>
                  <h3>Findings are graded and explained</h3>
                  <p>
                    Each check returns Critical, Warning, Passed, or Needs review, with the reason it matters and the
                    steps to fix it in the authoring tool you already use.
                  </p>
                </div>
              </li>
            </ol>
            <div className="note-card">
              <h3>Where automation stops</h3>
              <p>
                Roughly a third of accessibility requirements cannot be judged by software at all. Whether alt text is
                accurate, whether reading order makes sense, whether a heading describes its section — these need a
                person.
              </p>
              <p>
                The checker can inspect a PDF tag tree and report table nesting and header associations when they are
                present. It cannot judge whether those relationships match the visual meaning of the table or confirm
                full PDF/UA conformance, so those questions still require human review.
              </p>
            </div>
          </div>
        </div>
      </section>
    </>
  );
}
