import mammoth from "mammoth/mammoth.browser";
import DOMPurify from "dompurify";
import type { Locale } from "@/i18n";

export const USER_GUIDE_FILENAME =
  "Rainscales-Ticket-Huong-dan-su-dung-toan-bo-website.docx";
export const USER_GUIDE_URL = `/docs/${USER_GUIDE_FILENAME}`;
export const ENGLISH_GUIDE_URL = "/docs/Rainscales-Ticket-User-Guide.html";
export const ENGLISH_GUIDE_FILENAME = "Rainscales-Ticket-User-Guide.docx";

export interface GuideChapter {
  title: string;
  html: string;
  anchors: string[];
}

export interface GuideDocument {
  chapters: GuideChapter[];
  introductionHtml: string;
  version?: string;
  updatedAt?: string;
}

export function parseGuideHtml(html: string): GuideDocument {
  const body = DOMPurify.sanitize(html, {
    USE_PROFILES: { html: true },
    FORBID_ATTR: ["style"],
    RETURN_DOM: true,
  });
  if (!(body instanceof HTMLElement))
    throw new Error("Không đọc được nội dung tài liệu.");
  for (const table of body.querySelectorAll("table")) {
    const wrapper = body.ownerDocument.createElement("div");
    wrapper.className = "guide-document-table";
    table.replaceWith(wrapper);
    wrapper.append(table);
  }
  const text = body.textContent ?? "";
  const chapters: GuideChapter[] = [];
  let introductionHtml = "";
  for (const element of Array.from(body.children)) {
    if (element.tagName === "H1") {
      chapters.push({
        title: element.textContent?.trim() || "Hướng dẫn sử dụng",
        html: "",
        anchors: [],
      });
    }
    const chapter = chapters[chapters.length - 1];
    if (!chapter) {
      introductionHtml += element.outerHTML;
      continue;
    }
    for (const anchor of [element, ...element.querySelectorAll("[id]")]) {
      if (anchor.id) chapter.anchors.push(anchor.id);
    }
    if (element.tagName !== "H1") chapter.html += element.outerHTML;
  }
  if (!chapters.length && text.trim()) {
    chapters.push({
      title: "Hướng dẫn sử dụng",
      html: introductionHtml,
      anchors: [],
    });
    introductionHtml = "";
  }
  if (!chapters.length)
    throw new Error("Tài liệu hướng dẫn không có nội dung.");
  return {
    chapters,
    introductionHtml,
    version: text.match(/(?:Phiên bản|Version)\s+([\d.]+)/)?.[1],
    updatedAt: text.match(
      /(?:Cập nhật(?: ngày)?|Updated)\s+(\d{2}\/\d{2}\/\d{4})/,
    )?.[1],
  };
}

export async function convertGuideDocument(
  arrayBuffer: ArrayBuffer,
): Promise<GuideDocument> {
  const { value } = await mammoth.convertToHtml(
    { arrayBuffer },
    {
      includeEmbeddedStyleMap: false,
      externalFileAccess: false,
      idPrefix: "guide-",
    },
  );
  return parseGuideHtml(value);
}

export async function loadUserGuide(
  signal?: AbortSignal,
  locale: Locale = "vi",
): Promise<GuideDocument> {
  const response = await fetch(
    locale === "en" ? ENGLISH_GUIDE_URL : USER_GUIDE_URL,
    { signal, cache: "no-cache" },
  );
  if (!response.ok)
    throw new Error("Không tải được tài liệu hướng dẫn. Vui lòng thử lại.");
  if (locale === "en") {
    const html = await response.text();
    signal?.throwIfAborted();
    return parseGuideHtml(html);
  }
  const buffer = await response.arrayBuffer();
  signal?.throwIfAborted();
  const guide = await convertGuideDocument(buffer);
  signal?.throwIfAborted();
  return guide;
}
