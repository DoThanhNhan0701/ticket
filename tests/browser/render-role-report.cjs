const fs = require("node:fs");
const path = require("node:path");
const root = path.resolve(
  process.argv[2] || "test-results/role-audit-20261024",
);
const read = (name) =>
  JSON.parse(fs.readFileSync(path.join(root, name), "utf8"));
const escape = (value) =>
  String(value).replace(
    /[&<>"']/g,
    (c) =>
      ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" })[
        c
      ],
  );
const profiles = read("profiles.json");
const inventory = read("source-render-inventory.json");
const unit = read("unit-final.json");
const runs = ["full", "workflow", "hr", "hr-final"].map((name) => ({
  name,
  report: read(`${name}/frontend-report.json`),
  execution: read(`${name}/execution.json`),
}));
const review = {
  findings: {
    backend: read("backend-findings.json"),
    calendar:
      "FIXED: focusable labeled scroll regions for month/week/day; verified with focused recruitment tests and the final HR browser accessibility check.",
  },
  source: {
    files: inventory.sourceFiles,
    lines: inventory.sourceLines,
    method: inventory.method,
  },
  render: {
    component: "RequestDetailProgress",
    edits: 10,
    commitsBefore: 10,
    commitsAfter: 0,
    conditions:
      "After subscription warm-up; typing in an already filled required field while required completion is unchanged. Clearing a field still updates the count. This is a component commit measurement, not a whole-app FPS or CPU benchmark.",
    existingCreateShellRegression:
      "PASS for notes, title and detail edits with unchanged validity; included in full unit suite.",
    reviewAreas: [
      "Auth and layout context state",
      "Request create/detail/rows/steps/drafts",
      "Comments and attachment providers",
      "List search/filter/pagination",
      "Settings and template editors",
      "Recruitment editors/address/calendar/report",
      "Reports query keys and submit state",
      "Query isolation on account switches",
    ],
    remainingMeasurementLimits: [
      "Draft persistence serializes form state on each change; large-table storage cost was not benchmarked.",
      "Settings/template tables may render when parent UI state changes; no claim that every component in the app has zero avoidable renders.",
      "Completion projection still traverses row values; this optimization removes unchanged React commits, not all computation.",
    ],
  },
  unit: {
    tests: unit.numTotalTests,
    passed: unit.numPassedTests,
    failed: unit.numFailedTests,
    files: unit.testResults.length,
  },
  roles: {
    profiles: profiles.profiles.length,
    passed: profiles.profiles.filter((p) => p.verification === "passed").length,
    routeChecks: profiles.profiles.reduce(
      (n, p) => n + (p.pages?.length || 0),
      0,
    ),
    failures: profiles.failures,
  },
  runs: runs.map(({ name, report, execution }) => ({
    name,
    counts: report.counts,
    unexpectedDocumentNavigations: report.unexpectedDocumentNavigations.length,
    unhandledRuntimeErrors: report.unhandledRuntimeErrors.length,
    fixtures: execution.ownedFixtures,
  })),
  limitations: [
    "Permission-profile checks cover login, actual permissions, sidebar and 26 routes per profile; they are not 13 complete business-lifecycle runs.",
    "The independent role workflow covers creator, designated approver, group manager and assigned handler. HR is checked separately using an isolated user with the available supplemental HR group.",
    "BLOCKED and NOT RUN rows remain in each report; do not sum overlapping suites as unique scenarios.",
    "Superuser and every possible permission combination were not exercised. No existing account permissions were changed.",
    "Initial unit failures were cold lazy-module transformation deadlines; real route modules are now preloaded in the unit setup, while browser tests retain cold navigation.",
    "The initial profile harness misclassified a legacy HTTP 400 access-denial response. Its failed attempt is preserved; the corrected check was rerun through UI login.",
  ],
};
fs.writeFileSync(
  path.join(root, "review.json"),
  JSON.stringify(review, null, 2),
);
const runLabels = {
  full: "E2E tổng thể — nhandt01",
  workflow: "Luồng 4 tài khoản độc lập",
  hr: "Role HR — tuyển dụng",
  "hr-final": "Role HR — chạy lại sau sửa FE",
};
const runRows = runs
  .map(
    ({ name, report }) =>
      `<tr><td><a href="${name}/html/index.html">${runLabels[name]}</a></td>${["PASS", "FAIL", "BLOCKED", "NOT RUN"].map((status) => `<td>${report.counts[status] || 0}</td>`).join("")}</tr>`,
  )
  .join("");
