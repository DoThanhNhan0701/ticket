// @vitest-environment jsdom
import { useState } from "react";
import {
  cleanup,
  fireEvent,
  render,
  screen,
  waitFor,
} from "@testing-library/react";
import { afterEach, beforeEach, expect, it, vi } from "vitest";
import { RequestAttachments } from "@/features/requests/components/request-attachments";

const createUrl = vi.fn<(file: Blob) => string>();
const revokeUrl = vi.fn<(url: string) => void>();
beforeEach(() => {
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
afterEach(cleanup);

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
