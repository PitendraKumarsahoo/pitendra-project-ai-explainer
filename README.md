# Code Unpacked

# CodeXplain — AI Project Analyzer Website
### Full Product Blueprint + Build Prompt

---

## 1. Core Idea (One Line)

User uploads a **ZIP file** or pastes a **GitHub repo link** → the platform deeply analyzes the entire codebase and generates a complete, human-readable breakdown: file-by-file explanation, architecture diagrams, tech-stack detection, complexity report, and an **auto-generated interview prep sheet** based on that exact project — so anyone (especially students who used AI to build something) can actually understand and defend their own project.

**Target users:** Students submitting AI-built projects, job seekers prepping for project-round interviews, bootcamp grads, hackathon teams, freelancers handing off code, recruiters/reviewers doing quick due diligence.

---

## 2. Problem Statement

- Students use AI (ChatGPT/Claude/Copilot) to build apps but can't explain their own code in interviews or vivas.
- No single tool converts a raw codebase into a **plain-language explanation + interview Q&A** specific to that project.
- Reviewing an unfamiliar codebase (onboarding, code audits, hackathon judging) takes hours manually.

---

## 3. Core Features (MVP → Advanced)

### MVP (Phase 1)
1. **Input methods**
   - Upload `.zip` of project folder
   - Paste public GitHub repo URL (auto-clone via GitHub API)
2. **Project Overview Report**
   - Detected tech stack (languages, frameworks, libraries, versions from package.json/pom.xml/requirements.txt)
   - Folder structure tree (visual, collapsible)
   - Entry point detection (main.py, App.java, index.js, etc.)
3. **File-wise Explanation**
   - For every file: plain-language summary of what it does, key functions/classes listed with 1-line purpose each
   - Dependency map: which files import/call which
4. **Interview Prep Mode**
   - Auto-generated Q&A: "Why did you use X here?", "What happens if Y fails?", "Explain the flow of Z feature"
   - Difficulty levels: Basic / Intermediate / Grilling (viva-style)
   - Includes ideal-answer draft (in user's own project's context)
5. **Export**
   - Downloadable PDF/DOCX report
   - Shareable read-only link

### Phase 2 (Growth features)
6. **Visual Architecture Diagrams**
   - Auto-generated flowcharts (request flow, DB schema/ER diagram if detected, component diagram for frontend)
   - Sequence diagrams for key user actions (login, checkout, etc.)
7. **Code Quality & Red Flags**
   - Detects hardcoded secrets, missing error handling, unused code, N+1 queries, security smells (not full security audit — a "things to explain if asked" list)
   - Complexity score per file/function (cyclomatic complexity)
8. **"Explain Like I'm the one who wrote it" Mode**
   - Converts explanation into first-person narrative the student can literally rehearse/speak
9. **AI Chat on the Codebase**
   - Chat interface: "Ask anything about this project" — grounded only in the uploaded code (RAG over the repo)
10. **Comparison Mode**
   - Compare two versions/commits — "what changed and why does it matter"

### Phase 3 (Monetization-driving / Pro features)
11. **Mock Viva/Interview Simulator** — voice or text-based, AI asks questions live, evaluates answers
12. **Team/Recruiter Dashboard** — batch-analyze multiple student submissions, plagiarism/originality signal (AI-generated-code likelihood indicator)
13. **LMS/College integration** — bulk upload for faculty to auto-generate viva question banks per submitted project
14. **API access** for other platforms to plug in analysis

---

## 4. Suggested Tech Stack (matches your existing stack)

| Layer | Choice | Why |
|---|---|---|
| Backend | **Java + Spring Boot** | Your core strength; handles file upload, GitHub API, job orchestration well |
| Async processing | Spring Batch / Kafka or simple queue (RabbitMQ/Redis) | Repo analysis is slow — needs background jobs, not blocking requests |
| Code parsing | Language-specific parsers: `JavaParser` (Java), `ast` module (Python), `@babel/parser` / `ts-morph` (JS/TS), fallback to tree-sitter for multi-language | Real structural understanding, not just text |
| AI layer | Anthropic Claude API (Sonnet for depth, Haiku for cheap bulk file summaries) | For explanations, Q&A generation, chat-on-codebase (RAG) |
| Vector DB | pgvector / Qdrant | For "chat with codebase" RAG feature |
| Frontend | **React.js** + Tailwind | Matches your stack; diagrams via Mermaid.js/D3 or React Flow |
| Diagrams | Mermaid.js (auto-generated flowcharts/ER diagrams as text→visual) | Easiest to auto-generate from AI-extracted structure |
| DB | PostgreSQL | User accounts, reports, subscription/payment status |
| File storage | AWS S3 / Cloudflare R2 | Uploaded zips + generated reports |
| Auth | Spring Security + JWT, Google OAuth login | Fast onboarding |
| GitHub integration | GitHub REST API + OAuth (for private repos in Pro tier) | |
| Deployment | Docker + Render/Railway/AWS EC2, Nginx | Cost-effective for solo/small team launch |
| Payments | Razorpay (India-first) + Stripe (global) | For subscriptions |
| Ads | Google AdSense (only for free tier, non-intrusive placement) | Monetization while building paid base |

---

## 5. Monetization Plan

| Tier | Price | Includes |
|---|---|---|
| **Free** | ₹0 | 2 analyses/month, small repo size limit (e.g. <20MB), ads shown, basic report only |
| **Student Pro** | ~₹149–299/month | Unlimited analyses, interview Q&A mode, PDF export, no ads |
| **Pro+/Recruiter** | ~₹999+/month | Batch analysis, team dashboard, private repo support, API access |
| **One-time credit packs** | ₹49 for 1 deep analysis | For non-subscribers who need it once |

