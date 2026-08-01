import { useEffect, useRef, useState } from "react";

let idCounter = 0;

export function MermaidDiagram({
  code,
  onRendered,
}: {
  code: string;
  onRendered?: (svg: string | null) => void;
}) {
  const ref = useRef<HTMLDivElement>(null);
  const [error, setError] = useState<string | null>(null);
  const rendered = useRef(onRendered);
  rendered.current = onRendered;

  useEffect(() => {
    let cancelled = false;
    (async () => {
      try {
        const mermaid = (await import("mermaid")).default;
        mermaid.initialize({
          startOnLoad: false,
          securityLevel: "strict",
          theme: "base",
          fontFamily: "JetBrains Mono, monospace",
          themeVariables: {
            background: "transparent",
            primaryColor: "#121714",
            primaryTextColor: "#E8F0EA",
            primaryBorderColor: "#B8FF3C",
            lineColor: "#B8FF3C",
            secondaryColor: "#121714",
            tertiaryColor: "#0B0E0C",
            fontSize: "13px",
          },
        });
        const { svg } = await mermaid.render(`mmd-${++idCounter}`, code);
        if (!cancelled && ref.current) {
          ref.current.innerHTML = svg;
          setError(null);
          rendered.current?.(ref.current.querySelector("svg")?.outerHTML ?? svg);
        }
      } catch (e) {
        if (!cancelled) {
          setError(e instanceof Error ? e.message : "Could not render diagram.");
          rendered.current?.(null);
        }
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [code]);

  if (error) {
    return (
      <div className="rounded-sm border border-destructive/40 bg-card p-4">
        <p className="font-mono text-xs text-destructive">diagram failed to render</p>
        <pre className="mt-2 overflow-auto font-mono text-[11px] text-muted-foreground">{code}</pre>
      </div>
    );
  }

  return <div ref={ref} className="overflow-auto rounded-sm border border-border bg-card p-4 [&_svg]:mx-auto [&_svg]:h-auto [&_svg]:max-w-full" />;
}
