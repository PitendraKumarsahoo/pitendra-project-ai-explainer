import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import { isIgnored, isTextFile } from "./analysis";

const GithubInput = z.object({ url: z.string().min(4).max(300) });

const MAX_FILES = 60;
const MAX_FILE_BYTES = 120_000;

export const fetchGithubRepo = createServerFn({ method: "POST" })
  .inputValidator((input: unknown) => GithubInput.parse(input))
  .handler(async ({ data }) => {
    const m = data.url
      .trim()
      .replace(/\.git$/, "")
      .match(/github\.com\/([^/\s]+)\/([^/\s?#]+)/i);
    if (!m) throw new Error("That doesn't look like a GitHub repository URL.");
    const [, owner, repo] = m;

    const headers: Record<string, string> = {
      Accept: "application/vnd.github+json",
      "User-Agent": "CodeXplain",
    };

    const metaRes = await fetch(`https://api.github.com/repos/${owner}/${repo}`, { headers });
    if (!metaRes.ok) {
      throw new Error(
        metaRes.status === 404
          ? "Repository not found (it must be public)."
          : `GitHub error [${metaRes.status}]: ${await metaRes.text()}`,
      );
    }
    const meta = (await metaRes.json()) as { default_branch: string; full_name: string };

    const treeRes = await fetch(
      `https://api.github.com/repos/${owner}/${repo}/git/trees/${meta.default_branch}?recursive=1`,
      { headers },
    );
    if (!treeRes.ok) throw new Error(`GitHub error [${treeRes.status}]: ${await treeRes.text()}`);
    const tree = (await treeRes.json()) as {
      tree: { path: string; type: string; size?: number }[];
    };

    const wanted = tree.tree
      .filter((n) => n.type === "blob" && !isIgnored(n.path) && isTextFile(n.path))
      .filter((n) => (n.size ?? 0) < MAX_FILE_BYTES)
      .sort((a, b) => a.path.split("/").length - b.path.split("/").length)
      .slice(0, MAX_FILES);

    const files = await Promise.all(
      wanted.map(async (n) => {
        const raw = await fetch(
          `https://raw.githubusercontent.com/${owner}/${repo}/${meta.default_branch}/${n.path}`,
        );
        const content = raw.ok ? await raw.text() : "";
        return { path: n.path, content, size: n.size ?? content.length };
      }),
    );

    return { name: meta.full_name, files: files.filter((f) => f.content.length > 0) };
  });

const ExplainInput = z.object({
  name: z.string().max(200),
  stack: z.array(z.string()).max(40),
  files: z
    .array(z.object({ path: z.string().max(400), content: z.string().max(6000) }))
    .max(60),
});

type AiFileSummary = { path: string; summary: string; symbols: string[] };

async function callGateway(messages: { role: string; content: string }[]) {
  const key = process.env.LOVABLE_API_KEY;
  if (!key) throw new Error("AI is not configured for this project.");
  const res = await fetch("https://ai.gateway.lovable.dev/v1/chat/completions", {
    method: "POST",
    headers: { Authorization: `Bearer ${key}`, "Content-Type": "application/json" },
    body: JSON.stringify({
      model: "google/gemini-3.6-flash",
      messages,
      response_format: { type: "json_object" },
    }),
  });
  if (res.status === 429) throw new Error("Rate limit reached — try again in a minute.");
  if (res.status === 402) throw new Error("AI credits exhausted for this workspace.");
  if (!res.ok) throw new Error(`AI error [${res.status}]: ${await res.text()}`);
  const json = (await res.json()) as { choices: { message: { content: string } }[] };
  return JSON.parse(json.choices[0]?.message?.content ?? "{}") as Record<string, unknown>;
}

export const explainProject = createServerFn({ method: "POST" })
  .inputValidator((input: unknown) => ExplainInput.parse(input))
  .handler(async ({ data }) => {
    const batches: typeof data.files[] = [];
    for (let i = 0; i < data.files.length; i += 8) batches.push(data.files.slice(i, i + 8));

    const summaryJobs = batches.map(async (batch) => {
      const body = batch
        .map((f) => `--- FILE: ${f.path}\n${f.content.slice(0, 4000)}`)
        .join("\n\n");
      const out = await callGateway([
        {
          role: "system",
          content:
            "You explain code to students who must defend their own project in a viva. For each file give a plain-language summary (2-3 sentences, no jargon dumps) and list key functions/classes as 'name — one line purpose'. Respond as JSON: {\"files\":[{\"path\":string,\"summary\":string,\"symbols\":string[]}]}",
        },
        { role: "user", content: `Project: ${data.name}\n\n${body}` },
      ]);
      return (out.files as AiFileSummary[]) ?? [];
    });

    const overviewJob = callGateway([
      {
        role: "system",
        content:
          "You are a senior engineer summarising an unfamiliar codebase. Respond as JSON: {\"overview\": string} where overview is 3 short markdown-free paragraphs: what the project does, how it is architected (layers, data flow, entry points), and what a reviewer would question first.",
      },
      {
        role: "user",
        content: `Project: ${data.name}\nDetected stack: ${data.stack.join(", ")}\nFiles:\n${data.files
          .map((f) => f.path)
          .join("\n")}\n\nKey file excerpts:\n${data.files
          .slice(0, 12)
          .map((f) => `--- ${f.path}\n${f.content.slice(0, 1500)}`)
          .join("\n\n")}`,
      },
    ]);

    const [overviewOut, ...summaryChunks] = await Promise.all([overviewJob, ...summaryJobs]);

    return {
      overview: String(overviewOut.overview ?? "No overview could be generated."),
      summaries: summaryChunks.flat(),
    };
  });
