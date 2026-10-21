// Export a reviewable account list. Never include credentials in artifacts.
const fs = require("node:fs");
const source =
  process.env.PROFILE_REPORT ||
  "tests/artifacts/ticket-permission-profiles.json";
const target =
  process.env.PROFILE_CSV || "tests/artifacts/ticket-permission-profiles.csv";
const report = JSON.parse(fs.readFileSync(source, "utf8"));
const checks = report.profiles.flatMap((profile) => profile.pages ?? []);
report.summary = {
  accountsCreated: report.profiles.filter((profile) => profile.userId).length,
  accountsVerified: report.profiles.filter(
    (profile) => profile.verification === "passed",
  ).length,
  sidebarsVerified: report.profiles.filter(
    (profile) => profile.sidebar?.result === "passed",
  ).length,
  pageChecks: checks.length,
  allowed: checks.filter((check) => check.expected === "allowed").length,
  denied: checks.filter((check) => check.expected === "denied").length,
  apiErrorResponses: checks.reduce(
    (total, check) => total + check.apiErrors.length,
    0,
  ),
};
fs.writeFileSync(source, JSON.stringify(report, null, 2) + "\n");
const quote = (value) => '"' + String(value ?? "").replaceAll('"', '""') + '"';
const rows = [
  [
    "Tài khoản",
    "ID tài khoản",
    "Chức vụ TEST",
    "ID chức vụ",
    "Quyền được gán",
    "Tên quyền",
    "Quyền thực tế",
    "Đăng nhập",
    "Kiểm tra menu",
    "Trang cho phép",
    "Trang từ chối",
    "Kết quả",
  ],
];
for (const profile of report.profiles) {
  rows.push([
    profile.username,
    profile.userId,
    profile.positionName,
    profile.positionId,
    profile.permissions.join(", "),
    profile.permissions
      .map(
        (code) =>
          report.permissions.find((permission) => permission.code === code)
            ?.label ?? code,
      )
      .join(", ") || "Không có quyền",
    (profile.actualPermissions ?? []).join(", "),
    profile.login,
    profile.sidebar?.result,
    (profile.pages ?? []).filter((p) => p.expected === "allowed").length,
    (profile.pages ?? []).filter((p) => p.expected === "denied").length,
    profile.verification ?? "pending",
  ]);
}
fs.writeFileSync(
  target,
  "\uFEFF" + rows.map((row) => row.map(quote).join(",")).join("\r\n") + "\r\n",
);
console.log(
  JSON.stringify({ output: target, accounts: report.profiles.length }),
);
