// @vitest-environment jsdom
import {
  cleanup,
  fireEvent,
  render,
  screen,
  waitFor,
  within,
} from "@testing-library/react";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { afterEach, beforeEach, expect, it, vi } from "vitest";
import { TicketDiscussion } from "@/features/requests/components/ticket-discussion";
import { requestDetailSchema } from "@/features/requests/schemas/request-detail-schema";
import {
  addTicketComment,
  replyTicketComment,
  editTicketComment,
  searchMentionUsers,
} from "@/features/requests/api/ticket-discussion-api";
import { mentionAtCaret } from "@/features/requests/utils/comment-mentions";
import { setCookie } from "@/lib/cookies";
import { clearAuthSession } from "@/lib/auth-session";
import { COOKIE_TOKEN_KEY } from "@/constants/auth";
import { requestDetailFixture } from "./fixtures/request-detail";

vi.mock("sonner", () => ({ toast: { success: vi.fn(), error: vi.fn() } }));
let currentUsername: string;
vi.mock("@/features/auth/hooks/use-auth-context", () => ({
  useAuthContext: () => ({ username: currentUsername }),
}));
let client: QueryClient;
const fetchMock = vi.fn<typeof fetch>();
const onSaved = vi.fn<() => Promise<unknown>>();
let saveFailure: boolean;
let pending: Promise<Response> | undefined;
const json = (data: unknown, status = 200) =>
  new Response(JSON.stringify(data), {
    status,
    headers: { "Content-Type": "application/json" },
  });
const users = [
  {
    id: 1,
    username: "nhan",
    email: "nhan@example.com",
    is_active: true,
    password: "private-field",
  },
  { id: 2, username: "locked", email: "", is_active: false },
];
beforeEach(() => {
  clearAuthSession();
  setCookie(COOKIE_TOKEN_KEY, "discussion-session");
  client = new QueryClient({ defaultOptions: { queries: { retry: false } } });
  onSaved.mockResolvedValue(undefined);
  saveFailure = false;
  pending = undefined;
  vi.stubGlobal(
    "ResizeObserver",
    vi.fn(function () {
      return { observe: vi.fn(), unobserve: vi.fn(), disconnect: vi.fn() };
    }),
  );
  vi.stubGlobal("requestAnimationFrame", (callback: FrameRequestCallback) => {
    callback(0);
    return 0;
  });
  vi.stubGlobal("fetch", fetchMock);
  fetchMock.mockImplementation(async (input, options) => {
    const url = new URL(String(input));
    if (url.pathname === "/api/list_user_v2/") return json(users);
    if (
      ["/api/ticket_comment", "/api/ticket_item_comment"].includes(
        url.pathname,
      ) &&
      ["POST", "PUT"].includes(options?.method ?? "")
    ) {
      if (pending) return pending;
      if (saveFailure)
        return json({ detail: "Không có quyền sửa phản hồi" }, 403);
      return json({ message: "success" });
    }
    throw new Error(`Unexpected request ${url.pathname}`);
  });
});
afterEach(() => {
  cleanup();
  client.clear();
  clearAuthSession();
});
function open(username = "handler") {
  currentUsername = username;
  const ticket = requestDetailSchema.parse(requestDetailFixture);
  ticket.comments[0].content = "Đã nhận @nhan <script>alert(1)</script>";
  ticket.comments[0].att_file = {
    "old.pdf": "/media/old.pdf",
    "keep.txt": "/media/keep.txt",
  };
  ticket.comments[0].item_comment[0].att_file = {
    "reply.pdf": "/media/reply.pdf",
  };
  render(
    <QueryClientProvider client={client}>
      <TicketDiscussion ticket={ticket} onSaved={onSaved} />
    </QueryClientProvider>,
  );
}
const writes = () =>
  fetchMock.mock.calls.filter(([, options]) =>
    ["POST", "PUT"].includes(options?.method ?? ""),
  );
const rootForm = () => screen.getByRole("form", { name: "Phản hồi mới" });
it("sends with Enter and prevents duplicate keyboard submissions", async () => {
  open();
  const input = within(rootForm()).getByLabelText("Phản hồi");
  fireEvent.change(input, { target: { value: "Gửi bằng Enter" } });
  fireEvent.keyDown(input, { key: "Enter" });
  fireEvent.keyDown(input, { key: "Enter" });
  await waitFor(() => expect(onSaved).toHaveBeenCalledOnce());
  expect(writes()).toHaveLength(1);
  expect((writes()[0][1]!.body as FormData).get("ticket_comment")).toBe(
    "Gửi bằng Enter",
  );
});

