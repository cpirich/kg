import * as pdfjsLib from "pdfjs-dist";
import type { TextItem } from "pdfjs-dist/types/src/display/api";

/** Get the base path for static assets (respects Next.js basePath). */
function getBasePath(): string {
  if (typeof window !== "undefined" && "__NEXT_DATA__" in window) {
    const win = window as unknown as { __NEXT_DATA__?: { basePath?: string } };
    const nextData = win.__NEXT_DATA__;
    return nextData?.basePath ?? "";
  }
  return "";
}

let workerInitialized = false;

function initWorker(): void {
  if (workerInitialized) return;
  const basePath = getBasePath();
  pdfjsLib.GlobalWorkerOptions.workerSrc = `${basePath}/pdf.worker.min.mjs`;
  workerInitialized = true;
}

/**
 * Extract all text content from a PDF file.
 * Uses pdfjs-dist with a web worker for parsing.
 */
export async function extractTextFromPdf(file: File): Promise<string> {
  initWorker();

  const arrayBuffer = await file.arrayBuffer();
  const pdf = await pdfjsLib.getDocument({ data: arrayBuffer }).promise;

  const pages: string[] = [];

  for (let i = 1; i <= pdf.numPages; i++) {
    const page = await pdf.getPage(i);
    const textContent = await page.getTextContent();
    const pageText = textContent.items
      .filter((item): item is TextItem => "str" in item)
      .map((item) => item.str)
      .join(" ");
    pages.push(pageText);
  }

  return pages.join("\n\n");
}
