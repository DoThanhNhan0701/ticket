import { expect, it, vi } from "vitest";
import { recruitmentFields } from "@/features/recruitment/utils/recruitment-fields";
import {
  recruitmentDefaults,
  recruitmentFormSchema,
  validateRecruitmentRange,
  recruitmentFilterSchema,
  interviewCandidateFilterSchema,
} from "@/features/recruitment/utils/recruitment-validation";
import type {
  RecruitmentAction,
  RecruitmentValues,
} from "@/features/recruitment/types";
import {
  recruitmentDate,
  recruitmentStoredDate,
  recruitmentFileHref,
  recruitmentText,
} from "@/features/recruitment/utils/recruitment-format";
const now = new Date("2026-10-21T12:00:00");
const interview = {
  title: "TEST Interview",
  start_date: "22/10/2026",
  time_start: "09:00",
  time_end: "10:00",
  user_interview: [],
  note: "",
};
const schema = () =>
  recruitmentFormSchema(
    "interview",
    recruitmentFields("interview"),
    { users: [] },
    false,
    now,
  );
it.each(["31/02/2026", "2026-02-30", "2026-1-1", "abc", ""])(
  "rejects malformed recruitment date %s",
  (value) => {
    expect(recruitmentDate(value)).toBe("");
  },
);
it.each([
  ["29/02/2024", "2024-02-29"],
  ["2026-10-21", "2026-10-21"],
])("normalizes date %s", (input, expected) =>
  expect(recruitmentDate(input)).toBe(expected),
);
it.each([
  { time_end: "08:59" },
  { time_end: "09:00" },
  { time_start: "24:00" },
  { time_end: "10:99" },
  { start_date: "20/10/2026" },
  { start_date: "21/10/2026", time_start: "11:00" },
  { title: "    " },
  { title: "a".repeat(51) },
  { user_interview: ["999"] },
])("blocks invalid interview data %j", (invalid) => {
  expect(schema().safeParse({ ...interview, ...invalid }).success).toBe(false);
});
it("accepts a future schedule without interviewers and never changes existing form input", () => {
  expect(schema().safeParse(interview).success).toBe(true);
  expect(interview.start_date).toBe("22/10/2026");
});
it("allows editing notes on an existing past interview", () => {
  expect(
    recruitmentFormSchema(
      "interview",
      recruitmentFields("interview"),
      { users: [] },
      true,
      now,
    ).safeParse({ ...interview, start_date: "01/01/2026" }).success,
  ).toBe(true);
});
it.each([
  ["", "2026-10-21"],
  ["2026-10-22", "2026-10-21"],
  ["2026-01-01", "2026-07-02"],
  ["2026-01-01", "2026-08-01"],
  ["2026-01-31", "2026-08-01"],
  ["2026-08-31", "2027-03-01"],
])("rejects date range %s through %s", (from, to) =>
  expect(validateRecruitmentRange(from, to, 6)).toBeTruthy(),
);
it.each([
  ["2026-01-01", "2026-07-01"],
  ["2026-10-21", "2026-10-21"],
  ["2026-01-31", "2026-07-31"],
  ["2026-08-31", "2027-02-28"],
])("allows six-month boundary or equal range %s / %s", (from, to) =>
  expect(validateRecruitmentRange(from, to, 6)).toBeNull(),
);
it("validates candidate phone, email, city and future birthday without requiring optional education", () => {
  const fields = recruitmentFields("create-candidate");
  const options = {
    genders: [{ value: "Nam", label: "Nam" }],
    cities: [{ value: "01", label: "Hà Nội" }],
    districts: [{ value: "001", label: "Ba Đình" }],
    education: [],
    sources: [],
  };
  const base = {
    ...recruitmentDefaults(fields, {}),
    first_name: "TEST Candidate",
    gender: "Nam",
    numberphone: "0912345678",
    city_code: "01",
    district_code: "001",
    address: "TEST address",
  };
  const validator = recruitmentFormSchema(
    "create-candidate",
    fields,
    options,
    false,
    now,
  );
  expect(validator.safeParse(base).success).toBe(true);
  for (const invalid of [
    { numberphone: "091abc" },
    { numberphone: "123" },
    { email: "bad" },
    { birthday: "22/10/2026" },
    { city_code: "999" },
    { district_code: "not-in-city" },
    { district_code: "" },
    { address: "" },
  ])
    expect(validator.safeParse({ ...base, ...invalid }).success).toBe(false);
});

