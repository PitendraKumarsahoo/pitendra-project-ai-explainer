import { useState } from "react";
import { Loader2, MessageSquareQuote, Sparkles } from "lucide-react";
import { useServerFn } from "@tanstack/react-start";
import { toast } from "sonner";
import { scoreAnswer } from "@/lib/codexplain.functions";
import type { AnswerScore, InterviewPrep, InterviewQuestion } from "@/lib/analysis";
import { cn } from "@/lib/utils";

const TIERS = [
  { key: "basic", label: "basic", blurb: "warm-up questions on what the project is and does" },
  { key: "intermediate", label: "intermediate", blurb: "design decisions, data flow and trade-offs" },
  { key: "grilling", label: "grilling", blurb: "the hard ones — failure modes, security, scaling" },
] as const;

type Tier = (typeof TIERS)[number]["key"];

export type ScoreContext = { name: string; stack: string[]; overview?: string };

function ScoreBar({ label, value }: { label: string; value: number }) {
  const tone = value >= 8 ? "bg-primary" : value >= 5 ? "bg-primary/60" : "bg-destructive";
  return (
    <div>
      <div className="flex justify-between font-mono text-[10px] uppercase tracking-widest text-muted-foreground">
        <span>{label}</span>
        <span className="text-foreground">{value}/10</span>
      </div>
      <div className="mt-1 h-1.5 w-full bg-secondary">
        <div className={cn("h-full transition-all", tone)} style={{ width: `${value * 10}%` }} />
      </div>
    </div>
  );
}

function Rubric({
  q,
  tier,
  context,
}: {
  q: InterviewQuestion;
  tier: Tier;
  context: ScoreContext;
}) {
  const [draft, setDraft] = useState("");
  const [score, setScore] = useState<AnswerScore | null>(null);
  const [busy, setBusy] = useState(false);
  const run = useServerFn(scoreAnswer);

  const submit = async () => {
    if (draft.trim().length < 10) {
      toast.error("Write a bit more before scoring.");
      return;
    }
    setBusy(true);
    try {
      const result = await run({
        data: {
          name: context.name,
          stack: context.stack,
          overview: context.overview?.slice(0, 4000),
          tier,
          question: q.question.slice(0, 2000),
          idealAnswer: q.answer.slice(0, 4000),
          draft: draft.slice(0, 6000),
        },
      });
      setScore(result);
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Could not score that answer.");
    } finally {
      setBusy(false);
    }
  };

  const overall = score
    ? Math.round(((score.completeness + score.correctness + score.complexity) / 3) * 10) / 10
    : null;

  return (
    <div className="mt-5 border-t border-border pt-4">
      <p className="font-mono text-[10px] uppercase tracking-widest text-muted-foreground">
        score your own answer
      </p>
      <textarea
        value={draft}
        onChange={(e) => setDraft(e.target.value)}
        rows={4}
        placeholder="Answer in your own words, as you would out loud in the viva…"
        className="mt-2 w-full resize-y rounded-sm border border-border bg-background px-3 py-2 font-mono text-xs text-foreground outline-none placeholder:text-muted-foreground focus:border-primary"
      />
      <button
        onClick={submit}
        disabled={busy}
        className="mt-2 flex items-center gap-2 rounded-sm border border-primary px-3 py-1.5 font-mono text-xs text-primary transition-opacity hover:opacity-80 disabled:opacity-60"
      >
        {busy ? <Loader2 className="size-3 animate-spin" /> : <Sparkles className="size-3" />}
        {busy ? "grading" : score ? "re-score answer" : "score answer"}
      </button>

      {score && (
        <div className="mt-4 space-y-4 rounded-sm border border-border bg-background p-4">
          <div className="flex items-baseline gap-3">
            <span className="font-mono text-2xl text-primary">{overall}</span>
            <span className="font-mono text-[10px] uppercase tracking-widest text-muted-foreground">
              overall / 10
            </span>
          </div>
          <div className="grid gap-3 sm:grid-cols-3">
            <ScoreBar label="completeness" value={score.completeness} />
            <ScoreBar label="correctness" value={score.correctness} />
            <ScoreBar label="complexity" value={score.complexity} />
          </div>
          {score.verdict && <p className="text-sm leading-relaxed text-foreground/90">{score.verdict}</p>}
          {score.improvements.length > 0 && (
            <div>
              <p className="font-mono text-[10px] uppercase tracking-widest text-muted-foreground">
                targeted improvements
              </p>
              <ul className="mt-2 space-y-2">
                {score.improvements.map((imp, i) => (
                  <li key={i} className="border-l-2 border-primary/40 pl-3">
                    <p className="font-mono text-xs text-primary">{imp.label}</p>
                    <p className="mt-0.5 text-sm leading-relaxed text-foreground/85">{imp.detail}</p>
                  </li>
                ))}
              </ul>
            </div>
          )}
          {score.missingPoints.length > 0 && (
            <div>
              <p className="font-mono text-[10px] uppercase tracking-widest text-muted-foreground">
                you didn&apos;t mention
              </p>
              <ul className="mt-2 flex flex-wrap gap-2">
                {score.missingPoints.map((m, i) => (
                  <li
                    key={i}
                    className="rounded-sm border border-border px-2 py-1 font-mono text-[11px] text-muted-foreground"
                  >
                    {m}
                  </li>
                ))}
              </ul>
            </div>
          )}
          {score.strongerAnswer && (
            <div>
              <p className="font-mono text-[10px] uppercase tracking-widest text-muted-foreground">
                stronger version of your answer
              </p>
              <p className="mt-2 text-sm leading-relaxed text-foreground/90">{score.strongerAnswer}</p>
            </div>
          )}
        </div>
      )}
    </div>
  );
}

function QaList({
  items,
  tier,
  context,
  readOnly,
}: {
  items: InterviewQuestion[];
  tier: Tier;
  context: ScoreContext;
  readOnly?: boolean;
}) {
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
              {!readOnly && <Rubric key={`${tier}-${i}`} q={q} tier={tier} context={context} />}
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
  context,
}: {
  prep?: InterviewPrep;
  busy?: boolean;
  onGenerate?: () => void;
  readOnly?: boolean;
  context: ScoreContext;
}) {
  const [tier, setTier] = useState<Tier>("basic");

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
        {!readOnly && " — open a question, draft your answer and get it scored on completeness, correctness and complexity."}
      </p>
      <div className="mt-5">
        <QaList items={prep[tier]} tier={tier} context={context} readOnly={readOnly} />
      </div>
    </div>
  );
}
