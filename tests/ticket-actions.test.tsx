// @vitest-environment jsdom
import { toast } from "sonner";
import {
  act,
  cleanup,
  fireEvent,
  render,
  screen,
  waitFor,
  within,
} from "@testing-library/react";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { afterEach, beforeEach, expect, it, vi } from "vitest";
import { TicketActions } from "@/features/requests/components/ticket-actions";
import {
  requestDetailSchema,
  type RequestDetailData,
} from "@/features/requests/schemas/request-detail-schema";
import {
  availableTicketActions,
  assignmentModes,
  buildTicketActionPlan,
  ticketActionNames,
  type TicketActionValues,
  type TicketAction,
} from "@/features/requests/utils/ticket-actions";
import { executeTicketActionStep } from "@/features/requests/api/ticket-actions-api";
import { setCookie } from "@/lib/cookies";
import { clearAuthSession } from "@/lib/auth-session";
import { COOKIE_TOKEN_KEY } from "@/constants/auth";
import { requestDetailFixture } from "./fixtures/request-detail";

vi.mock("sonner", () => ({ toast: { success: vi.fn(), error: vi.fn() } }));
let client: QueryClient;
let ticket: RequestDetailData;
const fetchMock = vi.fn<typeof fetch>();
const onSaved = vi.fn<() => Promise<unknown>>();
const defaults: TicketActionValues = {
  reason: "",
  mode: "add",
  users: [],
  oldUser: "",
  newUser: "",
  replacements: [],
};
beforeEach(() => {
  clearAuthSession();
  setCookie(COOKIE_TOKEN_KEY, "action-session");
  client = new QueryClient({ defaultOptions: { queries: { retry: false } } });
  onSaved.mockResolvedValue(undefined);
  ticket = requestDetailSchema.parse({
    ...requestDetailFixture,
    list_button: Object.fromEntries(
      ticketActionNames.map((name) => [name, "#123456"]),
    ),
    list_user_received: [
      { user_id: 10, username: "handler", status: "Đang xử lý" },
      { user_id: 11, username: "handler2", status: "Đang xử lý" },
      { user_id: 12, username: "done-user", status: "Hoàn thành" },
    ],
    list_user_not_received: { "new-handler": 20, "new-handler2": 21 },
  });
  vi.stubGlobal(
    "ResizeObserver",
    vi.fn(function () {
      return { observe: vi.fn(), unobserve: vi.fn(), disconnect: vi.fn() };
    }),
  );
  vi.stubGlobal("PointerEvent", MouseEvent);
  vi.stubGlobal("fetch", fetchMock);
  fetchMock.mockResolvedValue(Response.json({ message: "OK" }));
});
afterEach(() => {
  cleanup();
  client.clear();
  clearAuthSession();
});
function open(action?: TicketAction) {
  render(
    <QueryClientProvider client={client}>
      <TicketActions ticket={ticket} onSaved={onSaved} />
    </QueryClientProvider>,
  );
  if (action) fireEvent.click(screen.getByRole("button", { name: action }));
}
function confirm(name: string) {
  fireEvent.click(
    within(screen.getByRole("dialog")).getByRole("button", {
      name,
    }),
  );
}
function body(index = 0) {
  return JSON.parse(String(fetchMock.mock.calls[index][1]?.body));
}
async function select(label: string, option: string) {
  fireEvent.click(screen.getByRole("combobox", { name: label }));
  const item = await screen.findByRole("option", { name: option });
  fireEvent.pointerDown(item, { pointerType: "mouse" });
  fireEvent.mouseUp(item);
  fireEvent.click(item);
  await waitFor(() => expect(screen.queryByRole("listbox")).toBeNull());
}
it("uses only API-provided allowed actions and ignores unknown buttons", () => {
  ticket.list_button = { "Tiếp nhận": "red", Hủy: "red", unknown: "red" };
  open();
  expect(
    screen.getAllByRole("button").map((button) => button.textContent),
  ).toEqual(["Tiếp nhận", "Hủy"]);
  expect(
    availableTicketActions(requestDetailSchema.parse(requestDetailFixture)),
  ).toEqual([]);
});
const specialHandlingCases = [
  { role: "manager before receipt", status: 2, actions: ["Tiếp nhận", "Hủy"] },
  { role: "member before receipt", status: 2, actions: [] },
  { role: "manager awaiting assignment", status: 8, actions: ["Phân công"] },
  { role: "member awaiting assignment", status: 8, actions: [] },
  { role: "unassigned manager", status: 3, actions: ["Phân công", "Hủy"] },
  { role: "unassigned member", status: 3, actions: [] },
  { role: "assigned member", status: 3, actions: ["Hoàn thành"] },
  { role: "creator after completion", status: 5, actions: ["Đóng"] },
  { role: "creator after closure", status: 7, actions: [] },
];
it.each(
  [5, 18, 20].flatMap((group) =>
    specialHandlingCases.map((scenario) => ({ ...scenario, group })),
  ),
)(
  "renders the BE action contract for department $group: $role",
  ({ group, status, actions }) => {
    ticket.handling_group = group;
    ticket.ticket_status = status;
    ticket.list_button = Object.fromEntries(
      actions.map((name) => [name, "#123456"]),
    );
    open();
    expect(
      screen.queryAllByRole("button").map((button) => button.textContent),
    ).toEqual(ticketActionNames.filter((name) => actions.includes(name)));
  },
);
it.each([5, 18, 20])(
  "assigns the first handler in received status 8 for department %s",
  async (group) => {
    ticket.handling_group = group;
    ticket.ticket_status = 8;
    ticket.list_button = { "Phân công": "#123456" };
    ticket.list_user_received = [];
    open("Phân công");
    fireEvent.click(screen.getByRole("combobox", { name: "Loại phân công" }));
    expect(
      screen
        .getByRole("option", { name: "Xóa người xử lý" })
        .getAttribute("aria-disabled"),
    ).toBe("true");
    expect(
      screen
        .getByRole("option", { name: "Thay đổi người xử lý" })
        .getAttribute("aria-disabled"),
    ).toBe("true");
    const addOption = screen.getByRole("option", { name: "Thêm người xử lý" });
    fireEvent.pointerDown(addOption, { pointerType: "mouse" });
    fireEvent.mouseUp(addOption);
    fireEvent.click(addOption);
    await waitFor(() => expect(screen.queryByRole("listbox")).toBeNull());
    fireEvent.click(screen.getByRole("button", { name: "Người nhận xử lý" }));
    fireEvent.click(screen.getByRole("button", { name: "new-handler" }));
    fireEvent.keyDown(document, { key: "Escape" });
    confirm("Phân công");
    await waitFor(() => expect(onSaved).toHaveBeenCalledOnce());
    expect(body()).toEqual({ ticket_id: 42, ls_user_assignment: [20] });
  },
);
it.each([
  ["Phê duyệt", "/accept_ticket/"],
  ["Tiếp nhận", "/receive_ticket/"],
  ["Đóng", "/close_ticket/"],
  ["Hoàn thành", "/done_ticket/"],
] as const)(
  "confirms %s using its original endpoint and refreshes detail",
  async (action, endpoint) => {
    open(action);
    expect(fetchMock).not.toHaveBeenCalled();
    confirm(action);
    await waitFor(() => expect(onSaved).toHaveBeenCalledOnce());
    expect(new URL(String(fetchMock.mock.calls[0][0])).pathname).toBe(
      `/api${endpoint}`,
    );
    expect(body()).toEqual({ ticket_id: 42 });
    await waitFor(() => expect(screen.queryByRole("dialog")).toBeNull());
  },
);
it.each(["Hủy", "Xử lý lại"] as const)(
  "requires a nonblank reason for %s",
  async (action) => {
    open(action);
    confirm(action);
    await waitFor(() =>
      expect(screen.getByRole("textbox").getAttribute("aria-invalid")).toBe(
        "true",
      ),
    );
    expect(fetchMock).not.toHaveBeenCalled();
    fireEvent.change(screen.getByRole("textbox"), {
      target: { value: "  Lý do hợp lệ  " },
    });
    confirm(action);
    await waitFor(() => expect(onSaved).toHaveBeenCalledOnce());
    expect(body()[action === "Hủy" ? "lydohuyyeucau" : "lydoxulylai"]).toBe(
      "Lý do hợp lệ",
    );
  },
);
it("requires the no-reprocess reason when finishing a reopened ticket", async () => {
  ticket.ticket_status = 6;
  open("Hoàn thành");
  confirm("Hoàn thành");
  await waitFor(() =>
    expect(
      screen
        .getByRole("textbox", { name: /Lý do không xử lý lại/ })
        .getAttribute("aria-invalid"),
    ).toBe("true"),
  );
  expect(fetchMock).not.toHaveBeenCalled();
  fireEvent.change(
    screen.getByRole("textbox", { name: /Lý do không xử lý lại/ }),
    {
      target: { value: "Không cần xử lý" },
    },
  );
  confirm("Hoàn thành");
  await waitFor(() => expect(onSaved).toHaveBeenCalledOnce());
  expect(body().lydokhongxulylai).toBe("Không cần xử lý");
});
it("forwards to an available handler instead of completing", async () => {
  open("Hoàn thành");
  confirm("Chuyển tiếp");
  await select("Người nhận chuyển tiếp", "new-handler");
  confirm("Chuyển tiếp");
  await waitFor(() => expect(onSaved).toHaveBeenCalledOnce());
  expect(new URL(String(fetchMock.mock.calls[0][0])).pathname).toBe(
    "/api/forward_ticket/",
  );
  expect(body()).toEqual({ ticket_id: 42, user_forward: 20 });
});
it("adds selected handlers and clears fields when assignment mode changes", async () => {
  open("Phân công");
  fireEvent.click(screen.getByRole("button", { name: "Người nhận xử lý" }));
  fireEvent.click(screen.getByRole("button", { name: "new-handler" }));
  fireEvent.keyDown(document, { key: "Escape" });
  confirm("Phân công");
  await waitFor(() => expect(onSaved).toHaveBeenCalledOnce());
  expect(body()).toEqual({ ticket_id: 42, ls_user_assignment: [20] });
});
it("changes handlers with the original user IDs and reason", async () => {
  open("Phân công");
  await select("Loại phân công", "Thay đổi người xử lý");
  await select("Người đang xử lý", "handler");
  await select("Người nhận xử lý mới", "new-handler");
  fireEvent.change(
    screen.getByRole("textbox", { name: /Lý do thay đổi người xử lý/ }),
    {
      target: { value: "Đổi ca" },
    },
  );
  confirm("Phân công");
  await waitFor(() => expect(onSaved).toHaveBeenCalledOnce());
  expect(body()).toEqual({
    ticket_id: 42,
    user_assignment_old: 10,
    user_assignment: 20,
    lydothaydoinguoixuly: "Đổi ca",
  });
});
it("blocks closing and duplicate submission while an action is pending", async () => {
  let finish!: (value: Response) => void;
  fetchMock.mockReturnValueOnce(
    new Promise<Response>((resolve) => {
      finish = resolve;
    }),
  );
  open("Tiếp nhận");
  confirm("Tiếp nhận");
  await waitFor(() => expect(fetchMock).toHaveBeenCalledOnce());
  fireEvent.submit(screen.getByRole("form"));
  fireEvent.keyDown(document, { key: "Escape" });
  expect(screen.getByRole("dialog")).toBeTruthy();
  expect(
    screen.getByRole("button", { name: "Thoát" }).hasAttribute("disabled"),
  ).toBe(true);
  expect(fetchMock).toHaveBeenCalledOnce();
  finish(Response.json({ message: "OK" }));
  await waitFor(() => expect(onSaved).toHaveBeenCalledOnce());
});
it("allows correcting a failed reason and retries the updated payload", async () => {
  fetchMock.mockResolvedValueOnce(Response.json({ error: "Không thể lưu" }));
  open("Xử lý lại");
  fireEvent.change(screen.getByRole("textbox"), {
    target: { value: "Lý do cũ" },
  });
  confirm("Xử lý lại");
  await waitFor(() =>
    expect(toast.error).toHaveBeenCalledWith(
      "Không thể lưu",
      expect.objectContaining({ id: expect.any(String) }),
    ),
  );
  fireEvent.change(screen.getByRole("textbox"), {
    target: { value: "Lý do mới" },
  });
  confirm("Xử lý lại");
  await waitFor(() => expect(onSaved).toHaveBeenCalledOnce());
  expect(body(1).lydoxulylai).toBe("Lý do mới");
});
it("resumes after an upload without re-uploading when cancel fails", async () => {
  fetchMock.mockImplementation(async (input) => {
    if (
      String(input).endsWith("/cancel_ticket/") &&
      fetchMock.mock.calls.length === 2
    )
      return Response.json({ error: "Thử lại sau" });
    return Response.json({ message: "OK" });
  });
  open("Hủy");
  fireEvent.change(screen.getByRole("textbox"), {
    target: { value: "Lý do hủy" },
  });
  fireEvent.change(screen.getByLabelText("Tệp đính kèm"), {
    target: { files: [new File(["proof"], "proof.txt")] },
  });
  confirm("Hủy");
  await waitFor(() =>
    expect(toast.error).toHaveBeenCalledWith(
      "Thử lại sau",
      expect.objectContaining({ id: expect.any(String) }),
    ),
  );
  expect(fetchMock).toHaveBeenCalledTimes(2);
  expect(screen.getByRole("textbox").hasAttribute("disabled")).toBe(true);
  confirm("Thử lại phần còn lại");
  await waitFor(() => expect(onSaved).toHaveBeenCalledOnce());
  expect(fetchMock).toHaveBeenCalledTimes(3);
  expect(String(fetchMock.mock.calls[2][0])).toContain("/cancel_ticket/");
  expect((fetchMock.mock.calls[0][1]!.body as FormData).get("ticket_id")).toBe(
    "42",
  );
});
it("closes without repeating a successful action when refreshing fails", async () => {
  onSaved.mockRejectedValueOnce(new Error("Offline"));
  open("Tiếp nhận");
  confirm("Tiếp nhận");
  await waitFor(() => expect(screen.queryByRole("dialog")).toBeNull());
  expect(fetchMock).toHaveBeenCalledOnce();
});
it.each(["Hủy", "Xử lý lại"] as const)(
  "rejects whitespace-only %s reason in the plan",
  (action) => {
    expect(() =>
      buildTicketActionPlan(ticket, action, { ...defaults, reason: "   " }),
    ).toThrow("lý do");
  },
);
it("does not permit actions missing from list_button", () => {
  ticket.list_button = {};
  expect(() => buildTicketActionPlan(ticket, "Tiếp nhận", defaults)).toThrow(
    "quyền",
  );
});
it("shows unavailable assignment modes disabled and prevents deleting the sole handler", async () => {
  ticket.list_user_received = ticket.list_user_received.slice(0, 1);
  open("Phân công");
  fireEvent.click(screen.getByRole("combobox", { name: "Loại phân công" }));
  expect(
    screen
      .getByRole("option", { name: "Thêm người xử lý" })
      .getAttribute("aria-disabled"),
  ).not.toBe("true");
  expect(
    screen
      .getByRole("option", { name: "Xóa người xử lý" })
      .getAttribute("aria-disabled"),
  ).toBe("true");
  expect(
    screen
      .getByRole("option", { name: "Thay đổi người xử lý" })
      .getAttribute("aria-disabled"),
  ).not.toBe("true");
  expect(fetchMock).not.toHaveBeenCalled();
});
it("allows adding only when there is no active handler, matching ticketV2 membership rules", () => {
  ticket.list_user_received = [];
  expect(
    assignmentModes(ticket).map(({ value, disabled }) => [value, disabled]),
  ).toEqual([
    ["add", false],
    ["delete", true],
    ["change", true],
  ]);
});
it("does not preselect a disabled operation when no assignment is possible", async () => {
  ticket.list_user_received = ticket.list_user_received.slice(0, 1);
  ticket.list_user_not_received = {};
  open("Phân công");
  expect(screen.getByText(/Hiện không có người phù hợp/)).toBeTruthy();
  expect(screen.queryByRole("button", { name: "Người nhận xử lý" })).toBeNull();
  confirm("Phân công");
  await screen.findByText(/Loại phân công is required/);
  expect(fetchMock).not.toHaveBeenCalled();
});
it("keeps deletion available without replacement candidates when other handlers have completed", () => {
  ticket.list_user_not_received = {};
  ticket.list_user_received = ticket.list_user_received.slice(1);
  expect(
    assignmentModes(ticket).map(({ value, disabled }) => [value, disabled]),
  ).toEqual([
    ["delete", false],
    ["change", true],
  ]);
});

