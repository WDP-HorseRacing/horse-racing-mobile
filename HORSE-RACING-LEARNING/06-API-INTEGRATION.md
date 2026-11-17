# 06 — Tích hợp API và realtime

## 1. Cấu hình API host

`src/config/api.ts` đọc `EXPO_PUBLIC_API_URL`; giá trị mặc định là `https://api.horse.io.vn/api/v1`. Với địa chỉ localhost, client thử thay host bằng IP của Metro để thiết bị thật trong cùng mạng có thể truy cập. `.env.example` ghi cách cấu hình dev. Không đọc file `.env` trong lần audit.

`EXPO_PUBLIC_*` là cấu hình có thể được đóng gói vào bundle mobile; không đặt secret server-side ở đây. Base URL chỉ đổi địa chỉ server, không thay đổi quyền hoặc dữ liệu.

## 2. HTTP client dùng chung

File trung tâm: `src/services/api-client.ts`.

1. Ghép base URL và path service.
2. Thêm `Accept: application/json`, `Content-Type` khi có body, và `Authorization: Bearer <token>` khi có token.
3. Tạo `AbortController`, timeout mặc định 15 giây; chuyển tiếp signal caller nếu được truyền.
4. Gọi `fetch`, trả `undefined` cho HTTP 204, thử parse JSON và dùng text nếu body không phải JSON.
5. HTTP lỗi trở thành `ApiError` với status/payload; timeout, abort và network có nhánh thông báo riêng.
6. Với 401 có token và refresh handler, thử refresh rồi retry request đúng một lần.

Generic `apiRequest<T>` giúp TypeScript kiểm tra cách dùng tại compile time; response JSON không được validate bằng schema runtime tổng quát. Vì vậy DTO không đảm bảo server luôn trả đúng shape.

## 3. Hook dữ liệu và lỗi

`useApiResource` quản lý data/loading/error/refresh và generation guard. Khi request cũ trả về sau lần tải mới, guard không cho response cũ ghi đè state hiện tại. Request cũ vẫn có thể tiếp tục trên mạng vì guard không tự abort nó. Nếu refresh lỗi, dữ liệu trước đó có thể còn hiển thị cùng error.

`AsyncStateView`, `errorHandler.ts` và `FieldErrors` đưa trạng thái tải/lỗi lên UI. Một số dashboard/service bắt lỗi tùy chọn thành `[]` hoặc `0`, làm lỗi endpoint khó phân biệt với dữ liệu thực sự rỗng. Một số thao tác thực hiện optimistic/local update và refresh; cần đọc từng màn để biết state nào đã commit.

## 4. Service theo domain

Đường dẫn dưới đây bỏ base prefix `/api/v1`; tham số trong dấu `:...` được thay bằng ID. Đây là inventory contract mobile gọi, không phải danh mục endpoint đã xác nhận từ server.

| Service | Nhóm endpoint/hoạt động |
|---|---|
| `auth.service.ts` | `POST /auth/login`, `/auth/refresh`, `/auth/logout`, `/auth/change-password`; `GET /auth/me` |
| `horse.service.ts` | Horse list/detail/create/update; permissions/photo URL; pedigree; measurements; ownership/transfers; barn/stall/groom placement; lifecycle; delete/restore preview và execution; past horses |
| `medical.service.ts` | Medical dashboard/checkups; cases/records/visits; exam requests; health status/history; care instructions; training locks; injuries timeline; close preview/close/correction; cost adjustment/report; care schedules |
| `training.service.ts` | Training subjects/plans/classes; enrollment; sessions/bulk sessions; participant check-in/ready/start/complete/stop; evaluation; trial result; time trial; visible horse session pages |
| `stable.service.ts` | Barn/stall CRUD, stall filters, groom workload |
| `stable-care.service.ts` | Feeding plans, task types, horse care tasks/checklists (tick với `done` hoặc `evidenceMediaId`), incidents, surcharges |
| `groom.service.ts` | `/grooms/me/today`; check-in/ready, care completion, incident report |
| `supplies.service.ts` | Items/low-stock; receipts/usages; lots/movements; supply requests/status |
| `performance.service.ts` | Horse/participant summaries, metrics ingest/read, thresholds, alerts, workload |
| `media.service.ts` | Upload request, signed binary upload, complete; download URL; image purposes gồm horse photo, incident photo và checklist evidence |
| `notifications.service.ts` | Cursor-based notifications, mark read/all; horse alert pages |
| `push-device.service.ts` | `PUT /me/devices` for device token |
| `users.service.ts` | User CRUD/status/reset; head trainer handover |
| `audit.service.ts` | `GET /audit-logs` |
| `billing.service.ts` | `GET /daily-fees` |
| `reports.service.ts` | Club finance and owner cost reports |
| `realtime.service.ts` | Socket.IO client to `/events`, event `performance.metrics` |

