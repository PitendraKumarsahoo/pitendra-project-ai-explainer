export type SourceFile = {
  path: string;
  content: string;
  size: number;
};

export type TreeNode = {
  name: string;
  path: string;
  type: "dir" | "file";
  size: number;
  children?: TreeNode[];
};

export type TechFinding = {
  name: string;
  version?: string;
  category: "language" | "framework" | "library" | "tooling" | "database";
};

export type FileSummary = {
  path: string;
  summary: string;
  symbols: string[];
};

export type InterviewQuestion = {
  question: string;
  answer: string;
};

export type InterviewPrep = {
  basic: InterviewQuestion[];
  intermediate: InterviewQuestion[];
  grilling: InterviewQuestion[];
};

export type Diagram = {
  title: string;
  kind: "flowchart" | "er" | "component";
  description: string;
  mermaid: string;
};

export type ProjectReport = {
  source: string;
  files: SourceFile[];
  tree: TreeNode;
  stack: TechFinding[];
  languages: { name: string; files: number; bytes: number }[];
  entryPoints: string[];
  overview: string;
  summaries: FileSummary[];
  prep?: InterviewPrep;
  diagrams?: Diagram[];
};

const TEXT_EXT = new Set([
  "js","jsx","ts","tsx","mjs","cjs","java","py","rb","go","rs","php","cs","kt","swift","c","h","cpp","hpp",
  "html","css","scss","sass","less","json","yml","yaml","toml","xml","md","sql","sh","env","gradle","properties","txt","vue","svelte",
]);

const IGNORE = [
  "node_modules/","dist/","build/","target/",".git/",".next/","venv/","__pycache__/",".idea/",".vscode/","coverage/",".cache/","vendor/",
];

export const isIgnored = (path: string) =>
  IGNORE.some((seg) => path.includes(seg)) || path.split("/").some((p) => p.startsWith("."));

export const ext = (path: string) => path.split(".").pop()?.toLowerCase() ?? "";

export const isTextFile = (path: string) => {
  const base = path.split("/").pop() ?? "";
  if (["Dockerfile", "Makefile", "LICENSE", "README"].includes(base)) return true;
  return TEXT_EXT.has(ext(path));
};

const LANG_BY_EXT: Record<string, string> = {
  ts: "TypeScript", tsx: "TypeScript", js: "JavaScript", jsx: "JavaScript", mjs: "JavaScript", cjs: "JavaScript",
  java: "Java", py: "Python", rb: "Ruby", go: "Go", rs: "Rust", php: "PHP", cs: "C#", kt: "Kotlin",
  swift: "Swift", c: "C", h: "C", cpp: "C++", hpp: "C++", html: "HTML", css: "CSS", scss: "SCSS",
  sql: "SQL", sh: "Shell", vue: "Vue", svelte: "Svelte", md: "Markdown", json: "JSON", yml: "YAML", yaml: "YAML",
};

export function detectLanguages(files: SourceFile[]) {
  const map = new Map<string, { name: string; files: number; bytes: number }>();
  for (const f of files) {
    const lang = LANG_BY_EXT[ext(f.path)];
    if (!lang) continue;
    const cur = map.get(lang) ?? { name: lang, files: 0, bytes: 0 };
    cur.files += 1;
    cur.bytes += f.size;
    map.set(lang, cur);
  }
  return [...map.values()].sort((a, b) => b.bytes - a.bytes);
}

const FRAMEWORK_HINTS: { match: RegExp; name: string; category: TechFinding["category"] }[] = [
  { match: /^react$/, name: "React", category: "framework" },
  { match: /^next$/, name: "Next.js", category: "framework" },
  { match: /^vue$/, name: "Vue", category: "framework" },
  { match: /^svelte$/, name: "Svelte", category: "framework" },
  { match: /^express$/, name: "Express", category: "framework" },
  { match: /^fastify$/, name: "Fastify", category: "framework" },
  { match: /^tailwindcss$/, name: "Tailwind CSS", category: "framework" },
  { match: /^vite$/, name: "Vite", category: "tooling" },
  { match: /^webpack$/, name: "Webpack", category: "tooling" },
  { match: /^typescript$/, name: "TypeScript", category: "tooling" },
  { match: /^jest$|^vitest$/, name: "Testing", category: "tooling" },
  { match: /^prisma$|^@prisma\/client$/, name: "Prisma", category: "database" },
  { match: /^mongoose$/, name: "MongoDB / Mongoose", category: "database" },
  { match: /^pg$|^postgres$/, name: "PostgreSQL", category: "database" },
  { match: /^@supabase\/supabase-js$/, name: "Supabase", category: "database" },
];

