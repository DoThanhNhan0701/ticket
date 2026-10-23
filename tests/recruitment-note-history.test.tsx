// @vitest-environment jsdom
import { toast } from "sonner";
import {
  cleanup,
  fireEvent,
  render,
  screen,
  waitFor,
} from "@testing-library/react";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { afterEach, beforeEach, expect, it, vi } from "vitest";
import { Dialog, DialogContent, DialogTitle } from "@/components/ui/dialog";
import { RecruitmentNoteHistory } from "@/features/recruitment/components/recruitment-note-history";
import {
  recruitmentArray,
  downloadRecruitmentNote,
} from "@/features/recruitment/api/recruitment-api";
import { downloadFile } from "@/lib/download";

vi.mock("@/features/auth/hooks/use-auth-context", () => ({
  useAuthContext: () => ({ userId: 42 }),
}));
vi.mock("@/features/recruitment/api/recruitment-api", () => ({
  recruitmentArray: vi.fn(),
  downloadRecruitmentNote: vi.fn(),
}));
vi.mock("@/lib/download", () => ({ downloadFile: vi.fn() }));

const createUrl = vi.fn(() => "blob:note-preview");
const revokeUrl = vi.fn();
let client: QueryClient;
beforeEach(() => {
  vi.resetAllMocks();
  createUrl.mockReturnValue("blob:note-preview");
  vi.stubGlobal(
    "URL",
    class extends URL {
      static createObjectURL = createUrl;
      static revokeObjectURL = revokeUrl;
    },
  );
  client = new QueryClient({ defaultOptions: { queries: { retry: false } } });
  vi.mocked(recruitmentArray).mockResolvedValue([
    {
      id: 1,
      content: "TEST feedback",
      fore_user__username: "admin",
      data_file: [
        { id: 10, file_name: "interview.PNG" },
        { id: 11, file_name: "interview.pdf" },
      ],
    },
  ]);
});
afterEach(() => {
  cleanup();
  client.clear();
  vi.unstubAllGlobals();
});

function mount() {
  render(
    <QueryClientProvider client={client}>
      <Dialog open>
        <DialogContent>
          <DialogTitle>Hồ sơ ứng viên</DialogTitle>
          <RecruitmentNoteHistory candidateId={408} />
        </DialogContent>
      </Dialog>
    </QueryClientProvider>,
  );
}

it("opens a protected history image in a nested preview and releases its URL without closing the profile", async () => {
  vi.mocked(downloadRecruitmentNote).mockResolvedValue(
    new Blob(["image"], { type: "image/png" }),
  );
  mount();
  fireEvent.click(
    await screen.findByRole("button", { name: "Xem ảnh interview.PNG" }),
  );
  const image = await screen.findByRole("img", { name: "interview.PNG" });
  expect(image.getAttribute("src")).toBe("blob:note-preview");
  expect(downloadRecruitmentNote).toHaveBeenCalledExactlyOnceWith(10);
  expect(downloadFile).not.toHaveBeenCalled();
  fireEvent.error(image);
  await screen.findByText("Không thể xem trước ảnh này.");
  fireEvent.click(screen.getByRole("button", { name: "Đóng xem trước ảnh" }));
  await waitFor(() =>
    expect(screen.queryByRole("dialog", { name: "interview.PNG" })).toBeNull(),
  );
  expect(screen.getByRole("dialog", { name: "Hồ sơ ứng viên" })).toBeTruthy();
  expect(revokeUrl).toHaveBeenCalledExactlyOnceWith("blob:note-preview");
});

it("opens protected documents in a preview modal with a download link", async () => {
  const blob = new Blob(["pdf"], { type: "application/pdf" });
  vi.mocked(downloadRecruitmentNote).mockResolvedValue(blob);
  mount();
  fireEvent.click(
    await screen.findByRole("button", { name: "Mở tệp interview.pdf" }),
  );
  await screen.findByRole("dialog", { name: "interview.pdf" });
  expect(
    screen
      .getByRole("dialog", { name: "interview.pdf" })
      .querySelector("iframe")
      ?.getAttribute("src"),
  ).toBe("blob:note-preview");
  expect(
    screen.getByRole("link", { name: "Tải xuống" }).getAttribute("download"),
  ).toBe("interview.pdf");
  expect(downloadRecruitmentNote).toHaveBeenCalledExactlyOnceWith(11);
  expect(createUrl).toHaveBeenCalledTimes(1);
  expect(downloadFile).not.toHaveBeenCalled();
});

it("shows fetch errors and allows retrying the same image", async () => {
  vi.mocked(downloadRecruitmentNote)
    .mockRejectedValueOnce(new Error("TEST file unavailable"))
    .mockResolvedValue(new Blob(["image"], { type: "image/png" }));
  mount();
  fireEvent.click(
    await screen.findByRole("button", { name: "Xem ảnh interview.PNG" }),
  );
  await waitFor(() =>
    expect(toast.error).toHaveBeenCalledWith(
      "TEST file unavailable",
      expect.objectContaining({ id: expect.any(String) }),
    ),
  );
  expect(createUrl).not.toHaveBeenCalled();
  fireEvent.click(
    screen.getByRole("button", { name: "Xem ảnh interview.PNG" }),
  );
  await screen.findByRole("img", { name: "interview.PNG" });
  expect(downloadRecruitmentNote).toHaveBeenCalledTimes(2);
  expect(downloadFile).not.toHaveBeenCalled();
});

vi.mock("sonner", () => ({ toast: { success: vi.fn(), error: vi.fn() } }));
