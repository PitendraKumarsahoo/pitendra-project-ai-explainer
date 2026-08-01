import { useCallback, useMemo, useRef, useState } from "react";
import { Ban, Download, FileText, Link2, Loader2 } from "lucide-react";
import { useServerFn } from "@tanstack/react-start";
import { toast } from "sonner";
import { FileTree } from "@/components/FileTree";
import { InterviewPrepTab } from "@/components/InterviewPrepTab";
import { ArchitectureTab } from "@/components/ArchitectureTab";
import { formatBytes, type ProjectReport } from "@/lib/analysis";
import { exportDocx, exportPdf, type DiagramImage } from "@/lib/export";
import { svgToPngDataUrl } from "@/lib/diagram-image";
import {
  generateDiagrams,
  generateInterviewPrep,
  revokeReport,
  shareReport,
} from "@/lib/codexplain.functions";
import { cn } from "@/lib/utils";

const TABS = ["Overview", "File Explorer", "Architecture", "Interview Prep"] as const;
type Tab = (typeof TABS)[number];

export function ReportView({
  report,
  onReset,
  onUpdate,
  readOnly,
}: {
  report: ProjectReport;
  onReset?: () => void;
  onUpdate?: (patch: Partial<ProjectReport>) => void;
  readOnly?: boolean;
}) {
  const [tab, setTab] = useState<Tab>("Overview");
  const [selected, setSelected] = useState<string | null>(report.entryPoints[0] ?? null);
  const [busy, setBusy] = useState<
    null | "prep" | "diagrams" | "pdf" | "docx" | "share" | "revoke"
  >(null);
  const [share, setShare] = useState<
    { url: string; id: string; revokeToken: string; expiresAt: string | null; revoked?: boolean } | null
  >(null);
  const [expiry, setExpiry] = useState<string>("168");
  const svgs = useRef<Record<number, string>>({});
  const [svgVersion, setSvgVersion] = useState(0);

  const runPrep = useServerFn(generateInterviewPrep);
  const runDiagrams = useServerFn(generateDiagrams);
  const runShare = useServerFn(shareReport);
  const runRevoke = useServerFn(revokeReport);

  const onSvg = useCallback((index: number, svg: string | null) => {
    if (svg) svgs.current[index] = svg;
    else delete svgs.current[index];
    setSvgVersion((v) => v + 1);
  }, []);

  const summaryByPath = useMemo(
    () => new Map(report.summaries.map((s) => [s.path, s])),
    [report.summaries],
  );
  const file = report.files.find((f) => f.path === selected);
  const summary = selected ? summaryByPath.get(selected) : undefined;
  const totalBytes = report.files.reduce((a, f) => a + f.size, 0);

  const context = () => ({
    name: report.source,
    stack: report.stack.map((s) => s.name),
    overview: report.overview.slice(0, 8000),
    paths: report.files.slice(0, 120).map((f) => f.path),
    excerpts: report.files.slice(0, 16).map((f) => ({ path: f.path, content: f.content.slice(0, 4000) })),
  });

  async function withBusy(kind: NonNullable<typeof busy>, fn: () => Promise<void>) {
    setBusy(kind);
    try {
      await fn();
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Something went wrong.");
    } finally {
      setBusy(null);
    }
  }

  const onPrep = () =>
    withBusy("prep", async () => {
      const prep = await runPrep({ data: context() });
      onUpdate?.({ prep });
    });

  const onDiagrams = () =>
    withBusy("diagrams", async () => {
      const { diagrams } = await runDiagrams({ data: context() });
      if (!diagrams.length) throw new Error("No diagrams could be generated.");
      onUpdate?.({ diagrams });
    });

  const onPdf = () =>
    withBusy("pdf", async () => {
      const images: DiagramImage[] = [];
      for (const [i, d] of (report.diagrams ?? []).entries()) {
        const svg = svgs.current[i];
        if (!svg) continue;
        try {
          const { dataUrl, width, height } = await svgToPngDataUrl(svg, 2);
          images[i] = { title: d.title, dataUrl, width, height };
        } catch {
          /* fall back to mermaid source in the PDF */
        }
      }
      await exportPdf(report, images);
    });

  const onRevoke = () =>
    withBusy("revoke", async () => {
      if (!share) return;
      await runRevoke({ data: { id: share.id, revokeToken: share.revokeToken } });
      setShare({ ...share, revoked: true });
      toast.success("Share link revoked — it can no longer be viewed.");
    });

  const onShare = () =>
    withBusy("share", async () => {
      const payload = {
        ...report,
        files: report.files.map((f) => ({ ...f, content: f.content.slice(0, 8000) })),
      };
      const hours = expiry === "never" ? null : Number(expiry);
      const { id, revokeToken, expiresAt } = await runShare({
        data: { source: report.source, payload: JSON.stringify(payload), expiresInHours: hours },
      });
      const url = `${window.location.origin}/r/${id}`;
      setShare({ url, id, revokeToken, expiresAt });
      try {
        await navigator.clipboard.writeText(url);
        toast.success("Read-only link copied to clipboard");
      } catch {
        toast.success("Read-only link created");
      }
    });

  return (
    <div className="mx-auto w-full max-w-6xl px-5 py-10">
      <div className="flex flex-wrap items-end justify-between gap-4 border-b border-border pb-5">
        <div>
          <p className="font-mono text-xs uppercase tracking-[0.2em] text-primary">
            {readOnly ? "shared report" : "report"}
          </p>
          <h1 className="mt-1 font-mono text-2xl text-foreground">{report.source}</h1>
        </div>
        <div className="flex flex-wrap gap-2">
          <button
            onClick={onPdf}
            disabled={busy !== null}
            className="flex items-center gap-2 rounded-sm border border-border px-3 py-1.5 font-mono text-xs text-muted-foreground transition-colors hover:border-primary hover:text-primary disabled:opacity-60"
          >
            {busy === "pdf" ? <Loader2 className="size-3 animate-spin" /> : <FileText className="size-3" />}
            pdf
          </button>
          <button
            onClick={() => withBusy("docx", () => exportDocx(report))}
            disabled={busy !== null}
            className="flex items-center gap-2 rounded-sm border border-border px-3 py-1.5 font-mono text-xs text-muted-foreground transition-colors hover:border-primary hover:text-primary disabled:opacity-60"
          >
            {busy === "docx" ? <Loader2 className="size-3 animate-spin" /> : <Download className="size-3" />}
            docx
          </button>
          {!readOnly && (
            <select
              value={expiry}
              onChange={(e) => setExpiry(e.target.value)}
              aria-label="Share link expiry"
              className="rounded-sm border border-border bg-card px-2 py-1.5 font-mono text-xs text-muted-foreground outline-none focus:border-primary"
            >
              <option value="1">expires in 1 hour</option>
              <option value="24">expires in 24 hours</option>
              <option value="168">expires in 7 days</option>
              <option value="720">expires in 30 days</option>
              <option value="never">never expires</option>
            </select>
          )}
          {!readOnly && (
            <button
              onClick={onShare}
              disabled={busy !== null}
              className="flex items-center gap-2 rounded-sm border border-border px-3 py-1.5 font-mono text-xs text-muted-foreground transition-colors hover:border-primary hover:text-primary disabled:opacity-60"
            >
              {busy === "share" ? <Loader2 className="size-3 animate-spin" /> : <Link2 className="size-3" />}
              share link
            </button>
          )}
          {!readOnly && onReset && (
            <button
              onClick={onReset}
              className="rounded-sm border border-border px-3 py-1.5 font-mono text-xs text-muted-foreground transition-colors hover:border-primary hover:text-primary"
            >
              analyze another
            </button>
          )}
        </div>
      </div>

      {share && (
        <div className="mt-4 flex flex-wrap items-center gap-3 rounded-sm border border-primary/40 bg-card px-4 py-3">
          <span className="font-mono text-[10px] uppercase tracking-widest text-muted-foreground">
            read-only link
          </span>
          {share.revoked ? (
            <span className="break-all font-mono text-xs text-destructive line-through">{share.url}</span>
          ) : (
            <a href={share.url} className="break-all font-mono text-xs text-primary underline-offset-4 hover:underline">
              {share.url}
            </a>
          )}
          <span className="font-mono text-[10px] text-muted-foreground">
            {share.revoked
              ? "revoked"
              : share.expiresAt
                ? `expires ${new Date(share.expiresAt).toLocaleString()}`
                : "no expiry"}
          </span>
          {!share.revoked && (
            <button
              onClick={onRevoke}
              disabled={busy !== null}
              className="ml-auto flex items-center gap-1.5 rounded-sm border border-border px-2.5 py-1 font-mono text-[11px] text-muted-foreground transition-colors hover:border-destructive hover:text-destructive disabled:opacity-60"
            >
              {busy === "revoke" ? <Loader2 className="size-3 animate-spin" /> : <Ban className="size-3" />}
              revoke access
            </button>
          )}
        </div>
      )}

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

      <div className="mt-8 flex flex-wrap gap-1 border-b border-border">
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

      {tab === "Overview" && (
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
      )}

      {tab === "File Explorer" && (
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

      {tab === "Architecture" && (
        <ArchitectureTab
          diagrams={report.diagrams}
          busy={busy === "diagrams"}
          onGenerate={onDiagrams}
          readOnly={readOnly}
          onSvg={onSvg}
          svgs={{ ...svgs.current, __v: svgVersion } as unknown as Record<number, string>}
        />
      )}

      {tab === "Interview Prep" && (
        <InterviewPrepTab
          prep={report.prep}
          busy={busy === "prep"}
          onGenerate={onPrep}
          readOnly={readOnly}
          context={{
            name: report.source,
            stack: report.stack.map((s) => s.name),
            overview: report.overview,
          }}
        />
      )}
    </div>
  );
}
