import { useState, type ReactNode } from "react";
import { AlertCircle, Boxes, CheckCircle2, Info, Loader2, X } from "lucide-react";

export function Field({
  label,
  children,
  hint,
}: {
  label: string;
  children: ReactNode;
  hint?: string;
}) {
  return (
    <div className="field">
      <span>{label}</span>
      {children}
      {hint && <small>{hint}</small>}
    </div>
  );
}

export function FormSection({
  title,
  description,
  children,
}: {
  title: string;
  description?: string;
  children: ReactNode;
}) {
  return (
    <section className="formSection">
      <div>
        <strong>{title}</strong>
        {description && <p>{description}</p>}
      </div>
      {children}
    </section>
  );
}

export function ActionBar({ children }: { children: ReactNode }) {
  return <div className="actionBar">{children}</div>;
}

export function Notice({
  tone = "info",
  children,
}: {
  tone?: "info" | "success" | "warning" | "danger";
  children: ReactNode;
}) {
  const Icon = tone === "success" ? CheckCircle2 : tone === "info" ? Info : AlertCircle;
  return (
    <div className={`noticeBox ${tone}`}>
      <Icon size={16} />
      <span>{children}</span>
    </div>
  );
}

export function EntityList({
  children,
  className = "",
}: {
  children: ReactNode;
  className?: string;
}) {
  return <div className={`entityList ${className}`}>{children}</div>;
}

export function EntityRow({
  title,
  subtitle,
  status,
  statusTone = "success",
  meta,
  details,
  actions,
  active = false,
  onClick,
}: {
  title: ReactNode;
  subtitle?: ReactNode;
  status?: ReactNode;
  statusTone?: string;
  meta?: ReactNode;
  details?: ReactNode;
  actions?: ReactNode;
  active?: boolean;
  onClick?: () => void;
}) {
  const clickable = !!onClick;
  const content = (
    <>
      <div className="entityRowMain">
        <strong>{title}</strong>
        {subtitle && <small>{subtitle}</small>}
        {details && <span>{details}</span>}
      </div>
      {status && <span className={`runStatus ${statusTone}`}>{status}</span>}
      {meta && <em>{meta}</em>}
      {actions && <div className="entityRowActions">{actions}</div>}
    </>
  );

  if (clickable) {
    return (
      <button
        className={`entityRow ${active ? "active" : ""}`}
        onClick={onClick}
      >
        {content}
      </button>
    );
  }

  return <article className={`entityRow ${active ? "active" : ""}`}>{content}</article>;
}

export function Drawer({
  open,
  title,
  description,
  children,
  footer,
  onClose,
  className = "",
}: {
  open: boolean;
  title: string;
  description?: string;
  children: ReactNode;
  footer?: ReactNode;
  onClose: () => void;
  className?: string;
}) {
  if (!open) return null;
  return (
    <div className="drawerBackdrop" role="presentation" onMouseDown={onClose}>
      <aside
        className={`sideDrawer ${className}`}
        role="dialog"
        aria-modal="true"
        onMouseDown={(event) => event.stopPropagation()}
      >
        <header>
          <div>
            <h2>{title}</h2>
            {description && <p>{description}</p>}
          </div>
          <button className="iconBtn" onClick={onClose} aria-label="关闭">
            <X size={18} />
          </button>
        </header>
        <div className="drawerBody">{children}</div>
        {footer && <footer>{footer}</footer>}
      </aside>
    </div>
  );
}

export function Modal({
  open,
  title,
  description,
  children,
  footer,
  onClose,
}: {
  open: boolean;
  title: string;
  description?: string;
  children: ReactNode;
  footer?: ReactNode;
  onClose: () => void;
}) {
  if (!open) return null;
  return (
    <div className="modalBackdrop" role="presentation" onMouseDown={onClose}>
      <section className="createModal" role="dialog" aria-modal="true" onMouseDown={(event) => event.stopPropagation()}>
        <header>
          <div>
            <h2>{title}</h2>
            {description && <p>{description}</p>}
          </div>
          <button className="iconBtn" onClick={onClose} aria-label="关闭">
            <X size={18} />
          </button>
        </header>
        {children}
        {footer && <footer>{footer}</footer>}
      </section>
    </div>
  );
}

export function CodeBlock({ title, code }: { title: string; code: string }) {
  return (
    <div className="codeBlock">
      <div>
        <strong>{title}</strong>
        <CopyButton text={code} />
      </div>
      <pre>{code}</pre>
    </div>
  );
}

export function CopyButton({ text }: { text: string }) {
  const [copied, setCopied] = useState(false);
  return (
    <button
      className="copyBtn"
      onClick={() => {
        void navigator.clipboard?.writeText(text);
        setCopied(true);
        window.setTimeout(() => setCopied(false), 1200);
      }}
    >
      {copied ? "已复制" : "复制"}
    </button>
  );
}

export function StatePanel({
  icon = "empty",
  title,
  text,
}: {
  icon?: "empty" | "loading" | "missing";
  title: string;
  text: string;
}) {
  return (
    <div className="statePanel">
      {icon === "loading" ? (
        <Loader2 className="spin" size={28} />
      ) : (
        <Boxes size={28} />
      )}
      <strong>{title}</strong>
      <span>{text}</span>
    </div>
  );
}

export function PromptEditor({
  title,
  label,
  description,
  value,
  onChange,
  icon,
}: {
  title: string;
  label: string;
  description: string;
  value: string;
  onChange: (value: string) => void;
  icon: ReactNode;
}) {
  const lineCount = value ? value.split(/\r?\n/).length : 0;
  const charCount = value.trim().length;
  return (
    <section className="promptEditor">
      <div className="promptEditorHeader">
        <span className="promptEditorIcon">{icon}</span>
        <div>
          <small>{label}</small>
          <strong>{title}</strong>
          <p>{description}</p>
        </div>
        <em>
          {lineCount} 行 · {charCount} 字
        </em>
      </div>
      <textarea
        value={value}
        onChange={(event) => onChange(event.target.value)}
      />
    </section>
  );
}
