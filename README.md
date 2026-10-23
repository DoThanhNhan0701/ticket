# Rainscales Ticket

Rainscales Ticket is an internal ticket workspace built with React 19, TypeScript, Vite, Tailwind CSS, React Router, TanStack Query, React Hook Form and Zod.

The theme preference is stored independently under `ticket-theme` in local storage.

Session cookies use the `Secure` flag on HTTPS. Cached account data is validated before it can populate the interface or sidebar permissions.

After sign-in, the application opens the first navigation page permitted for the account. Accounts with `can_view` start at `Danh sách yêu cầu` (`/requests`); task/report-only accounts start at `/tasks/mine`. The protected `/` route, unknown URLs and header logo use the same permission-aware destination. Create-only accounts can start at `/requests/new`; accounts without any eligible destination retain the access-denied screen. The current source includes a responsive sidebar based on `ticketV2`, Rainscales account sign-in, request/approval/task lists, ticket status changes, reports and Excel exports, themes, shared components, branding, API configuration and Docker deployment. Remaining destinations currently have page shells; their forms, lists and API integrations are not implemented yet.

Frontend domain: `https://ticket-new.aiminds.io.vn/`.

API domain: `https://ticket-api.aiminds.io.vn`. API requests use the `/api` prefix, for example `https://ticket-api.aiminds.io.vn/api/token/`.

## Development

Use Node.js 20.19+ on the Node 20 release line, or Node.js 22.12+.

```bash
npm ci
npm run dev
```

Yarn is also supported through `yarn.lock`. Use one package manager consistently and update both lockfiles when changing dependencies.

The development server polls for file changes every 300 ms to avoid Linux `ENOSPC` file-watcher limits. Hot reload remains enabled; polling may use more CPU than native file watching.

The development server proxies `/api` and `/media` to the backend configured in `vite.config.ts`. Set `VITE_API_BASE_URL` in `.env.local` when using a different backend host. Vite environment variables are included in the browser bundle; credentials belong in the server or CI environment.

The `/api` prefix is defined in `src/lib/api/api-base-url.ts` and added by the shared HTTP client. Configure only the backend host in `.env.local`.

Login follows the `ticketV2` API contract: `POST /api/token/` with JSON `{ "username": "...", "password": "..." }` returns `{ "access": "...", "refresh": "..." }`. The application stores these tokens in Ticket-specific cookies and uses `Authorization: Bearer <access>` for authenticated requests.

After sign-in and on page reload, `GET /api/list_permission/` loads the account and permissions. The `infoUser` tuple supplies the user ID, name and avatar; `userPermission` and `handlingPermission` supply the permission flags. Sign-in completes after account information loads. Signing out removes the Ticket session and query cache. Existing Homepage sessions are separate; sign in again after switching to this authentication flow. If localStorage is blocked or full, login and logout still work using the in-memory account and session cookies; account information is reloaded from the API on the next visit.

When a protected request receives `401` or an explicit `token_not_valid` error, the client posts `{ "refresh": "..." }` to `/api/token/refresh/` and retries the request once. Concurrent requests share one refresh. If the server returns a rotated refresh token, it replaces the saved one. A missing access cookie can also be recovered using the refresh cookie. Rejected refresh credentials or a second authentication failure end the session.

Network errors, ordinary `403` permission errors and temporary server errors preserve an existing session. During account restoration, cached account information remains available if reloading permissions fails temporarily. Signing out invalidates pending requests so a late refresh response cannot restore the session.

Restart the development server after changing `.env.local`; rebuild deployed bundles when their API configuration changes.

## Request list

`/requests` (formerly `/danhsachyeucau`) follows the `ticketV2` API contract:

- `GET /api/list_ticket/` returns `{ "count": 25, "results": [...] }`. The page always sends `typeView=create`, with defaults `page=1`, `page_size=100`, `columnSort=id` and `typeSort=descend`.
- `GET /api/list_ticketstatus/` returns `{ "results": [{ "id": 1, "name": "..." }] }`. Status filtering sends the status **name** as `ticket_status_name`; submitting all statuses omits it. The status Select sits beside the keyword input without a visible label and retains an accessible name. Both controls are drafts: clicking `Tìm kiếm` or submitting with Enter applies them together. Changing status or clearing the keyword alone does not fetch the list.
- Every implemented status selector uses the shared searchable Select, including request lists, approval lists, task lists and the change-status form. Searching ignores case and accents. In list toolbars, searching or selecting an option remains a draft until submitting `Tìm kiếm`; API names/IDs and page scopes stay unchanged. Reusable `DataSearch` filters enable this with `searchable: true`.
- Quick search sends trimmed `searchAll`, clears advanced fields and preserves the selected status. Advanced fields are `ticket_code`, `ticket_type_name`, `title`, `vanphong_name`, `duedate` (`YYYY-MM-DD`), `approve_user_name` and `updating_user_name`. Clicking `Lọc nâng cao` opens a drawer on the right with scrollable fields and fixed actions. Applying or clearing filters closes it. Closing it with the close button, Escape or backdrop discards unapplied edits and returns focus to the trigger; saved URL filters do not open the drawer automatically.
- Pagination runs on the server. Page sizes are 100 and 200, with a default of 100. Changing filters or page size resets to page 1. Changing pages, sizes or applied filters returns the table's vertical scroll to the top while preserving its horizontal position and mounted rows under the loading overlay. Background refreshes of the same list keep its scroll position. Filters and pagination live in the URL, allowing reloads, bookmarks and browser Back to restore them. Column sorting is disabled; requests always send the backend's required `columnSort=id` and `typeSort=descend`, ignoring old sort parameters in bookmarked URLs.

The workspace uses its full available width. The table shows the request code, type, title, Department, Team, office, due date, approver, status and last updater. Department and Team headers and cells are centered. Every cell displays at most two lines with an ellipsis and its full text in the browser's native `title` tooltip. The status and page-size controls use the shared shadcn Select. Its focusable scroll region supports horizontal and vertical scrolling, with a sticky header and pagination outside the scrolling rows. Request links open `/tickets/:ticketID`. Loading, empty results and API errors have separate states; failed requests can be retried. Failure to load status options does not block the list. Requests use the shared authenticated client and its token refresh behavior. Accounts without list access do not fetch data.

