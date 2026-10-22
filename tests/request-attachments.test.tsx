// @vitest-environment jsdom
import { useState } from "react";
import {
  cleanup,
  fireEvent,
  render,
  screen,
  waitFor,
  within,
} from "@testing-library/react";
import { afterEach, beforeEach, expect, it, vi } from "vitest";
import { RequestAttachments } from "@/features/requests/components/request-attachments";
import { TicketFiles } from "@/features/requests/components/ticket-files";
import { FilePreviewDialog } from "@/components/file-preview-dialog";
import { toast } from "sonner";

vi.mock("sonner", () => ({ toast: { success: vi.fn(), error: vi.fn() } }));

const createUrl = vi.fn<(file: Blob) => string>();
const revokeUrl = vi.fn<(url: string) => void>();
const writeText = vi.fn<(text: string) => Promise<void>>();
beforeEach(() => {
  writeText.mockReset().mockResolvedValue(undefined);
  Object.defineProperty(navigator, "clipboard", {
    configurable: true,
    value: { writeText },
  });
  createUrl
    .mockReset()
    .mockImplementation(() => `blob:preview-${createUrl.mock.calls.length}`);
  revokeUrl.mockReset();
  vi.stubGlobal(
    "URL",
    class extends URL {
      static createObjectURL = createUrl;
      static revokeObjectURL = revokeUrl;
    },
  );
  vi.stubGlobal("PointerEvent", MouseEvent);
  vi.stubGlobal(
    "ResizeObserver",
    vi.fn(function () {
      return { observe: vi.fn(), unobserve: vi.fn(), disconnect: vi.fn() };
    }),
  );
});
afterEach(() => {
  cleanup();
  Reflect.deleteProperty(navigator, "clipboard");
});

it("copies the saved file URL without opening its preview", async () => {
  render(
    <TicketFiles files={{ "photo.png": "/media/photo.png" }} layout="tiles" />,
  );
  fireEvent.click(
    screen.getByRole("button", { name: "Sao chép liên kết photo.png" }),
  );
  await waitFor(() =>
    expect(writeText).toHaveBeenCalledExactlyOnceWith(
      new URL("/media/photo.png", window.location.origin).href,
    ),
  );
  expect(screen.queryByRole("dialog")).toBeNull();
  expect(toast.success).toHaveBeenCalledWith("Đã sao chép liên kết tệp.");
});

it("reports clipboard failures without claiming the link was copied", async () => {
  writeText.mockRejectedValueOnce(new Error("Clipboard denied"));
  render(
    <TicketFiles
      files={{ "report.pdf": "/media/report.pdf" }}
      layout="tiles"
    />,
  );
  fireEvent.click(
    screen.getByRole("button", { name: "Sao chép liên kết report.pdf" }),
  );
  await waitFor(() =>
    expect(toast.error).toHaveBeenCalledWith(
      "Không thể sao chép liên kết. Vui lòng thử lại.",
    ),
  );
  expect(toast.success).not.toHaveBeenCalled();
});

it("does not offer a link for files that have not been uploaded", () => {
  render(
    <RequestAttachments
      compact
      files={[new File(["draft"], "draft.txt")]}
      onChange={vi.fn()}
      disabled={false}
    />,
  );
  expect(
    screen.queryByRole("button", { name: /Sao chép liên kết/ }),
  ).toBeNull();
});

it.each(["list", "tiles"] as const)(
  "uses a download callback for protected note files in %s layout and blocks it while downloading",
  (layout) => {
    const onDownload = vi.fn();
    const files = { "interview-note.pdf": "" };
    const { rerender } = render(
      <TicketFiles files={files} layout={layout} onDownload={onDownload} />,
    );
    fireEvent.click(
      screen.getByRole("button", { name: "Tải tệp interview-note.pdf" }),
    );
    expect(onDownload).toHaveBeenCalledExactlyOnceWith("interview-note.pdf");
    rerender(
      <TicketFiles
        files={files}
        layout={layout}
        onDownload={onDownload}
        disabled
      />,
    );
    fireEvent.click(
      screen.getByRole("button", { name: "Tải tệp interview-note.pdf" }),
    );
    expect(onDownload).toHaveBeenCalledTimes(1);
  },
);

