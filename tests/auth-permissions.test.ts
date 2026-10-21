import { afterEach, expect, it, vi } from "vitest";
import { getUserPermissionRequest } from "@/features/auth/api/auth-api";
import { getRequest } from "@/lib/api/client";
import { canAccessPage, navigationGroups } from "@/app/navigation";

vi.mock("@/lib/api/client", () => ({ getRequest: vi.fn() }));
const account = {
  infoUser: [798, "test-user", null],
  userPermission: [],
  handlingPermission: {},
  is_handling: false,
  is_superuser: false,
  ls_permission: [],
  ls_department: [],
  ls_cv_status: [],
  ls_ticket_status: [],
};
afterEach(() => vi.resetAllMocks());

it.each([
  { userPermission: ["can_process"], is_handling: false },
  { handlingPermission: { IT: ["can_process"] }, is_handling: false },
  { userPermission: [], is_handling: true },
])("retains processing access supplied by the API: %j", async (overrides) => {
  vi.mocked(getRequest).mockResolvedValue({ ...account, ...overrides });
  const result = await getUserPermissionRequest();
  expect(result.permission.can_process).toBe(true);
  expect(canAccessPage(navigationGroups[2].pages[0], result.permission)).toBe(
    true,
  );
});

it("merges duplicate position and handling rights without granting unrelated pages", async () => {
  vi.mocked(getRequest).mockResolvedValue({
    ...account,
    userPermission: ["can_view", "can_view"],
    handlingPermission: { IT: ["can_view", "can_report"], HR: ["can_export"] },
  });
  const { permission } = await getUserPermissionRequest();
  expect(permission).toMatchObject({
    can_view: true,
    can_report: true,
    can_export: true,
    can_process: false,
  });
  expect(permission.can_create).toBeUndefined();
  expect(permission.can_system).toBeUndefined();
  expect(permission.can_report_all_groups).toBe(false);
});

it("uses the actual manager permissions for an account with an empty position", async () => {
  vi.mocked(getRequest).mockResolvedValue({
    ...account,
    userPermission: ["can_process", "can_report", "can_export"],
    is_handling: true,
  });
  const { permission } = await getUserPermissionRequest();
  expect(
    navigationGroups
      .flatMap((g) => g.pages)
      .filter((p) => canAccessPage(p, permission))
      .map((p) => p.path),
  ).toEqual(["/tasks/mine", "/tasks", "/reports", "/reports/export"]);
});

it.each([{}, { is_superuser: true, is_admin: true }])(
  "does not invent page access for an empty account: %j",
  async (flags) => {
    vi.mocked(getRequest).mockResolvedValue({ ...account, ...flags });
    const { permission } = await getUserPermissionRequest();
    expect(
      navigationGroups
        .flatMap((g) => g.pages)
        .some((p) => canAccessPage(p, permission)),
    ).toBe(false);
  },
);

it.each([{ AD: [] }, { AD: ["can_report"] }])(
  "recognizes explicit AD scope independently from Django flags: %j",
  async (handlingPermission) => {
    vi.mocked(getRequest).mockResolvedValue({ ...account, handlingPermission });
    const { permission } = await getUserPermissionRequest();
    expect(permission.can_report_all_groups).toBe(true);
    expect(permission.can_system).toBeUndefined();
  },
);
