import type { ProjectReport } from "./analysis";

function reportSections(report: ProjectReport) {
  const stack = report.stack.map((s) => `${s.name}${s.version ? ` ${s.version}` : ""}`).join(", ");
  const languages = report.languages
    .slice(0, 8)
    .map((l) => `${l.name} (${l.files} files)`)
    .join(", ");
  return { stack, languages };
}

function treeLines(report: ProjectReport) {
  return report.files.map((f) => f.path);
}

export async function exportPdf(report: ProjectReport) {
  const { jsPDF } = await import("jspdf");
  const doc = new jsPDF({ unit: "pt", format: "letter" });
  const margin = 56;
  const width = doc.internal.pageSize.getWidth() - margin * 2;
  const bottom = doc.internal.pageSize.getHeight() - margin;
  let y = margin;

  const nl = (h: number) => {
    if (y + h > bottom) {
      doc.addPage();
      y = margin;
    }
  };
  const heading = (text: string, size = 14) => {
    nl(size + 18);
    y += 10;
    doc.setFont("helvetica", "bold").setFontSize(size);
    doc.text(text, margin, y);
    y += size + 6;
  };
  const body = (text: string, size = 10, mono = false) => {
    doc.setFont(mono ? "courier" : "helvetica", "normal").setFontSize(size);
    for (const line of doc.splitTextToSize(text, width) as string[]) {
      nl(size + 4);
      doc.text(line, margin, y);
      y += size + 4;
    }
  };

  doc.setFont("helvetica", "bold").setFontSize(22);
  doc.text("CodeXplain Report", margin, y);
  y += 26;
  doc.setFont("helvetica", "normal").setFontSize(12);
  doc.text(report.source, margin, y);
  y += 18;
  doc.setFontSize(9).setTextColor(120);
  doc.text(new Date().toLocaleString(), margin, y);
  doc.setTextColor(0);
  y += 10;

  const { stack, languages } = reportSections(report);
  heading("Project overview");
  body(report.overview);
  heading("Detected stack");
  body(stack || "none detected");
  heading("Languages");
  body(languages || "none detected");
  heading("Entry points");
  body(report.entryPoints.join("\n") || "none detected");

  heading("File structure");
  body(treeLines(report).join("\n"), 9, true);

  heading("File-by-file explanations");
  for (const s of report.summaries) {
    nl(40);
    doc.setFont("helvetica", "bold").setFontSize(11);
    doc.text(s.path, margin, y);
    y += 14;
    body(s.summary);
    if (s.symbols?.length) body(s.symbols.map((x) => `• ${x}`).join("\n"), 9);
    y += 6;
  }

  if (report.diagrams?.length) {
    heading("Architecture diagrams (Mermaid source)");
    for (const d of report.diagrams) {
      nl(30);
      doc.setFont("helvetica", "bold").setFontSize(11);
      doc.text(d.title, margin, y);
      y += 14;
      body(d.description);
      body(d.mermaid, 8, true);
      y += 6;
    }
  }

  if (report.prep) {
    heading("Interview prep");
    for (const [tier, list] of Object.entries(report.prep)) {
      heading(tier.toUpperCase(), 12);
      list.forEach((q, i) => {
        nl(30);
        doc.setFont("helvetica", "bold").setFontSize(10);
        for (const line of doc.splitTextToSize(`${i + 1}. ${q.question}`, width) as string[]) {
          nl(14);
          doc.text(line, margin, y);
          y += 14;
        }
        body(q.answer);
        y += 4;
      });
    }
  }

  doc.save(`${report.source.replace(/[^\w.-]+/g, "-")}-codexplain.pdf`);
}

export async function exportDocx(report: ProjectReport) {
  const { Document, Packer, Paragraph, TextRun, HeadingLevel, AlignmentType } = await import("docx");
  const { saveAs } = await import("file-saver");
  const { stack, languages } = reportSections(report);

  const p = (text: string, opts: { bold?: boolean; mono?: boolean; size?: number } = {}) =>
    new Paragraph({
      spacing: { after: 120 },
      children: [
        new TextRun({
          text,
          bold: opts.bold,
          font: opts.mono ? "Courier New" : "Arial",
          size: opts.size ?? 22,
        }),
      ],
    });
  const h = (text: string, level: (typeof HeadingLevel)[keyof typeof HeadingLevel]) =>
    new Paragraph({ heading: level, spacing: { before: 240, after: 120 }, children: [new TextRun({ text, bold: true, font: "Arial" })] });

  const children: InstanceType<typeof Paragraph>[] = [
    new Paragraph({
      alignment: AlignmentType.LEFT,
      children: [new TextRun({ text: "CodeXplain Report", bold: true, size: 44, font: "Arial" })],
    }),
    p(report.source, { bold: true, size: 26 }),
    p(new Date().toLocaleString(), { size: 18 }),
    h("Project overview", HeadingLevel.HEADING_1),
    ...report.overview.split(/\n{1,2}/).filter(Boolean).map((t) => p(t)),
    h("Detected stack", HeadingLevel.HEADING_1),
    p(stack || "none detected"),
    h("Languages", HeadingLevel.HEADING_1),
    p(languages || "none detected"),
    h("Entry points", HeadingLevel.HEADING_1),
    ...(report.entryPoints.length ? report.entryPoints.map((e) => p(e, { mono: true, size: 20 })) : [p("none detected")]),
    h("File structure", HeadingLevel.HEADING_1),
    ...treeLines(report).map((l) => p(l, { mono: true, size: 18 })),
    h("File-by-file explanations", HeadingLevel.HEADING_1),
  ];

  for (const s of report.summaries) {
    children.push(h(s.path, HeadingLevel.HEADING_2), p(s.summary));
    for (const sym of s.symbols ?? []) children.push(p(`• ${sym}`, { mono: true, size: 18 }));
  }

  if (report.diagrams?.length) {
    children.push(h("Architecture diagrams (Mermaid source)", HeadingLevel.HEADING_1));
    for (const d of report.diagrams) {
      children.push(h(d.title, HeadingLevel.HEADING_2), p(d.description));
      for (const line of d.mermaid.split("\n")) children.push(p(line, { mono: true, size: 18 }));
    }
  }

  if (report.prep) {
    children.push(h("Interview prep", HeadingLevel.HEADING_1));
    for (const [tier, list] of Object.entries(report.prep)) {
      children.push(h(tier.charAt(0).toUpperCase() + tier.slice(1), HeadingLevel.HEADING_2));
      list.forEach((q, i) => {
        children.push(p(`${i + 1}. ${q.question}`, { bold: true }), p(q.answer));
      });
    }
  }

  const doc = new Document({
    styles: { default: { document: { run: { font: "Arial", size: 22 } } } },
    sections: [
      {
        properties: {
          page: { size: { width: 12240, height: 15840 }, margin: { top: 1440, right: 1440, bottom: 1440, left: 1440 } },
        },
        children,
      },
    ],
  });

  const blob = await Packer.toBlob(doc);
  saveAs(blob, `${report.source.replace(/[^\w.-]+/g, "-")}-codexplain.docx`);
}