function AttachmentsForm({ onSubmit }: Readonly<{ onSubmit: () => void }>) {
  const [files, setFiles] = useState<File[]>([]);
  return (
    <form
      onSubmit={(event) => {
        event.preventDefault();
        onSubmit();
      }}
    >
      <RequestAttachments files={files} onChange={setFiles} disabled={false} />
    </form>
  );
}
const chooseFiles = (files: File[]) =>
  fireEvent.change(screen.getByLabelText("Tệp đính kèm"), {
    target: { files },
  });

it("loads remote PDFs without credentials and forces PDF MIME before opening the native viewer", async () => {
  const fetchFile = vi.spyOn(globalThis, "fetch").mockResolvedValue({
    ok: true,
    blob: async () =>
      new Blob(["<html>mislabelled</html>"], { type: "text/html" }),
  } as Response);
  try {
    const { unmount } = render(
      <FilePreviewDialog
        name="CV.pdf"
        url="https://files.example.test/CV.pdf"
        onClose={vi.fn()}
      />,
    );
    await waitFor(() => expect(createUrl).toHaveBeenCalledTimes(1));
    expect(fetchFile).toHaveBeenCalledWith(
      "https://files.example.test/CV.pdf",
      { credentials: "omit", signal: expect.any(AbortSignal) },
    );
    expect(createUrl.mock.calls[0][0].type).toBe("application/pdf");
    const iframe = screen.getByRole("dialog").querySelector("iframe");
    expect(iframe?.getAttribute("src")).toBe("blob:preview-1");
    expect(iframe?.hasAttribute("sandbox")).toBe(false);
    unmount();
    expect(revokeUrl).toHaveBeenCalledWith("blob:preview-1");
  } finally {
    fetchFile.mockRestore();
  }
});

it("keeps a download link when a remote PDF cannot be fetched", async () => {
  const fetchFile = vi
    .spyOn(globalThis, "fetch")
    .mockRejectedValue(new Error("offline"));
  try {
    render(
      <FilePreviewDialog
        name="CV.pdf"
        url="https://files.example.test/CV.pdf"
        onClose={vi.fn()}
      />,
    );
    expect(await screen.findByText(/Không thể xem trước tệp này/)).toBeTruthy();
    expect(
      screen.getByRole("link", { name: "Tải xuống" }).getAttribute("href"),
    ).toBe("https://files.example.test/CV.pdf");
    expect(screen.getByRole("dialog").querySelector("iframe")).toBeNull();
  } finally {
    fetchFile.mockRestore();
  }
});

