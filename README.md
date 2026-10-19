# Rainscales Ticket

Rainscales Ticket is an internal ticket workspace built with React 19, TypeScript, Vite, Tailwind CSS, React Router, TanStack Query, React Hook Form and Zod.

The theme preference is stored independently under `ticket-theme` in local storage.

Session cookies use the `Secure` flag on HTTPS. Cached account data is validated before it can populate the interface or sidebar permissions.

After sign-in, the application opens `Danh sách yêu cầu` at `/requests`. The protected `/` route redirects there as well. The current source includes a responsive sidebar based on `ticketV2`, Rainscales account sign-in, the request-list API integration, themes, shared components, branding, API configuration and Docker deployment. Other destinations currently have page shells; their forms, lists, reports and API integrations are not implemented yet.

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

After sign-in and on page reload, `GET /api/list_permission/` loads the account and permissions. The `infoUser` tuple supplies the user ID, name and avatar; `userPermission` and `handlingPermission` supply the permission flags. Sign-in completes after account information loads. Signing out removes the Ticket session and query cache. Existing Homepage sessions are separate; sign in again after switching to this authentication flow.

When a protected request receives `401` or an explicit `token_not_valid` error, the client posts `{ "refresh": "..." }` to `/api/token/refresh/` and retries the request once. Concurrent requests share one refresh. If the server returns a rotated refresh token, it replaces the saved one. A missing access cookie can also be recovered using the refresh cookie. Rejected refresh credentials or a second authentication failure end the session.

Network errors, ordinary `403` permission errors and temporary server errors preserve an existing session. During account restoration, cached account information remains available if reloading permissions fails temporarily. Signing out invalidates pending requests so a late refresh response cannot restore the session.

Restart the development server after changing `.env.local`; rebuild deployed bundles when their API configuration changes.

## Request list

`/requests` (formerly `/danhsachyeucau`) follows the `ticketV2` API contract:

- `GET /api/list_ticket/` returns `{ "count": 25, "results": [...] }`. The page always sends `typeView=create`, with defaults `page=1`, `page_size=100`, `columnSort=id` and `typeSort=descend`.
- `GET /api/list_ticketstatus/` returns `{ "results": [{ "id": 1, "name": "..." }] }`. Status filtering sends the status **name** as `ticket_status_name`; submitting all statuses omits it. The status Select sits beside the keyword input without a visible label and retains an accessible name. Both controls are drafts: clicking `Tìm kiếm` or submitting with Enter applies them together. Changing status or clearing the keyword alone does not fetch the list.
- Every implemented status selector uses the shared searchable Select, including personal requests, all requests, pending/approved approvals and the change-status form. Searching ignores case and accents. In list toolbars, searching or selecting an option remains a draft until submitting `Tìm kiếm`; API names/IDs and page scopes stay unchanged. Reusable `DataSearch` filters enable this with `searchable: true`.
- Quick search sends trimmed `searchAll`, clears advanced fields and preserves the selected status. Advanced fields are `ticket_code`, `ticket_type_name`, `title`, `vanphong_name`, `duedate` (`YYYY-MM-DD`), `approve_user_name` and `updating_user_name`. Clicking `Lọc nâng cao` opens a drawer on the right with scrollable fields and fixed actions. Applying or clearing filters closes it. Closing it with the close button, Escape or backdrop discards unapplied edits and returns focus to the trigger; saved URL filters do not open the drawer automatically.
- Pagination runs on the server. Page sizes are 100 and 200, with a default of 100. Changing filters or page size resets to page 1. Changing pages, sizes or applied filters returns the table's vertical scroll to the top while preserving its horizontal position and mounted rows under the loading overlay. Background refreshes of the same list keep its scroll position. Filters and pagination live in the URL, allowing reloads, bookmarks and browser Back to restore them. Column sorting is disabled; requests always send the backend's required `columnSort=id` and `typeSort=descend`, ignoring old sort parameters in bookmarked URLs.

The workspace uses its full available width. The table shows the request code, type, title, Department, Team, office, due date, approver, status and last updater. Department and Team headers and cells are centered. Every cell displays at most two lines with an ellipsis and its full text in the browser's native `title` tooltip. The status and page-size controls use the shared shadcn Select. Its focusable scroll region supports horizontal and vertical scrolling, with a sticky header and pagination outside the scrolling rows. Request links open `/tickets/:ticketID`. Loading, empty results and API errors have separate states; failed requests can be retried. Failure to load status options does not block the list. Requests use the shared authenticated client and its token refresh behavior. Accounts without list access do not fetch data.

`/requests/all` (formerly `/tatcayeucau`) reuses the same list components and requires `can_allticket` or superuser access:

- `GET /api/list_ticket_all_SupAD/` is the endpoint used by the actual `ticketV2` route. Its default all-records view omits `typeView`. The toolbar shows search, status and advanced filters. Saved URLs can still include `typeView=processing`, `handle`, `accepted` or `received`; clearing all filters removes that parameter.
- The status Select submits the actual numeric status ID as `ticket_status`, omitting it for all statuses. Status ID 1 is excluded from its options, matching V2. Advanced filters replace `ticket_type_name` with `ticket_type_id` and `approve_user_name` with `list_user_received`; the remaining fields and date format are shared.
- `GET /api/list_handling_alltickettype/` supplies a validated array of request types. The shared drawer Select displays the handling group and type name, and sends the type **ID**. Its search input filters names and groups without distinguishing case or accents; typing and selecting remain drafts until applying the drawer. Keyboard selection, an empty-results message and Escape dismissal are supported. Sending the type name, as the older UI did, returns no matching records on the current backend. A failed lookup can be retried without blocking ticket results.
- The table follows V2's all-request columns: row number, code, type, title, office, due date, handler, status and updater. Search, the filter drawer, 100/200 page sizes, loading overlay, empty/error states and row navigation are shared with `/requests`. Query caches are separated by account and list scope; navigating between the two lists cannot show the other list's previous rows.

`/approvals/pending` (formerly `/chopheduyet`) and `/approvals/approved` (formerly `/dapheduyet`) require `can_accept` or superuser access. Both reuse the request-list components and validated `GET /api/list_ticket/` response. Pending approvals always send `typeView=pendingAccept`; approved requests always send `typeView=accepted`. URL parameters cannot override these page scopes.

The approval tables follow V2's columns: row number, code, type, title, office, due date, requester (`username_create`), status and updater. Advanced filters use `username_create` instead of the personal list's approver filter; request types remain text filters using `ticket_type_name`. Status filters send names as `ticket_status_name`. Approved-status options exclude ID 1, matching V2; pending-status options retain it. Search drafts, the filter drawer, 100/200 pagination, row links, loading overlay, table scroll reset, empty/error recovery and account-scoped caches are shared across all four lists. Unauthorized accounts do not fetch approval records or lookup options.

In development, React StrictMode runs an additional effect setup/cleanup cycle. TanStack Query forwards that cleanup through the request's AbortSignal, so DevTools can show one canceled request followed by one successful request for each list endpoint. The production build omits this development probe. Keep cancellation enabled: changing search parameters aborts the obsolete query, and its late response cannot replace the latest results. Regression tests cover both behaviors and confirm that cancellation preserves the authentication session.

Vite pre-bundles `@hookform/resolvers/zod`, `react-hook-form` and `zod` explicitly for lazy routes. The dev server uses `node_modules/.vite-dev`, and Vitest uses `node_modules/.vite-test`. Auxiliary `createServer` calls must set their own `cacheDir` and disable client dependency discovery when only loading SSR fixtures. Sharing the dev cache can invalidate module hashes for browsers that are already open. For an `Outdated Optimize Dep` response, reload the page after optimization finishes; `npm run dev -- --force` rebuilds dependencies when restarting is needed. A failed lazy import now shows a recovery screen with `Tải lại trang`, preserving the current URL and session when reloading.

Below 640px, the keyword spans the full toolbar width; the status, search and advanced-filter controls align on the second row. Wider screens keep the toolbar on one row when space allows; extra actions wrap instead of being clipped. Pagination keeps the range, page-size select and previous/page/next controls on one row at every width. Long range text truncates with an ellipsis and exposes its full text in the browser's native tooltip. Below 400px the selected size omits its visible unit while retaining its accessible label. Both mobile and desktop display a static page counter between the previous and next buttons. Page headers and their actions are 40px high; drawer close buttons and paging arrows provide 44px touch targets on mobile. The request results use a smaller minimum height on narrow screens so the table and pager fit shorter viewports; landscape screens can scroll the main content when needed.

## Change ticket status

`/requests/change-status` (formerly `/change_status`) requires `can_return_ticket` or superuser access. The form uses the shared input, Select, async button and alert components. It loads `GET /api/list_ticketstatus/`, excluding status ID 1 as in `ticketV2`, and requires a ticket code and a selected status. The reason is optional. Missing, failed or empty status options block updates and can be retried when loading fails.

Submitting sends `POST /api/change_status_ticket/` with JSON fields `ticket_code` (trimmed string), `ticket_status_id` (numeric ID) and `lydohuyyeucau` (trimmed string, empty when omitted). The backend accepts JSON as well as V2's form-data. Its response is `{ "message": "...", "error": "..." }`; a nonempty `error` is a failed update even with HTTP 200. Responses are validated before displaying a result. Inputs remain available after errors so the user can correct them and retry; pending updates disable editing and duplicate submissions. Successful updates invalidate both request-list caches. The operation records status history and does not send email, matching V2's description.

## API contracts

All active API responses enter as `unknown` and pass Zod validation before application code uses them. Response types are inferred from those schemas so runtime validation and TypeScript declarations stay together. The contracts were checked against the Ticket backend; credentials and tokens are not stored in source.