### API inventory theo family

Đây là contract mà mobile service khai báo. `:id` là `encodeURIComponent(id)`; request/response mô tả DTO phía client. Có thể có query filter tùy màn. Không phải mọi route dưới đây đều được gọi trong cùng một session.

| Feature | Method | Endpoint | Request phía mobile | Response phía mobile | Mục đích |
|---|---|---|---|---|---|
| Auth | POST | `/auth/login` | `{email,password}` | `AuthTokens` | Đăng nhập |
| Auth | POST | `/auth/refresh` | `{refreshToken}` | `AuthTokens` | Xin access token mới |
| Auth | GET | `/auth/me` | Bearer access token | `AuthUser` (id/email/status/roles) | Khôi phục user/role |
| Auth | POST | `/auth/logout`, `/auth/change-password` | refresh/device token; hoặc current/new password | `void` | Logout và đổi mật khẩu |
| Horse | GET | `/horses?page&limit&search&filters` | Query; page size 100 | `Page<HorseListItemDto>` mỗi trang, service trả mảng đã gom | Tìm/lọc ngựa |
| Horse | GET/POST/PATCH | `/horses`, `/horses/:id`, `/horses/:id/permissions`, `/horses/:id/photo-url`, `/horses/:id/pedigree` | Create/update JSON hoặc ID | `HorseProfileResponseDto`, detail, permissions, `{url}`, pedigree | Hồ sơ, ảnh và capability UI |
| Horse | GET/POST/DELETE | `/horses/:id/measurements[/:measurementId]` | Query paging; values `{type,value}[]`, reason khi xóa | Measurements kèm alert hoặc `void` | Đo và sửa dữ liệu đo |
| Horse | GET/POST | `/horses/:id/ownerships`, `/ownership-transfers` | ID; `{newOwnerId,reason,version}` | Ownership list / `HorseProfileResponseDto` | Lịch sử/chuyển owner |
| Horse placement | GET/PUT/DELETE | `/horses/:id/barn-preview`, `/barn`, `/placement`, `/stall`, `/groom` | `barnId`, `stallId`, `groomId`; placement `{stallId,groomId}` | Preview DTO / profile hoặc `unknown` | Preview và đổi vị trí/phân công |
| Horse lifecycle | GET/PATCH/POST/DELETE | `/horses/:id/lifecycle-status/preview`, `/horses/:id/lifecycle-status`, `/horses/:id/deletion-preview`, `DELETE /horses/:id`, `/horses/:id/restore-preview`, `/horses/:id/restore` | trạng thái, reason, optional ownerId | Preview/profile hoặc `void` | Vòng đời, xóa và phục hồi |
| Horse history | GET | `/past-horses`, `/past-horses/:id` | token + optional ID | `PastHorseListItemDto[]` / detail DTO | Horse không còn active |
| Medical | GET/PUT/DELETE | `/medical/dashboard`, `/medical/checkups`, `/horses/:id/checkup-appointment` | filter; lịch `{scheduledAt,reason?}`; cancellation reason | dashboard/checkups/appointment hoặc `void` | Dashboard, lịch khám |
| Medical case/record | GET/POST/PATCH | `/medical-cases`, `/medical-cases/:id`, `/horses/:id/medical-records`, `/medical-cases/:id/visits`, `/medical-records/:id` | Filter; visit DTO (diagnosis, measurements, prescriptions, injuries...) | Case summary/detail hoặc `MedicalRecordDto` | Xem, tạo, sửa, follow-up |
| Medical request/status | GET/POST/PATCH | `/exam-requests`, `/horses/:id/exam-requests`, `/exam-requests/:id[/dismiss]`, `/horses/:id/health-status` | paging/filter; description/urgent/reason; health status/reason | Page/list/request/status transition | Yêu cầu khám và health status |
| Medical injury/lock | GET/POST | `/horses/:id/injuries`, `/horses/:id/training-locks`, `/training-locks/:id/release` | horse ID; lock reason/end; conclusion | Injury timeline / lock DTOs | Injury history và khóa huấn luyện |
| Medical history/care instructions | GET/PATCH | `/horses/:id/health-history`, `/horses/:id/care-instructions`, `/horses/:id/health-status` | horse ID; health status/reason khi cập nhật | History entries, current care instructions, transition result | Theo dõi tình trạng và hướng dẫn chăm sóc |
| Medical close/cost/care | GET/POST/PATCH | `/medical-cases/:id/close-preview`, `/medical-cases/:id/close`, `/medical-cases/:id/conclusion`, `/medical-records/:id/cost`, `/medical/cost-report`, `/horses/:id/care-schedules`, `/care-schedules/:id`, `/care-schedules/:id/complete`, `/care-schedules/:id/cancel`, `/care-schedules/:id/reopen` | kết luận, lock decision, reason/cost, filters, dates/care fields | Case/record/report/schedule DTOs | Đóng/sửa case, chi phí và care |
| Training setup | GET/POST/PATCH/PUT/DELETE | `/training-subjects`, `/training-plans`, `/classes` và `/:id` | domain create/update DTO | Subject/plan/class DTO hoặc `void` | Quản lý chương trình/lớp |
| Training enrollment | GET/POST/PATCH | `/classes/:id/enrollments`, `/enrollable-horses`, `/enrollments/:id/leave` | `{horseId}`; leave `{reason?}` | Enrollment/horse list | Thêm/bỏ ngựa khỏi lớp |
| Training sessions | GET/POST/PATCH | `/classes/:id/sessions[(/bulk)]`, `/training-sessions/:id[/cancel]` | session(s), update fields, cancel reason | Session DTO/list | Lịch buổi tập |
| Training participant | GET/POST/PATCH | `/training-sessions/:id/participants`, `/session-participants/:id/{groom,check-in,absent,ready,start,complete,stop}` | status action; groomId/reason khi cần | Participant DTO | Điểm danh và chuyển trạng thái |
| Evaluation/trial | GET/POST/PATCH | `/session-participants/:id/evaluation`, `/trial-results[/attemptNo]`, `/training-sessions/:id/time-trial` | score/comment/reason; attempt/time/video; distance/time | Evaluation/TrialResult/TimeTrial DTO | Đánh giá và kết quả tập/thử |
| Stable | GET/POST/PATCH/DELETE | `/barns`, `/barns/:id`, `/stalls`, `/stalls/:id`, `/grooms/workload` | barn/stall input, filter `barnId` | Barn/Stall/Workload DTOs | Cấu hình stable và capacity |
| Groom | GET/POST | `/grooms/me/today`, participant check-in/ready, care schedule complete, `/incidents` | token; action reason/input incident | GroomToday/incident hoặc `void` | Tác vụ hằng ngày và báo incident |
| Stable care | GET/POST/PUT/PATCH/DELETE | `/horses/:id/feeding-plans`, `/feeding-plans/:id`, `/care-task-types`, `/horses/:id/care-tasks`, `/horse-care-tasks/:id`, `/horses/:id/checklists`, `/daily-checklists/regenerate-today`, `/checklist-items/:id`, `/incidents[/:id]`, `/horse-surcharges/*` | Domain DTO; checklist tick `{done,note?}` hoặc `{evidenceMediaId,note?}` | Care/checklist/incident/surcharge DTO | Feeding, checklist, incident, phụ phí |
| Supplies | GET/POST/PATCH/DELETE | `/supplies/items`, `/:id/receipts`, `/:id/usages`, `/usages/:id/cancel`, lots/movements, `/supplies/requests` | item fields; quantity/price/note; request itemId/status/reason | Item/request/lot/movement DTO hoặc `void` | Tồn kho và yêu cầu vật tư |
| Performance | GET/POST | horse/participant performance, metrics, thresholds, alerts, workload | ingest `{sourceId,recordedAt,heartRateBpm,speedMps}`; alert/date filters | Summary, points, ingest counts, threshold/alert/workload | Telemetry và tải tập |
| Media | POST/PUT/POST | `/media/upload-requests`, signed URL, `/media/:assetId/complete`; GET download URL | MIME/name/size/purpose; file bytes; assetId | Signed upload DTO/media ID; `{url}` | Upload/download ảnh/video |
| Notifications/push | GET/PATCH/PUT | `/notifications`, `/:id/read`, `/read-all`, `/me/devices` | cursor/limit; device token/platform | Page/count hoặc `void` | Inbox, read state, đăng ký push |
| Users/audit | GET/POST/PATCH/DELETE | `/users`, `/:id/status`, reset-password, handover; `/audit-logs` | user fields/status/password/handover target | Staff DTO, handover counts, audit list | Quản trị user và xem audit |
| Billing/reports | GET/POST/PATCH/DELETE | `/daily-fees`; `/reports/club/finance`, `/reports/owner/costs` | effective date/fee/reason; from/to/ownerId | DailyFee, ClubFinanceReport, OwnerCostReport | Phí và báo cáo tài chính |

