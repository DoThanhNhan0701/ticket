const ticketTestEnv = require("../env.cjs");
// Direct API regression for users imported/created without a position.
// Input: { admin: { username, password }, testPassword } on stdin.
// Only isolated TEST users may be created; no existing records are modified.
const fs = require("node:fs");
const assert = require("node:assert/strict");
const base = ticketTestEnv.apiUrl;
const reportPath =
  process.env.NO_POSITION_API_REPORT ||
  "tests/artifacts/ticket-user-no-position-api.json";
const previous = fs.existsSync(reportPath)
  ? JSON.parse(fs.readFileSync(reportPath, "utf8"))
  : null;
const report = {
  testedAt: new Date().toISOString(),
  method: "Direct real API requests; no browser/form validation",
  cases: [],
};
async function request(path, token, body, json = false) {
  const headers = token ? { Authorization: "Bearer " + token } : {};
  if (json) headers["Content-Type"] = "application/json";
  const response = await fetch(base + path, {
    method: body ? "POST" : "GET",
    headers,
    body: json ? JSON.stringify(body) : body,
    signal: AbortSignal.timeout(30000),
  });
  const text = await response.text();
  let data;
  try {
    data = JSON.parse(text);
  } catch {
    data = null;
  }
  return {
    status: response.status,
    ok: response.ok,
    data,
    nonJsonResponse: data === null,
  };
}
function userSummary(user) {
  return {
    id: user.id,
    username: user.username,
    chucvu: user.chucvu,
    team: user.team,
    bophan: user.bophan,
    is_active: user.is_active,
    is_superuser: user.is_superuser,
    is_staff: user.is_staff,
    ls_permission: user.ls_permission,
  };
}
(async () => {
  const input = JSON.parse(fs.readFileSync(0, "utf8"));
  assert(
    input.admin?.username && input.admin?.password && input.testPassword,
    "Supply credentials on stdin",
  );
  const login = await request("/token/", null, input.admin, true);
  assert(
    login.ok && login.data?.access,
    "Admin API login failed: " + login.status,
  );
  const adminToken = login.data.access;
  const [teams, departments] = await Promise.all([
    request("/list_team/", adminToken),
    request("/list_bophan_sudung/?page_size=1000&page=1", adminToken),
  ]);
  assert(teams.ok && departments.ok, "Unable to load isolated TEST fixtures");
  const team = teams.data.find((t) => t.name === "TEST_QC_PERM_261021");
  const department = (departments.data.results ?? departments.data).find(
    (d) => d.name === "TEST_QC_PERM_261021",
  );
  assert(team && department && !team.is_handling && !department.is_handling);
  report.fixtures = { teamId: team.id, departmentId: department.id };
  for (const [index, variant] of ["omitted", "empty", "null"].entries()) {
    const username = "test_api_nopos_261021_" + variant;
    const result = { variant, username };
    report.cases.push(result);
    let listing = await request("/list_user_v2/", adminToken);
    assert(listing.ok && Array.isArray(listing.data));
    let user = listing.data.find((u) => u.username === username);
    if (!user) {
      const values = {
        username,
        msnv: "TNP261021" + (index + 1),
        first_name: "Không chức vụ",
        last_name: "TEST API",
        email: username + "@example.invalid",
        team: String(team.id),
        bophan: String(department.id),
        nhomquyen: "",
        is_active: "true",
      };
      if (variant === "empty") values.chucvu = "";
      const body =
        variant === "null" ? { ...values, chucvu: null } : new FormData();
      if (body instanceof FormData)
        for (const [key, value] of Object.entries(values))
          body.append(key, value);
      const created = await request(
        "/usermmanager/",
        adminToken,
        body,
        variant === "null",
      );
      result.create = {
        status: created.status,
        nonJsonResponse: created.nonJsonResponse,
        error: created.data?.error ?? null,
        message: created.data?.message ?? created.data?.detail ?? null,
      };
      listing = await request("/list_user_v2/", adminToken);
      assert(listing.ok && Array.isArray(listing.data));
      user = listing.data.find((u) => u.username === username);
    } else
      result.create = {
        ...previous?.cases.find((entry) => entry.username === username)?.create,
        reusedExistingTestAccount: true,
      };
    result.persisted = Boolean(user);
    if (!user) {
      result.result = "creation-rejected";
      continue;
    }
    assert(user.username.startsWith("test_api_nopos_261021_"));
    result.user = userSummary(user);
    assert.equal(user.chucvu, null, "API unexpectedly assigned a position");
    assert.equal(user.is_superuser, false);
    assert.equal(user.is_staff, false);
    assert.deepEqual(user.ls_permission, []);
    const detail = await request("/usermmanager/" + user.id, adminToken);
    result.readback = { status: detail.status, chucvu: detail.data?.chucvu };
    assert(detail.ok && detail.data?.chucvu === null);
    const signedIn = await request(
      "/token/",
      null,
      { username, password: input.testPassword },
      true,
    );
    result.login = { status: signedIn.status };
    if (!signedIn.ok || !signedIn.data?.access) {
      result.result = "login-failed";
      continue;
    }
    const permission = await request("/list_permission/", signedIn.data.access);
    result.accountPermission = {
      status: permission.status,
      nonJsonResponse: permission.nonJsonResponse,
    };
    if (permission.ok) {
      Object.assign(result.accountPermission, {
        userPermission: permission.data.userPermission,
        handlingPermission: permission.data.handlingPermission,
        is_handling: permission.data.is_handling,
        is_superuser: permission.data.is_superuser,
      });
      const roles = [
        ...(permission.data.userPermission ?? []),
        ...Object.values(permission.data.handlingPermission ?? {}).flat(),
      ];
      assert.deepEqual(
        roles,
        [],
        "No-position account unexpectedly inherited functional permissions",
      );
      assert.equal(permission.data.is_handling, false);
      assert.equal(permission.data.is_superuser, false);
      result.result = "created-without-position-and-no-permissions";
    } else result.result = "permission-api-failed";
    fs.writeFileSync(reportPath, JSON.stringify(report, null, 2) + "\n");
  }
  const controlLogin = await request(
    "/token/",
    null,
    { username: "test_p261021_none", password: input.testPassword },
    true,
  );
  assert(controlLogin.ok && controlLogin.data?.access, "Control login failed");
  const controlPermission = await request(
    "/list_permission/",
    controlLogin.data.access,
  );
  report.control = {
    username: "test_p261021_none",
    description: "Position assigned, but no permission grants",
    loginStatus: controlLogin.status,
    permissionStatus: controlPermission.status,
    userPermission: controlPermission.data?.userPermission,
    handlingPermission: controlPermission.data?.handlingPermission,
    is_handling: controlPermission.data?.is_handling,
  };
  assert(controlPermission.ok, "Assigned-position control permissions failed");
  assert.deepEqual(controlPermission.data.userPermission, []);
  assert.deepEqual(controlPermission.data.handlingPermission, {});
  report.completed = true;
  report.result = report.cases.every(
    (entry) => entry.result === "created-without-position-and-no-permissions",
  )
    ? "passed"
    : "failed";
  if (report.result === "failed") process.exitCode = 1;
})()
  .catch((error) => {
    report.failure = error.message;
    process.exitCode = 1;
  })
  .finally(() => {
    fs.writeFileSync(reportPath, JSON.stringify(report, null, 2) + "\n");
    console.log(JSON.stringify(report, null, 2));
  });
