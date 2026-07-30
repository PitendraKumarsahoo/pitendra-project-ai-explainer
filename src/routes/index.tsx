import { createFileRoute } from "@tanstack/react-router";
import { useServerFn } from "@tanstack/react-start";
import { useRef, useState } from "react";
import { Github, Loader2, Upload } from "lucide-react";
import { toast } from "sonner";
import { ReportView } from "@/components/ReportView";
import {
  buildTree,
  detectEntryPoints,
  detectLanguages,
  detectStack,
  isIgnored,
  isTextFile,
  type ProjectReport,
  type SourceFile,
} from "@/lib/analysis";
import { explainProject, fetchGithubRepo } from "@/lib/codexplain.functions";

export const Route = createFileRoute("/")({
  head: () => ({
    meta: [
      { title: "CodeXplain — Understand and defend any codebase" },
      {
        name: "description",
        content:
          "Upload a ZIP or paste a GitHub repo and get a plain-language breakdown: tech stack, folder tree, and AI file-by-file explanations.",
      },
      { property: "og:title", content: "CodeXplain — Understand and defend any codebase" },
      {
        property: "og:description",
        content:
          "Turn any project into a human-readable report: detected stack, folder tree, and file-by-file AI explanations.",
      },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary_large_image" },
    ],
  }),
  component: Index,
});

const STAGES = [
  "reading files",
  "detecting tech stack",
  "mapping structure",
  "explaining code with AI",
];

function Index() {
  const [url, setUrl] = useState("");
  const [busy, setBusy] = useState(false);
  const [stage, setStage] = useState(0);
  const [report, setReport] = useState<ProjectReport | null>(null);
  const fileInput = useRef<HTMLInputElement>(null);

  const runGithub = useServerFn(fetchGithubRepo);
  const runExplain = useServerFn(explainProject);

  async function analyze(source: string, files: SourceFile[]) {
    if (!files.length) throw new Error("No readable source files were found.");
    setStage(1);
    const stack = detectStack(files);
    setStage(2);
    const tree = buildTree(files);
    const languages = detectLanguages(files);
    const entryPoints = detectEntryPoints(files);
    setStage(3);
    const ai = await runExplain({
      data: {
        name: source,
        stack: stack.map((s) => s.name),
        files: files.slice(0, 60).map((f) => ({ path: f.path, content: f.content.slice(0, 6000) })),
      },
    });
    setReport({ source, files, tree, stack, languages, entryPoints, ...ai });
  }

  async function onZip(fileList: FileList | null) {
    const zipFile = fileList?.[0];
    if (!zipFile) return;
    if (zipFile.size > 20 * 1024 * 1024) {
      toast.error("ZIP is larger than 20 MB.");
      return;
    }
    setBusy(true);
    setStage(0);
    try {
      const JSZip = (await import("jszip")).default;
      const zip = await JSZip.loadAsync(zipFile);
      const entries = Object.values(zip.files).filter(
        (e) => !e.dir && !isIgnored(e.name) && isTextFile(e.name),
      );
      const files: SourceFile[] = [];
      for (const entry of entries.slice(0, 300)) {
        const content = await entry.async("string");
        if (content.length > 120_000) continue;
        files.push({ path: entry.name.replace(/^[^/]+\//, ""), content, size: content.length });
      }
      files.sort((a, b) => a.path.split("/").length - b.path.split("/").length);
      await analyze(zipFile.name.replace(/\.zip$/i, ""), files.slice(0, 60));
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Analysis failed.");
    } finally {
      setBusy(false);
    }
  }

  async function onGithub() {
    if (!url.trim()) return;
    setBusy(true);
    setStage(0);
    try {
      const repo = await runGithub({ data: { url } });
      await analyze(repo.name, repo.files);
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Analysis failed.");
    } finally {
      setBusy(false);
    }
  }

  if (report) return <ReportView report={report} onReset={() => setReport(null)} />;

  return (
    <main className="relative min-h-screen overflow-hidden">
      <div className="grid-bg pointer-events-none absolute inset-0 opacity-40" />
      <div className="relative mx-auto flex min-h-screen w-full max-w-3xl flex-col justify-center px-5 py-20">
        <p className="font-mono text-xs uppercase tracking-[0.3em] text-primary">codexplain</p>
        <h1 className="mt-5 font-mono text-4xl leading-tight text-foreground sm:text-5xl">
          Understand the code
          <br />
          you shipped.
        </h1>
        <p className="mt-5 max-w-xl text-sm leading-relaxed text-muted-foreground">
          Drop a ZIP or paste a public GitHub repo. CodeXplain reads the codebase and returns the
          detected stack, the folder structure, and a plain-language explanation of every file — so
          you can actually defend the project in a viva or interview.
        </p>

        <div className="term-glow mt-10 rounded-sm border border-border bg-card p-6">
          {busy ? (
            <div className="space-y-3">
              {STAGES.map((s, i) => (
                <div
                  key={s}
                  className="flex items-center gap-3 font-mono text-xs"
                  style={{ opacity: i <= stage ? 1 : 0.35 }}
                >
                  {i === stage ? (
                    <Loader2 className="size-3 animate-spin text-primary" />
                  ) : (
                    <span className="text-primary">{i < stage ? "✓" : "·"}</span>
                  )}
                  <span className={i <= stage ? "text-foreground" : "text-muted-foreground"}>
                    {s}
                  </span>
                </div>
              ))}
            </div>
          ) : (
            <>
              <button
                onClick={() => fileInput.current?.click()}
                className="flex w-full items-center justify-center gap-3 rounded-sm border border-dashed border-border py-10 font-mono text-xs text-muted-foreground transition-colors hover:border-primary hover:text-primary"
              >
                <Upload className="size-4" />
                upload project .zip (max 20 MB)
              </button>
              <input
                ref={fileInput}
                type="file"
                accept=".zip"
                className="hidden"
                onChange={(e) => onZip(e.target.files)}
              />

              <div className="my-5 flex items-center gap-3 font-mono text-[10px] uppercase tracking-widest text-muted-foreground">
                <span className="h-px flex-1 bg-border" />
                or
                <span className="h-px flex-1 bg-border" />
              </div>

              <div className="flex flex-col gap-2 sm:flex-row">
                <div className="flex flex-1 items-center gap-2 rounded-sm border border-input bg-background px-3">
                  <Github className="size-4 text-muted-foreground" />
                  <input
                    value={url}
                    onChange={(e) => setUrl(e.target.value)}
                    onKeyDown={(e) => e.key === "Enter" && onGithub()}
                    placeholder="https://github.com/owner/repo"
                    className="w-full bg-transparent py-2.5 font-mono text-xs text-foreground outline-none placeholder:text-muted-foreground"
                  />
                </div>
                <button
                  onClick={onGithub}
                  className="rounded-sm bg-primary px-5 py-2.5 font-mono text-xs font-medium text-primary-foreground transition-opacity hover:opacity-90"
                >
                  analyze
                </button>
              </div>
            </>
          )}
        </div>

        <p className="mt-6 font-mono text-[11px] text-muted-foreground scan-caret">
          reads up to 60 source files per run
        </p>
      </div>
    </main>
  );
}
