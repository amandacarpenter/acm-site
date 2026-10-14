import { useId, useState } from 'react';
import {
  CloudUpload,
  FileText,
  Heading,
  Image as ImageIcon,
  Keyboard,
  Link2,
  ScanLine,
  Table2,
  TriangleAlert,
} from 'lucide-react';
import { SIM_ACCEPT, validateSimFile } from '../lib/load';
import type { SimValidationError } from '../lib/types';

interface Props {
  onFile: (file: File) => void;
  error: SimValidationError | null;
  setError: (e: SimValidationError | null) => void;
  compact?: boolean;
}

const HEARS = [
  {
    icon: Heading,
    title: 'Headings and reading order',
    body: 'Each heading level, read in the order a screen reader follows, with skipped levels and empty headings flagged.',
  },
  {
    icon: ImageIcon,
    title: 'Image descriptions',
    body: 'The alt text read aloud for each graphic, plus images with no description or a placeholder description.',
  },
  {
    icon: Table2,
    title: 'Tables and lists',
    body: 'Table size, header cells, and cell positions, and lists announced with their item count.',
  },
  {
    icon: Link2,
    title: 'Links and form fields',
    body: 'Link text as it is announced, empty or vague links, and form fields with no label.',
  },
  {
    icon: ScanLine,
    title: 'Untagged and scanned pages',
    body: 'Untagged PDFs and scanned pages are read too, with a clear note about what a screen reader would miss.',
  },
  {
    icon: Keyboard,
    title: 'Screen reader navigation',
    body: 'Jump by heading, table, list, link, graphic, form field, or issue with the same single-key shortcuts screen reader users rely on.',
  },
];

export function SimUploader({ onFile, error, setError, compact = false }: Props) {
  const [dragging, setDragging] = useState(false);
  const inputId = useId();
  const descId = useId();

  function handleFiles(files: FileList | null) {
    setError(null);
    const file = files?.[0];
    if (!file) return;
    const problem = validateSimFile(file);
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
              data-testid="sim-dropzone"
            >
              <CloudUpload className="dropzone-icon" size={38} aria-hidden="true" />
              <h2 id={`${inputId}-label`}>Simulate a document</h2>
              <p className="dropzone-hint" id={descId}>
                Drag a PDF or Word file here, or choose one from your device.
              </p>
              <label className="btn btn-primary btn-lg" htmlFor={inputId}>
                <FileText size={18} aria-hidden="true" />
                Choose a file
              </label>
              <input
                id={inputId}
                className="file-input"
                type="file"
                accept={SIM_ACCEPT}
                aria-describedby={descId}
                data-testid="sim-input-file"
                onChange={(e) => {
                  handleFiles(e.target.files);
                  e.target.value = '';
                }}
              />
            </div>

            <div className="upload-meta">
              <span>
                <FileText size={14} aria-hidden="true" />
                PDF and Word files up to 50 MB
              </span>
              <span>Read in your browser</span>
              <span>Document contents are not uploaded</span>
            </div>

            <p className="disclaimer" data-testid="sim-privacy-note">
              <ScanLine size={18} aria-hidden="true" />
              <span>
                <strong>Private document processing.</strong> Your document is opened and read in your browser. It is
                not uploaded or saved, and the simulation does not record your filename.
              </span>
            </p>

            <p className="disclaimer" data-testid="sim-automation-note">
              <TriangleAlert size={18} aria-hidden="true" />
              <span>
                <strong>A simulation, not certification.</strong> NVDA, JAWS, and VoiceOver each announce content a
                little differently. Confirm final documents with a real screen reader.
              </span>
            </p>

            <div role="alert" aria-live="assertive" data-testid="sim-upload-error">
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

      {!compact && (
        <section className="section" aria-labelledby="sim-hears-title">
          <div className="wrap">
            <div className="section-head">
              <h2 id="sim-hears-title">What you will hear</h2>
              <p>
                The simulation reads your document's structure the way a screen reader does, so you can hear problems
                that are easy to miss by looking at the page.
              </p>
            </div>
            <ul className="check-list">
              {HEARS.map(({ icon: Icon, title, body }) => (
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
      )}

      {!compact && (
        <section className="section" aria-labelledby="sim-method-title">
          <div className="wrap">
            <div className="section-head">
              <h2 id="sim-method-title">How it works</h2>
              <p>Your document is read directly in your browser and is never uploaded or saved.</p>
            </div>
            <div className="method">
              <ol className="method-steps">
                <li>
                  <div>
                    <h3>The file is opened locally</h3>
                    <p>
                      PDFs are opened with Mozilla's pdf.js and Word files are unpacked in memory. No network request
                      carries your document contents.
                    </p>
                  </div>
                </li>
                <li>
                  <div>
                    <h3>The reading order is built</h3>
                    <p>
                      PDF tags and Word styles are turned into the sequence a screen reader follows, including heading
                      levels, list and table announcements, link text, and alt text.
                    </p>
                  </div>
                </li>
                <li>
                  <div>
                    <h3>You listen and navigate</h3>
                    <p>
                      Press Play to hear it read aloud with your browser's voice, or move by heading, table, link, or
                      issue. The page view highlights what is being read.
                    </p>
                  </div>
                </li>
              </ol>
              <div className="note-card">
                <h3>Where the simulation stops</h3>
                <p>
                  The simulation shows what a screen reader is given to work with. It cannot tell you whether alt text
                  is accurate or whether a heading describes its section; those still need a person.
                </p>
                <p>
                  Each screen reader has its own wording and verbosity settings, so use the simulation to find and fix
                  problems early, then confirm final files with NVDA, JAWS, or VoiceOver.
                </p>
              </div>
            </div>
          </div>
        </section>
      )}
    </>
  );
}
