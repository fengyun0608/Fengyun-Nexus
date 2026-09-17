import { useState, type ReactNode } from "react";

/** Human summary first; optional inline raw JSON (prefer page-level raw on dashboard/db). */
export function RawBlock({
  summary,
  raw,
  showLabel,
  hideLabel,
  corner = false,
}: {
  summary: ReactNode;
  raw: unknown;
  showLabel: string;
  hideLabel: string;
  /** Legacy inline toggle; prefer page-level rawPage for dashboard/database. */
  corner?: boolean;
}) {
  const [open, setOpen] = useState(false);
  return (
    <div className={`raw-block ${corner ? "raw-corner" : ""}`}>
      <div className="raw-head">
        <div className="raw-summary">{summary}</div>
        <button type="button" className="btn ghost mini raw-toggle" onClick={() => setOpen((v) => !v)}>
          {open ? hideLabel : showLabel}
        </button>
      </div>
      {open && <pre className="code-block">{JSON.stringify(raw, null, 2)}</pre>}
    </div>
  );
}
