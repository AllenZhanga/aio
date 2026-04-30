import { cloneElement, isValidElement, useCallback, useEffect, useRef, useState, type MouseEvent, type ReactElement, type ReactNode } from "react";
import { AlertCircle, AlertTriangle, Boxes, CheckCircle2, Info, Loader2, X } from "lucide-react";

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

export type ConfirmTone = "info" | "warning" | "danger" | "success";

export type ConfirmOptions = {
  title?: string;
  message: ReactNode;
  confirmText?: string;
  cancelText?: string;
  tone?: ConfirmTone;
};

export type ConfirmAction = (options: string | ConfirmOptions) => Promise<boolean>;

function normalizeConfirmOptions(options: string | ConfirmOptions): ConfirmOptions {
  return typeof options === "string" ? { message: options } : options;
}

export function ConfirmDialog({
  open,
  options,
  onCancel,
  onConfirm,
}: {
  open: boolean;
  options: ConfirmOptions | null;
  onCancel: () => void;
  onConfirm: () => void;
}) {
  if (!open || !options) return null;
  const tone = options.tone || "warning";
  const title = options.title || "确认操作";
  const confirmText = options.confirmText || "确认";
  const cancelText = options.cancelText || "取消";
  const Icon = tone === "info" ? Info : tone === "success" ? CheckCircle2 : AlertTriangle;
  return (
    <div className="modalBackdrop confirmBackdrop" role="presentation" onMouseDown={onCancel}>
      <section
        className={`confirmDialog ${tone}`}
        role="alertdialog"
        aria-modal="true"
        aria-labelledby="confirm-dialog-title"
        aria-describedby="confirm-dialog-message"
        onMouseDown={(event) => event.stopPropagation()}
      >
        <header>
          <span className="confirmIcon" aria-hidden="true">
            <Icon size={22} />
          </span>
          <div>
            <h2 id="confirm-dialog-title">{title}</h2>
            <div id="confirm-dialog-message" className="confirmMessage">{options.message}</div>
          </div>
        </header>
        <footer>
          <button className="ghostBtn" onClick={onCancel} autoFocus>
            {cancelText}
          </button>
          <button className={`confirmAcceptBtn ${tone}`} onClick={onConfirm}>
            {confirmText}
          </button>
        </footer>
      </section>
    </div>
  );
}

export function useConfirmDialog() {
  const [options, setOptions] = useState<ConfirmOptions | null>(null);
  const resolverRef = useRef<((confirmed: boolean) => void) | null>(null);

  const settle = useCallback((confirmed: boolean) => {
    resolverRef.current?.(confirmed);
    resolverRef.current = null;
    setOptions(null);
  }, []);

  const confirm = useCallback<ConfirmAction>((nextOptions) => {
    return new Promise((resolve) => {
      resolverRef.current?.(false);
      resolverRef.current = resolve;
      setOptions(normalizeConfirmOptions(nextOptions));
    });
  }, []);

  useEffect(() => {
    if (!options) return undefined;
    const handleKeyDown = (event: KeyboardEvent) => {
      if (event.key === "Escape") settle(false);
    };
    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, [options, settle]);

  useEffect(() => {
    return () => {
      resolverRef.current?.(false);
      resolverRef.current = null;
    };
  }, []);

  return {
    confirm,
    dialog: (
      <ConfirmDialog
        open={!!options}
        options={options}
        onCancel={() => settle(false)}
        onConfirm={() => settle(true)}
      />
    ),
  };
}

type PopConfirmTriggerProps = {
  disabled?: boolean;
  onClick?: (event: MouseEvent<HTMLElement>) => void;
};

export function PopConfirm({
  title = "确认删除",
  message,
  confirmText = "确认删除",
  cancelText = "取消",
  tone = "danger",
  placement = "top-end",
  children,
  onConfirm,
}: {
  title?: string;
  message: ReactNode;
  confirmText?: string;
  cancelText?: string;
  tone?: ConfirmTone;
  placement?: "top-end" | "bottom-end";
  children: ReactElement<PopConfirmTriggerProps>;
  onConfirm: () => void | Promise<void>;
}) {
  const [open, setOpen] = useState(false);
  const rootRef = useRef<HTMLSpanElement | null>(null);
  const triggerDisabled = !!children.props.disabled;

  useEffect(() => {
    if (!open) return undefined;
    const handlePointerDown = (event: globalThis.MouseEvent) => {
      if (!rootRef.current?.contains(event.target as Node)) setOpen(false);
    };
    const handleKeyDown = (event: KeyboardEvent) => {
      if (event.key === "Escape") setOpen(false);
    };
    document.addEventListener("mousedown", handlePointerDown, true);
    window.addEventListener("keydown", handleKeyDown);
    return () => {
      document.removeEventListener("mousedown", handlePointerDown, true);
      window.removeEventListener("keydown", handleKeyDown);
    };
  }, [open]);

  const trigger = isValidElement<PopConfirmTriggerProps>(children)
    ? cloneElement(children, {
        onClick: (event: MouseEvent<HTMLElement>) => {
          event.preventDefault();
          event.stopPropagation();
          if (triggerDisabled) return;
          setOpen((current) => !current);
        },
      })
    : children;

  return (
    <span
      className="popConfirmWrap"
      ref={rootRef}
      onClick={(event) => event.stopPropagation()}
      onKeyDown={(event) => event.stopPropagation()}
    >
      {trigger}
      {open && (
        <span className={`popConfirmBubble ${tone} ${placement}`} role="dialog" aria-label={title}>
          <span className="popConfirmArrow" aria-hidden="true" />
          <span className="popConfirmTitle"><AlertTriangle size={15} /> {title}</span>
          <span className="popConfirmMessage">{message}</span>
          <span className="popConfirmActions">
            <button className="ghostTinyBtn" onClick={() => setOpen(false)}>{cancelText}</button>
            <button
              className={`confirmAcceptBtn ${tone}`}
              onClick={() => {
                setOpen(false);
                void onConfirm();
              }}
            >
              {confirmText}
            </button>
          </span>
        </span>
      )}
    </span>
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
