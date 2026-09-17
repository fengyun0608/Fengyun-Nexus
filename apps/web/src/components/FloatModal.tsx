import type { ReactNode } from "react";

export function FloatModal({
  title,
  subtitle,
  open,
  onClose,
  children,
  footer,
}: {
  title: string;
  subtitle?: string;
  open: boolean;
  onClose: () => void;
  children: ReactNode;
  footer?: ReactNode;
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
            关闭
          </button>
        </header>
        <div className="float-body">{children}</div>
        {footer ? <footer className="float-foot">{footer}</footer> : null}
      </div>
    </div>
  );
}
