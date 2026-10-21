import { expect, it, vi } from "vitest";
import { recruitmentFields } from "@/features/recruitment/utils/recruitment-fields";
import {
  recruitmentDefaults,
  recruitmentFormSchema,
  validateRecruitmentRange,
} from "@/features/recruitment/utils/recruitment-validation";
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
])("rejects date range %s through %s", (from, to) =>
  expect(validateRecruitmentRange(from, to, 6)).toBeTruthy(),
);
it.each([
  ["2026-01-01", "2026-07-01"],
  ["2026-10-21", "2026-10-21"],
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