`/requests/all` (formerly `/tatcayeucau`) reuses the same list components and requires `can_allticket`:

- `GET /api/list_ticket_all_SupAD/` is the endpoint used by the actual `ticketV2` route. Its default all-records view omits `typeView`. The toolbar shows search, status and advanced filters. Saved URLs can still include `typeView=processing`, `handle`, `accepted` or `received`; clearing all filters removes that parameter.
- The status Select submits the actual numeric status ID as `ticket_status`, omitting it for all statuses. Status ID 1 is excluded from its options, matching V2. Advanced filters replace `ticket_type_name` with `ticket_type_id` and `approve_user_name` with `list_user_received`; the remaining fields and date format are shared.
- `GET /api/list_handling_alltickettype/` supplies a validated array of request types. The shared drawer Select displays the handling group and type name, and sends the type **ID**. Its search input filters names and groups without distinguishing case or accents; typing and selecting remain drafts until applying the drawer. Keyboard selection, an empty-results message and Escape dismissal are supported. Sending the type name, as the older UI did, returns no matching records on the current backend. A failed lookup can be retried without blocking ticket results.
- The table follows V2's all-request columns: row number, code, type, title, office, due date, handler, status and updater. Search, the filter drawer, 100/200 page sizes, loading overlay, empty/error states and row navigation are shared with `/requests`. Query caches are separated by account and list scope; navigating between the two lists cannot show the other list's previous rows.

`/approvals/pending` (formerly `/chopheduyet`) and `/approvals/approved` (formerly `/dapheduyet`) require `can_accept`. Both reuse the request-list components and validated `GET /api/list_ticket/` response. Pending approvals always send `typeView=pendingAccept`; approved requests always send `typeView=accepted`. URL parameters cannot override these page scopes.

The approval tables follow V2's columns: row number, code, type, title, office, due date, requester (`username_create`), status and updater. Advanced filters use `username_create` instead of the personal list's approver filter; request types remain text filters using `ticket_type_name`. Status filters send names as `ticket_status_name`. Approved-status options exclude ID 1, matching V2; pending-status options retain it. Search drafts, the filter drawer, 100/200 pagination, row links, loading overlay, table scroll reset, empty/error recovery and account-scoped caches are shared across the implemented lists. Unauthorized accounts do not fetch approval records or lookup options.

`/tasks/mine` (formerly `/danhsachxulycanhan`) and `/tasks` (formerly `/danhsachxuly`) require `can_process`:

- Personal tasks use `GET /api/list_ticket_personal/`; all tasks use `GET /api/list_ticket_all/`. Both default to all records without `typeView`. The drawer's searchable `Nhóm nhiệm vụ` selector sends the supported `processing`, `handle`, `accepted` or `received` views without adding toolbar tabs. Ordering and 100/200 pagination follow the shared list behavior.
- Both tables include Department, Team and creation date. Personal tasks show the approver; all tasks show the handler. Status filters send actual IDs as `ticket_status` and exclude ID 1. Type options come from the separately cached `GET /api/list_handling_tickettype/`: personal tasks submit `ticket_type_name`, while all tasks submit `ticket_type_id`, matching V2.
- Personal and all-task rows use a soft red background adapted to the light/dark theme, following V2's rule: highlight when the due timestamp is at or before the current time and status is not 4, 5 or 7. A date-only deadline starts at local midnight, so tickets due today also qualify. Invalid dates stay unhighlighted; hovering retains the red background.
- The drawer supports `bophansudung_name`, multiple `team_id` values from validated `GET /api/list_team/`, and `created_from`/`created_to` dates. Team selections use the shared multi-select and serialize as comma-separated IDs; dates use the shared date picker and serialize as `YYYY-MM-DD`. All tasks additionally provide the `Được gắn thẻ` filter. Its URL value `type_option=0` is sent to the API as `type_option[]=0`, matching V2's Axios array serialization; the unbracketed API parameter is ignored by the backend.
- Quick search preserves the selected task view, status and tagged scope while clearing other advanced fields. Clearing filters returns to the default all-records view. Applied filters, paging and sizes remain in the URL; Back restores team selections and creation dates. Lookup errors can be retried independently without blocking task results. Task caches are isolated from each other and from request/approval lists; unauthorized accounts fetch neither records nor lookups.

React StrictMode is disabled at the application entry point, so development does not run its additional effect setup/cleanup cycle. Request cancellation remains enabled: changing search parameters aborts the obsolete query, and its late response cannot replace the latest results. Regression tests also exercise StrictMode explicitly to verify that cancellation preserves the authentication session.

Vite pre-bundles `@hookform/resolvers/zod`, `react-hook-form` and `zod` explicitly for lazy routes. The dev server uses `node_modules/.vite-dev`, and Vitest uses `node_modules/.vite-test`. Auxiliary `createServer` calls must set their own `cacheDir` and disable client dependency discovery when only loading SSR fixtures. Sharing the dev cache can invalidate module hashes for browsers that are already open. For an `Outdated Optimize Dep` response, reload the page after optimization finishes; `npm run dev -- --force` rebuilds dependencies when restarting is needed. A failed lazy import now shows a recovery screen with `Tải lại trang`, preserving the current URL and session when reloading.

Below 640px, the keyword spans the full toolbar width; the status, search and advanced-filter controls align on the second row. Wider screens keep the toolbar on one row when space allows; extra actions wrap instead of being clipped. Pagination keeps the range, page-size select and previous/page/next controls on one row at every width. Long range text truncates with an ellipsis and exposes its full text in the browser's native tooltip. Below 400px the selected size omits its visible unit while retaining its accessible label. Both mobile and desktop display a static page counter between the previous and next buttons. Page headers and their actions are 40px high; drawer close buttons and paging arrows provide 44px touch targets on mobile. The request results use a smaller minimum height on narrow screens so the table and pager fit shorter viewports; landscape screens can scroll the main content when needed.

## Change ticket status