it.each([
  ["CV.PNG", "image/png", "image"],
  ["CV.pdf", "application/pdf", "pdf"],
  ["Interview.mp4", "video/mp4", "video"],
  ["Interview.mp3", "audio/mpeg", "audio"],
  ["Notes.txt", "text/plain", "text"],
  [
    "Đánh giá #1.docx",
    "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
    "other",
  ],
  [
    "Results.xlsx",
    "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
    "other",
  ],
  [
    "Slides.pptx",
    "application/vnd.openxmlformats-officedocument.presentationml.presentation",
    "other",
  ],
  ["Archive.zip", "application/zip", "other"],
  ["README", "", "other"],
  ["Page.html", "text/html", "other"],
])(
  "opens selected %s in a modal without filtering its format or submitting the form",
  async (name, type, kind) => {
    const file = new File(["TEST content"], name, { type });
    const submit = vi.fn();
    render(
      <form onSubmit={submit}>
        <RequestAttachments
          files={[file]}
          onChange={vi.fn()}
          disabled={false}
          layout="tiles"
          previewAllFiles
        />
      </form>,
    );
    expect(
      screen.getByLabelText("Tệp đính kèm").getAttribute("accept"),
    ).toBeNull();
    fireEvent.click(
      screen.getByRole("button", {
        name: `${kind === "image" ? "Xem ảnh" : "Mở tệp"} ${name}`,
      }),
    );
    const dialog = await screen.findByRole("dialog", { name });
    const link = within(dialog).getByRole("link", { name: "Tải xuống" });
    expect(link.getAttribute("download")).toBe(name);
    if (kind === "pdf" || kind === "text")
      expect(dialog.querySelector("iframe")?.getAttribute("title")).toBe(name);
    if (kind === "other") {
      expect(within(dialog).getByText(/Trình duyệt chưa hỗ trợ/)).toBeTruthy();
      expect(dialog.querySelector("iframe")).toBeNull();
    }
    if (kind === "video" || kind === "audio")
      expect(dialog.querySelector(kind)?.hasAttribute("controls")).toBe(true);
    expect(submit).not.toHaveBeenCalled();
    fireEvent.click(
      within(dialog).getByRole("button", {
        name: kind === "image" ? "Đóng xem trước ảnh" : "Đóng xem tệp",
      }),
    );
    await waitFor(() => expect(screen.queryByRole("dialog")).toBeNull());
    expect(revokeUrl).toHaveBeenCalled();
  },
);

it("opens a selected image in a dialog without submitting and keeps non-image files as plain list items", async () => {
  const submit = vi.fn();
  render(<AttachmentsForm onSubmit={submit} />);
  const image = new File(["image"], "screenshot.png", { type: "image/png" });
  chooseFiles([
    image,
    new File(["pdf"], "document.pdf", { type: "application/pdf" }),
  ]);
  expect(createUrl).not.toHaveBeenCalled();
  expect(screen.getByText("document.pdf").tagName).toBe("SPAN");
  expect(
    screen.queryByRole("button", { name: "Xem ảnh document.pdf" }),
  ).toBeNull();
  fireEvent.click(
    screen.getByRole("button", { name: "Xem ảnh screenshot.png" }),
  );
  expect(
    await screen.findByRole("dialog", { name: "screenshot.png" }),
  ).toBeTruthy();
  expect(
    screen.getByRole("img", { name: "screenshot.png" }).getAttribute("src"),
  ).toBe("blob:preview-1");
  expect(createUrl).toHaveBeenCalledWith(image);
  expect(submit).not.toHaveBeenCalled();
  fireEvent.click(screen.getByRole("button", { name: "Đóng xem trước ảnh" }));
  await waitFor(() => expect(screen.queryByRole("dialog")).toBeNull());
  expect(revokeUrl).toHaveBeenCalledExactlyOnceWith("blob:preview-1");
  expect(
    screen.getByRole("button", { name: "Xem ảnh screenshot.png" }),
  ).toBeTruthy();
});

it.each([
  ["photo.dat", "image/jpeg"],
  ["PHOTO.PNG", ""],
])("recognizes image %s with MIME type %s", async (name, type) => {
  render(<AttachmentsForm onSubmit={vi.fn()} />);
  chooseFiles([new File(["image"], name, { type })]);
  fireEvent.click(screen.getByRole("button", { name: `Xem ảnh ${name}` }));
  expect(await screen.findByRole("img", { name })).toBeTruthy();
});

it("does not treat a file with an explicit non-image MIME type as an image", () => {
  render(<AttachmentsForm onSubmit={vi.fn()} />);
  chooseFiles([new File(["pdf"], "document.png", { type: "application/pdf" })]);
  expect(
    screen.queryByRole("button", { name: "Xem ảnh document.png" }),
  ).toBeNull();
  expect(screen.getByText("document.png").tagName).toBe("SPAN");
  expect(createUrl).not.toHaveBeenCalled();
});

