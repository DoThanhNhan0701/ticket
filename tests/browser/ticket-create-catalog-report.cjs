// Build the reviewable CSV after both UI runners have completed.
const fs = require("node:fs");
const path =
  process.env.CATALOG_REPORT || "tests/artifacts/ticket-create-catalog.json";
const readbackPath =
  process.env.READBACK_REPORT ||
  "tests/artifacts/ticket-create-catalog-readback.json";
const target =
  process.env.CATALOG_CSV || "tests/artifacts/ticket-create-catalog.csv";
const report = JSON.parse(fs.readFileSync(path, "utf8"));
const audit = JSON.parse(fs.readFileSync(readbackPath, "utf8"));
for (const result of report.results) {
  const check = audit.results.find((row) => row.id === result.id);
  if (check)
    result.readback = {
      status: check.status,
      verifiedCells: check.verifiedCells || 0,
      reason: check.reason,
    };
  result.fixedLegacyTemplate =
    !!report.firstPass?.issues.some(
      (issue) => issue.typeId === result.typeId,
    ) && result.status === "passed";
}
report.summary = {
  total: report.inventory.activeTypes,
  passed: report.results.filter(
    (row) => row.status === "passed" && row.readback?.status === "passed",
  ).length,
  blocked: report.results.filter((row) => row.status === "blocked").length,
  failed: report.results.filter(
    (row) =>
      row.status !== "blocked" &&
      (row.status !== "passed" || row.readback?.status !== "passed"),
  ).length,
  created: report.results.filter((row) => row.id).length,
  fiveRowTickets: report.results.filter((row) => row.id && row.rows === 5)
    .length,
  noCreationDetailTickets: report.results.filter(
    (row) => row.id && row.rows === 0,
  ).length,
  enteredDetailRows: report.results.reduce(
    (sum, row) => sum + (row.rows || 0),
    0,
  ),
  verifiedCells: audit.results.reduce(
    (sum, row) => sum + (row.verifiedCells || 0),
    0,
  ),
  fixedLegacyTemplates: report.results.filter((row) => row.fixedLegacyTemplate)
    .length,
};
const encode = (value) => '"' + String(value ?? "").replaceAll('"', '""') + '"';
const rows = [
  [
    "Bộ phận",
    "ID loại",
    "Loại yêu cầu",
    "Kết quả",
    "ID ticket",
    "Mã ticket",
    "Số dòng nhập",
    "Số ô đối chiếu",
    "Lỗi template cũ đã sửa",
    "Ghi chú",
    "Link ticket",
    "Ảnh form",
    "Ảnh sau tạo",
  ],
];
for (const group of report.groups)
  for (const type of group.types) {
    const result = report.results.find((row) => row.typeId === type.id) || {};
    rows.push([
      group.name,
      type.id,
      type.name,
      result.status,
      result.id,
      result.code,
      result.rows,
      result.readback?.verifiedCells,
      result.fixedLegacyTemplate ? "Có" : "",
      result.reason || result.readback?.reason,
      result.id ? "https://ticket-new.aiminds.io.vn/requests/" + result.id : "",
      result.formScreenshot,
      result.createdScreenshot || result.failureScreenshot,
    ]);
  }
fs.writeFileSync(
  target,
  "\uFEFF" + rows.map((row) => row.map(encode).join(",")).join("\r\n") + "\r\n",
);
fs.writeFileSync(path, JSON.stringify(report, null, 2) + "\n");
console.log(JSON.stringify(report.summary, null, 2));