`/requests/change-status` (formerly `/change_status`) requires `can_return_ticket`. The form uses the shared input, Select, async button and alert components. It loads `GET /api/list_ticketstatus/`, excluding status ID 1 as in `ticketV2`, and requires a ticket code and a selected status. The reason is optional. Missing, failed or empty status options block updates and can be retried when loading fails.

Submitting sends `POST /api/change_status_ticket/` with JSON fields `ticket_code` (trimmed string), `ticket_status_id` (numeric ID) and `lydohuyyeucau` (trimmed string, empty when omitted). The backend accepts JSON as well as V2's form-data. Its response is `{ "message": "...", "error": "..." }`; a nonempty `error` is a failed update even with HTTP 200. Responses are validated before displaying a result. Inputs remain available after errors so the user can correct them and retry; pending updates disable editing and duplicate submissions. Successful updates invalidate both request-list caches. The operation records status history and does not send email, matching V2's description.

## Reports and data export

`/reports` requires `can_report`; `/reports/export` (formerly `/export_data`) requires `can_export`. Both load active handling groups through validated `GET /api/list_handling_group/` with `columnSort=id`, `typeSort=ascend`, `is_active=true`, `page_size=1000` and `page=1`.

Both report pages initially leave the handling group unselected. The dashboard defaults to the preceding seven days through today and loads a report only after choosing a group and clicking `Tra cứu`; the export page loads request types only after a group is selected. Clicking `Tra cứu` applies draft dates and group together; submitting the same criteria refreshes the report. `POST /api/report` receives multipart fields `startdate`, `enddate` (`YYYY-MM-DD`) and `handlinggroup`. Its four validated datasets drive summary cards, responsibility shares, on-time rates and request-type rates. Clicking a summary opens a dialog with `/tickets/:id` links. The charts use CSS and SVG without additional chart dependencies. Empty datasets have explicit states; changing filters keeps existing charts under a loading overlay, and failed lookups/reports can be retried.

Dashboard `Xuất Excel` sends the current valid draft filters to `POST /api/export_excel`, so users can export a selected range directly. The data-export page loads `GET /api/list_tickettype/` using `handling_group`, `page_size=1000` and `page=1`. Its searchable type selector includes active types for the selected group and `All`. Changing group clears the old type and loads a separately cached lookup. Export submits multipart `from_date`, `to_date`, `ticket_type_id` and `bophanxuly_id` to `POST /api/export_ticket_type`. Both forms validate required fields, dates, date order and group/type membership before sending requests; pending exports block duplicate submission.

The dashboard exposes all active groups, matching V2. Data export is restricted to groups whose `is_manager` equals the signed-in user's ID. The `AD` handling permission enables all active export groups; this is normalized into the cached `can_report_all_groups` permission. Django superuser flags do not expand export scope. Accounts without exportable groups do not load type options or generate files. Lookups and report caches include account IDs.

The authenticated client supports native `FormData` and binary responses while preserving token refresh, cancellation and session-version checks. It lets the browser set multipart boundaries and still parses JSON authentication failures during an Excel request. Successful spreadsheets must be nonempty blobs with an accepted spreadsheet/ZIP MIME type. HTTP 200 JSON no-data responses display a message instead of downloading a JSON file. The shared download helper sanitizes filenames, removes its temporary anchor and revokes the object URL after starting the download.

## System settings

The seven `/settings/*` pages require only `can_system`. `/settings` opens the user list, and legacy paths redirect to English URLs. Lists use the shared table, 100/200 pagination, search, searchable status selectors and form fields. Search applies on submission; paging resets table scroll. Empty results hide pagination, and loading preserves previous results beneath an overlay.

| Page                               | Read API                                | Create/update API                                               |
| ---------------------------------- | --------------------------------------- | --------------------------------------------------------------- |
| `/settings/users`                  | `/api/list_user_v2/` (array)            | `/api/usermmanager/`, `/api/usermmanager/:id`                   |
| `/settings/requesting-departments` | `/api/list_bophan_sudung/` (paginated)  | `/api/bophanmmanager/`, `/api/bophanmmanager/:id`               |
| `/settings/handling-departments`   | `/api/list_handling_group/` (paginated) | `/api/handlinggroupmmanager/`, `/api/handlinggroupmmanager/:id` |
| `/settings/request-types`          | `/api/list_ticket_type/` (paginated)    | `/api/tickettypemmanager/`, `/api/tickettypemmanager/:id`       |
| `/settings/teams`                  | `/api/list_team/` (array)               | `/api/teammanager/`, `/api/teammanager/:id`                     |
| `/settings/positions`              | `/api/list_chucvu/` (array)             | `/api/chucvumanager/`, `/api/chucvumanager/:id`                 |
| `/settings/offices`                | `/api/list_vanphong/` (array)           | `/api/vanphongmanager/`, `/api/vanphongmanager/:id`             |

Array responses are searched, filtered and paginated locally. Paginated endpoints receive `search`, `is_active`, `page` and `page_size`. Related names come from validated lookups, including all pages of large catalogs. Existing inactive selections remain visible while editing. POST and PUT use V2's JSON or multipart fields. User edits preserve the superuser flag and employee code. Handling groups support manager, members, description and email; positions load permission IDs from `/api/list_position_permission/`. Permission names use shared Vietnamese labels in the positions table and editor while preserving the original IDs in API payloads. `Thông tin quyền hạn`, beside `Thêm mới`, explains the loaded permissions using the same labels and supports lookup retries. The unused website permissions `can_search` and `can_delete` are retired from new assignments. Existing grants remain visible as `Ngừng cấp mới` and are preserved unless explicitly removed; form validation rejects new retired grants. The help dialog explains their status. This is a frontend assignment policy; backend definitions and existing accounts are not deleted. Unknown permission names retain their server-provided text. User export uses `/api/export_user` and the shared spreadsheet validator. Pending saves prevent duplicate submissions and dismissal; errors retain the form for correction. Successful changes invalidate affected lists/lookups and refresh account permissions when users or positions change.

