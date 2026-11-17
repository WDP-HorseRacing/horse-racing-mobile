# 04 — Deep dive theo module

Code evidence mô tả điều mobile làm. Những điều server thực hiện chỉ được khẳng định nếu mobile response/type chứng minh được; backend không nằm trong source audit.

## Module 1 — Authentication, navigation, role

### A. Module overview

Đưa user vào workspace dựa trên role server trả về, giữ session qua lần mở app và tránh điều hướng nhầm role ở UI. Có năm role map trong source.

### B. File structure

- app/login.tsx — form, nhớ email, submit và hiển thị lỗi.
- app/_layout.tsx — Provider tree, notification handler, stack.
- app/index.tsx — root redirect.
- src/context/AuthContext.tsx — restore/sign-in/sign-out/refresh/session.
- src/features/auth/AuthRouteGate.tsx — route guard.
- src/features/auth/role-mapper.ts, roles.ts — role map và nav config.
- src/services/auth.service.ts — endpoint wrapper.
- src/services/api-client.ts — bearer/401 retry/error.

### C. Execution flow

~~~text
Email/password
→ signIn
→ POST /auth/login
→ token pair
→ GET /auth/me
→ map response roles[]
→ persist session
→ route gate chuyển về /{app-role}
~~~

Restore flow: đọc raceos.auth.session.v1 → parse accessToken/refreshToken → refresh nếu gần hết hạn → GET /auth/me → set user/role. AppState active và timer cũng thử refresh.

### D. Code walkthrough

- authService.login chỉ gửi email/password JSON; nó không tự lưu state.
- AuthContext.signIn gọi login, đặt sessionRef để request kế tiếp có token, gọi getMe, từ chối nếu không map được app role, rồi mới persist session và set React state.
- refreshAccessToken giữ một Promise đang chạy trong ref. Nếu nhiều request gặp 401 cùng lúc, các request có thể chờ chung lượt refresh; sau đó mỗi request retry một lần qua api-client.
- AuthRouteGate chỉ xem pathname và role. Screen còn dùng horseService.getPermissions để quyết định tab/action theo hồ sơ.
- Xóa logic restore sẽ khiến app yêu cầu đăng nhập lại hoặc không xác định được role; bỏ check role sẽ làm UI điều hướng sai, nhưng không thay được permission check server.

### E. Knowledge foundation

**Token:** credential gửi cùng request. Ví dụ ngoài app: thẻ ra vào. Trong source, access token được đính kèm trong Authorization header dạng Bearer; refresh token dùng gọi refresh endpoint. Hỏi hội đồng: refresh token khác access token thế nào?

**Context:** vùng state React được nhiều component đọc mà không truyền prop qua nhiều tầng. Ví dụ đơn giản: theme context. Trong source, useAuth() lấy user/token/role. Dùng cho session dùng chung, không phải để lưu mọi API response.

**Role mapping:** chuyển mã role backend thành route role nội bộ. Trong source, HEAD_TRAINER → trainer. Nếu response có nhiều role, appRoleFromAuthRoles lấy role đầu tiên trong mảng map được.

**Async/Await:** cú pháp làm việc với Promise bất đồng bộ. Trong source: login, refresh, getMe. Hội đồng có thể hỏi vì sao phải đặt try/catch/finally quanh sign-in.

## Module 2 — API client, service, resource hook

### A. Module overview

Tách HTTP mechanics khỏi từng domain: service nói endpoint/payload; api-client nói header, timeout, parse và lỗi. useApiResource nối screen với read request.

### B. File structure