| Endpoint                                | Contract                                                                                                         |
| --------------------------------------- | ---------------------------------------------------------------------------------------------------------------- |
| `POST /api/token/`                      | String `access` and `refresh` tokens                                                                             |
| `POST /api/token/refresh/`              | String `access`, optional rotated `refresh`                                                                      |
| `GET /api/list_permission/`             | Typed `infoUser` tuple, permission flags, handling-permission arrays and configuration lists                     |
| `GET /api/list_ticket/`                 | Integer `count`, nullable `next`/`previous`, full ticket-list records with numeric IDs and team objects          |
| `GET /api/list_ticket_all_SupAD/`       | Same validated ticket-list envelope, across all accessible requests                                              |
| `GET /api/list_ticketstatus/`           | Same pagination envelope, full status records including colors, timestamps and `is_active`                       |
| `GET /api/list_handling_alltickettype/` | Array of request types with numeric IDs, handling group, names, nullable file fields, active flag and timestamps |
| `POST /api/change_status_ticket/`       | String `message` and `error`; nonempty business error fails the mutation even with HTTP 200                      |

Missing related Department, cancellation-user and customer display names are optional; nullable foreign keys and timestamps remain explicitly nullable. The list serializer returns `list_user_received` as a string. It must not be confused with the ticket-detail response. Malformed nested fields produce a handled API error instead of reaching the UI. The unused Homepage `/list-project` lookup was removed because it does not exist on the Ticket backend.

The create-request and ticket-detail routes remain page shells; their APIs are not part of this integration.

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

`Danh sách yêu cầu` is the default destination after sign-in and for the header logo. The overview page has been removed. The `Tạo yêu cầu` action appears in the request-list page header, linking to `/requests/new`. Both the list and creation action require `can_create`. Page URLs use English paths, with the Vietnamese navigation labels retained. Old `ticketV2` page URLs redirect to their English equivalents, preserving record identifiers, query parameters and URL fragments. Ticket details, requests from email, user creation and interview details also have contextual routes without sidebar links. The public CV form and the old Change Password page are not included.

| Area        | English URLs                                                                                                                                                                      |
| ----------- | --------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Requests    | `/requests`, `/requests/new`, `/requests/all`, `/requests/change-status`                                                                                                          |
| Approvals   | `/approvals/pending`, `/approvals/approved`                                                                                                                                       |
| Tasks       | `/tasks/mine`, `/tasks`                                                                                                                                                           |
| Reports     | `/reports`, `/reports/export`                                                                                                                                                     |
| Recruitment | `/recruitment/requests`, `/recruitment/candidates`, `/recruitment/interviews`, `/recruitment/reports`                                                                             |
| Settings    | `/settings/users`, `/settings/requesting-departments`, `/settings/handling-departments`, `/settings/request-types`, `/settings/teams`, `/settings/positions`, `/settings/offices` |

Contextual URLs are `/tickets/:ticketID`, `/tickets/from-email/:ticketID`, `/settings/users/new` and `/recruitment/interviews/:codeInterview`. Backend API URLs follow the server contract, including `/api/list_permission/`.

`src/app/navigation.ts` defines page metadata and access rules shared by routes and the sidebar. Menu groups are filtered using permissions from `/api/list_permission/`; opening a restricted URL directly shows an access message. Superusers can access every group. Settings accepts `can_system` or `is_system_manage`; switching ticket status requires `can_return_ticket`. Backend APIs must enforce their own permissions when those pages are implemented.

The collapsed desktop sidebar shows one 44px icon per permitted group, with a hover tooltip and an active-group marker. Clicking a group or pressing Enter opens its labeled links in a popover on the right. Opening focuses the first link; Escape closes the popover and restores focus. Selecting a page closes it, and switching to the mobile breakpoint dismisses open desktop popovers. Expanded and mobile navigation retain the grouped list.

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
- `FormFieldShell` provides labels, required indicators and linked validation errors for input, date, select and multi-select fields. `controlClassName` provides their common surface, border and focus treatment.
- `SearchInput` provides search and clear actions. `AsyncButton` provides a spinner and pending/disabled state.
- `Badge`, `UserAvatar`, `EmptyState`, `ErrorAlert` and `LoadingState` keep repeated feedback and identity elements consistent.
- `AppNavLink` shares navigation states. `ProjectCardContent` shares application tile content.

Keep feature-specific actions in their feature; compose these components in pages and dialogs.

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

Coverage checks require at least 80% statements, 80% lines, 70% branches and 75% functions across the full application source. These local regression thresholds do not replace the SonarQube server's Quality Gate or its new-code coverage calculation. Asynchronous UI assertions allow three seconds for cold lazy-route imports under coverage instrumentation; tests still fail on assertion timeouts.

Tests cover HTTP error/status handling, Ticket sign-in and session restoration, authentication expiration, slash fallback, routing, request-list API parameters, filtering, default ordering, pagination, retries, access rules and shared form controls. API calls are mocked; tests do not contact the backend. Test API configuration is isolated from `.env.local`.

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

## License

Private repository. All rights reserved.
