import { useState, type ReactNode } from "react";

/** Human summary first; optional raw JSON. */
export function RawBlock({
  summary,
  raw,
  showLabel,
  hideLabel,
}: {
  summary: ReactNode;
  raw: unknown;
  showLabel: string;
  hideLabel: string;
}) {
  const [open, setOpen] = useState(false);
  return (
    <div className="raw-block">
      <div className="raw-summary">{summary}</div>
      <button type="button" className="btn ghost mini" onClick={() => setOpen((v) => !v)}>
        {open ? hideLabel : showLabel}
      </button>
      {open && <pre className="code-block">{JSON.stringify(raw, null, 2)}</pre>}
    </div>
  );
}