`api-contract.test.mjs` trong mobile test suite static-scans các call service/DTO để so với OpenAPI JSON ở sibling `horse-racing-ne`. Đây là source evidence về ý định đối chiếu contract, không phải live request. Audit này không mở sibling OpenAPI file và không chạy test.

Trong test source có allowlist `KNOWN_MISSING_ROUTES` và `KNOWN_GAPS`. Ví dụ, test cho phép một số route mà OpenAPI match chưa được nhận diện và các response-shape/nullable khác biệt; những tên như `healthOutcome` được nêu trong allowlist. Điều này cho thấy có sai khác được chủ động miễn trong static check. Vì contract file không được mở và test không chạy, không kết luận đó là lỗi production hoặc trạng thái hiện tại của backend.

### Trace request/response mẫu

Ví dụ GET list ngựa từ `horseService.list`:

~~~http
GET /api/v1/horses?page=1&limit=100&search=Comet&myBarns=true
Accept: application/json
Authorization: Bearer <access-token>
~~~

Shape mong đợi phía TypeScript:

~~~json
{
  "items": [{ "id": "horse-id", "name": "Comet", "healthStatus": "ELIGIBLE" }],
  "meta": { "totalPages": 1 }
}
~~~

`apiRequest` parse JSON, `horseService.list` gom các page thành `HorseListItemDto[]`, screen/adapter map tên barn/stall và enum health thành view model, rồi danh sách render. JSON trên chỉ là rút gọn minh họa shape, không phải payload capture; item có nhiều field hơn.