it("shows a fallback for an unreadable image and releases each preview URL on close", async () => {
  render(<AttachmentsForm onSubmit={vi.fn()} />);
  chooseFiles([new File(["invalid"], "broken.png", { type: "image/png" })]);
  fireEvent.click(screen.getByRole("button", { name: "Xem ảnh broken.png" }));
  fireEvent.error(await screen.findByRole("img", { name: "broken.png" }));
  expect(screen.getByRole("status").textContent).toBe(
    "Không thể xem trước ảnh này.",
  );
  fireEvent.click(screen.getByRole("button", { name: "Đóng xem trước ảnh" }));
  await waitFor(() => expect(screen.queryByRole("dialog")).toBeNull());
  fireEvent.click(screen.getByRole("button", { name: "Xem ảnh broken.png" }));
  expect(await screen.findByRole("img", { name: "broken.png" })).toBeTruthy();
  expect(screen.queryByRole("status")).toBeNull();
  fireEvent.keyDown(screen.getByRole("dialog"), {
    key: "Escape",
    code: "Escape",
  });
  await waitFor(() => expect(screen.queryByRole("dialog")).toBeNull());
  expect(revokeUrl.mock.calls).toEqual([
    ["blob:preview-1"],
    ["blob:preview-2"],
  ]);
});

it("closes a preview when the selected files are reset and cleans up when the form unmounts", async () => {
  const file = new File(["image"], "photo.png", { type: "image/png" });
  const props = { onChange: vi.fn(), disabled: false };
  const { rerender, unmount } = render(
    <RequestAttachments {...props} files={[file]} />,
  );
  fireEvent.click(screen.getByRole("button", { name: "Xem ảnh photo.png" }));
  await screen.findByRole("img", { name: "photo.png" });
  rerender(<RequestAttachments {...props} files={[]} />);
  expect(screen.queryByRole("dialog")).toBeNull();
  expect(revokeUrl).toHaveBeenCalledExactlyOnceWith("blob:preview-1");
  rerender(<RequestAttachments {...props} files={[file]} />);
  fireEvent.click(screen.getByRole("button", { name: "Xem ảnh photo.png" }));
  await screen.findByRole("img", { name: "photo.png" });
  unmount();
  expect(revokeUrl.mock.calls).toEqual([
    ["blob:preview-1"],
    ["blob:preview-2"],
  ]);
});

it("replaces a single attachment on selection or drop and ignores drops while disabled", () => {
  const previous = new File(["old"], "previous.pdf");
  const first = new File(["new"], "new.pdf");
  const second = new File(["extra"], "extra.pdf");
  const onChange = vi.fn();
  const props = {
    files: [previous],
    onChange,
    label: "Tệp CV",
    inputId: "recruitment-file_upload",
    multiple: false,
  };
  const { rerender } = render(
    <RequestAttachments {...props} disabled={false} />,
  );
  const input = screen.getByLabelText("Tệp CV") as HTMLInputElement;
  expect(input.multiple).toBe(false);
  fireEvent.change(input, { target: { files: [first, second] } });
  expect(onChange).toHaveBeenLastCalledWith([first]);
  fireEvent.drop(screen.getByRole("button", { name: "Chọn tệp cv" }), {
    dataTransfer: { files: [second, first] },
  });
  expect(onChange).toHaveBeenLastCalledWith([second]);
  fireEvent.click(screen.getByRole("button", { name: "Bỏ tệp previous.pdf" }));
  expect(onChange).toHaveBeenLastCalledWith([]);
  onChange.mockClear();
  rerender(<RequestAttachments {...props} disabled />);
  fireEvent.drop(screen.getByRole("button", { name: "Chọn tệp cv" }), {
    dataTransfer: { files: [first] },
  });
  expect(onChange).not.toHaveBeenCalled();
});
