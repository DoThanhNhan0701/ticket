# Đối chiếu hướng dẫn Word và frontend E2E

Ngày kiểm tra: 23/10/2026. Tài liệu v1.2 ngày 22/10/2026, 15 chương / 87 mục nhỏ. Bản trong `docs/` và bản tải tại `public/docs/` giống nhau. Không thay nội dung hướng dẫn để phù hợp với kết quả test.

Các đường dẫn module bên dưới tương đối với `tests/e2e/modules/`. `EXISTING` nghĩa là đã có kịch bản, `ADDED` là bổ sung lần đối chiếu này; cả hai **không tự có nghĩa PASS**. `PARTIAL` còn nhánh chưa kiểm tra, `KNOWN FAIL` có bằng chứng lỗi trước đó, `NOT RUN` chưa chạy, `MANUAL` là bước cần con người/điều kiện bên ngoài. Kết quả thực thi và ca lỗi nằm trong [báo cáo JSON](../tests/artifacts/user-guide-coverage-20261023.json).

Chạy bổ sung trên TEST bằng tài khoản đủ quyền được truyền qua stdin/env:

```bash
BASE_URL=http://127.0.0.1:5187 E2E_GUIDE_ONLY=true npm run test:e2e:frontend
```

Mode này tạo 7 danh mục thử, tạo ticket nguồn, chọn `@` user thử, tạo ticket sao chép từ workbook tải thật, kiểm tra báo cáo/hướng dẫn, hủy các ticket thử và khóa danh mục. Chạy mặc định cũng bao gồm các ca mới. Ảnh, trace, workbook và HTML nằm trong `/tmp/ticket-frontend-e2e/`, không đưa vào source. Không gọi API trực tiếp hay reload để sửa trạng thái UI.

Lượt cuối `guide-crosscheck-10`: **54 PASS / 0 FAIL / 0 BLOCKED / 23 NOT RUN**.
Mười ca mới có nhãn `Guide` và ba ca đọc/tải hướng dẫn đều PASS. Hai ticket thử
(nguồn và bản sao) đã Hủy; bảy danh mục đã Khóa và kiểm tra badge trên UI.
Không có điều hướng document ngoài dự kiến hoặc lỗi JavaScript chưa xử lý.
HTTP 401 là ca sai mật khẩu có chủ đích; các GET bị hủy khi chuyển UI được giữ
trong báo cáo, không kết luận thành lỗi ứng dụng. 23 NOT RUN thuộc các phần ngoài
mode tập trung; không dùng kết quả này để tuyên bố toàn website PASS.

Lượt đầu `guide-crosscheck-09` giữ nguyên evidence, có ba lỗi kỳ vọng của harness:
maxlength chặn quá 300, cột Excel `Stt` chưa điền và required ngày chỉ báo lần lượt.
Đã sửa harness rồi chạy lại. Ticket bản sao ở lượt đầu chưa được gửi; nguồn và bảy
danh mục đã dọn. Những lỗi ticket/recruitment trước đó vẫn theo dõi tại
[báo cáo riêng](../tests/artifacts/ticket-actions-recruitment-20261023.json).

Kiểm tra mã: lint/typecheck PASS, 7 unit tests đọc Word PASS; Prettier và
`git diff --check` PASS. Tài liệu Word gốc/bản public không bị chỉnh sửa.