const options = {
  genders: [{ value: "Nam", label: "Nam" }],
  cities: [{ value: "01", label: "Hà Nội" }],
  districts: [{ value: "00004", label: "Ba Đình" }],
  statuses: [{ value: "1", label: "Mới" }],
  users: [{ value: "42", label: "test-user" }],
  interviews: [{ value: "58", label: "TEST Interview" }],
  departments: [{ value: "31", label: "HR" }],
};
const validCandidate = {
  first_name: "TEST Candidate",
  numberphone: "0912345678",
  city_code: "01",
  district_code: "00004",
  address: "TEST address",
  gender: "Nam",
  cv_status: "1",
};
it.each<{
  action: RecruitmentAction;
  valid: RecruitmentValues;
  invalid: RecruitmentValues[];
}>([
  {
    action: "request",
    valid: { quantity: "1" },
    invalid: [
      { quantity: "" },
      { quantity: "0" },
      { quantity: "-1" },
      { quantity: "1.5" },
      { quantity: "1e3" },
      { quantity: "9007199254740993" },
      { quantity: ["1"] },
      { reason_recr_id: "missing" },
    ],
  },
  {
    action: "create-candidate",
    valid: validCandidate,
    invalid: [
      { first_name: "  " },
      { first_name: "ab" },
      { first_name: "a".repeat(151) },
      { first_name: ["TEST Candidate"] },
      { numberphone: ["0912345678"] },
      { gender: "unknown" },
      { application_date: "31/02/2026" },
      { education_level: "missing" },
      { candidate_source: "missing" },
    ],
  },
  {
    action: "candidate",
    valid: { ...validCandidate, ls_user_received: ["42"] },
    invalid: [
      { ls_user_received: "42" },
      { ls_user_received: ["missing"] },
      { email: "invalid" },
    ],
  },
  {
    action: "status",
    valid: { cv_status: "1" },
    invalid: [
      { cv_status: "" },
      { cv_status: "missing" },
      { cv_status: ["1"] },
      { why_change: ["reason"] },
    ],
  },
  {
    action: "attach",
    valid: { start_date: "2026-10-22", id_interview: "58" },
    invalid: [
      { start_date: "" },
      { start_date: "2026-02-30" },
      { id_interview: "" },
      { id_interview: "missing" },
      { id_interview: ["58"] },
    ],
  },
  {
    action: "candidate-time",
    valid: { time_start: "09:30" },
    invalid: [
      { time_start: "24:00" },
      { time_start: "09:60" },
      { time_start: "9:30" },
      { time_start: ["09:30"] },
    ],
  },
  {
    action: "note",
    valid: { note: "TEST feedback" },
    invalid: [{ note: ["feedback"] }],
  },
])("validates editable fields for $action", ({ action, valid, invalid }) => {
  const validator = recruitmentFormSchema(
    action,
    recruitmentFields(action),
    options,
    true,
    now,
  );
  expect(validator.safeParse(valid).success).toBe(true);
  for (const values of invalid) {
    const parsed = validator.safeParse({ ...valid, ...values });
    expect(parsed.success, JSON.stringify(values)).toBe(false);
    if (!parsed.success)
      expect(
        parsed.error.issues.some(
          (issue) => issue.path[0] === Object.keys(values)[0],
        ),
      ).toBe(true);
  }
});
it("validates candidate times against the parent interview including both endpoints", () => {
  const validator = recruitmentFormSchema(
    "candidate-time",
    recruitmentFields("candidate-time", { start: "04:00", end: "11:00" }),
    {},
    true,
    now,
  );
  for (const time_start of ["", "04:00", "07:30", "11:00"])
    expect(validator.safeParse({ time_start }).success).toBe(true);
  for (const time_start of ["03:59", "11:01", "24:00"])
    expect(validator.safeParse({ time_start }).success).toBe(false);
});
it("accepts optional empty fields and trims text without accepting arrays as text", () => {
  const validator = recruitmentFormSchema(
    "candidate-time",
    recruitmentFields("candidate-time"),
    {},
    true,
    now,
  );
  expect(validator.parse({ time_start: "  " })).toMatchObject({
    time_start: "",
  });
  const candidateSchema = recruitmentFormSchema(
    "candidate",
    recruitmentFields("candidate"),
    options,
    true,
    now,
  );
  expect(
    candidateSchema.parse({
      ...validCandidate,
      first_name: "  TEST Candidate  ",
      ls_user_received: [" 42 "],
    }),
  ).toMatchObject({ first_name: "TEST Candidate", ls_user_received: ["42"] });
});
it("enforces interview title and note boundaries and multi-select value types", () => {
  expect(
    schema().safeParse({ ...interview, title: "abcde", note: "a".repeat(255) })
      .success,
  ).toBe(true);
  for (const invalid of [
    { title: "abcd" },
    { note: "a".repeat(256) },
    { user_interview: "42" },
    { title: ["TEST Interview"] },
  ])
    expect(schema().safeParse({ ...interview, ...invalid }).success).toBe(
      false,
    );
});
it.each(["requests", "candidates", "interviews", "reports"] as const)(
  "validates %s filter dates and trims search input",
  (mode) => {
    const validator = recruitmentFilterSchema(mode, options);
    const valid = {
      from_date: "2026-10-21",
      to_date: "2026-10-22",
      search: " TEST ",
    };
    expect(validator.parse(valid).search).toBe("TEST");
    expect(
      validator.safeParse({ ...valid, from_date: "2026-02-30" }).success,
    ).toBe(false);
    if (mode !== "interviews") {
      for (const to_date of ["", "2026-02-30", "2026-10-20"])
        expect(validator.safeParse({ ...valid, to_date }).success).toBe(false);
    }
  },
);
it.each(["requests", "candidates"] as const)(
  "validates %s filter selections against current directories",
  (mode) => {
    const validator = recruitmentFilterSchema(mode, options);
    const valid = {
      from_date: "2026-10-21",
      to_date: "2026-10-22",
      department_recruited: "31",
      user_received: "42",
      cv_status: "1",
      ticket_status: "2",
    };
    expect(validator.safeParse(valid).success).toBe(true);
    for (const invalid of [
      { department_recruited: "31,999" },
      { department_recruited: "31," },
      { user_received: "999" },
      mode === "requests" ? { ticket_status: "1" } : { cv_status: "999" },
    ])
      expect(validator.safeParse({ ...valid, ...invalid }).success).toBe(false);
  },
);
it("validates interview candidate filter gender and status while allowing empty filters", () => {
  const validator = interviewCandidateFilterSchema(options);
  expect(
    validator.parse({ search: " TEST ", gender: "Nam", cv_status: "1" }),
  ).toEqual({ search: "TEST", gender: "Nam", cv_status: "1" });
  expect(
    validator.safeParse({ search: "", gender: "", cv_status: "" }).success,
  ).toBe(true);
  expect(
    validator.safeParse({ search: "", gender: "unknown", cv_status: "1" })
      .success,
  ).toBe(false);
  expect(
    validator.safeParse({ search: "", gender: "Nam", cv_status: "999" })
      .success,
  ).toBe(false);
});
it("keeps meaningful zero values and blocks unsafe attachment URLs", () => {
  expect(recruitmentText(0)).toBe("0");
  expect(recruitmentText(null)).toBe("");
  for (const value of [
    "javascript:alert(1)",
    "data:text/html,bad",
    "file:///tmp/cv",
  ]) {
    expect(recruitmentFileHref(value)).toBeUndefined();
  }
  expect(recruitmentFileHref("https://example.com/cv.pdf")).toBe(
    "https://example.com/cv.pdf",
  );
});
it("normalizes seconds and assignees from detail readback", () => {
  expect(
    recruitmentDefaults(recruitmentFields("interview"), {
      time_start: "09:30:00",
      data_user_interview: [{ id: 42, username: "test" }],
    }),
  ).toMatchObject({ time_start: "09:30", user_interview: ["42"] });
});
it("restores interviewer IDs from the calendar CSV contract", () => {
  expect(
    recruitmentDefaults(recruitmentFields("interview"), {
      user_interview: "42, 43,",
    }),
  ).toMatchObject({ user_interview: ["42", "43"] });
});
it("shows human-readable detail labels without loading HR directories for an interview-only user", () => {
  expect(
    recruitmentDefaults(recruitmentFields("view-candidate"), {
      city_code: "01",
      city_name: "Hà Nội",
      education_level: 1,
      education_level_name: "Đại học",
      data_user_received: [{ id: 42, username: "test-user" }],
    }),
  ).toMatchObject({
    city_code: "Hà Nội",
    education_level: "Đại học",
    ls_user_received: "test-user",
  });
});

