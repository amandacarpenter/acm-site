import { useId, useRef, useState } from 'react';
import {
  TriangleAlert,
  FileText,
  Image as ImageIcon,
  Languages,
  Link2,
  ListTree,
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
    body: 'Heading styles, document titles, and the structural tag tree used by assistive technology.',
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
      <section className="checker-upload" aria-labelledby={`${inputId}-label`}>
        <div className="wrap upload-wrap">
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
                Documents up to 50 MB
              </span>
              <span>Checked in your browser</span>
              <span>Document contents are not uploaded</span>
            </div>

            <p className="disclaimer" data-testid="checker-privacy-note">
              <ScanLine size={18} aria-hidden="true" />
              <span>
                <strong>Private document processing.</strong> Your document contents stay in your browser and are not
                saved. Remedy508 records the filename and basic check metadata for internal usage reporting for up to
                90 days.
              </span>
            </p>

            <p className="disclaimer" data-testid="checker-automation-note">
              <TriangleAlert size={18} aria-hidden="true" />
              <span>
                <strong>Automated guidance, not certification.</strong> The checker identifies machine-detectable
                barriers. Manual review is still needed to confirm accessibility and compliance.
              </span>
            </p>

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
            <h2 id="checks-title">What Remedy508 Accessibility Checker looks for</h2>
            <p>
              These are the properties an automated tool can read directly out of a document file. They catch the
              barriers that affect assistive technology most often and are most efficient to address before
              publication.
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
            <h2 id="method-title">How it works</h2>
            <p>
              Document contents are inspected directly in your browser and are never uploaded or saved.
            </p>
          </div>
          <div className="method">
            <ol className="method-steps">
              <li>
                <div>
                  <h3>The file is opened locally</h3>
                  <p>
                    Document packages are opened in memory and PDFs are parsed with Mozilla’s pdf.js and pdf-lib. No
                    network request carries your document contents. Only the filename and basic check metadata are
                    recorded for internal usage reporting.
                  </p>
                </div>
              </li>
              <li>
                <div>
                  <h3>Structural properties are read</h3>
                  <p>
                    Heading styles, document titles, alt text attributes, hyperlink targets, table structures and
                    header associations, form field labels, language values, and text layers are read from the file.
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