it.each([{ shiftKey: true }, { isComposing: true }, { keyCode: 229 }])(
  "does not submit a newline or an unfinished IME composition: %j",
  (keys) => {
    open();
    const input = within(rootForm()).getByLabelText("Phản hồi");
    fireEvent.change(input, { target: { value: "Đang nhập phản hồi" } });
    expect(fireEvent.keyDown(input, { key: "Enter", ...keys })).toBe(true);
    expect(writes()).toHaveLength(0);
  },
);

it("validates empty comments when Enter is pressed", async () => {
  open();
  fireEvent.keyDown(within(rootForm()).getByLabelText("Phản hồi"), {
    key: "Enter",
  });
  expect(await screen.findByText("Vui lòng nhập phản hồi.")).toBeTruthy();
  expect(writes()).toHaveLength(0);
});

const files = () => [
  new File(["first"], "first.txt", { type: "text/plain" }),
  new File(["second"], "second.pdf", { type: "application/pdf" }),
];
function attach(form: HTMLElement, selected: File[]) {
  fireEvent.change(within(form).getByLabelText("Tệp đính kèm"), {
    target: { files: selected },
  });
}

it("renders threaded messages, timestamps and safe highlighted mentions", () => {
  open();
  expect(screen.getByText("@nhan")).toBeTruthy();
  expect(screen.getByText(/<script>alert\(1\)<\/script>/)).toBeTruthy();
  expect(document.querySelector("script")).toBeNull();
  expect(screen.getByText("Cảm ơn")).toBeTruthy();
  expect(screen.getAllByRole("button", { name: "Trả lời" })).toHaveLength(1);
  expect(screen.getByText(/20\/10\/2026/)).toBeTruthy();
});
it("sends multiple attachments as one multipart comment and clears successful drafts", async () => {
  open();
  const form = rootForm();
  fireEvent.change(within(form).getByLabelText("Phản hồi"), {
    target: { value: "  Nội dung mới @nhan  " },
  });
  attach(form, files());
  fireEvent.click(within(form).getByRole("button", { name: "Gửi phản hồi" }));
  await waitFor(() => expect(onSaved).toHaveBeenCalledTimes(1));
  expect(writes()).toHaveLength(1);
  const body = writes()[0][1]!.body as FormData;
  expect(body.get("ticket_id")).toBe("42");
  expect(body.get("ticket_comment")).toBe("Nội dung mới @nhan");
  expect(body.getAll("att_file").map((file) => (file as File).name)).toEqual([
    "first.txt",
    "second.pdf",
  ]);
  expect(
    (within(form).getByLabelText("Phản hồi") as HTMLTextAreaElement).value,
  ).toBe("");
  expect(within(form).queryByText("first.txt")).toBeNull();
});
it("posts replies to the parent comment using the legacy reply endpoint", async () => {
  open();
  fireEvent.click(screen.getByRole("button", { name: "Trả lời" }));
  const form = screen.getByRole("form", { name: "Trả lời handler mới" });
  fireEvent.change(within(form).getByLabelText("Trả lời handler"), {
    target: { value: "Phản hồi cấp 2" },
  });
  attach(form, files());
  fireEvent.click(within(form).getByRole("button", { name: "Gửi phản hồi" }));
  await waitFor(() => expect(onSaved).toHaveBeenCalledTimes(1));
  expect(String(writes()[0][0])).toContain("/ticket_item_comment");
  const body = writes()[0][1]!.body as FormData;
  expect(body.get("comment_id")).toBe("1");
  expect(body.get("comment_content")).toBe("Phản hồi cấp 2");
  expect(body.get("ticket_id")).toBeNull();
  await waitFor(() =>
    expect(
      screen.queryByRole("form", { name: "Trả lời handler mới" }),
    ).toBeNull(),
  );
});
it.each([
  ["handler", "/api/ticket_comment", "1", "old.pdf"],
  ["ticket-user", "/api/ticket_item_comment", "2", "reply.pdf"],
])(
  "edits %s's message with attachment removal and replacement",
  async (username, endpoint, id, oldName) => {
    open(username);
    fireEvent.click(
      screen.getByRole("button", {
        name: `Chỉnh sửa phản hồi của ${username}`,
      }),
    );
    const dialog = await screen.findByRole("dialog", {
      name: "Chỉnh sửa bình luận",
    });
    const form = within(dialog).getByRole("form");
    fireEvent.change(within(form).getByLabelText("Nội dung bình luận"), {
      target: { value: "Nội dung đã sửa" },
    });
    fireEvent.click(
      within(form).getByRole("button", { name: `Bỏ tệp cũ ${oldName}` }),
    );
    fireEvent.click(
      within(form).getByRole("button", { name: `Khôi phục tệp ${oldName}` }),
    );
    fireEvent.click(
      within(form).getByRole("button", { name: `Bỏ tệp cũ ${oldName}` }),
    );
    attach(form, files());
    fireEvent.click(within(form).getByRole("button", { name: "Lưu thay đổi" }));
    await waitFor(() => expect(onSaved).toHaveBeenCalledTimes(1));
    expect(new URL(String(writes()[0][0])).pathname).toBe(endpoint);
    expect(writes()[0][1]?.method).toBe("PUT");
    const body = writes()[0][1]!.body as FormData;
    expect(body.get("comment_id")).toBe(id);
    expect(body.get("content_comment")).toBe("Nội dung đã sửa");
    expect(body.getAll("deleted_old_files")).toEqual([oldName]);
    expect(body.getAll("att_file")).toHaveLength(2);
    await waitFor(() => expect(screen.queryByRole("dialog")).toBeNull());
  },
);
it("cancels edits without changing server data or leaking removed files into the next edit", async () => {
  open();
  fireEvent.click(
    screen.getByRole("button", { name: "Chỉnh sửa phản hồi của handler" }),
  );
  let dialog = await screen.findByRole("dialog");
  fireEvent.click(
    within(dialog).getByRole("button", { name: "Bỏ tệp cũ old.pdf" }),
  );
  attach(within(dialog).getByRole("form"), files());
  fireEvent.click(within(dialog).getByRole("button", { name: "Hủy" }));
  await waitFor(() => expect(screen.queryByRole("dialog")).toBeNull());
  fireEvent.click(
    screen.getByRole("button", { name: "Chỉnh sửa phản hồi của handler" }),
  );
  dialog = await screen.findByRole("dialog");
  expect(within(dialog).queryByText("first.txt")).toBeNull();
  expect(within(dialog).getByRole("link", { name: "old.pdf" })).toBeTruthy();
  expect(
    within(dialog).queryByRole("button", { name: "Khôi phục tệp old.pdf" }),
  ).toBeNull();
  expect(writes()).toHaveLength(0);
});
it("keeps failed drafts and attachments available to retry", async () => {
  open();
  saveFailure = true;
  const form = rootForm();
  fireEvent.change(within(form).getByLabelText("Phản hồi"), {
    target: { value: "Giữ bản nháp" },
  });
  attach(form, files());
  fireEvent.click(within(form).getByRole("button", { name: "Gửi phản hồi" }));
  expect(await screen.findByText("Không có quyền sửa phản hồi")).toBeTruthy();
  expect(
    (within(form).getByLabelText("Phản hồi") as HTMLTextAreaElement).value,
  ).toBe("Giữ bản nháp");
  expect(within(form).getByText("first.txt")).toBeTruthy();
  saveFailure = false;
  fireEvent.click(within(form).getByRole("button", { name: "Gửi phản hồi" }));
  await waitFor(() => expect(onSaved).toHaveBeenCalledTimes(1));
  expect(writes()).toHaveLength(2);
});
it("rejects blank submissions and oversized files before requests", async () => {
  open();
  const form = rootForm();
  fireEvent.click(within(form).getByRole("button", { name: "Gửi phản hồi" }));
  expect(screen.getByText("Vui lòng nhập phản hồi.")).toBeTruthy();
  expect(writes()).toHaveLength(0);
  const tooBig = new File(["large"], "large.txt");
  Object.defineProperty(tooBig, "size", { value: 50 * 1024 * 1024 + 1 });
  attach(form, [tooBig, files()[0]]);
  expect(await screen.findByText(/vượt quá 50 MB/)).toBeTruthy();
  expect(within(form).getByText("first.txt")).toBeTruthy();
  await expect(addTicketComment(42, " ")).rejects.toThrow(
    "Vui lòng nhập phản hồi.",
  );
  await expect(addTicketComment(42, "text", [tooBig])).rejects.toThrow(
    "vượt quá 50 MB",
  );
  expect(writes()).toHaveLength(0);
});
it("prevents duplicate submissions and closing an edit while saving", async () => {
  let resolve!: (value: Response) => void;
  pending = new Promise((done) => {
    resolve = done;
  });
  open();
  fireEvent.click(
    screen.getByRole("button", { name: "Chỉnh sửa phản hồi của handler" }),
  );
  const dialog = await screen.findByRole("dialog");
  const form = within(dialog).getByRole("form");
  fireEvent.submit(form);
  fireEvent.submit(form);
  await waitFor(() => expect(writes()).toHaveLength(1));
  expect(
    (within(dialog).getByRole("button", { name: "Hủy" }) as HTMLButtonElement)
      .disabled,
  ).toBe(true);
  fireEvent.keyDown(dialog, { key: "Escape" });
  expect(screen.getByRole("dialog")).toBeTruthy();
  resolve(json({ message: "success" }));
  await waitFor(() => expect(screen.queryByRole("dialog")).toBeNull());
});
it("debounces mention searches, filters inactive users and supports keyboard selection", async () => {
  open();
  const input = screen.getByLabelText("Phản hồi");
  fireEvent.focus(input);
  fireEvent.change(input, {
    target: { value: "Xin chào @n", selectionStart: 11 },
  });
  fireEvent.change(input, {
    target: { value: "Xin chào @nh", selectionStart: 12 },
  });
  expect(fetchMock).not.toHaveBeenCalled();
  expect(await screen.findByRole("option", { name: /@nhan/ })).toBeTruthy();
  expect(screen.queryByRole("option", { name: /locked/ })).toBeNull();
  const calls = fetchMock.mock.calls.filter(([url]) =>
    String(url).includes("list_user_v2"),
  );
  expect(calls).toHaveLength(1);
  expect(new URL(String(calls[0][0])).searchParams.get("search")).toBe("nh");
  expect(new URL(String(calls[0][0])).searchParams.get("type_api")).toBe(
    "tag_comment",
  );
  fireEvent.keyDown(input, { key: "Enter" });
  expect((input as HTMLTextAreaElement).value).toBe("Xin chào @nhan ");
  expect(screen.queryByRole("listbox")).toBeNull();
  expect(writes()).toHaveLength(0);
});
it("does not retain password fields from mention search results", async () => {
  const result = await searchMentionUsers("nh");
  expect(result).toHaveLength(1);
  expect(result[0]).not.toHaveProperty("password");
});
it("uses legacy empty multipart fields when no files are added or removed", async () => {
  await replyTicketComment(1, {
    content: "reply",
    files: [],
    removedFiles: [],
  });
  await editTicketComment(2, "reply", {
    content: "edit",
    files: [],
    removedFiles: [],
  });
  expect((writes()[0][1]!.body as FormData).get("att_file")).toBe("");
  expect((writes()[1][1]!.body as FormData).get("deleted_old_files")).toBe("");
});
it.each([
  ["mail@example.com", 16, null],
  ["Hello @nhan suffix", 9, { search: "nh", start: 6, end: 11 }],
  ["@nhân", 5, { search: "nhân", start: 0, end: 5 }],
])("detects a mention only at the caret in %s", (value, caret, expected) => {
  expect(mentionAtCaret(String(value), Number(caret))).toEqual(expected);
});

it.each(["handler", "ticket-user", "other-user", ""])(
  "only shows edit actions for the signed-in author (%s)",
  (username) => {
    open(username);
    for (const author of ["handler", "ticket-user"]) {
      const edit = screen.queryByRole("button", {
        name: `Chỉnh sửa phản hồi của ${author}`,
      });
      expect(Boolean(edit)).toBe(username === author);
    }
    expect(screen.getByRole("button", { name: "Trả lời" })).toBeTruthy();
  },
);
