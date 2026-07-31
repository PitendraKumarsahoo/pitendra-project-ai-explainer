import { useState } from "react";
import { Loader2, MessageSquareQuote } from "lucide-react";
import type { InterviewPrep, InterviewQuestion } from "@/lib/analysis";
import { cn } from "@/lib/utils";

const TIERS = [
  { key: "basic", label: "basic", blurb: "warm-up questions on what the project is and does" },
  { key: "intermediate", label: "intermediate", blurb: "design decisions, data flow and trade-offs" },
  { key: "grilling", label: "grilling", blurb: "the hard ones — failure modes, security, scaling" },
] as const;

function QaList({ items }: { items: InterviewQuestion[] }) {
  const [open, setOpen] = useState<number | null>(0);
  if (!items.length)
    return <p className="font-mono text-xs text-muted-foreground">No questions generated for this tier.</p>;
  return (
    <ul className="space-y-2">
      {items.map((q, i) => (
        <li key={i} className="rounded-sm border border-border bg-card">
          <button
            onClick={() => setOpen(open === i ? null : i)}
            className="flex w-full items-start gap-3 px-4 py-3 text-left"
          >
            <span className="mt-0.5 font-mono text-[10px] text-primary">{String(i + 1).padStart(2, "0")}</span>
            <span className="text-sm text-foreground">{q.question}</span>
          </button>
          {open === i && (
            <div className="border-t border-border px-4 py-3">
              <p className="font-mono text-[10px] uppercase tracking-widest text-muted-foreground">
                ideal answer draft
              </p>
              <p className="mt-2 text-sm leading-relaxed text-foreground/90">{q.answer}</p>
            </div>
          )}
        </li>
      ))}
    </ul>
  );
}

export function InterviewPrepTab({
  prep,
  busy,
  onGenerate,
  readOnly,
}: {
  prep?: InterviewPrep;
  busy?: boolean;
  onGenerate?: () => void;
  readOnly?: boolean;
}) {
  const [tier, setTier] = useState<(typeof TIERS)[number]["key"]>("basic");

  if (!prep) {
    return (
      <div className="mt-10 flex flex-col items-center rounded-sm border border-dashed border-border py-16 text-center">
        <MessageSquareQuote className="size-5 text-primary" />
        <p className="mt-4 max-w-md text-sm text-muted-foreground">
          {readOnly
            ? "The author didn't include interview prep in this shared report."
            : "Generate viva-style questions across three difficulty tiers, each with an ideal answer draft written from your project."}
        </p>
        {!readOnly && (
          <button
            onClick={onGenerate}
            disabled={busy}
            className="mt-5 flex items-center gap-2 rounded-sm bg-primary px-5 py-2.5 font-mono text-xs font-medium text-primary-foreground transition-opacity hover:opacity-90 disabled:opacity-60"
          >
            {busy && <Loader2 className="size-3 animate-spin" />}
            {busy ? "writing questions" : "generate interview prep"}
          </button>
        )}
      </div>
    );
  }

  return (
    <div className="mt-8">
      <div className="flex flex-wrap gap-2">
        {TIERS.map((t) => (
          <button
            key={t.key}
            onClick={() => setTier(t.key)}
            className={cn(
              "rounded-sm border px-3 py-1.5 font-mono text-xs transition-colors",
              tier === t.key
                ? "border-primary text-primary"
                : "border-border text-muted-foreground hover:text-foreground",
            )}
          >
            {t.label}
            <span className="ml-2 text-[10px] opacity-70">{prep[t.key].length}</span>
          </button>
        ))}
      </div>
      <p className="mt-3 font-mono text-[11px] text-muted-foreground">
        {TIERS.find((t) => t.key === tier)?.blurb}
      </p>
      <div className="mt-5">
        <QaList items={prep[tier]} />
      </div>
    </div>
  );
}
