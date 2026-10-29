import { useId } from "react";
import "./document-size-choice.css";

export type DocumentSize = "standard" | "large";
export default function DocumentSizeChoice({ value, onChange, disabled = false }: {
  value: DocumentSize; onChange: (value: DocumentSize) => void; disabled?: boolean;
}) {
  const id = useId();
  return <fieldset className="document-size-choice" disabled={disabled}>
    <legend>Document size</legend>
    <div className="document-size-options">
      {([
        ["standard", "Standard (up to 50 pages)", "Word or PDF"],
        ["large", "Large document (over 50 pages)", "PDF · Up to 400 pages"],
      ] as const).map(([mode, title, detail]) => <label key={mode} className={value === mode ? "is-selected" : ""}>
        <input type="radio" name={id} value={mode} checked={value === mode}
          onChange={() => onChange(mode)} />
        <span><strong>{title}</strong><small>{detail}</small></span>
      </label>)}
    </div>
    {disabled && <p className="document-size-hint">Wait for this upload to finish, or pause the large-document job, before switching modes.</p>}
  </fieldset>;
}
