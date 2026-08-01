import { useState } from "react";
import { Download, Image as ImageIcon, Loader2, Workflow } from "lucide-react";
import { toast } from "sonner";
import { MermaidDiagram } from "@/components/MermaidDiagram";
import { downloadPng, downloadSvg, safeName } from "@/lib/diagram-image";
import type { Diagram } from "@/lib/analysis";

export function ArchitectureTab({
  diagrams,
  busy,
  onGenerate,
  readOnly,
  onSvg,
  svgs,
}: {
  diagrams?: Diagram[];
  busy?: boolean;
  onGenerate?: () => void;
  readOnly?: boolean;
  onSvg?: (index: number, svg: string | null) => void;
  svgs?: Record<number, string>;
}) {
  const [pending, setPending] = useState<string | null>(null);

  if (!diagrams?.length) {
    return (
      <div className="mt-10 flex flex-col items-center rounded-sm border border-dashed border-border py-16 text-center">
        <Workflow className="size-5 text-primary" />
        <p className="mt-4 max-w-md text-sm text-muted-foreground">
          {readOnly
            ? "The author didn't include architecture diagrams in this shared report."
            : "Render Mermaid flowchart, entity-relationship and component diagrams derived from the analyzed codebase."}
        </p>
        {!readOnly && (
          <button
            onClick={onGenerate}
            disabled={busy}
            className="mt-5 flex items-center gap-2 rounded-sm bg-primary px-5 py-2.5 font-mono text-xs font-medium text-primary-foreground transition-opacity hover:opacity-90 disabled:opacity-60"
          >
            {busy && <Loader2 className="size-3 animate-spin" />}
            {busy ? "drawing diagrams" : "generate diagrams"}
          </button>
        )}
      </div>
    );
  }

  const save = async (kind: "svg" | "png", i: number, title: string) => {
    const svg = svgs?.[i];
    if (!svg) {
      toast.error("Wait for the diagram to finish rendering.");
      return;
    }
    const file = `${safeName(title)}.${kind}`;
    setPending(`${kind}-${i}`);
    try {
      if (kind === "svg") downloadSvg(svg, file);
      else await downloadPng(svg, file);
      toast.success(`Saved ${file}`);
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Export failed.");
    } finally {
      setPending(null);
    }
  };

  return (
    <div className="mt-8 space-y-10">
      {diagrams.map((d, i) => (
        <section key={i}>
          <div className="flex flex-wrap items-baseline gap-3">
            <h2 className="font-mono text-sm text-primary">{d.title}</h2>
            <span className="rounded-sm border border-border px-2 py-0.5 font-mono text-[10px] uppercase tracking-widest text-muted-foreground">
              {d.kind}
            </span>
            <div className="ml-auto flex gap-2">
              <button
                onClick={() => save("png", i, d.title)}
                disabled={pending !== null}
                className="flex items-center gap-1.5 rounded-sm border border-border px-2.5 py-1 font-mono text-[11px] text-muted-foreground transition-colors hover:border-primary hover:text-primary disabled:opacity-60"
              >
                {pending === `png-${i}` ? (
                  <Loader2 className="size-3 animate-spin" />
                ) : (
                  <ImageIcon className="size-3" />
                )}
                png
              </button>
              <button
                onClick={() => save("svg", i, d.title)}
                disabled={pending !== null}
                className="flex items-center gap-1.5 rounded-sm border border-border px-2.5 py-1 font-mono text-[11px] text-muted-foreground transition-colors hover:border-primary hover:text-primary disabled:opacity-60"
              >
                <Download className="size-3" />
                svg
              </button>
            </div>
          </div>
          {d.description && (
            <p className="mt-2 max-w-3xl text-sm leading-relaxed text-muted-foreground">{d.description}</p>
          )}
          <div className="mt-4">
            <MermaidDiagram code={d.mermaid} onRendered={(svg) => onSvg?.(i, svg)} />
          </div>
          <details className="mt-3">
            <summary className="cursor-pointer font-mono text-[11px] text-muted-foreground hover:text-primary">
              mermaid source
            </summary>
            <pre className="mt-2 overflow-auto rounded-sm border border-border bg-card p-4 font-mono text-[11px] text-foreground/80">
              {d.mermaid}
            </pre>
          </details>
        </section>
      ))}
    </div>
  );
}