- src/config/api.ts — API base URL và tìm Metro host.
- src/services/api-client.ts — apiRequest<T>, ApiError.
- src/hooks/useApiResource.ts — load/refresh/error/stale request.
- src/hooks/useRefreshOnFocus.ts — revalidate khi screen focus.
- src/utils/errorHandler.ts, src/components/common/AsyncStateView.tsx — đưa lỗi tới UI.
- src/adapters/* — các mapper theo domain.

### C. Execution flow

Screen callback → service method → apiRequest → fetch → parse → service resolve/reject → hook state → UI.

### D. Code walkthrough

- ApiRequestOptions nhận token, body, signal, timeout và RequestInit.
- Body được JSON.stringify; Content-Type được thêm khi body không undefined.
- AbortController gắn timeout mặc định 15,000 ms và chuyển tiếp abort từ caller.
- 204 trả undefined; HTTP error tạo ApiError; network/timeout có message riêng.
- Khi 401 và có token + refresh handler, client gọi refresh handler; nếu nhận token mới thì chạy request lại với cờ không refresh thêm.
- LatestRequestGuard.begin() tăng generation. Response chỉ cập nhật nếu đúng generation đang hoạt động.
- Cần phân biệt lỗi transport (mất mạng/timeout), lỗi HTTP (status 4xx/5xx) và lỗi validation trong form.

Nếu bỏ API client, mỗi service phải lặp header, timeout, parse, auth refresh và error mapping. Nếu bỏ generation guard, thao tác tìm kiếm nhanh có thể để request chậm cũ ghi đè kết quả mới.

### E. Knowledge foundation

**REST API:** giao tiếp request/response qua HTTP. Ví dụ ngoài app: GET danh sách sách. Trong source: GET /horses; POST /medical-cases/:id/visits. Hội đồng có thể hỏi GET/POST/PATCH/PUT khác nhau thế nào.

**DTO:** kiểu mô tả dữ liệu truyền qua API; nó không tự xác minh JSON thật khi runtime. Trong source: HorseListItemDto, MedicalRecordDto. DTO làm rõ contract phía client.

**Adapter/mapper:** chuyển shape dữ liệu thành shape thuận cho UI. Trong source: mapHorseSummary, mapTrainingSessions. Ví dụ: map health UNDER_OBSERVATION thành status nhãn MONITOR. Không nhầm adapter với database repository.

**Error propagation:** lỗi đi từ fetch/service lên hook/screen. Trong source: ApiError có status/payload, extractErrorMessage chọn lỗi field/message. Câu hỏi: lỗi 401 khác lỗi offline thế nào?

## Module 3 — Hồ sơ ngựa, ownership, placement và stable

### A. Module overview

Đây là domain dữ liệu trung tâm: danh sách ngựa, hồ sơ, vị trí barn/stall, người sở hữu, phép sửa, đo lường và vòng đời. Nhiều role có route xem; permission chi tiết dựa vào API permission DTO.

### B. File structure

- app/[role]/horses.tsx — tìm kiếm/filter/sort danh sách.
- app/[role]/horse/[id].tsx — hồ sơ nhiều tab, API + một số fixture fallback.
- app/[role]/horse/[id]/measurements.tsx, ownership.tsx, placement.tsx.
- app/manager/register-horse.tsx, edit-horse/[id].tsx, lifecycle/[id].tsx.
- src/services/horse.service.ts, stable.service.ts, users.service.ts.
- src/adapters/horse.adapter.ts, src/features/horses/components/*.
- src/utils/recentHorses.ts — recent horse IDs cục bộ.

### C. Execution flow

Horse list: input → debounce 300 ms → horseService.list(token, search, filters) → service page loop → mapper → FlatList. Filter role mặc định: trainer myBarns, groom myHorses; filter khác gồm health/lifecycle/gender/aptitude/barn/placement/deleted.

Horse placement: tải horse + permission + barn/stall/workload theo role → user chọn → có thể gọi preview → submit assignBarn, assignStall, assignGroom hoặc placeHorse → refresh profile/list.

### D. Code walkthrough

- horseService.list lấy page 1 limit 100, lặp tới meta.totalPages, gom items.
- mapHorseSummary chuyển DTO lồng location thành tên barn/stall; mapHealthStatus đổi trạng thái backend thành enum UI.
- HorsePermissionsDto là capability flags như canEditProfile/canAssignStallAndGroom/canViewMedicalTab. UI dùng flags để mở tab/action.
- placement.tsx có preview barn trước khi assign; preview response có allowed và blockedReason. Preview không phải bằng chứng transaction đã commit.
- RaceAptitude/profile/health changes có request riêng.

### E. Knowledge foundation

**Pagination:** chia danh sách lớn thành trang. Trong source horse/user/supplies/training services lặp theo totalPages. Nếu totalPages thiếu, một số vòng lặp mặc định dừng ở trang hiện tại.

**Permission vs role:** role là nhóm người dùng; permission là hành động cụ thể trên resource. Trong source có role route gate và HorsePermissionsDto. Không khẳng định backend an toàn chỉ từ việc button bị ẩn.

**Server-confirmed update:** UI đợi request rồi refresh ở nhiều thao tác, thay vì luôn đổi trước kết quả server. Hội đồng có thể hỏi điều gì xảy ra nếu request thành công nhưng refresh lỗi.

## Module 4 — Groom, daily care và incident

### A. Module overview

Groom xem ngựa được giao, checklist, feeding plan, lịch chạy, care schedule và appointment; có thể đánh dấu checklist/training/care và báo incident. Checklist có thể đính kèm ảnh bằng chứng tùy chọn; incident có thể đính kèm ảnh riêng.

### B. File structure

- app/groom/tasks.tsx, app/groom/stable.tsx, app/groom/report.tsx.
- src/features/stable-care/ChecklistEvidenceSheet.tsx, IncidentsScreen.tsx, HorseStableCareScreen.tsx.
- src/services/groom.service.ts, stable-care.service.ts, media.service.ts.
- app/[role]/work.tsx, app/groom/tasks.tsx, src/features/dashboard/components/RoleDashboard.tsx — entry points checklist evidence.
- src/adapters/groom.adapter.ts; task card và evidence UI.

### C. Execution flow

GET /grooms/me/today → service chuẩn hóa nested arrays → screen map task → user chọn complete. Với checklist, `ChecklistEvidenceSheet` cho phép chụp ảnh hoặc chọn thư viện; ảnh là optional. Nếu có ảnh, upload media lấy `evidenceMediaId` rồi PATCH checklist item; nếu không ảnh, PATCH `{done: true}`. Training/care action dùng operation riêng; sau đó screen refresh.

Incident photo: chọn ảnh → upload request signed URL → PUT bytes → POST complete → POST /incidents với horseId/description/urgent/photoMediaId. Incident được đọc qua /incidents; refer/resolve có endpoint riêng.

### D. Code walkthrough

- groomService.getToday gọi API rồi arrayOrEmpty cho một số nested arrays để tránh crash nếu response thiếu array.
- mapGroomTodayToTasks chuyển checklist item, training run, care schedule thành Task UI. Training status quyết định nút Check in / Mark ready / không action.
- Checklist evidence được upload thành mediaId; sau đó stableCareService.tickChecklistItem gửi evidenceMediaId hoặc done/note.
- `ChecklistEvidenceSheet` xin quyền camera/photo library, hiển thị preview, và trả asset local cho caller; upload/patch được orchestration ở screen.
- `ChecklistEvidenceLink` tải download URL theo media ID hoặc dùng photo URL sẵn có để hiển thị ảnh bằng chứng đã lưu.
- IncidentsScreen dùng mediaService.uploadIncidentPhoto trước khi gọi reportIncident.
- Sau thao tác, screen refresh danh sách; offline queue không thấy trong source.

### E. Knowledge foundation

**Async sequence:** upload và save là hai request tuần tự vì incident/checklist cần mediaId trước. Ví dụ ngoài app: tải file rồi tạo record tham chiếu file.

**State machine:** trạng thái và action hợp lệ phụ thuộc trạng thái hiện tại. Trong source participant status quyết định check-in/ready; incident OPEN có resolve/refer. Mobile có thể ẩn action nhưng server phải xác nhận luật.

**File upload:** server cấp URL + headers; app PUT file trực tiếp tới storage rồi gọi complete. Đây là signed upload workflow, không phải gửi ảnh base64 trong JSON.

## Module 5 — Medical, case, visit và training lock

### A. Module overview

Veterinarian dùng workspace xem dashboard, requests, checkups, cases, records, injury timeline, care schedule; ghi khám, cập nhật sức khỏe, kê đơn, tạo injury, follow-up, khóa huấn luyện và đóng case. Trainer/manager/owner có một số read views theo role.

### B. File structure

- app/[role]/medical.tsx → src/features/medical/MedicalWorkspaceScreen.tsx.
- app/[role]/medical/visit.tsx — create standalone/follow-up visit, form validation.
- app/[role]/medical/cases/index.tsx, cases/[id].tsx, visits/[id].tsx, visits/edit/[id].tsx.
- app/[role]/medical/requests.tsx, checkups.tsx, care.tsx, costs.tsx.
- app/vet/injury/[id].tsx, lock/[id].tsx.
- src/services/medical.service.ts, src/adapters/medical.adapter.ts.
- src/features/medical/medical-validation.ts và injury-mapper/.

### C. Execution flow

Visit screen tải case nếu có, rồi horse, requests, care instructions, cases, records, injuries. Khi submit:

1. Validate request linkage, diagnosis, health reason, dates, measurement ranges, prescription fields, injury count/status.
2. Hiện confirmation alert.
3. Nếu có caseId, gọi POST /medical-cases/:caseId/visits; nếu không, gọi POST /horses/:horseId/medical-records.
4. Injury mới chỉ gửi khi form sẽ mở case; injury follow-up gửi injuryUpdates.
5. Dùng response để xác định record/case; ghi metadata local cho injury points mới; điều hướng tới case hoặc visit.

### D. Code walkthrough

- MedicalDashboardDto mô tả dashboard với herd, checkups, careSchedules, openCases, prescriptions, requests.
- MedicalRecordDto mô tả record trả về: examDate, diagnosis, resultingStatus, prescriptions, injuries, caseId, cost.
- InjuryTimelineItemDto gom injuryId/bodyRegion/position/current status/history. Field position chỉ có x/y/z; không có model version/frame.
- Visit form kiểm tra injury draft confirmed, injury type/region/recovery và coordinate range qua isValidInjuryDraft.
- closeCase trước đó tải close preview; UI cho nhập finalConclusion và lock decision. Nếu giữ lock thì cần ngày giờ kỳ vọng gỡ lock hợp lệ.
- medical-validation.ts còn định nghĩa dải đo lường client-side (weight/height/BCS/temperature). Đây là validation constants trong app, không phải bằng chứng chuẩn thú y đã được xác thực.

### E. Knowledge foundation

**Clinical record:** một bản ghi khám theo thời điểm. Trong source MedicalRecordDto có các trường khám và kết quả; case gom nhiều visits. Hội đồng có thể hỏi case và record khác nhau thế nào.

**Auditability:** ghi lý do và người/thời điểm để hiểu thay đổi. Source có void/reason, cost adjustment reason, conclusion correction reason, audit.service. Chưa thể khẳng định mọi mutation đều có audit ở backend.

**Validation:** kiểm tra dữ liệu trước khi gửi. Ví dụ: ngày kết thúc không sớm hơn ngày bắt đầu. Trong source: prescription/visit/measurement checks. Vẫn cần server validation vì client có thể bị bypass.

## Module 6 — 3D Injury Mapping

### A. Module overview

Một WebView hiển thị model horse GLB bằng Three.js, hỗ trợ xoay/zoom, raycast chọn bề mặt, marker và native form xác nhận injury. Asset record nói rõ model không dùng làm chẩn đoán hoặc đo giải phẫu.

### B. File structure

- src/features/medical/injury-mapper/Injury3DMapper.tsx — React Native modal, assets, bridge, form, drafts.
- viewer-entry.ts — Three.js canvas, camera, loader, controls, raycast, marker rendering.
- injury-coordinate.mjs và .d.mts — world point → horse root local.
- injury-regions.mjs — heuristic region suggestion.
- injury-mapper.types.ts, policy.ts, protocol.ts — enums, validation, JSON bridge protocol.
- injury-model-metadata.ts — AsyncStorage version/frame sidecar.
- scripts/build-injury-mapper.mjs và assets model v1/v2 + viewer bundle.
- medical visit/case/visit detail và app/vet/injury/[id].tsx — integration points.

### C. Execution flow

Injury3DMapper mở → Asset/GLB đọc cục bộ → bundle HTML trong WebView → model gửi Base64 theo chunks → GLTFLoader → camera fit → user chạm mesh → worldToLocal → validate bounds → suggest region → native editor xác nhận → visit payload.

### D. Code walkthrough

- viewer-entry.ts tạo PerspectiveCamera, WebGLRenderer, Hemisphere/Directional lights, OrbitControls.
- Trong mark mode, một tap phải dịch chuyển tối đa 7 px và chỉ có một pointer. Kéo/pinch không đặt điểm.
- Screen point đổi thành normalized device coordinates; Raycaster tìm marker trước, sau đó tìm mesh horse.
- Hit world point đổi sang root-local. Bounds: x trong [-0.8, 0.8], y trong [-0.1, 2.4], z trong [-1.5, 1.6], mọi tọa độ finite.
- Region được đề xuất dựa theo x/y/z. Người dùng có thể đổi region/type/recovery/notes.
- Visit service gửi newInjuries gồm bodyRegion, position, injuryType, recoveryStatus, notes nếu có.

### E. Knowledge foundation

**Coordinate frame:** hệ trục tham chiếu để con số có ý nghĩa. Ví dụ: vị trí trong bản đồ xe phụ thuộc origin và hướng Bắc. Ở source: HORSE_ROOT_LOCAL; +Y lên, +Z hướng đầu, +X là bên trái con ngựa theo third-party asset note.

**Raycasting:** bắn một tia từ camera qua vị trí tap để tìm mesh giao nhau. Ví dụ: chọn vật thể trong game bằng click. Source giữ điểm hit 3D, không chuyển thành pixel hoặc anatomical landmark.

**Model versioning:** cùng tọa độ chỉ so sánh đúng nếu model/frame tương thích. Source đánh dấu version/frame trong AsyncStorage local metadata và yêu cầu match. Backend DTO chưa chứa hai field đó.

## Module 7 — Training, performance và realtime

### A. Module overview

Trainer/manager cấu hình subject/plan/class/session; ngựa được enroll; participant state đi từ planned/check-in/ready/ongoing tới completed/stopped, hoặc absent/ineligible/cancelled. Performance lưu heart rate/speed, hiển thị chart và nhận event socket.

### B. File structure

- app/trainer/training.tsx, plans.tsx, class/new.tsx, plan/[id].tsx, plan/[id]/session/[sessionId].tsx.
- app/trainer/participant/[id].tsx, eval/[id].tsx, trial-result/[id].tsx.
- app/manager/training.tsx, app/owner/training.tsx và session/trial/remark screens.
- src/services/training.service.ts, performance.service.ts, realtime.service.ts.
- src/adapters/training.adapter.ts.
- src/features/training/sensor-simulator.ts, TrialVideoPicker.tsx, calendar view.
- src/features/performance/components/ParticipantPerformanceView.tsx.

### C. Execution flow

Trainer đọc plans/classes/sessions → chọn class/participant → groom check-in/ready → trainer start/complete/stop → ingest metric → performance.metrics socket update → evaluate/trial record/video upload → owner đọc sessions/remarks/video.

### D. Code walkthrough

- trainingService gom REST operations theo subject/plan/class/session/participant/evaluation/trial.
- mapTrainingSessions đổi DTO status và datetime thành view model label; trạng thái participant và session đều ảnh hưởng kết quả.
- performanceService.ingestMetric POST sourceId/recordedAt/heartRateBpm/speedMps.
- subscribeToPerformanceMetrics kết nối /events, truyền token trong Socket.IO auth, chỉ nhận event shape hợp lệ, reconnect với delay.
- sensor-simulator.ts tự tạo data bình thường 135–159 bpm; sendHeartRateSpike dùng 248 bpm. Đây là simulator IoT, không phải đọc cảm biến phần cứng.
- app/[role]/live/[id].tsx là route demo fixture khác với ParticipantPerformanceView realtime-backed.

### E. Knowledge foundation

**WebSocket/realtime:** giữ kết nối để server push event, khác request REST chỉ trả lời khi client hỏi. Trong source: Socket.IO performance.metrics. Hội đồng có thể hỏi reconnect có không: có, reconnect bật với delay cấu hình.

**Simulator:** tạo dữ liệu giả theo code để demo/kiểm tra luồng. Trong source startSimulation gọi local onTick rồi gửi ingest bất đồng bộ nếu có token. Không khẳng định đang đọc thiết bị IoT thật.

**State transition:** ParticipantStatus là trạng thái người tham gia buổi tập. UI map trạng thái sang planned/in_progress/completed/cancelled/ineligible. Nguyên nhân lock injury phía server phải xác minh backend.

## Module 8 — Media, notification, UI và localization

### A. Overview / files

- src/services/media.service.ts — image/video upload, download URL.
- src/services/notifications.service.ts, push-device.service.ts.
- src/features/alerts/components/NotificationsFeed.tsx.
- src/components/common/* và src/components/ui/* — shared UI primitives.
- src/context/I18nContext.tsx và src/data/locales/* — en/vi.

### B. Flow và walkthrough

Ảnh/video: validate MIME/size → POST /media/upload-requests → PUT file tới signed URL → POST /media/:assetId/complete → lưu asset ID vào nghiệp vụ. Image tối đa 10 MB; trial video tối đa 200 MB; format video MP4/WebM/QuickTime.

Notification inbox gọi /notifications?limit=50, đánh dấu read bằng PATCH; horse alerts page qua pages. Push token hiện chỉ đăng ký Android (Platform.OS === android); app request permission hoặc chỉ đăng ký nếu permission đã granted.

Shared UI gồm Screen, AsyncStateView, Button, Field, Panel, DatePickerField, Chips và component chart. UI logic không thay thế service/data contract.

### C. Knowledge foundation

**Signed URL:** URL tạm thời có quyền upload/download được cấp trước. Trong source binary PUT dùng uploadUrl/headers server trả về; API complete chốt asset.

**Localization:** text được chuyển qua t() và JSON catalog. I18nContext tạo English reverse map từ tiếng Việt và có một số heuristic cho template/compound phrase; không phải mọi chuỗi đều được dịch nhờ catalog đầy đủ.

**Shared component:** component trình bày dùng chung; ví dụ AsyncStateView dùng chung loading/error/empty. Dùng để giảm lặp UI, nhưng không chứa domain business rule.