const roleRows = profiles.profiles
  .map(
    (p) =>
      `<tr><td>${escape(p.username)}</td><td>${escape((p.actualPermissions || []).join(", ") || "Không quyền")}</td><td>${p.pages?.length || 0}</td><td>${escape(p.verification)}</td></tr>`,
  )
  .join("");
const hrRole = read("hr-final/hr-role.json");
const hrFixtures = read("hr-final/hr-fixtures.json");
const extra = read("workflow/role-fixtures.json");
const active = [
  ...runs.flatMap((r) => Object.values(r.execution.ownedFixtures || {})),
  ...extra.extra,
].filter((row) => row.active);
const html = `<!doctype html><html lang="vi"><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><title>Rà soát render và role — Ticket</title><style>body{font:16px/1.6 system-ui;max-width:1100px;margin:36px auto;padding:0 20px;color:#192336}h1{font-size:28px}h2{margin-top:32px;font-size:21px}table{border-collapse:collapse;width:100%}th,td{border-bottom:1px solid #ddd;padding:9px;text-align:left;overflow-wrap:anywhere}td:nth-child(2){max-width:440px}a{color:#2358bb}.pass{color:#197245}.scroll{overflow:auto}code{background:#f3f5f8;padding:2px 5px}</style>
<h1>Rà soát render và kiểm thử theo role — 24/10/2026</h1>
<p>Quét tĩnh <strong>${inventory.sourceFiles} file TS/TSX</strong> (${inventory.sourceLines} dòng), kiểm tra các luồng state/subscription/query chính và chạy toàn bộ bộ test. Đây không phải cam kết rằng mọi component đều không còn render thừa.</p>
<h2>Render đã đo và sửa</h2><p><code>RequestDetailProgress</code> trước đây render theo mọi ký tự ở dòng chi tiết. Sau khi chỉ theo dõi trạng thái ô đã nhập, 10 lần gõ sau warm-up giảm từ <strong>10 → 0 commit</strong> khi trạng thái hoàn tất không đổi. Xóa nội dung, thêm/xóa dòng, đổi template và khoảng ngày vẫn cập nhật đúng. Phép đo không đại diện cho FPS toàn ứng dụng; việc tính trạng thái ô vẫn cần duyệt giá trị.</p>
<p>Test chống render lại form cha khi gõ tiêu đề, ghi chú và chi tiết vẫn đạt. Các khu vực đã xem xét gồm auth/layout, danh sách/bộ lọc, cấu hình/biểu mẫu, trao đổi/tệp, tuyển dụng/địa chỉ/lịch và báo cáo. Chi phí lưu nháp với bảng rất lớn và render bảng khi mở modal chưa được benchmark riêng.</p>
<h2>Kết quả kiểm thử</h2><p class="pass"><strong>${unit.numPassedTests}/${unit.numTotalTests} unit/integration test đạt</strong> (${unit.testResults.length} file).</p><div class="scroll"><table><tr><th>Bộ kiểm thử</th><th>PASS</th><th>FAIL</th><th>BLOCKED</th><th>NOT RUN</th></tr>${runRows}</table></div>
<p>Các bộ có ca trùng nhau; không cộng thành số ca duy nhất. Chi tiết BLOCKED/NOT RUN nằm trong từng báo cáo. Quyền HR không có trên nhandt01 được kiểm tra bổ sung bằng tài khoản HR riêng.</p>
<h2>Lỗi FE đã sửa và lỗi backend còn lại</h2><p>Vùng cuộn lịch phỏng vấn đã có nhãn và nhận focus để cuộn bằng bàn phím. 70 test tuyển dụng đạt sau sửa; ca kiểm tra accessibility của lượt HR cuối xác minh lại trực tiếp trên trình duyệt.</p><p><strong>Còn lỗi backend: GET /api/list_cv/ trả HTTP 500 khi tìm không có kết quả.</strong> Hai ca bị ảnh hưởng là tìm chuỗi không tồn tại và kiểm tra danh sách sau khi xóa ứng viên. POST xóa trả 200; danh sách không lọc sau đó trả đủ dữ liệu và không còn ứng viên đã xóa, nhưng tìm lại đúng tên trả 500. FE giữ lỗi server trong kết quả, không coi 500 là danh sách rỗng. <a href="backend-findings.json">Request/response và bằng chứng</a>.</p>
<h2>Chuyển giao giữa các role</h2><p>Người tạo (view + create) → người duyệt khác (view + accept) → quản lý bộ phận → người được phân công → người tạo yêu cầu xử lý lại → quản lý hoàn thành lại → người tạo đóng. Test kiểm tra cả thao tác không được phép: người tạo không tự duyệt ticket giao cho người khác; người xử lý không đóng thay người tạo.</p>
<p>Tài khoản HR <code>${escape(hrRole.username)}</code> nhận quyền thực tế <code>${escape(hrRole.permissions.join(", "))}</code>. Luồng HR kiểm tra yêu cầu tuyển dụng, hồ sơ/CV, lịch phỏng vấn, gắn ứng viên, giờ phỏng vấn, xuất dữ liệu và dọn dữ liệu riêng của lượt chạy.</p>
<h2>Ma trận quyền tài khoản</h2><p>${review.roles.passed}/${review.roles.profiles} cấu hình quyền đạt, ${review.roles.routeChecks} lượt kiểm tra route. Gồm các quyền đơn, quyền cũ search/delete, không quyền và quyền tổng hợp. Các kiểm tra này xác minh đăng nhập, sidebar, quyền vào trang và chặn tải dữ liệu khi không có quyền; không thay thế kiểm thử nghiệp vụ đầy đủ cho từng tổ hợp quyền.</p><div class="scroll"><table><tr><th>Tài khoản</th><th>Quyền thực tế</th><th>Route</th><th>Kết quả</th></tr>${roleRows}</table></div>
<p>Tài khoản chỉ xem bị từ chối ticket không thuộc phạm vi: API trả HTTP 400 kèm “You do not have access”. Test đã được sửa để phân biệt quyền chức năng với quyền trên bản ghi, và đăng nhập lại qua UI sau khi ứng dụng xóa phiên. Không sửa quyền của tài khoản có sẵn.</p>
<h2>Dữ liệu và giới hạn</h2><p>Số danh mục/tài khoản test mới còn active trong các bản ghi dọn dữ liệu: <strong>${active.length}</strong>. Lịch phỏng vấn cuối đã xóa: <strong>${Boolean(hrFixtures.interviewDeleted)}</strong>; ticket HR cuối được quản trị hủy: <strong>${escape(hrFixtures.adminCleanup || "chưa xác nhận")}</strong>. Việc tìm lại ứng viên sau xóa vẫn FAIL vì API 500; bằng chứng danh sách không lọc được ghi riêng. Ticket đã được đóng/hủy theo các ca cleanup; hồ sơ hủy và danh mục khóa được giữ theo cơ chế ứng dụng.</p><p>Chưa chạy mọi tổ hợp quyền, role superuser, hết hạn token tự nhiên hoặc benchmark FPS toàn ứng dụng. Báo cáo giữ các ca chưa chạy và các lần test ban đầu thất bại do chuẩn bị module/cách đọc lỗi quyền, không xóa bằng chứng.</p>
<p><a href="review.json">Kết luận và giới hạn dạng JSON</a> · <a href="profiles.json">Ma trận quyền</a> · <a href="source-render-inventory.json">Danh mục source và hooks</a> · <a href="unit-final.json">Toàn bộ unit test</a> · <a href="profiles-before-resource-check-fix.json">Lượt kiểm tra quyền trước khi sửa harness</a></p></html>`;
fs.writeFileSync(path.join(root, "review.html"), html);
console.log(
  JSON.stringify({
    unit: review.unit,
    roles: review.roles,
    runs: review.runs.map(({ name, counts }) => ({ name, counts })),
    activeFixtures: active.length,
  }),
);
