import { ApiError } from "@/lib/api/api-error";
import { beforeEach, expect, it, vi } from "vitest";
import {
  getRequest,
  postRequest,
  putRequest,
  deleteRequest,
} from "@/lib/api/client";
import {
  listRecruitment,
  recruitmentWrite,
  recruitmentDetail,
  exportRecruitment,
  interviewDetail,
} from "@/features/recruitment/api/recruitment-api";
import { saveRecruitmentAction } from "@/features/recruitment/utils/recruitment-actions";
import type { RecruitmentEditorState } from "@/features/recruitment/types";
vi.mock("@/lib/api/client", () => ({
  getRequest: vi.fn(),
  postRequest: vi.fn(),
  putRequest: vi.fn(),
  deleteRequest: vi.fn(),
}));
beforeEach(() => {
  vi.resetAllMocks();
  vi.mocked(postRequest).mockResolvedValue({});
  vi.mocked(putRequest).mockResolvedValue({});
  vi.mocked(deleteRequest).mockResolvedValue(null);
});
it.each([
  {
    action: "request",
    id: 85,
    endpoint: "/detail_recruitment/85",
    method: "PUT",
    field: "file_upload",
  },
  {
    action: "create-candidate",
    id: 85,
    endpoint: "/detail_cv/85",
    method: "POST",
    field: "file_upload",
  },
  {
    action: "candidate",
    id: 408,
    endpoint: "/detail_cv/408",
    method: "PUT",
    field: "file_upload",
  },
  {
    action: "note",
    id: 408,
    endpoint: "/note-cv/",
    method: "POST",
    field: "file_note",
  },
] as const)(
  "preserves every uploaded file format for $action / $field",
  async ({ action, id, endpoint, method, field }) => {
    const formats = [
      ["Đánh giá ứng viên #1.PNG", "image/png"],
      ["CV.pdf", "application/pdf"],
      [
        "CV.docx",
        "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
      ],
      [
        "Dữ liệu.xlsx",
        "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
      ],
      [
        "Presentation.pptx",
        "application/vnd.openxmlformats-officedocument.presentationml.presentation",
      ],
      ["Notes.txt", "text/plain"],
      ["Backup.zip", "application/zip"],
      ["Archive.7z", ""],
      ["Interview.mp4", "video/mp4"],
      ["README", ""],
    ];
    for (const [name, type] of formats) {
      const file = new File([`TEST ${name}`], name, { type });
      await saveRecruitmentAction(
        { action, row: { id } } satisfies RecruitmentEditorState,
        { note: "TEST upload", quantity: "1" },
        { [field]: file },
      );
      const calls =
        method === "POST"
          ? vi.mocked(postRequest).mock.calls
          : vi.mocked(putRequest).mock.calls;
      const [url, options] = calls[calls.length - 1];
      expect(url).toBe(endpoint);
      const uploaded = (options!.body as FormData).get(field) as File;
      expect(uploaded).toBe(file);
      expect(uploaded.name).toBe(name);
      expect(uploaded.type).toBe(type);
      expect(uploaded.size).toBe(file.size);
    }
  },
);
it("keeps only applied nonempty filters and respects nullable calendar counts", async () => {
  vi.mocked(getRequest).mockResolvedValue({
    count: null,
    results: [{ id: 4, title: "TEST" }],
  });
  expect(
    await listRecruitment("interviews", {
      from_date: "2026-10-21",
      to_date: "2026-10-22",
      user_interview: "",
    }),
  ).toMatchObject({ count: 1 });
  expect(getRequest).toHaveBeenCalledWith(
    "/list-interview/",
    expect.objectContaining({
      params: { from_date: "2026-10-21", to_date: "2026-10-22" },
    }),
  );
});
it.each([
  { results: [] },
  { count: 1, results: "bad" },
  { count: -1, results: [] },
])("rejects malformed list data %j", async (data) => {
  vi.mocked(getRequest).mockResolvedValue(data);
  await expect(listRecruitment("requests", {})).rejects.toThrow(
    "Dữ liệu tuyển dụng",
  );
});
it("reads requirement detail and reason options", async () => {
  vi.mocked(getRequest).mockResolvedValue({
    results: { id: 85 },
    list_reason_recruitment: [{ id: 2, name: "Thay thế" }],
  });
  expect(await recruitmentDetail("requests", 85)).toEqual({
    row: { id: 85 },
    reasons: [{ value: "2", label: "Thay thế" }],
  });
});
it("encodes contextual interview identifiers", async () => {
  vi.mocked(getRequest).mockResolvedValue([]);
  await interviewDetail("INT /42");
  expect(getRequest).toHaveBeenCalledWith(
    "/regis-interview/INT%20%2F42",
    expect.anything(),
  );
});
it("creates a candidate under its recruitment request with files and ISO dates", async () => {
  const file = new File(["TEST"], "cv.txt");
  await saveRecruitmentAction(
    { action: "create-candidate", row: { id: 85, department_recruited: "31" } },
    { first_name: "TEST", birthday: "01/01/2000" },
    { file_upload: file },
  );
  const [url, options] = vi.mocked(postRequest).mock.calls[0];
  expect(url).toBe("/detail_cv/85");
  const body = options!.body as FormData;
  expect(JSON.parse(String(body.get("values")))).toMatchObject({
    department_recruited: "31",
    birthday: "2000-01-01",
  });
  expect(body.get("file_upload")).toBeInstanceOf(File);
});
it("does not overwrite readonly rich text or ticket data when saving a request", async () => {
  await saveRecruitmentAction(
    { action: "request", row: { id: 85 } },
    {
      quantity: "3",
      title: "readonly",
      job_description: "<p>original</p>",
      other_skill: "original skill",
      user_update_name: "test-admin",
      duedate: "01/11/2026",
      note: "TEST",
    },
    {},
  );
  const body = vi.mocked(putRequest).mock.calls[0][1]!.body as FormData;
  expect(JSON.parse(String(body.get("values")))).toEqual({
    quantity: "3",
    note: "TEST",
  });
});
it("cannot change CV status or transition reason through a profile update", async () => {
  await saveRecruitmentAction(
    { action: "candidate", row: { id: 408 } },
    {
      first_name: "TEST Updated",
      cv_status: "2",
      cv_status_id: "2",
      why_change: "TEST transition reason",
      why_change_statuscv: "TEST old reason",
      id_interview: "58",
      note: "TEST injected feedback",
    },
    { file_note: new File(["TEST"], "feedback.pdf") },
  );
  expect(putRequest).toHaveBeenCalledTimes(1);
  const [path, options] = vi.mocked(putRequest).mock.calls[0];
  expect(path).toBe("/detail_cv/408");
  const body = options!.body as FormData;
  expect(body.has("file_note")).toBe(false);
  expect(JSON.parse(String(body.get("values")))).toEqual({
    first_name: "TEST Updated",
  });
});
it("rejects empty interview notes but accepts attachment-only notes", async () => {
  await expect(
    saveRecruitmentAction(
      { action: "note", row: { id: 408 } },
      { note: "   " },
      {},
    ),
  ).rejects.toThrow("Vui lòng nhập ghi chú hoặc đính kèm tệp.");
  expect(postRequest).not.toHaveBeenCalled();
  const file = new File(["TEST"], "feedback.xlsx");
  await saveRecruitmentAction(
    { action: "note", row: { id: 408 } },
    { note: "" },
    { file_note: file },
  );
  const body = vi.mocked(postRequest).mock.calls[0][1]!.body as FormData;
  expect(body.get("file_note")).toBe(file);
  expect(body.get("id_cv")).toBe("408");
});
it("uses the V2 status change multipart contract", async () => {
  await saveRecruitmentAction(
    { action: "status", row: { id: 8, code_cv: "TEST-CV" } },
    { cv_status: "2", why_change: "TEST reason" },
    {},
  );
  expect(putRequest).toHaveBeenCalledWith(
    "/change_status_cv/8",
    expect.anything(),
  );
  const body = vi.mocked(putRequest).mock.calls[0][1]!.body as FormData;
  expect(Object.fromEntries(body)).toEqual({
    code_cv: "TEST-CV",
    cv_status: "2",
    why_change: "TEST reason",
  });
});
it("registers and edits interviews with numeric assignees", async () => {
  await saveRecruitmentAction(
    { action: "interview", row: {} },
    {
      title: "TEST Interview",
      start_date: "22/10/2026",
      time_start: "10:00",
      time_end: "11:00",
      user_interview: ["42"],
    },
    {},
  );
  const body = vi.mocked(postRequest).mock.calls[0][1]!.body as FormData;
  expect(JSON.parse(String(body.get("values")))).toMatchObject({
    start_date: "2026-10-22",
    user_interview: [42],
  });
  await saveRecruitmentAction(
    { action: "interview", row: { id: 4 } },
    { note: "TEST" },
    {},
  );
  expect(putRequest).toHaveBeenCalledWith(
    "/regis-interview/",
    expect.anything(),
  );
});
it("blocks out-of-range candidate times before sending an API write", async () => {
  const state: RecruitmentEditorState = {
    action: "candidate-time",
    row: { id: 408, id_interview: 58 },
    timeRange: { start: "04:00", end: "11:00" },
  };
  for (const time_start of ["03:59", "11:01", "25:00"])
    await expect(
      saveRecruitmentAction(state, { time_start }, {}),
    ).rejects.toThrow();
  expect(postRequest).not.toHaveBeenCalled();
  for (const time_start of ["04:00", "11:00", ""])
    await saveRecruitmentAction(state, { time_start }, {});
  expect(postRequest).toHaveBeenCalledTimes(3);
  expect(postRequest).toHaveBeenLastCalledWith("/detail-cv-interview/", {
    body: { id_cv: 408, id_interview: 58, time_start: null },
  });
});
it("removes candidates using DELETE query parameters without a request body", async () => {
  await saveRecruitmentAction(
    {
      action: "remove-interview-cv",
      row: { id: 8 },
      ids: [8, 9],
      code: "INT42",
    },
    {},
    {},
  );
  expect(deleteRequest).toHaveBeenCalledWith("/del-cv-interview/", {
    body: undefined,
    params: { ls_id_cv: "[8,9]", code_interview: "INT42" },
  });
});
it.each(["POST", "PUT", "DELETE"] as const)(
  "surfaces business errors for successful HTTP %s responses",
  async (method) => {
    for (const call of [postRequest, putRequest, deleteRequest])
      vi.mocked(call).mockResolvedValue({ error: "Không đủ quyền." });
    await expect(recruitmentWrite("/test", method)).rejects.toThrow(
      "Không đủ quyền.",
    );
  },
);
it.each([
  ["requests", "/export-recruitment/"],
  ["candidates", "/export-cv/"],
  ["reports", "/export_rect/"],
] as const)("exports %s with only applied filters", async (kind, path) => {
  const blob = new Blob(["TEST"]);
  vi.mocked(postRequest).mockResolvedValue(blob);
  expect(
    await exportRecruitment(kind, { from_date: "2026-10-01", search: "" }),
  ).toBe(blob);
  expect(postRequest).toHaveBeenCalledWith(
    path,
    expect.objectContaining({ responseType: "blob" }),
  );
  const body = vi.mocked(postRequest).mock.calls[0][1]!.body as FormData;
  expect(Object.fromEntries(body)).toEqual({ from_date: "2026-10-01" });
});
it("omits an empty interviewer list because the live API rejects an empty array", async () => {
  await saveRecruitmentAction(
    { action: "interview", row: {} },
    { title: "TEST", user_interview: [] },
    {},
  );
  const body = vi.mocked(postRequest).mock.calls[0][1]!.body as FormData;
  expect(JSON.parse(String(body.get("values")))).toEqual({ title: "TEST" });
});
it.each([{}, new Blob([])])(
  "rejects successful export responses without a usable file",
  async (response) => {
    vi.mocked(postRequest).mockResolvedValue(response);
    await expect(exportRecruitment("reports", {})).rejects.toThrow("Excel");
  },
);
it("never posts a read-only interview viewer form", async () => {
  await expect(
    saveRecruitmentAction(
      { action: "view-candidate", row: { id: 408 } },
      {},
      {},
    ),
  ).rejects.toThrow("Thao tác không hợp lệ");
  expect(postRequest).not.toHaveBeenCalled();
  expect(putRequest).not.toHaveBeenCalled();
});

it("recognizes the live API's empty interview response while preserving all other failures", async () => {
  vi.mocked(getRequest).mockRejectedValueOnce(
    new ApiError("Không tìm thấy ứng viên.", 400),
  );
  expect(await interviewDetail("TEST-empty")).toEqual([]);
  vi.mocked(getRequest).mockRejectedValueOnce(
    new ApiError("Không tìm thấy lịch phỏng vấn.", 400),
  );
  await expect(interviewDetail("TEST-unknown")).rejects.toThrow(
    "Không tìm thấy lịch phỏng vấn.",
  );
  vi.mocked(getRequest).mockRejectedValueOnce(
    new ApiError("Server error", 500),
  );
  await expect(interviewDetail("TEST-error")).rejects.toThrow("Server error");
});