it("validates assignment membership and preserves at least one handler", () => {
  expect(() =>
    buildTicketActionPlan(ticket, "Phân công", { ...defaults, users: ["999"] }),
  ).toThrow("hợp lệ");
  expect(() =>
    buildTicketActionPlan(ticket, "Phân công", {
      ...defaults,
      mode: "change",
      oldUser: "12",
      newUser: "20",
      reason: "đổi",
    }),
  ).toThrow("hợp lệ");
  ticket.list_user_received = ticket.list_user_received.slice(0, 1);
  expect(() =>
    buildTicketActionPlan(ticket, "Phân công", {
      ...defaults,
      mode: "delete",
      users: ["10"],
      reason: "xóa",
    }),
  ).toThrow("ít nhất một");
});
it.each([true, false])(
  "handles removal of all active handlers (replacement: %s)",
  (replace) => {
    const steps = buildTicketActionPlan(ticket, "Phân công", {
      ...defaults,
      mode: "delete",
      users: ["10", "11"],
      reason: "xóa",
      replacements: replace ? ["20"] : [],
    });
    expect(steps).toEqual([
      {
        endpoint: "/delete_assignment_ticket/",
        body: {
          ticket_id: 42,
          ls_user_delete: [10, 11],
          lydoxoanguoixuly: "xóa",
        },
      },
      replace
        ? {
            endpoint: "/assignment_ticket/",
            body: { ticket_id: 42, ls_user_assignment: [20] },
          }
        : {
            endpoint: "/done_ticket/",
            body: { ticket_id: 42, is_manage_done: true },
          },
    ]);
  },
);
it("only deletes selected processing handlers when others remain", () => {
  expect(
    buildTicketActionPlan(ticket, "Phân công", {
      ...defaults,
      mode: "delete",
      users: ["10"],
      reason: "xóa",
    }),
  ).toHaveLength(1);
});
it("rejects oversized cancellation attachments before posting anything", () => {
  const file = new File(["x"], "large.txt");
  Object.defineProperty(file, "size", { value: 50 * 1024 * 1024 + 1 });
  expect(() =>
    buildTicketActionPlan(ticket, "Hủy", { ...defaults, reason: "hủy" }, [
      file,
    ]),
  ).toThrow("50 MB");
  expect(fetchMock).not.toHaveBeenCalled();
});
it("surfaces HTTP permission errors without closing the form", async () => {
  fetchMock.mockResolvedValueOnce(
    Response.json({ detail: "Không có quyền" }, { status: 403 }),
  );
  open("Tiếp nhận");
  confirm("Tiếp nhận");
  await waitFor(() =>
    expect(toast.error).toHaveBeenCalledWith(
      "Không có quyền",
      expect.objectContaining({ id: expect.any(String) }),
    ),
  );
  expect(screen.getByRole("dialog")).toBeTruthy();
  expect(onSaved).not.toHaveBeenCalled();
});
it("rejects invalid and access-denied response bodies", async () => {
  fetchMock.mockResolvedValueOnce(Response.json(null));
  await expect(
    executeTicketActionStep({
      endpoint: "/accept_ticket/",
      body: { ticket_id: 42 },
    }),
  ).rejects.toThrow("không hợp lệ");
  fetchMock.mockResolvedValueOnce(
    Response.json({ message: "You do not have access" }),
  );
  await expect(
    executeTicketActionStep({
      endpoint: "/accept_ticket/",
      body: { ticket_id: 42 },
    }),
  ).rejects.toThrow("quyền");
});

