// @vitest-environment jsdom
import { readFileSync } from "node:fs";
import { afterEach, expect, it, vi } from "vitest";
import {
  convertGuideDocument,
  loadUserGuide,
  parseGuideHtml,
  USER_GUIDE_URL,
} from "@/features/help/api/user-guide-api";

const documentBuffer = () =>
  Uint8Array.from(
    readFileSync(new URL("../public" + USER_GUIDE_URL, import.meta.url)),
  ).buffer;
afterEach(() => vi.unstubAllGlobals());

it("reads all chapters, formatting, tables and metadata from the actual Word manual", async () => {
  const guide = await convertGuideDocument(documentBuffer());
  expect(guide.chapters).toHaveLength(15);
  expect(guide.chapters[0].title).toBe("1. Bắt đầu sử dụng");
  expect(guide.chapters[3].title).toBe("4. Tạo một yêu cầu mới");
  expect(guide.chapters[3].html).toContain("4.7. Gửi và kiểm tra kết quả");
  expect(guide.chapters[0].html).toContain("<table>");
  expect(guide.chapters[0].html).toContain("<strong>");
  expect(guide.chapters[0].html).toContain('class="guide-document-table"');
  expect(guide.introductionHtml).toContain("RAINSCALES");
  expect(guide.version).toBe("1.2");
  expect(guide.updatedAt).toBe("22/10/2026");
  expect(guide.chapters[0].anchors.length).toBeGreaterThan(0);
});

it("styles Word table headers separately from the first data row", async () => {
  const guide = await convertGuideDocument(documentBuffer());
  const style = document.createElement("style");
  style.textContent = readFileSync(
    "src/features/help/components/guide-document.css",
    "utf8",
  );
  const content = document.createElement("div");
  content.className = "guide-document";
  content.innerHTML = guide.chapters[0].html;
  document.head.append(style);
  document.body.append(content);
  try {
    const header = content.querySelector("thead > tr");
    const firstRow = content.querySelector("tbody > tr");
    if (!header || !firstRow) throw new Error("Missing Word table rows");
    expect(window.getComputedStyle(header).fontWeight).toBe("600");
    expect(window.getComputedStyle(firstRow).fontWeight).not.toBe("600");
  } finally {
    content.remove();
    style.remove();
  }
});

it("loads the same DOCX used by the download link and forwards cancellation", async () => {
  const fetcher = vi.fn().mockResolvedValue(new Response(documentBuffer()));
  vi.stubGlobal("fetch", fetcher);
  const signal = new AbortController().signal;
  expect((await loadUserGuide(signal)).chapters).toHaveLength(15);
  expect(fetcher).toHaveBeenCalledWith(USER_GUIDE_URL, {
    signal,
    cache: "no-cache",
  });
});

it("reports a failed download instead of parsing an error page", async () => {
  vi.stubGlobal(
    "fetch",
    vi.fn().mockResolvedValue(new Response("Not found", { status: 404 })),
  );
  await expect(loadUserGuide()).rejects.toThrow("Không tải được");
});

it("rejects corrupt Word data", async () => {
  await expect(convertGuideDocument(new ArrayBuffer(5))).rejects.toThrow();
});

it("removes scripts, event handlers and unsafe links while retaining rich text", () => {
  const guide = parseGuideHtml(
    '<h1>Guide</h1><p><strong>Safe</strong><script>alert(1)</script><img src="x" onerror="alert(1)"><a href="javascript:alert(1)">Link</a></p>',
  );
  expect(guide.chapters[0].html).toContain("<strong>Safe</strong>");
  expect(guide.chapters[0].html).not.toMatch(/script|onerror|javascript:/);
});

it("renders documents without chapter headings and rejects empty documents", () => {
  expect(parseGuideHtml("<p>Standalone guide</p>").chapters).toEqual([
    {
      title: "Hướng dẫn sử dụng",
      html: "<p>Standalone guide</p>",
      anchors: [],
    },
  ]);
  expect(() => parseGuideHtml("<p></p>")).toThrow("không có nội dung");
});