Request types accept optional PDF guidance; omitting an upload preserves the existing file. Metadata saves leave templates untouched. The separate `Biểu mẫu` action reads `/api/template_form/:id` and supports sections, field ordering, required/handling/visibility flags, text/number/date/range-date types, choices, widths and date comparisons. Existing template properties are retained. Template saves read the form back and confirm the submitted values before closing the editor. New templates POST to `/api/template_form/`; existing ones PUT to `/api/template_form/:id` with `ticket_type`, `data_form.forms`, `user`, `mota` and `ghichu`. Missing templates and failed lookups have explicit states and retry controls. V2's activate/lock workflow is retained.

Real-data permission QC uses `tests/browser/ticket-permission-profiles.cjs` with `smoke`, `create` and read-only `verify` modes. Supply `{ "admin": { "username": "...", "password": "..." }, "testPassword": "..." }` through stdin; configure `BASE_URL`, `PLAYWRIGHT_MODULE` and `BROWSER_EXECUTABLE` for the browser environment. The runner creates isolated TEST department/team and positions for each assignable permission in the live catalog plus no-permission/all-assignable-permission controls. The stored 13-account report records the original run before `can_search` and `can_delete` were retired; its existing grants are retained. It reuses exact TEST names on resume, verifies the default password, compares actual permissions/sidebar links, and checks all 26 protected page URLs without creating tickets or editing existing users. JSON results are saved to `tests/artifacts/ticket-permission-profiles.json`; `tests/browser/ticket-permission-profiles-report.cjs` exports the account CSV. Credentials are excluded from both artifacts. Page access and the API's separate ticket/data-scope checks are reported independently.

## API contracts

Active JSON API responses enter as `unknown` and pass Zod validation before application code uses them. Response types are inferred from those schemas so runtime validation and TypeScript declarations stay together. Spreadsheet responses are validated as nonempty blobs with accepted MIME types. The contracts were checked against the Ticket backend; credentials and tokens are not stored in source.

| Endpoint                                | Contract                                                                                                         |
| --------------------------------------- | ---------------------------------------------------------------------------------------------------------------- |
| `POST /api/token/`                      | String `access` and `refresh` tokens                                                                             |
| `POST /api/token/refresh/`              | String `access`, optional rotated `refresh`                                                                      |
| `GET /api/list_permission/`             | Typed `infoUser` tuple, permission flags, handling-permission arrays and configuration lists                     |
| `GET /api/list_ticket/`                 | Integer `count`, nullable `next`/`previous`, full ticket-list records with numeric IDs and team objects          |
| `GET /api/list_ticket_all_SupAD/`       | Same validated ticket-list envelope, across all accessible requests                                              |
| `GET /api/list_ticket_personal/`        | Same validated ticket-list envelope for personal handling tasks                                                  |
| `GET /api/list_ticket_all/`             | Same validated ticket-list envelope for tasks accessible to the handling account                                 |
| `GET /api/list_ticketstatus/`           | Same pagination envelope, full status records including colors, timestamps and `is_active`                       |
| `GET /api/list_handling_alltickettype/` | Array of request types with numeric IDs, handling group, names, nullable file fields, active flag and timestamps |
| `GET /api/list_handling_tickettype/`    | Same validated type array, restricted to the account's handling types                                            |
| `GET /api/list_team/`                   | Array of teams with numeric IDs, nullable Department ID, active/handling flags and timestamps                    |
| `POST /api/change_status_ticket/`       | String `message` and `error`; nonempty business error fails the mutation even with HTTP 200                      |
| `GET /api/list_handling_group/`         | Paginated handling groups with numeric IDs, nullable manager ID, member IDs, active flag and timestamps          |
| `GET /api/list_tickettype/`             | Paginated request-type records scoped to the selected handling group                                             |
| `POST /api/report`                      | Four dictionaries: summary counts/code-ID pairs, shares, and percentage/count/total tuples                       |
| `POST /api/export_excel`                | Validated binary spreadsheet for the report range and group                                                      |
| `POST /api/export_ticket_type`          | Validated binary spreadsheet, or JSON status when no data is available                                           |

Missing related Department, cancellation-user and customer display names are optional; nullable foreign keys and timestamps remain explicitly nullable. The list serializer returns `list_user_received` as a string. It must not be confused with the ticket-detail response. Malformed nested fields produce a handled API error instead of reaching the UI. The unused Homepage `/list-project` lookup was removed because it does not exist on the Ticket backend.

The create-request and ticket-detail APIs are implemented. `/requests/new` loads active catalogs and the selected type's current template, validates visible creation fields, supports multiple rows and Excel import/export, and uploads attachments after creation. Upload retries retain the created ticket ID and send only remaining files.

Create validation starts on the first submit and then updates as values change. General fields, detail rows and active catalog selections use the same resolver. Date comparisons and both range endpoints revalidate together, including copied, added, deleted and imported rows. Switching group/type removes the previous template's errors; starting over also resets the validation state. Attachments above 50 MB are rejected before creating a ticket, and removing them clears the error. `tests/browser/ticket-create-validation.cjs` exercises these transitions through the browser against the real API and records creation, upload, readback and cancellation of a TEST ticket in `tests/artifacts/ticket-create-validation.json`. It uses the same stdin credentials and browser environment variables as the clone regression below.

Existing templates normalize labels and options when loaded. Creation validates the sections enabled for the requester; blank or repeated labels in later processing sections remain preserved for legacy templates. Saving template configuration still enforces the full template's uniqueness and date rules.

The create-only catalog QC suite is `tests/browser/ticket-create-catalog.cjs inventory` followed by `run`. It discovers handling groups and request types through the UI, enters five rows for each type with creation details, creates TEST tickets and reopens them from the list. The report checkpoints ticket IDs so resuming does not create duplicates. `ticket-create-catalog-readback.cjs` searches and opens each created ticket through the UI and compares every displayed detail cell with the entered values. `ticket-create-catalog-report.cjs` merges the outcomes into `tests/artifacts/ticket-create-catalog.csv` and JSON. These catalog runners use no direct API calls or injected form state; they only observe responses caused by browser actions. They leave the created tickets in their initial status and retain screenshots under `/tmp/<report prefix>/`.