Ví dụ submit standalone medical visit với injury:

~~~http
POST /api/v1/horses/horse-id/medical-records
Accept: application/json
Content-Type: application/json
Authorization: Bearer <access-token>
~~~

~~~json
{
  "kind": "ROUTINE",
  "conclusion": "ISSUE",
  "initialDiagnosis": "Lameness",
  "diagnosis": "Illustrative diagnosis",
  "healthStatus": "UNDER_OBSERVATION",
  "healthReason": "Needs follow-up",
  "newInjuries": [{
    "bodyRegion": "LEFT_FRONT_LEG",
    "position": { "x": 0.12, "y": 0.74, "z": 0.31 },
    "injuryType": "SPRAIN",
    "recoveryStatus": "ACUTE",
    "notes": "Illustrative note"
  }]
}
~~~

Service nhận `MedicalRecordDto`; visit screen xử lý response để lấy record/case context, rồi ghi model/frame sidecar cục bộ nếu có marker mới và điều hướng. Response DTO được parse/cast, không schema-validate runtime tổng quát. Field values là ví dụ theo client DTO, không phải tư vấn y tế.

### Một số endpoint cần nhận diện khi đọc flow

- Medical standalone record: `POST /horses/:horseId/medical-records`.
- Case follow-up: `POST /medical-cases/:caseId/visits`.
- Injury history: `GET /horses/:horseId/injuries`.
- Groom today: `GET /grooms/me/today`.
- Notifications: `GET /notifications?limit=50&cursor=...`.
- Performance ingestion: gửi sample có `sourceId`, `recordedAt`, `heartRateBpm`, `speedMps`.

