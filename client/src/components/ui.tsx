import React, { PropsWithChildren } from "react";

export function Card({ children }: PropsWithChildren) {
  return <div className="bg-white/80 backdrop-blur rounded-2xl shadow-sm border border-slate-200 p-6">{children}</div>;
}

export function CardHeader({ title, subtitle }: { title: string; subtitle?: string }) {
  return (
    <div className="mb-4">
      <div className="text-lg font-semibold font-display text-ink">{title}</div>
      {subtitle ? <div className="text-sm text-slate-500 mt-1">{subtitle}</div> : null}
    </div>
  );
}

export function Button({
  children,
  className,
  type = "button",
  ...props
}: PropsWithChildren<React.ButtonHTMLAttributes<HTMLButtonElement>>) {
  const { onClick, ...rest } = props;
  return (
    <button
      type={type}
      {...rest}
      onClick={(event) => onClick?.(event)}
      className={`px-4 py-2 rounded-xl bg-accent text-white font-medium shadow hover:shadow-md transition ${className ?? ""}`}
    >
      {children}
    </button>
  );
}

export function GhostButton({
  children,
  className,
  type = "button",
  ...props
}: PropsWithChildren<React.ButtonHTMLAttributes<HTMLButtonElement>>) {
  const { onClick, ...rest } = props;
  return (
    <button
      type={type}
      {...rest}
      onClick={(event) => onClick?.(event)}
      className={`px-3 py-2 rounded-xl border border-slate-200 text-slate-600 hover:text-ink hover:border-slate-400 transition ${className ?? ""}`}
    >
      {children}
    </button>
  );
}

export const Input = React.forwardRef<HTMLInputElement, React.InputHTMLAttributes<HTMLInputElement>>(
  (props, ref) => {
    const { onFocus, ...rest } = props;
    return (
      <input
        {...rest}
        ref={ref}
        onFocus={(event) => {
          onFocus?.(event);
          if (event.currentTarget.select) {
            event.currentTarget.select();
          }
        }}
        className={`w-full rounded-xl border border-slate-200 px-3 py-2 focus:outline-none focus:ring-2 focus:ring-accent ${
          props.className ?? ""
        }`}
      />
    );
  }
);
Input.displayName = "Input";

export const Select = React.forwardRef<HTMLSelectElement, React.SelectHTMLAttributes<HTMLSelectElement>>(
  (props, ref) => {
    return (
      <select
        {...props}
        ref={ref}
        className={`w-full rounded-xl border border-slate-200 px-3 py-2 focus:outline-none focus:ring-2 focus:ring-accent ${
          props.className ?? ""
        }`}
      />
    );
  }
);
Select.displayName = "Select";

export function Modal({
  title,
  children,
  isOpen,
  onClose
}: PropsWithChildren<{ title: string; isOpen: boolean; onClose: () => void }>) {
  if (!isOpen) return null;
  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center">
      <div className="absolute inset-0 bg-black/40" onClick={onClose} />
      <div className="relative z-10 w-[92vw] max-w-xl rounded-2xl bg-white shadow-lg border border-slate-200 p-6">
        <div className="text-lg font-semibold font-display text-ink mb-3">{title}</div>
        {children}
      </div>
    </div>
  );
}

export function Badge({ children }: PropsWithChildren) {
  return <span className="inline-flex items-center px-2 py-1 rounded-full bg-slate-100 text-xs text-slate-600">{children}</span>;
}

function getReadableTextColor(hex: string | null | undefined) {
  if (!hex) return "#0f172a";
  const normalized = hex.replace("#", "");
  if (normalized.length !== 6) return "#0f172a";
  const r = parseInt(normalized.slice(0, 2), 16);
  const g = parseInt(normalized.slice(2, 4), 16);
  const b = parseInt(normalized.slice(4, 6), 16);
  const luminance = (0.299 * r + 0.587 * g + 0.114 * b) / 255;
  return luminance > 0.6 ? "#0f172a" : "#ffffff";
}

export function TypePill({
  name,
  color,
  className
}: {
  name: string;
  color?: string | null;
  className?: string;
}) {
  const textColor = getReadableTextColor(color);
  return (
    <span
      className={`inline-flex items-center px-3 py-1 rounded-lg text-xs font-semibold tracking-wide ${className ?? ""}`}
      style={{ backgroundColor: color ?? "#e2e8f0", color: textColor }}
    >
      {name}
    </span>
  );
}