Shared form labels, text inputs and validation errors truncate long text with an ellipsis and retain the full text in native tooltips. Password values are excluded from tooltips. Required date ranges flag both missing endpoints, flag an invalid/missing end at its own input, and allow equal start/end dates. The live browser regression in `tests/browser/ticket-clone-dates.cjs` checks clone `14134` using real API data, creates and reads back a TEST ticket, then cancels that TEST ticket through the UI. Supply `{ "username": "...", "password": "..." }` through stdin and configure `BASE_URL`, `PLAYWRIGHT_MODULE` and `BROWSER_EXECUTABLE`; the report is `tests/artifacts/ticket-clone-dates.json`.

`/requests/:ticketID` loads `/api/ticket_manager/:id` and provides URL-persisted general, detail, discussion and history tabs. API-provided `list_button` controls approval, receipt, assignment (add/change/remove), completion, forwarding, cancellation, reprocessing and closing. Reasons and replacement users are validated before submission. Multi-step operations resume from the last confirmed step after an error.

General information supports extending the due date through `/api/update_duedate/` in statuses 1, 2, 3 and 6, and uploading additional attachments in statuses 2, 3 and 6. It displays each handler's processing status and saved reasons. Later template sections can be edited in statuses 2, 3 and 6 according to creator/processor field permissions; sections completed during creation remain read-only. Discussion supports mentions, attachments, replies and editing owned comments/replies, including removing old files. History loads on demand from `/api/list_ticket_history/`.

`Sao chép` checks that the request type is still active, then opens `/requests/new?clone=:id`. The form loads current catalogs/templates and copies matching creation values. The new ticket starts with a fresh due date, processing fields, attachments, discussion and lifecycle. Inactive related selections require correction. Successful detail changes refresh the detail, history, request lists and report caches. Detail/history caches are scoped to the signed-in account. Details reload on entry and window focus, and history reloads when its tab is activated, so another user's updates appear when returning to a ticket. Legacy HTTP-200 access-denied responses are treated as errors.

## Docker

Build and run the production web on port `5174`:

```bash
docker build --pull -t rainscales-ticket:local .
docker run -d --name rainscales-ticket --restart unless-stopped \
  -p 5174:5174 rainscales-ticket:local
```

Open `http://localhost:5174`. The image builds the application with Node.js and serves the generated files with unprivileged Nginx. It includes SPA routing, compressed responses, caching for hashed assets and a health check at `/healthz`.

For `https://ticket-new.aiminds.io.vn/`, configure DNS and an HTTPS reverse proxy to forward requests to this container on port `5174`. The container serves HTTP; configure the TLS certificate at the reverse proxy. Vite also allows `ticket-new.aiminds.io.vn` when forwarding to the development server.

Docker excludes local environment files, including `.env.local`. The browser uses the `/api` prefix defined in source; Nginx proxies `/api` and `/media` to `https://ticket-api.aiminds.io.vn` by default. To use another backend, set `API_UPSTREAM` when starting the container, using its origin only, without a path or trailing slash:

```bash
docker run -d --name rainscales-ticket --restart unless-stopped \
  -p 5174:5174 -e API_UPSTREAM=https://backend.example.com \
  rainscales-ticket:local
```

The backend must be reachable from inside the container. Changing `API_UPSTREAM` requires recreating the container; source changes require rebuilding the image.

## Sidebar and pages

The desktop sidebar supports collapsing to icons. On mobile, the menu button opens a drawer that closes after navigation. Groups can be expanded independently, and the current group opens automatically when visiting a page directly.

| Group               | Pages                                                                              |
| ------------------- | ---------------------------------------------------------------------------------- |
| Yêu cầu             | Danh sách yêu cầu, Tất cả yêu cầu, Chuyển trạng thái ticket                        |
| Danh sách phê duyệt | Chờ phê duyệt, Đã phê duyệt                                                        |
| Nhiệm vụ của tôi    | Nhiệm vụ cá nhân, Tất cả nhiệm vụ                                                  |
| Báo cáo & dữ liệu   | Báo cáo, Truy xuất dữ liệu                                                         |
| Tuyển dụng          | Yêu cầu tuyển dụng, Quản lý ứng viên, Lịch phỏng vấn, Báo cáo tuyển dụng           |
| Cấu hình hệ thống   | Người dùng, Bộ phận sử dụng, Bộ phận xử lý, Loại yêu cầu, Team, Chức vụ, Văn phòng |

`Danh sách yêu cầu` is the preferred destination when the account has `can_view`. Sign-in, the root route, unknown URLs and the header logo use `getDefaultWorkspacePath` to choose the first permitted navigation page, falling back to the create page for create-only accounts. Explicit unauthorized URLs still show access denied. The overview page has been removed. The `Tạo yêu cầu` action appears in the request-list page header, linking to `/requests/new`. The list requires `can_view`; the creation action requires `can_create`. Ticket detail and email-ticket pages also require `can_view`. Page URLs use English paths, with the Vietnamese navigation labels retained. Old `ticketV2` page URLs redirect to their English equivalents, preserving record identifiers, query parameters and URL fragments. Ticket details, requests from email, user creation and interview details also have contextual routes without sidebar links. The public CV form and the old Change Password page are not included.

| Area        | English URLs                                                                                                                                                                      |
| ----------- | --------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Requests    | `/requests`, `/requests/new`, `/requests/all`, `/requests/change-status`                                                                                                          |
| Approvals   | `/approvals/pending`, `/approvals/approved`                                                                                                                                       |
| Tasks       | `/tasks/mine`, `/tasks`                                                                                                                                                           |
| Reports     | `/reports`, `/reports/export`                                                                                                                                                     |
| Recruitment | `/recruitment/requests`, `/recruitment/candidates`, `/recruitment/interviews`, `/recruitment/reports`                                                                             |
| Settings    | `/settings/users`, `/settings/requesting-departments`, `/settings/handling-departments`, `/settings/request-types`, `/settings/teams`, `/settings/positions`, `/settings/offices` |

Contextual URLs are `/tickets/:ticketID`, `/tickets/from-email/:ticketID`, `/settings/users/new` and `/recruitment/interviews/:codeInterview`. Backend API URLs follow the server contract, including `/api/list_permission/`.