## 5. Pagination và chi phí request

Horse và user list lấy page size 100; measurements dùng 500; horse alert pages dùng limit 100. Một số service lặp đến `meta.totalPages` rồi nối items. Nếu metadata thiếu/sai, behavior phụ thuộc fallback của từng service.

`trainingService.listAllVisibleSessions` tải danh sách horse trước, rồi gọi sessions theo từng horse. Đây là N+1 pattern: tăng latency và số request theo số ngựa nhìn thấy. Không có bằng chứng endpoint backend hỗ trợ batch thay thế trong mobile contract đang dùng.

## 6. Upload media

`media.service.ts` dùng ba bước:

~~~text
POST upload request → nhận signed URL/media ID
PUT bytes tới signed URL → POST complete → dùng media ID ở domain request
~~~

Ảnh incident chấp nhận JPEG/PNG/WebP tối đa 10 MB; video trial chấp nhận MP4/WebM/QuickTime tối đa 200 MB theo client validation. Upload signed URL không đi qua API JSON client giống service thông thường; cần xử lý lỗi ở từng bước. Nếu PUT xong nhưng complete hoặc domain POST lỗi, có thể còn upload chưa được gắn bản ghi.

Checklist evidence dùng `mediaService.uploadChecklistEvidence` (purpose `CHECKLIST_EVIDENCE`). `ChecklistItemDto` có thể mang `evidenceMediaId`/`evidencePhotoUrl`; tick request nhận `done` hoặc `evidenceMediaId`. UI chọn ảnh qua `expo-image-picker`, còn media service xử lý upload. Đây là API contract hiện trong mobile working tree; server acceptance/delivery vẫn cần contract/runtime verification.

## 7. Socket.IO

`realtime.service.ts` kết nối namespace/path `/events`, truyền token trong socket `auth`, dùng websocket transport và bật reconnect. Client nghe `performance.metrics` rồi parse/kiểm tra event shape ở adapter/service. Cơ chế này tách biệt với REST metrics.

`ParticipantPerformanceView` còn nhận tick từ simulator cục bộ. Nếu cùng một metric được simulator append local và server phát lại qua socket, component hiện không dedupe timestamp/source. Đây là rủi ro có điều kiện; cần kiểm tra behavior backend/event delivery để xác nhận có duplicate ngoài thực tế.

## 8. Mock, fallback và giới hạn kiểm chứng

- `src/mocks/raceos.json`, `src/lib/raceos-data.ts` và `RaceOSContext` hỗ trợ fixture/prototype.
- Live route cũ phát chuỗi `liveSeries` hardcoded bằng timer; nó không dùng Socket.IO.
- Simulator có thể vừa phát callback local vừa gửi ingest đến backend nếu có token.
- Catch fallback ở một số dashboard trả danh sách/số rỗng; đó không chứng minh server trả empty.
- DTO chỉ mô tả kỳ vọng của client; không có backend source, database schema, migration, access policy hay log server trong phạm vi audit.

## Câu hỏi để tự kiểm tra

1. `apiRequest<T>` có xác minh response JSON khớp T lúc runtime không?
2. Vì sao `useApiResource` có thể bỏ kết quả cũ nhưng vẫn để request cũ chạy?
3. N+1 xuất hiện ở luồng training nào và ảnh hưởng gì?
4. Upload ảnh cần những bước nào trước khi incident có thể tham chiếu media?
5. Token Socket.IO được đặt ở đâu trong client code?
