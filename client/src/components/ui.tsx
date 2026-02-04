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
    return (
      <input
        {...props}
        ref={ref}
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

export function Badge({ children }: PropsWithChildren) {
  return <span className="inline-flex items-center px-2 py-1 rounded-full bg-slate-100 text-xs text-slate-600">{children}</span>;
}
