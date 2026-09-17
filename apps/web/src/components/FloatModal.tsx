import type { ReactNode } from "react";

export function FloatModal({
  title,
  subtitle,
  open,
  onClose,
  children,
  footer,
  status,
  statusTone = "muted",
  closeLabel = "关闭",
}: {
  title: string;
  subtitle?: string;
  open: boolean;
  onClose: () => void;
  children: ReactNode;
  footer?: ReactNode;
  status?: string;
  statusTone?: "muted" | "ok" | "error";
  closeLabel?: string;
}) {
  if (!open) return null;
  return (
    <div className="float-layer" role="presentation" onClick={onClose}>
      <div
        className="float-modal"
        role="dialog"
        aria-modal="true"
        aria-label={title}
        onClick={(e) => e.stopPropagation()}
      >
        <header className="float-head">
          <div>
            <h2>{title}</h2>
            {subtitle ? <p>{subtitle}</p> : null}
          </div>
          <button type="button" className="btn ghost mini" onClick={onClose}>
            {closeLabel}
          </button>
        </header>
        <div className="float-body">{children}</div>
        {status ? <p className={`float-status tone-${statusTone}`}>{status}</p> : null}
        {footer ? <footer className="float-foot">{footer}</footer> : null}
      </div>
    </div>
  );
}
