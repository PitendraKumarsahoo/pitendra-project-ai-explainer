export function normalizeSvg(svg: string) {
  // Ensure the exported SVG carries the dark canvas so it is readable standalone.
  return svg.replace(
    /<svg([^>]*)>/,
    (m, attrs: string) =>
      `<svg${attrs.includes("xmlns=") ? attrs : `${attrs} xmlns="http://www.w3.org/2000/svg"`}>` +
      `<rect width="100%" height="100%" fill="#0B0E0C"/>`,
  );
}

function svgSize(svg: string) {
  const vb = svg.match(/viewBox="([\d.\-\s]+)"/);
  if (vb) {
    const [, , w, h] = vb[1].trim().split(/\s+/).map(Number);
    if (w && h) return { width: w, height: h };
  }
  const w = Number(svg.match(/width="([\d.]+)"/)?.[1] ?? 1200);
  const h = Number(svg.match(/height="([\d.]+)"/)?.[1] ?? 800);
  return { width: w || 1200, height: h || 800 };
}

export async function svgToPngDataUrl(svg: string, scale = 2) {
  const clean = normalizeSvg(svg);
  const { width, height } = svgSize(clean);
  const url = `data:image/svg+xml;charset=utf-8,${encodeURIComponent(clean)}`;
  const img = new Image();
  img.crossOrigin = "anonymous";
  await new Promise<void>((resolve, reject) => {
    img.onload = () => resolve();
    img.onerror = () => reject(new Error("Could not rasterize the diagram."));
    img.src = url;
  });
  const canvas = document.createElement("canvas");
  canvas.width = Math.max(1, Math.round(width * scale));
  canvas.height = Math.max(1, Math.round(height * scale));
  const ctx = canvas.getContext("2d");
  if (!ctx) throw new Error("Canvas is unavailable in this browser.");
  ctx.fillStyle = "#0B0E0C";
  ctx.fillRect(0, 0, canvas.width, canvas.height);
  ctx.drawImage(img, 0, 0, canvas.width, canvas.height);
  return { dataUrl: canvas.toDataURL("image/png"), width, height };
}

function triggerDownload(href: string, filename: string) {
  const a = document.createElement("a");
  a.href = href;
  a.download = filename;
  document.body.appendChild(a);
  a.click();
  a.remove();
}

export function safeName(text: string) {
  return text.replace(/[^\w.-]+/g, "-").replace(/^-+|-+$/g, "").toLowerCase() || "diagram";
}

export function downloadSvg(svg: string, filename: string) {
  const blob = new Blob([normalizeSvg(svg)], { type: "image/svg+xml;charset=utf-8" });
  const url = URL.createObjectURL(blob);
  triggerDownload(url, filename);
  setTimeout(() => URL.revokeObjectURL(url), 2000);
}

export async function downloadPng(svg: string, filename: string) {
  const { dataUrl } = await svgToPngDataUrl(svg, 2);
  triggerDownload(dataUrl, filename);
}
