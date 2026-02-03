import { PropsWithChildren } from "react";

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

export function Button({ children, onClick, type = "button" }: PropsWithChildren<{ onClick?: () => void; type?: "button" | "submit" }>) {
  return (
    <button
      type={type}
      onClick={onClick}
      className="px-4 py-2 rounded-xl bg-accent text-white font-medium shadow hover:shadow-md transition"
    >
      {children}
    </button>
  );
}

export function GhostButton({ children, onClick }: PropsWithChildren<{ onClick?: () => void }>) {
  return (
    <button
      onClick={onClick}
      className="px-3 py-2 rounded-xl border border-slate-200 text-slate-600 hover:text-ink hover:border-slate-400 transition"
    >
      {children}
    </button>
  );
}

export function Input(props: React.InputHTMLAttributes<HTMLInputElement>) {
  return (
    <input
      {...props}
      className={`w-full rounded-xl border border-slate-200 px-3 py-2 focus:outline-none focus:ring-2 focus:ring-accent ${
        props.className ?? ""
      }`}
    />
  );
}

export function Select(props: React.SelectHTMLAttributes<HTMLSelectElement>) {
  return (
    <select
      {...props}
      className={`w-full rounded-xl border border-slate-200 px-3 py-2 focus:outline-none focus:ring-2 focus:ring-accent ${
        props.className ?? ""
      }`}
    />
  );
}

export function Badge({ children }: PropsWithChildren) {
  return <span className="inline-flex items-center px-2 py-1 rounded-full bg-slate-100 text-xs text-slate-600">{children}</span>;
}