it("deletes a selected processing handler through the assignment form", async () => {
  open("Phân công");
  await select("Loại phân công", "Xóa người xử lý");
  fireEvent.click(
    screen.getByRole("button", { name: "Người cần xóa khỏi yêu cầu" }),
  );
  fireEvent.click(
    screen.getByRole("button", { name: "handler", pressed: false }),
  );
  fireEvent.keyDown(document, { key: "Escape" });
  fireEvent.change(
    screen.getByRole("textbox", { name: /Lý do xóa người xử lý/ }),
    { target: { value: "Chuyển ca" } },
  );
  confirm("Phân công");
  await waitFor(() => expect(onSaved).toHaveBeenCalledOnce());
  expect(new URL(String(fetchMock.mock.calls[0][0])).pathname).toBe(
    "/api/delete_assignment_ticket/",
  );
  expect(body()).toEqual({
    ticket_id: 42,
    ls_user_delete: [10],
    lydoxoanguoixuly: "Chuyển ca",
  });
});
it("clears stale selections when switching assignment modes", async () => {
  open("Phân công");
  fireEvent.click(screen.getByRole("button", { name: "Người nhận xử lý" }));
  fireEvent.click(
    screen.getByRole("button", { name: "new-handler", pressed: false }),
  );
  fireEvent.keyDown(document, { key: "Escape" });
  await select("Loại phân công", "Xóa người xử lý");
  expect(
    screen.queryByRole("button", { name: "Bỏ chọn new-handler" }),
  ).toBeNull();
  confirm("Phân công");
  await waitFor(() =>
    expect(
      screen
        .getByRole("button", { name: "Người cần xóa khỏi yêu cầu" })
        .getAttribute("aria-describedby"),
    ).toBe("ticket-assignment-users-error"),
  );
  expect(fetchMock).not.toHaveBeenCalled();
});
it("cancels without submitting and discards the previous action's draft", async () => {
  open("Hủy");
  fireEvent.change(screen.getByRole("textbox"), {
    target: { value: "Bản nháp hủy" },
  });
  confirm("Thoát");
  await waitFor(() => expect(screen.queryByRole("dialog")).toBeNull());
  fireEvent.click(screen.getByRole("button", { name: "Xử lý lại" }));
  expect((screen.getByRole("textbox") as HTMLTextAreaElement).value).toBe("");
  expect(fetchMock).not.toHaveBeenCalled();
});

it("closes the saved dialog while refresh is pending and prevents actions on stale detail", async () => {
  let resolveRefresh!: () => void;
  onSaved.mockReturnValueOnce(
    new Promise<void>((resolve) => {
      resolveRefresh = resolve;
    }),
  );
  open("Tiếp nhận");
  confirm("Tiếp nhận");
  await waitFor(() => expect(screen.queryByRole("dialog")).toBeNull());
  expect(onSaved).toHaveBeenCalledOnce();
  const button = screen.getByRole("button", {
    name: "Tiếp nhận",
  }) as HTMLButtonElement;
  expect(button.disabled).toBe(true);
  fireEvent.click(button);
  expect(fetchMock).toHaveBeenCalledOnce();
  await act(async () => resolveRefresh());
  await waitFor(() => expect(button.disabled).toBe(false));
});