`src/app/navigation.ts` defines page metadata and access rules shared by routes and the sidebar. Menu groups are filtered using permissions from `/api/list_permission/`; opening a restricted URL directly shows an access message. Each page declares exactly one required functional permission in `WorkspacePageDefinition.permission`. Django flags (`is_superuser`, `is_staff`, `is_admin`) and `is_system_manage` do not bypass page access. Settings requires `can_system`; switching ticket status requires `can_return_ticket`. Unauthorized pages do not mount their data components or fetch their data. Backend APIs remain responsible for enforcing access to individual records and actions.

| Pages                                        | Required permission                             |
| -------------------------------------------- | ----------------------------------------------- |
| Request list, ticket detail and email ticket | `can_view`                                      |
| Create ticket and copy action                | `can_create`                                    |
| All requests                                 | `can_allticket`                                 |
| Change ticket status                         | `can_return_ticket`                             |
| Pending/approved requests                    | `can_accept`                                    |
| Personal/all tasks                           | `can_process` (API permission or `is_handling`) |
| Reports                                      | `can_report`                                    |
| Data export                                  | `can_export`                                    |
| Recruitment pages                            | `can_hr_rec`                                    |
| Interview CV detail                          | `can_cv_interview`                              |
| Settings and user creation                   | `can_system`                                    |

The collapsed desktop sidebar shows one 44px icon per permitted group, with a hover tooltip and an active-group marker. Clicking a group or pressing Enter opens its labeled links in a popover on the right. Opening focuses the first link; Escape closes the popover and restores focus. Selecting a page closes it, and switching to the mobile breakpoint dismisses open desktop popovers. Expanded and mobile navigation retain the grouped list. Sidebar width and explicitly opened/closed groups persist in localStorage under `ticket.sidebar` across reloads; desktop and mobile share the group preferences. Invalid or unavailable storage falls back to usable navigation defaults.

## Recruitment

The four recruitment screens use the ticketV2 API contracts:

- `/recruitment/requests`: date, department, owner, title and status filters; pagination; editable recruitment details, attachments, public CV-link copying, candidate creation and Excel export. Ticket-owned fields remain read-only when updating recruitment details.
- `/recruitment/candidates`: search and advanced filters, candidate details/files, status changes, duplicate checks, notes, individual/bulk interview assignment, deletion and Excel export.
- `/recruitment/interviews`: month/week/day calendar with time slots, overlapping schedules, interviewer username filtering, creation, editing, deletion and contextual candidate navigation.
- `/recruitment/reports`: eight report tabs with tables, count charts, date filtering (up to six months) and Excel export.

The contextual interview screen supports search, gender/status filters, profile viewing and feedback. `can_cv_interview` permits access; editing profiles, setting candidate times and removing assignments additionally require `can_hr_rec`. Viewing a profile does not load HR user directories or expose save controls. API access must also be enforced by the backend.

Forms reject invalid dates, future birthdays, invalid phone/email values, unknown options and reversed interview times. Dependent district/schedule lists must finish loading before submission. After a failed submit, correcting a field clears its validation error. Candidate creation requires a district, as confirmed against the live API; education and source are optional. CV uploads are limited to 10 MB and note uploads to 50 MB. Note files use the authenticated download endpoint.

Regression tests are `tests/recruitment*.test.ts*`. `tests/browser/ticket-recruitment-workflows.cjs` performs live browser QC against the preview at `BASE_URL` (default `http://127.0.0.1:5189`), using JSON credentials on stdin. Configure `PLAYWRIGHT_MODULE` and `BROWSER_EXECUTABLE` for the local browser installation. This script creates/updates isolated `TEST QC` records, exports files and removes its temporary boundary-test candidates. It reuses the named TEST candidate and schedule on repeated runs. `tests/browser/ticket-recruitment-readback.cjs` checks the calendar, reports and access denial with separate admin, interview-only and no-permission accounts, supplied in its documented stdin shape. The checked-in artifacts record the 2026-10-21 run; `ticket-recruitment-qc-summary.json` documents retained TEST records, cleanup and validation limits. Credentials are not stored in them.

`tests/browser/ticket-recruitment-ui-boundaries.cjs` checks responsive light/dark layouts at 1440, 768, 390 and 320px, date and candidate validation recovery, independent upload errors, calendar action visibility and selected-date defaults. Supply `{ "admin": { "username": "...", "password": "..." } }` on stdin; invalid-form QC blocks all business mutations. The UI/code review results and local SonarJS audit are recorded in `tests/artifacts/ticket-recruitment-ui-review.json`.

The 20-candidate live QC run is recorded in `tests/artifacts/ticket-recruitment-20-summary.json` (detailed evidence: `ticket-recruitment-20-records.json`). It created `TEST_REC20_261021` candidates 412–431, deleted 430–431 through the UI and retained 18 candidates plus TEST schedules 60–62. Two diagnostic candidates and schedule 63 were removed. `tests/browser/ticket-recruitment-20-records.cjs` / `ticket-recruitment-20-scenarios.cjs` contain the run-specific UI scenarios; `QC_PHASE` selects a phase and credentials are read from stdin. These fixtures are tied to 2026-10-21 and recruitment request 84; do not reuse them as a generic seed script. Creation now requires address, and stored timestamps use Vietnam dates in the editor. General-list gender/city filters are excluded to match ticketV2's disabled controls and API support; contextual interview gender filtering remains. The summary distinguishes resolved frontend issues from three outstanding API issues: empty candidate searches (500), schedule notes that do not persist despite a 200 response, and report export for 2026-10-21 (500).

Known live backend issue: `/api/list_cv/` can return HTTP 500 when filters have no matching candidates. The screen exposes the error and retry action; it does not misreport a server failure as an empty successful result. The public CV application form remains hosted on the legacy backend and is outside these four screens.