Ads only on free tier (AdSense banner, non-blocking) — don't let ads slow down or clutter the actual report page; keep them in sidebar/footer only.

**Cost control tip:** Use cheaper models (Haiku-class) for per-file summaries (bulk, repetitive), and reserve expensive/deep reasoning models for the overview report, architecture inference, and interview-question generation — this is where most of your margin will come from since AI API cost is your #1 variable cost.

---

## 6. Master Build Prompt (paste this into Claude Code / Cursor / your AI dev tool)

```
Build a full-stack web application called "CodeXplain" with the following spec:

PURPOSE:
A platform where users upload a ZIP file or paste a GitHub repository URL,
and the system analyzes the entire codebase to produce a comprehensive,
human-readable report: tech stack detection, folder structure, file-by-file
explanations, dependency graph, auto-generated architecture diagrams
(flowcharts/ER diagrams via Mermaid.js), code quality flags, and an
auto-generated interview/viva Q&A sheet specific to that project
(basic / intermediate / grilling difficulty levels).

BACKEND: Java 17 + Spring Boot 3
- REST API: /api/upload (zip), /api/analyze/github (repo URL),
  /api/reports/{id}, /api/reports/{id}/export
- Async job processing for analysis (use Spring's @Async or a queue)
- File extraction & parsing service: detect language(s), parse structure
  using JavaParser (Java files), Python ast (via subprocess or a Python
  microservice), @babel/parser or ts-morph (JS/TS files)
- Integration with GitHub REST API to clone/fetch public repos
- Integration with Anthropic Claude API for:
  - per-file plain-language summaries
  - overall architecture inference
  - interview Q&A generation (3 difficulty tiers)
  - RAG-based "chat with your codebase" (embed file chunks, store in
    pgvector, retrieve relevant chunks per user question)
- Auth: Spring Security + JWT + Google OAuth login
- Subscription/payment: Razorpay integration, tiers = Free / Pro / Pro+
- Rate-limit free tier (2 analyses/month, 20MB max upload)

FRONTEND: React.js + Tailwind CSS
- Landing page explaining the product, pricing table, testimonials section
- Upload page: drag-drop zip OR paste GitHub URL, show live progress
  (analyzing... parsing... generating report...)
- Report dashboard with tabs: Overview | File Explorer | Architecture
  Diagrams | Interview Prep | Code Quality | Chat with Codebase
- File Explorer: collapsible folder tree, click a file to see its
  AI-generated explanation + key functions
- Architecture tab: render Mermaid.js diagrams (flowchart, ER diagram,
  sequence diagram) generated from backend-extracted structure
- Interview Prep tab: accordion of Q&A grouped by difficulty, with a
  "practice mode" that hides answers and lets user type/reveal
- Export button: generate PDF/DOCX of the full report
- Responsive, clean, professional UI (avoid generic AI-template look —
  use a distinct color scheme and typography)

DATABASE: PostgreSQL
- Tables: users, subscriptions, reports, report_files, chat_history
- pgvector extension for embeddings (codebase chat feature)

DEPLOYMENT:
- Dockerize backend and frontend separately
- docker-compose for local dev (backend, frontend, postgres, redis)
- Provide Nginx reverse proxy config
- Environment variables for API keys (Anthropic, GitHub, Razorpay, AWS S3)

DELIVERABLES:
1. Full backend Spring Boot project with all controllers, services,
   repositories, and DTOs
2. Full React frontend with all pages/components listed above
3. Database migration scripts (Flyway/Liquibase)
4. Docker + docker-compose setup
5. README with setup instructions

Build this step by step: start with the upload + basic file parsing +
tech-stack detection + file explanation report (MVP), then add
architecture diagrams, then interview Q&A generation, then chat-on-
codebase, then payments/subscriptions last.
```

---

## 7. Naming Ideas
CodeXplain · RepoLens · CodeUnbox · Vivaly · ExplainMyCode · CodeInterviewer · ProjectProbe

---

## 8. Suggested Build Order (Realistic, Solo Dev)

1. Week 1–2: Upload/GitHub fetch + folder tree + tech stack detection (no AI yet, just static analysis)
2. Week 3–4: Plug in Claude API for file summaries + overview report
3. Week 5: Interview Q&A generation
4. Week 6: Mermaid diagram auto-generation
5. Week 7: Auth + Free/Pro tier gating + PDF export
6. Week 8: Payments (Razorpay) + AdSense on free tier
7. Week 9+: Chat-with-codebase (RAG), polish UI, launch

Launch MVP after week 6–7 — don't wait for every feature; get real users analyzing real projects early and iterate.

This project was built with [Lovable](https://lovable.dev).

**Live app**: https://vivaly-ai-explainer.lovable.app

## Build with Lovable

Continue developing this project in the [Lovable editor](https://lovable.dev/projects/ac8e4617-cd3c-4be4-bdad-437f433d937e).

- **Ship faster**: describe what you want to build and Lovable handles the code.
- **Stay in sync**: every change made in Lovable is committed straight to this repository.
- **Full ownership**: this code is yours. Push to `main` on GitHub and your changes sync back into Lovable, ready for your next prompt.

## Development

Prefer working locally? You need Node.js and npm — [install with nvm](https://github.com/nvm-sh/nvm#installing-and-updating).

```sh
git clone <this-repository-url>
cd <repository-name>
npm i
npm run dev
```
