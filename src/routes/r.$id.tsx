import { createFileRoute } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { Loader2 } from "lucide-react";
import { ReportView } from "@/components/ReportView";
import type { ProjectReport } from "@/lib/analysis";
import { loadSharedReport } from "@/lib/codexplain.functions";

export const Route = createFileRoute("/r/$id")({
  head: () => ({
    meta: [
      { title: "Shared CodeXplain report — read-only codebase breakdown" },
      {
        name: "description",
        content:
          "A read-only CodeXplain report: detected tech stack, folder structure, file-by-file explanations, architecture diagrams and interview prep.",
      },
      { property: "og:title", content: "Shared CodeXplain report" },
      {
        property: "og:description",
        content: "Read-only codebase breakdown: stack, structure, file explanations and architecture diagrams.",
      },
      { property: "og:type", content: "article" },
      { name: "twitter:card", content: "summary_large_image" },
    ],
  }),
  component: SharedReport,
});

function SharedReport() {
  const { id } = Route.useParams();
  const load = useServerFn(loadSharedReport);
  const { data, isLoading, error } = useQuery({
    queryKey: ["shared-report", id],
    queryFn: () => load({ data: { id } }),
  });

  if (isLoading)
    return (
      <div className="flex min-h-screen items-center justify-center gap-3 font-mono text-xs text-muted-foreground">
        <Loader2 className="size-4 animate-spin text-primary" /> loading shared report
      </div>
    );

  if (error || !data || data.status !== "ok") {
    const state = data?.status ?? "missing";
    const copy = {
      revoked: {
        code: "410",
        title: "This shared report has been revoked",
        blurb: "The author turned off access to this link.",
      },
      expired: {
        code: "410",
        title: "This share link has expired",
        blurb: "Ask the author for a fresh link.",
      },
      missing: {
        code: "404",
        title: "This shared report doesn't exist",
        blurb: "The link may be mistyped.",
      },
    }[state === "revoked" || state === "expired" ? state : "missing"];

    return (
      <div className="flex min-h-screen flex-col items-center justify-center gap-3 px-5 text-center">
        <p className="font-mono text-xs uppercase tracking-[0.2em] text-primary">{copy.code}</p>
        <h1 className="font-mono text-xl text-foreground">{copy.title}</h1>
        <p className="font-mono text-xs text-muted-foreground">{copy.blurb}</p>
        <a href="/" className="font-mono text-xs text-muted-foreground underline-offset-4 hover:text-primary hover:underline">
          analyze your own project
        </a>
      </div>
    );
  }

  return <ReportView report={data.payload as unknown as ProjectReport} readOnly />;
}