const PY_HINTS: { match: RegExp; name: string; category: TechFinding["category"] }[] = [
  { match: /^django/i, name: "Django", category: "framework" },
  { match: /^flask/i, name: "Flask", category: "framework" },
  { match: /^fastapi/i, name: "FastAPI", category: "framework" },
  { match: /^pandas/i, name: "pandas", category: "library" },
  { match: /^numpy/i, name: "NumPy", category: "library" },
  { match: /^torch|^tensorflow/i, name: "Deep learning stack", category: "library" },
  { match: /^psycopg/i, name: "PostgreSQL", category: "database" },
];

export function detectStack(files: SourceFile[]): TechFinding[] {
  const out: TechFinding[] = [];
  const seen = new Set<string>();
  const push = (t: TechFinding) => {
    if (seen.has(t.name)) return;
    seen.add(t.name);
    out.push(t);
  };

  for (const l of detectLanguages(files).slice(0, 5)) {
    if (["JSON", "Markdown", "YAML"].includes(l.name)) continue;
    push({ name: l.name, category: "language" });
  }

  const pkg = files.find((f) => f.path.endsWith("package.json") && !f.path.includes("node_modules"));
  if (pkg) {
    try {
      const json = JSON.parse(pkg.content) as {
        dependencies?: Record<string, string>;
        devDependencies?: Record<string, string>;
      };
      const deps = { ...(json.dependencies ?? {}), ...(json.devDependencies ?? {}) };
      for (const [dep, version] of Object.entries(deps)) {
        const hit = FRAMEWORK_HINTS.find((h) => h.match.test(dep));
        if (hit) push({ name: hit.name, version: String(version), category: hit.category });
      }
    } catch {
      /* malformed package.json — ignore */
    }
  }

  const req = files.find((f) => f.path.endsWith("requirements.txt"));
  if (req) {
    for (const line of req.content.split("\n")) {
      const nameOnly = line.split(/[=<>~\[]/)[0].trim();
      if (!nameOnly) continue;
      const hit = PY_HINTS.find((h) => h.match.test(nameOnly));
      if (hit) push({ name: hit.name, version: line.trim(), category: hit.category });
    }
  }

  if (files.some((f) => f.path.endsWith("pom.xml"))) push({ name: "Maven / Java", category: "tooling" });
  if (files.some((f) => f.path.endsWith("build.gradle"))) push({ name: "Gradle", category: "tooling" });
  if (files.some((f) => /Dockerfile$/.test(f.path))) push({ name: "Docker", category: "tooling" });

  return out;
}

const ENTRY_PATTERNS = [
  /(^|\/)main\.(py|go|rs|java|ts|js)$/,
  /(^|\/)index\.(js|ts|tsx|jsx|html)$/,
  /(^|\/)app\.(py|js|ts|jsx|tsx)$/,
  /(^|\/)server\.(js|ts)$/,
  /Application\.java$/,
  /(^|\/)manage\.py$/,
];

export const detectEntryPoints = (files: SourceFile[]) =>
  files.filter((f) => ENTRY_PATTERNS.some((p) => p.test(f.path))).map((f) => f.path).slice(0, 8);

export function buildTree(files: SourceFile[]): TreeNode {
  const root: TreeNode = { name: "project", path: "", type: "dir", size: 0, children: [] };
  for (const file of files) {
    const parts = file.path.split("/");
    let node = root;
    parts.forEach((part, i) => {
      const isFile = i === parts.length - 1;
      const path = parts.slice(0, i + 1).join("/");
      node.size += file.size;
      let next = node.children?.find((c) => c.name === part && c.type === (isFile ? "file" : "dir"));
      if (!next) {
        next = { name: part, path, type: isFile ? "file" : "dir", size: 0, children: isFile ? undefined : [] };
        node.children?.push(next);
      }
      node = next;
    });
    node.size = file.size;
  }
  const sort = (n: TreeNode) => {
    n.children?.sort((a, b) => (a.type === b.type ? a.name.localeCompare(b.name) : a.type === "dir" ? -1 : 1));
    n.children?.forEach(sort);
  };
  sort(root);
  return root;
}

export const formatBytes = (n: number) =>
  n > 1_000_000 ? `${(n / 1_048_576).toFixed(1)} MB` : n > 1000 ? `${Math.round(n / 1024)} KB` : `${n} B`;