The ticket-to-recruitment live QC run is documented in `tests/artifacts/ticket-recruitment-request-20-summary.json`, with detailed UI/API evidence in `ticket-recruitment-request-20.json`. It created and approved 20 HR tickets (`HR_261021_002`–`HR_261021_021`) through the UI, generating 24 recruitment requests because the final ticket has five detail rows. All 24 were edited and read back; two TEST candidates were added from the new requests. Search by `TEST_HRREQ20_261021`. The initial approval-failure ticket `HR_261021_001` was cancelled. The run fixed recruitment approval compatibility with legacy `(*)` field keys, attachment links missing filenames, readonly metadata parity and due-date formatting. The copied public CV URL still returns HTTP 404; HR receiving/completion cases are marked skipped because the API grants no corresponding actions to the supplied admin. The phase-based browser scripts `ticket-recruitment-request-20.cjs` and `ticket-recruitment-request-20-scenarios.cjs` use stdin credentials, resume their run-specific records and restrict mutations to TEST fixtures. They are tied to the 2026-10-21 dataset.

## Project structure

```text
src/
├── app/                    # Application routing and route layouts
│   ├── app.tsx
│   ├── navigation.ts        # Sidebar groups, routes and access rules
│   └── layouts/
├── assets/                 # Images and static design assets
├── components/
│   ├── data-management/    # Reusable lists, filters, tables, pagination and URL helpers
│   ├── form/               # Shared, accessible React Hook Form controls
│   └── ui/                 # UI primitives
├── constants/              # Shared application constants
├── features/
│   ├── auth/               # Authentication API, context, provider, hooks and schemas
│   ├── recruitment/        # Recruitment lists, candidate forms, interview calendar and reports
│   ├── projects/           # Shared project-card presentation and icon selection
│   └── requests/           # Request API, schemas, column/filter configuration and list composition
├── hooks/                  # Hooks shared across features, including debounce
├── lib/
│   ├── api/                # HTTP client and typed HTTP errors
│   ├── auth-session.ts     # Shared cleanup of persisted authentication
│   └── ...                 # Cookies, storage, query client and UI utilities
├── pages/                  # Route screens that compose feature components
├── index.css
└── main.tsx

tests/                      # API contracts, validation and UI behavior tests
```

Keep business rules and API calls inside their feature. Keep route pages focused on composing the screen. Use the shared data-management module for management lists; keep other feature-specific code local until reuse is needed. Use kebab-case for files, PascalCase for React components and types, and camelCase for functions and variables. Preserve backend field names at the API boundary.

## Shared interface components

The interface uses opaque surfaces and semantic color tokens in `src/index.css`. Use `bg-card`, `text-foreground`, `text-muted-foreground`, `border-border` and the status tokens instead of adding separate hardcoded light/dark color classes. Primary and supporting text use the same contrast rules across screens.

- `PageHeader` composes page titles, back navigation and toolbar actions.
- `DialogHeading` shares a 40px icon tile, 14px title and closely spaced 12px description across dialogs and drawers. `DialogHeader` and `DialogFooter` keep spacing, scrolling and actions consistent without divider lines; dialog content retains the width needed by each form.
- `FormFieldShell` provides labels, required indicators and linked validation errors for input, date, select and multi-select fields. `controlClassName` provides their common surface, border and focus treatment.
- `SearchInput` provides search and clear actions. `AsyncButton` provides a spinner and pending/disabled state.
- `Badge`, `UserAvatar`, `EmptyState`, `ErrorAlert` and `LoadingState` keep repeated feedback and identity elements consistent.
- `AppNavLink` shares navigation states. `ProjectCardContent` shares application tile content.

Keep feature-specific actions in their feature; compose these components in pages and dialogs.

Missing field values render as empty content across tables and ticket details. Shared text/date formatters use an empty string for missing values; preserve actual values such as `0` and `false`. Empty-list messages and form hints remain separate from field values.

## Reusable management lists

Import shared list components, types and helpers through `@/components/data-management` (the public `index.ts`). `/requests` uses this module; its API contracts, access rules, status options and request-specific columns remain in `features/requests`.

| Export                                                                             | Responsibility                                                                                             |
| ---------------------------------------------------------------------------------- | ---------------------------------------------------------------------------------------------------------- |
| `DataTable<T>`, `DataColumn<T>`                                                    | Typed columns, shared alignment, fixed row height, scroll region and optional row navigation               |
| `DataText`, `DataRowLink`                                                          | Two-line truncation, native browser tooltips and accessible detail links                                   |
| `DataSearch`                                                                       | Draft keyword and optional select; submit applies both values                                              |
| `DataFiltersDrawer`, `DataFilterField`                                             | Configured text/date fields, applied-filter count, date validation and modal lifecycle                     |
| `DataResults`, `DataListQuery<T>`                                                  | Initial loading, retry, empty state, pagination and loading overlay over retained rows                     |
| `DataPagination`                                                                   | Configurable sizes, previous/next navigation, page counter, empty-state hiding and independent control IDs |
| `parseListPagination`, `readStringFilters`, `updateListSearchParams`               | Validated paging, whitelisted string filters and immutable URL updates that reset page to 1                |
| `getFilterValues`, `countActiveFilters`, `normalizeFilterValues`, `formatDataDate` | Field defaults/counting, trimmed values, ISO date filters and date display                                 |

For a new page, define a typed `DataColumn<YourRow>[]` and a readonly `DataFilterField[]`, then compose the shared controls as in `request-list.tsx` and `request-table.tsx`. Mark date filters with `type: "date"`; normalization follows that configuration rather than a particular API field name. `DataTable` takes `getRowKey` and optional `getRowHref`. Pass a stable `scrollResetKey` derived from pagination and applied filters to reset vertical scroll only when that key changes. Nested links and controls retain their own actions when row navigation is enabled.

`DataResults` expects data shaped as `{ count, results }` and the loading/error flags in `DataListQuery<T>`; TanStack Query results already match that interface. Keep previous data while fetching to retain the table under the update overlay. Pass the page's size options explicitly (`/requests` uses `[100, 200]`), and map its API response in the feature if it has a different shape.