| Mục Word                                           | Đối chiếu  | Module                                               | Bước kiểm tra / còn thiếu                                                                         |
| -------------------------------------------------- | ---------- | ---------------------------------------------------- | ------------------------------------------------------------------------------------------------- |
| 1.1. Bạn cần làm việc gì?                          | EXISTING   | navigation.ts, ticket-actions.ts, hr.ts              | Menu và quy trình theo vai trò; không thay thế hướng dẫn nghiệp vụ.                               |
| 1.2. Ai làm gì trong một yêu cầu?                  | PARTIAL    | navigation.ts, ticket-actions.ts, hr.ts              | Chưa chứng minh ma trận mọi tổ hợp vai trò/quan hệ bản ghi.                                       |
| 1.3. Hiểu dấu hiệu và tên gọi trên màn hình        | PARTIAL    | navigation.ts, ticket-actions.ts, hr.ts              | Kiểm tra nhãn/lỗi/badge; tooltip tên dài trên mọi bảng chưa đủ.                                   |
| 1.4. Cách kiểm tra sau mỗi lần lưu                 | EXISTING   | navigation.ts, ticket-actions.ts, hr.ts              | Có save/reopen; stale recruitment editor là lỗi đã ghi nhận.                                      |
| 2.1. Chuẩn bị                                      | MANUAL     | auth.ts, navigation.ts, session.ts                   | Điều kiện mạng nội bộ và quy trình cấp tài khoản ngoài UI.                                        |
| 2.2. Đăng nhập từng bước                           | EXISTING   | auth.ts, navigation.ts, session.ts                   | Required, sai mật khẩu, show/hide, submit kép, đăng nhập thành công.                              |
| 2.3. Các khu vực và biểu tượng                     | EXISTING   | auth.ts, navigation.ts, session.ts                   | Logo, sidebar, theme, tên tài khoản, help, logout.                                                |
| 2.4. Mở trang và kiểm tra quyền                    | PARTIAL    | auth.ts, navigation.ts, session.ts                   | Menu/full quyền + tài khoản thử hạn chế; chưa mọi tập quyền.                                      |
| 2.5. Đăng xuất trên máy dùng chung                 | EXISTING   | auth.ts, navigation.ts, session.ts                   | Logout và Back không khôi phục truy cập bảo vệ.                                                   |
| 3.1. Chọn đúng danh sách trước khi tìm             | EXISTING   | navigation.ts                                        | Sidebar sáu danh sách; nhiệm vụ của user phụ qua UI.                                              |
| 3.2. Tìm nhanh                                     | EXISTING   | navigation.ts                                        | Search draft, Enter, reset, mở đúng mã.                                                           |
| 3.3. Lọc nâng cao                                  | PARTIAL    | navigation.ts                                        | Drawer cancel/Escape đã có; chưa áp dụng mọi tổ hợp đa lựa chọn/ngày.                             |
| 3.4. Đọc bảng và chuyển trang                      | PARTIAL    | navigation.ts                                        | Page size/boundary và next/previous khi đủ dòng; chưa tạo 201 ticket để ép phân trang.            |
| 3.5. Nếu tìm không thấy                            | EXISTING   | navigation.ts                                        | Không kết quả/reset; không suy luận xóa bản ghi từ kết quả rỗng.                                  |
| 4.1. Mở form và chuẩn bị                           | EXISTING   | requests.ts, guide.ts                                | Required và mở tuần tự các phần.                                                                  |
| 4.2. Phần 1 – Loại yêu cầu: chọn nơi nhận          | PARTIAL    | requests.ts, guide.ts                                | Danh mục phụ thuộc và chặn tên bộ phận dài; lỗi tải mạng chưa kích hoạt có kiểm soát.             |
| 4.3. Phần 2 – Thông tin yêu cầu                    | ADDED      | requests.ts, guide.ts                                | Biên tiêu đề 300/301 và ngày quá khứ; Team nhiều lựa chọn chưa kiểm tra đủ.                       |
| 4.4. Phần 3 – Điền các dòng chi tiết               | PARTIAL    | requests.ts, guide.ts                                | Text/number zero, clone/delete dòng; date/range/conditions chưa có live fixture.                  |
| 4.5. Nhập chi tiết bằng Excel                      | ADDED      | requests.ts, guide.ts                                | Tải mẫu thật, sửa workbook cục bộ, sai extension giữ dữ liệu, nhập hai dòng 0/2.                  |
| 4.6. Phần 4 – Thông tin bổ sung: ghi chú và tệp    | ADDED      | requests.ts, guide.ts                                | Bỏ file chọn nhầm và biên ghi chú 1000/1001; kéo thả/50 MB chưa live đủ.                          |
| 4.7. Gửi và kiểm tra kết quả                       | PARTIAL    | requests.ts, guide.ts                                | Tạo thật và đọc lại; retry upload sau lưu một phần chưa kích hoạt trong continuous suite.         |
| 4.8. Nháp, mất mạng và phải đăng nhập lại          | NOT RUN    | requests.ts, guide.ts                                | Chưa cắt mạng thật/đợi hết phiên và kiểm chứng nháp sau UI đăng nhập lại; không thay token.       |
| 4.9. Quay lại và Làm lại                           | PARTIAL    | requests.ts, guide.ts                                | Làm lại/clone reset đã có; Quay lại và khôi phục nháp mới còn thiếu.                              |
| 4.10. Ví dụ một lần gửi hoàn chỉnh                 | EXISTING   | requests.ts, guide.ts                                | Tạo yêu cầu own fixtures, file Unicode/PNG, tìm mã và mở lại.                                     |
| 5.1. Sao chép tạo ra điều gì?                      | ADDED      | requests.ts (cloneReset), guide.ts                   | Sau tạo bản sao kiểm tra ticket nguồn giữ nội dung.                                               |
| 5.2. Thực hiện từng bước                           | ADDED      | requests.ts (cloneReset), guide.ts                   | Gửi bản sao thật có hai dòng Excel, mã khác nguồn, đọc lại và hủy bản thử.                        |
| 5.3. Nếu không sao chép được hoặc muốn làm lại     | PARTIAL    | requests.ts (cloneReset), guide.ts                   | Clone reset + regression danh mục khóa; chưa loại nguồn bị thay đổi cấu trúc.                     |
| 6.1. Mở chi tiết và đọc đúng tab                   | EXISTING   | requests.ts, ticket-actions.ts                       | Bốn tab và attachment preview.                                                                    |
| 6.2. Phê duyệt từng bước                           | PARTIAL    | requests.ts, ticket-actions.ts                       | Approve/cancel confirmation đã chạy; chưa xác nhận own mã chuyển hai danh sách duyệt.             |
| 6.3. Khi chưa đồng ý nội dung                      | EXISTING   | requests.ts, ticket-actions.ts                       | Trao đổi và Hủy đúng own ticket; không có hành động từ chối riêng.                                |
| 6.4. Xem lại sau duyệt                             | PARTIAL    | requests.ts, ticket-actions.ts                       | Có trạng thái/history tabs; chưa assert own mã trong Đã phê duyệt.                                |
| 6.5. Không còn nút Phê duyệt                       | PARTIAL    | requests.ts, ticket-actions.ts                       | Nút thay đổi theo trạng thái đã có; Tải lại yêu cầu sau đồng thời đổi trạng thái chưa chạy.       |
| 7.1. Hiểu trạng thái và nút hành động              | EXISTING   | ticket-actions.ts, hr.ts                             | Lifecycle approve/receive/complete/reprocess/close/cancel, không giả định thứ tự mọi ticket.      |
| 7.2. Tiếp nhận                                     | EXISTING   | ticket-actions.ts, hr.ts                             | Nhận việc primary và own secondary.                                                               |
| 7.3. Phân công – Thêm người xử lý                  | EXISTING   | ticket-actions.ts, hr.ts                             | Thêm own handler, required, đọc danh sách.                                                        |
| 7.4. Phân công – Thay đổi người xử lý              | EXISTING   | ticket-actions.ts, hr.ts                             | Thay handler giữa primary và own user, lý do.                                                     |
| 7.5. Phân công – Xóa người xử lý                   | PARTIAL    | ticket-actions.ts, hr.ts                             | Xóa own handler/lý do; nhánh gỡ hết/thay thế và retry nhiều bước chưa đủ.                         |
| 7.6. Cập nhật kết quả vào biểu mẫu                 | EXISTING   | ticket-actions.ts, hr.ts                             | Processing section edit/cancel/save/reopen đã PASS ở regression04.                                |
| 7.7. Hoàn thành và chuyển tiếp                     | EXISTING   | ticket-actions.ts, hr.ts                             | Chuyển tiếp và hoàn thành từng handler; từ chối xử lý lại có lý do.                               |
| 7.8. Đóng, xử lý lại và hủy                        | EXISTING   | ticket-actions.ts, hr.ts                             | Xử lý lại trước Đóng, closed terminal; Hủy có lý do + PDF riêng.                                  |
| 7.9. Đổi ngày mong muốn                            | KNOWN FAIL | ticket-actions.ts, hr.ts                             | Click thường bị overlay chặn; giữ lỗi, không force click.                                         |
| 7.10. Chuyển trạng thái ticket theo mã             | PARTIAL    | ticket-actions.ts, hr.ts                             | Đổi trạng thái own HR sang Hủy và đọc lại; vị trí hiển thị lý do chưa xác nhận.                   |
| 8.1. Gửi phản hồi mới                              | ADDED      | requests.ts, guide.ts                                | @ own username qua Arrow/Enter không gửi sớm, gửi và mở lại.                                      |
| 8.2. Trả lời và chỉnh sửa                          | PARTIAL    | requests.ts, guide.ts                                | Reply/edit/save đã có; edit giữ/bỏ file cũ và cancel edit chưa đủ.                                |
| 8.3. Xem và tải tệp                                | PARTIAL    | requests.ts, guide.ts                                | Ảnh đã load thật; chưa đối chiếu byte mọi định dạng download/file ghi chú HR.                     |
| 8.4. Đọc lịch sử                                   | PARTIAL    | requests.ts, guide.ts                                | Tab Lịch sử đã mở; chưa assert actor/thời gian từng hành động.                                    |
| 9.1. Phân biệt hai trang                           | EXISTING   | secondary.ts (reports)                               | Tách report dashboard/export đúng route.                                                          |
| 9.2. Xem báo cáo                                   | EXISTING   | secondary.ts (reports)                               | Range invalid/valid, group, render kết quả.                                                       |
| 9.3. Truy xuất và xuất Excel                       | PARTIAL    | secondary.ts (reports)                               | Download ZIP magic đúng; chưa parse các giá trị từng ô/export so bộ lọc.                          |
| 9.4. Nếu chưa xuất được                            | NOT RUN    | secondary.ts (reports)                               | Chưa tạo lỗi download thật để kiểm tra retry; không giả lập backend response.                     |
| 10.1. Xem và cập nhật yêu cầu tuyển dụng           | KNOWN FAIL | hr.ts, secondary.ts (recruitment)                    | Số lượng/note lưu rồi reopen stale UI so với phản hồi quan sát.                                   |
| 10.2. Thêm ứng viên vào đúng yêu cầu               | PARTIAL    | hr.ts, secondary.ts (recruitment)                    | Tạo own candidate/địa chỉ/CV/phone; các biên email, birthday, 150/151 còn thiếu.                  |
| 10.3. Tìm ứng viên và mở thao tác                  | KNOWN FAIL | hr.ts, secondary.ts (recruitment)                    | Candidate empty search HTTP500; reset finally để không cascade.                                   |
| 10.4. Sửa hồ sơ và chuyển trạng thái               | KNOWN FAIL | hr.ts, secondary.ts (recruitment)                    | Candidate reopen stale; chưa chứng minh giữ status/owner sau edit.                                |
| 10.5. Ghi chú phỏng vấn và lịch sử                 | PARTIAL    | hr.ts, secondary.ts (recruitment)                    | Ghi chú + PDF/history đã chạy; file-only, giới hạn50MB và download chưa đủ.                       |
| 10.6. Kiểm tra hồ sơ trùng                         | EXISTING   | hr.ts, secondary.ts (recruitment)                    | Mở duplicate lookup, chỉ đọc không xóa hồ sơ thật.                                                |
| 10.7. Phân biệt xóa tệp, xóa hồ sơ và bỏ khỏi lịch | KNOWN FAIL | hr.ts, secondary.ts (recruitment)                    | Xóa CV, bỏ lịch PASS; xóa hồ sơ chưa xác minh vắng mặt vì empty-search500.                        |
| 10.8. Xuất danh sách                               | PARTIAL    | hr.ts, secondary.ts (recruitment)                    | UI download; chưa đối chiếu từng ô với filter.                                                    |
| 11.1. Xem lịch và chuyển thời gian                 | PARTIAL    | hr.ts, secondary.ts, guide.ts                        | Month/week/day/today/prev/next đã có; lọc nhiều interviewer chưa đủ.                              |
| 11.2. Tạo lịch phỏng vấn                           | PARTIAL    | hr.ts, secondary.ts, guide.ts                        | Required/time invalid + tạo; chưa đủ title5/50, note255, quá khứ, nhiều interviewer.              |
| 11.3. Sửa và xóa lịch                              | PARTIAL    | hr.ts, secondary.ts, guide.ts                        | Create/edit/reopen/delete PASS; chuyển ngày và tìm ở ngày cũ/mới chưa đủ.                         |
| 11.4. Gắn ứng viên vào lịch có sẵn                 | PARTIAL    | hr.ts, secondary.ts, guide.ts                        | Bulk attach own candidate PASS; nhánh row-attach/đổi ngày reset lịch chưa đủ.                     |
| 11.5. Đặt giờ riêng và bỏ ứng viên khỏi lịch       | PARTIAL    | hr.ts, secondary.ts, guide.ts                        | Đặt giờ invalid/valid, profile, remove PASS; candidate status/note ngay trên detail chưa đủ.      |
| 11.6. Báo cáo tuyển dụng                           | ADDED      | hr.ts, secondary.ts, guide.ts                        | Required hai ngày, đảo ngày, hơn6tháng, recover; tabs/export đã có.                               |
| 12.1. Nguyên tắc cập nhật                          | EXISTING   | settings.ts, session.ts, guide.ts                    | Chỉ own TESTFE fixtures, khóa theo phụ thuộc; không sửa shared HR.                                |
| 12.2. Thêm/sửa bản ghi từng bước                   | EXISTING   | settings.ts, session.ts, guide.ts                    | Create/update/reopen/cancel/lock7 danh mục.                                                       |
| 12.3. Người dùng và ý nghĩa trường nhập            | PARTIAL    | settings.ts, session.ts, guide.ts                    | Own user/immutable MSNV + login; thu hồi additional group quyền chưa chứng minh.                  |
| 12.4. Bộ phận sử dụng và Team                      | PARTIAL    | settings.ts, session.ts, guide.ts                    | Dept max30/team relation/create selection; đổi dept reset team chưa đủ.                           |
| 12.5. Bộ phận xử lý và bàn giao                    | EXISTING   | settings.ts, session.ts, guide.ts                    | Own manager/member + ticket reassignment; không giả định tự bàn giao.                             |
| 12.6. Loại yêu cầu và tài liệu của loại            | ADDED      | settings.ts, session.ts, guide.ts                    | Sai file/PDF upload/reopen và manual link trong create.                                           |
| 12.7. Chức vụ và quyền hạn                         | PARTIAL    | settings.ts, session.ts, guide.ts                    | Own position permissions + popup responsive; mọi quyền/ngừng cấp mới chưa đủ.                     |
| 12.8. Văn phòng và xuất người dùng                 | ADDED      | settings.ts, session.ts, guide.ts                    | Own office CRUD + export own user; không sửa ngày hệ thống.                                       |
| 13.1. Mở đúng biểu mẫu                             | EXISTING   | settings.ts, ticket-actions.ts, requests.ts          | Mở own template và lưu.                                                                           |
| 13.2. Chia phần thông tin theo công việc           | PARTIAL    | settings.ts, ticket-actions.ts, requests.ts          | Thêm phần/trường, processing hidden; chưa rename trùng/reorder/delete đủ.                         |
| 13.3. Tên trường và kiểu dữ liệu                   | PARTIAL    | settings.ts, ticket-actions.ts, requests.ts          | Text/numberzero; live date/range/options/width chưa đủ.                                           |
| 13.4. Phân biệt lựa chọn về nhập và hiển thị       | PARTIAL    | settings.ts, ticket-actions.ts, requests.ts          | Required/create visibility/handling PASS; confidentiality theo hai vai trò chưa đủ.               |
| 13.5. Danh sách lựa chọn và điều kiện ngày         | NOT RUN    | settings.ts, ticket-actions.ts, requests.ts          | Live options/date comparisons/self-reference/cycle trên own template chưa có.                     |
| 13.6. Kiểm tra trước khi áp dụng                   | PARTIAL    | settings.ts, ticket-actions.ts, requests.ts          | Template→create→Excel→processing đã có; private-field role visibility chưa đủ.                    |
| 14.1. Mở menu và nhận diện icon                    | EXISTING   | harness.ts (responsive), navigation.ts, secondary.ts | Mobile navigation + responsive ba kích thước.                                                     |
| 14.2. Áp dụng và hủy lọc                           | PARTIAL    | harness.ts (responsive), navigation.ts, secondary.ts | Mobile drawer/cancel/calendar; applied multi-filter chưa đủ.                                      |
| 14.3. Form và bảng nhiều cột                       | PARTIAL    | harness.ts (responsive), navigation.ts, secondary.ts | Overflow/form responsiveness; chưa touch drag/upload picker trên thiết bị thật.                   |
| 14.4. Đọc hướng dẫn trên điện thoại                | ADDED      | harness.ts (responsive), navigation.ts, secondary.ts | Đủ15chương, next/previous và disabled boundaries, mobile selector, Word download.                 |
| 15.1. Xử lý theo dấu hiệu đang thấy                | PARTIAL    | auth.ts, requests.ts, hr.ts, guide.ts                | Required/permission/noresults thực tế; không phải mọi lỗi mạng/đồng thời.                         |
| 15.2. Giới hạn thường gặp                          | PARTIAL    | auth.ts, requests.ts, hr.ts, guide.ts                | Thêm title/notes/dates/report ranges; 50MB/file và mọi candidate/interview boundary chưa đủ.      |
| 15.3. Xác nhận đã lưu hay chưa trước khi gửi lại   | NOT RUN    | auth.ts, requests.ts, hr.ts, guide.ts                | Upload partial-failure/retry có đúng một ticket chưa tái hiện continuous live session.            |
| 15.4. Checklist trước khi gửi yêu cầu              | EXISTING   | auth.ts, requests.ts, hr.ts, guide.ts                | Controlled request + clone đọc lại mã/rows/files.                                                 |
| 15.5. Gửi gì cho người hỗ trợ?                     | MANUAL     | auth.ts, requests.ts, hr.ts, guide.ts                | Quy trình báo hỗ trợ của người dùng; evidence E2E có route/case/thời gian, không gửi tin tự động. |
