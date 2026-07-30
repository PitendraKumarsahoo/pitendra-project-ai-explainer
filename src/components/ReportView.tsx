import { useMemo, useState } from "react";
import { FileTree } from "@/components/FileTree";
import { formatBytes, type ProjectReport } from "@/lib/analysis";
import { cn } from "@/lib/utils";

const TABS = ["Overview", "File Explorer"] as const;
type Tab = (typeof TABS)[number];

export function ReportView({ report, onReset }: { report: ProjectReport; onReset: () => void }) {
  const [tab, setTab] = useState<Tab>("Overview");
  const [selected, setSelected] = useState<string | null>(report.entryPoints[0] ?? null);

  const summaryByPath = useMemo(
    () => new Map(report.summaries.map((s) => [s.path, s])),
    [report.summaries],
  );
  const file = report.files.find((f) => f.path === selected);
  const summary = selected ? summaryByPath.get(selected) : undefined;
  const totalBytes = report.files.reduce((a, f) => a + f.size, 0);

  return (
    <div className="mx-auto w-full max-w-6xl px-5 py-10">
      <div className="flex flex-wrap items-end justify-between gap-4 border-b border-border pb-5">
        <div>
          <p className="font-mono text-xs uppercase tracking-[0.2em] text-primary">report</p>
          <h1 className="mt-1 font-mono text-2xl text-foreground">{report.source}</h1>
        </div>
        <button
          onClick={onReset}
          className="rounded-sm border border-border px-3 py-1.5 font-mono text-xs text-muted-foreground transition-colors hover:border-primary hover:text-primary"
        >
          analyze another
        </button>
      </div>

      <div className="mt-6 grid grid-cols-2 gap-px overflow-hidden rounded-sm border border-border bg-border sm:grid-cols-4">
        {[
          ["files", String(report.files.length)],
          ["size", formatBytes(totalBytes)],
          ["languages", String(report.languages.length)],
          ["entry points", String(report.entryPoints.length)],
        ].map(([label, value]) => (
          <div key={label} className="bg-card px-4 py-3">
            <p className="font-mono text-[10px] uppercase tracking-widest text-muted-foreground">
              {label}
            </p>
            <p className="mt-1 font-mono text-lg text-primary">{value}</p>
          </div>
        ))}
      </div>

      <div className="mt-8 flex gap-1 border-b border-border">
        {TABS.map((t) => (
          <button
            key={t}
            onClick={() => setTab(t)}
            className={cn(
              "-mb-px border-b-2 px-4 py-2 font-mono text-xs transition-colors",
              tab === t
                ? "border-primary text-primary"
                : "border-transparent text-muted-foreground hover:text-foreground",
            )}
          >
            {t}
          </button>
        ))}
      </div>

      {tab === "Overview" ? (
        <div className="mt-8 grid gap-8 lg:grid-cols-[1.6fr_1fr]">
          <section>
            <h2 className="font-mono text-xs uppercase tracking-[0.2em] text-muted-foreground">
              what this project is
            </h2>
            <div className="mt-3 space-y-4 text-sm leading-relaxed text-foreground/90">
              {report.overview.split(/\n{1,2}/).filter(Boolean).map((p, i) => (
                <p key={i}>{p}</p>
              ))}
            </div>
          </section>
          <aside className="space-y-8">
            <div>
              <h2 className="font-mono text-xs uppercase tracking-[0.2em] text-muted-foreground">
                detected stack
              </h2>
              <ul className="mt-3 flex flex-wrap gap-2">
                {report.stack.map((s) => (
                  <li
                    key={s.name}
                    className="rounded-sm border border-border bg-card px-2 py-1 font-mono text-xs text-foreground"
                  >
                    {s.name}
                    {s.version && <span className="ml-1 text-muted-foreground">{s.version}</span>}
                  </li>
                ))}
              </ul>
            </div>
            <div>
              <h2 className="font-mono text-xs uppercase tracking-[0.2em] text-muted-foreground">
                languages
              </h2>
              <ul className="mt-3 space-y-2">
                {report.languages.slice(0, 6).map((l) => (
                  <li key={l.name} className="font-mono text-xs">
                    <div className="flex justify-between text-muted-foreground">
                      <span className="text-foreground">{l.name}</span>
                      <span>{Math.round((l.bytes / totalBytes) * 100)}%</span>
                    </div>
                    <div className="mt-1 h-1 w-full bg-secondary">
                      <div
                        className="h-full bg-primary"
                        style={{ width: `${Math.max(2, (l.bytes / totalBytes) * 100)}%` }}
                      />
                    </div>
                  </li>
                ))}
              </ul>
            </div>
            <div>
              <h2 className="font-mono text-xs uppercase tracking-[0.2em] text-muted-foreground">
                entry points
              </h2>
              <ul className="mt-3 space-y-1 font-mono text-xs text-primary">
                {report.entryPoints.length ? (
                  report.entryPoints.map((e) => <li key={e}>{e}</li>)
                ) : (
                  <li className="text-muted-foreground">none detected</li>
                )}
              </ul>
            </div>
          </aside>
        </div>
      ) : (
        <div className="mt-8 grid gap-6 lg:grid-cols-[320px_1fr]">
          <div className="max-h-[70vh] overflow-auto rounded-sm border border-border bg-card py-2">
            <FileTree node={report.tree} onSelect={setSelected} selected={selected} />
          </div>
          <div className="min-w-0">
            {file ? (
              <div>
                <p className="font-mono text-sm text-primary">{file.path}</p>
                <p className="mt-1 font-mono text-[10px] uppercase tracking-widest text-muted-foreground">
                  {formatBytes(file.size)}
                </p>
                <div className="mt-5">
                  <h3 className="font-mono text-xs uppercase tracking-[0.2em] text-muted-foreground">
                    explanation
                  </h3>
                  <p className="mt-2 text-sm leading-relaxed text-foreground/90">
                    {summary?.summary ?? "No AI summary was generated for this file."}
                  </p>
                </div>
                {summary?.symbols?.length ? (
                  <div className="mt-6">
                    <h3 className="font-mono text-xs uppercase tracking-[0.2em] text-muted-foreground">
                      key functions & classes
                    </h3>
                    <ul className="mt-2 space-y-1.5">
                      {summary.symbols.map((s, i) => (
                        <li
                          key={i}
                          className="border-l-2 border-primary/40 pl-3 font-mono text-xs text-foreground/90"
                        >
                          {s}
                        </li>
                      ))}
                    </ul>
                  </div>
                ) : null}
                <div className="mt-6">
                  <h3 className="font-mono text-xs uppercase tracking-[0.2em] text-muted-foreground">
                    source
                  </h3>
                  <pre className="mt-2 max-h-[45vh] overflow-auto rounded-sm border border-border bg-card p-4 font-mono text-[11px] leading-relaxed text-foreground/80">
                    {file.content.slice(0, 8000)}
                  </pre>
                </div>
              </div>
            ) : (
              <p className="font-mono text-xs text-muted-foreground">
                Select a file to read its explanation.
              </p>
            )}
          </div>
        </div>
      )}
    </div>
  );
}