URL helpers use `page` and `page_size`. Feature-specific keys and obsolete parameters are supplied by the caller. Changing filters or size resets page to 1; explicitly updating `page` overrides that reset. Pass `resetKey={JSON.stringify(params)}` to `DataSearch` to restore drafts when navigating Back/Forward. Put the filter Drawer in its `actions` slot to align it with the search controls; only the inner search form remounts when `resetKey` changes, preserving the Drawer's state and trigger focus. The Drawer restores applied values on reopening and discards unapplied edits.

## Quality checks

| Command                 | Purpose                                                                      |
| ----------------------- | ---------------------------------------------------------------------------- |
| `npm run check`         | Lint, formatting, application/config/test type checking and tests            |
| `npm run check:quality` | Lint, formatting, type checking, coverage thresholds and production build    |
| `npm run build`         | Check application/config TypeScript projects and create the production build |
| `npm run lint`          | Run Oxlint; any warning or error fails the command                           |
| `npm run format`        | Apply Prettier formatting                                                    |
| `npm run format:check`  | Check formatting without changing files                                      |
| `npm run typecheck`     | Check application, configuration and tests                                   |
| `npm run test`          | Run Vitest regression tests                                                  |
| `npm run test:watch`    | Run tests interactively                                                      |
| `npm run test:coverage` | Generate text, HTML and LCOV coverage reports                                |
| `npm run preview`       | Serve the production build locally                                           |

Lint rules cover hooks, explicit `any`, nested ternaries, duplicate imports and common accessibility issues. Application functions are limited to a cyclomatic complexity of 20 and a nesting depth of 4. The label primitive forwards its control association through props, so label association is checked at usage sites. Semantic-role suggestions are disabled for UI primitives that use ARIA grouping.

Permission regressions cover canonical and legacy URLs, loading before account restoration, revoked cached rights, empty accounts, duplicate position/handling rights, Django flags without functional grants, inactive/retired permission assignments, and blocked browser storage. To reduce worker contention during coverage runs, use `npm run test:coverage -- --maxWorkers=2`.

Coverage checks require at least 80% statements, 80% lines, 70% branches and 75% functions across the full application source. These local regression thresholds do not replace the SonarQube server's Quality Gate or its new-code coverage calculation. Asynchronous UI assertions allow three seconds for cold lazy-route imports under coverage instrumentation; tests still fail on assertion timeouts.

Unit tests cover HTTP error/status handling, Ticket sign-in and session restoration, authentication expiration, slash fallback, routing, request-list API parameters, filtering, default ordering, pagination, retries, access rules and shared form controls. Their API calls are mocked and do not contact the backend. Test API configuration is isolated from `.env.local`.

`npm run test:settings:live` runs the settings workflow in a visible browser against the real TEST API. It accepts `{ "username": "...", "password": "..." }` on stdin and never writes credentials or screenshots. Set `PLAYWRIGHT_MODULE` and `BROWSER_EXECUTABLE` to existing Playwright and browser installations; `BASE_URL` can point to a local frontend running `npm run dev:test`. The runner checks that the API is the configured TEST host before permitting writes.

The live workflow creates its own `TESTCFG_*` department, office, position, team, user, handling department and request type, then updates them, uploads/replaces a PDF, creates/updates a template, locks/reactivates records and exports users. It verifies saved records with authenticated GET requests and reloads the UI. Only this run's records may be updated; successful runs finish by locking them in dependency order. The UI has no delete operation. `SETTINGS_CRUD_REPORT` selects the JSON report and resumable fixture IDs; reuse the same report to continue an interrupted run without recreating completed steps. Progress is saved under the system temporary directory, outside Vite's watched tree, and copied to the report after the run. A failed run retains its fixtures for inspection. `HEADLESS=true` disables the visible browser; `KEEP_BROWSER_OPEN=true` leaves it open after completion.

## SonarQube

`sonar-project.properties` scans all application source in `src`, identifies tests in `tests`, and imports `coverage/lcov.info`. It does not exclude application UI from analysis or coverage.

Install [SonarScanner CLI](https://docs.sonarsource.com/sonarqube-server/analyzing-source-code/scanners/sonarscanner), create the project on your SonarQube server, and provide `SONAR_HOST_URL` and `SONAR_TOKEN` through your shell or CI secret store. Change `sonar.projectKey` if your existing project has another key.

```bash
npm run check
npm run build
npm run test:coverage
npm run sonar -- -Dsonar.qualitygate.wait=true
```

Alternatively, `npm run check:quality` runs all local checks, coverage and the build before the scanner. A SonarJS recommended-rule audit can identify local code issues, but only a scan against the configured SonarQube server establishes its Quality Gate result. The scanner requires the server URL and authentication to be configured; do not commit tokens to the project properties or source.

Generate coverage before scanning, as described in the [SonarQube JavaScript/TypeScript coverage documentation](https://docs.sonarsource.com/sonarqube-server/analyzing-source-code/test-coverage/javascript-typescript-test-coverage). The server's Quality Profile and Quality Gate determine acceptance; passing local lint and tests alone does not establish a passing SonarQube result. Coverage includes untested application files so the report reflects remaining gaps.

## Brand assets

The supplied `Logo-Rainscales-New-Colors_260717.zip` is the source for `public/brand`. SVG canvases are trimmed to remove export whitespace; the original paths and gradients are preserved. `BrandLogo` displays the color artwork in light mode and the white artwork in dark mode, with a compact emblem on mobile.

The brand colors are purple `#6468AF`, cyan `#61C9D9` and blue `#263D88`. Related `brand-*` shades in `src/index.css` provide readable focus, hover and text states. The favicon and Apple touch icon use the supplied emblem; Scout illustrations remain available for login and empty states.

## User guide

The header's book icon opens `/help` for any signed-in account. The reader
supports chapter navigation on desktop/mobile and downloading the original Word
manual. It does not use an external document viewer.

After editing `docs/Rainscales-Ticket-Huong-dan-su-dung-toan-bo-website.docx`, update
the generated reader content and the Word download in `public/docs`:

```bash
python3 scripts/export-user-guide.py
npx prettier --write src/features/help/user-guide.json
```

The exporter only needs Python's standard library and publishes the user manual;
the FE–BE audit report stays outside the public assets.

## License

Private repository. All rights reserved.