it.each([
  ["2019-12-31T17:00:00Z", "2020-01-01"],
  ["2026-10-20T17:00:00Z", "2026-10-21"],
  ["2026-10-21T23:30:00+07:00", "2026-10-21"],
  ["2026-10-21", "2026-10-21"],
  [null, ""],
  ["2026-99-99T99:99:00Z", ""],
])(
  "restores stored business dates without a UTC day shift: %s",
  (value, expected) => {
    expect(recruitmentStoredDate(value)).toBe(expected);
  },
);
it("restores application and birth dates in create/edit forms without changing strict input validation", () => {
  expect(
    recruitmentDefaults(recruitmentFields("candidate"), {
      application_date: "2026-10-20T17:00:00Z",
      birthday: "2000-01-01",
    }),
  ).toMatchObject({ application_date: "2026-10-21", birthday: "2000-01-01" });
  expect(recruitmentDate("2026-10-20T17:00:00Z")).toBe("");
});

it("joins recruitment attachment directories with encoded filenames and uses the public media host", () => {
  vi.stubEnv("VITE_API_BASE_URL", "https://ticket-api.example.test");
  try {
    expect(recruitmentFileHref("media/recruitment/90/", "Đặng JD #1.txt")).toBe(
      "https://ticket-api.example.test/media/recruitment/90/%C4%90%E1%BA%B7ng%20JD%20%231.txt",
    );
    expect(
      recruitmentFileHref(
        "http://192.168.1.10:8000/media/recruitment/90/",
        "JD.txt",
      ),
    ).toBe("https://ticket-api.example.test/media/recruitment/90/JD.txt");
    expect(recruitmentFileHref("/media/recruitment/90/JD.txt", "JD.txt")).toBe(
      "https://ticket-api.example.test/media/recruitment/90/JD.txt",
    );
    expect(recruitmentFileHref("https://example.test/JD.pdf", "JD.pdf")).toBe(
      "https://example.test/JD.pdf",
    );
    expect(
      recruitmentFileHref("javascript:alert(1)", "JD.pdf"),
    ).toBeUndefined();
  } finally {
    vi.unstubAllEnvs();
  }
});
