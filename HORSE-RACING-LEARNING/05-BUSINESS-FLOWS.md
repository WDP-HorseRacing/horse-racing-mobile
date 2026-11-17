# 05 — Luồng nghiệp vụ đầu-cuối

Tài liệu theo dõi hành vi từ màn hình đến service/state. “API thật” ở đây nghĩa là mobile có request đến contract endpoint; không phải kết luận đã kiểm chứng server hay dữ liệu production. Các luồng dùng fixture/local state được ghi riêng.

## 1. Đăng nhập, khôi phục và thoát

### Đăng nhập

`app/login.tsx` thu email/mật khẩu rồi gọi `useAuth().signIn`. `AuthContext` gửi `POST /auth/login`, lấy token, gọi `GET /auth/me`, ánh xạ role bằng `role-mapper.ts`, rồi mới lưu session và set state. Nếu `me` không có role mobile hỗ trợ, sign-in bị từ chối.

~~~text
Form → AuthContext.signIn → authService.login → apiRequest
     → authService.getMe → role mapping → AsyncStorage → app route
~~~

Email gần đây có key riêng; không phải credential. Session được ghi vào AsyncStorage. Login có API thật theo client contract.

### Khôi phục session

Khi app khởi tạo, `AuthContext` đọc `raceos.auth.session.v1`, xác thực hình dạng dữ liệu cơ bản, refresh token nếu gần hết hạn, rồi gọi `/auth/me`. Timer và sự kiện AppState active cũng có thể kích hoạt refresh. Ref giữ Promise refresh đang chạy để nhiều request 401 không đồng thời khởi tạo nhiều refresh.

### Đăng xuất

Client gửi `POST /auth/logout` với refresh token và device token nếu có, sau đó xóa session cục bộ kể cả khi request thất bại. Điều này kết thúc phiên trên thiết bị; hiệu lực thu hồi token phía server không được kiểm chứng trong repo mobile.

## 2. Route theo role và dashboard

`app/index.tsx` điều hướng user đã đăng nhập sang route theo app role; chưa đăng nhập thì tới login. `AuthRouteGate` kiểm tra role với pathname và chặn truy cập route không khớp. Role backend được map thành trainer, groom, vet, owner hoặc manager. Đây là kiểm soát điều hướng UI; API phải tự kiểm tra quyền ở server.

Dashboard đang dùng `app/[role]/index.tsx` và các component/API hiện hành. Các truy vấn manager được tải song song cho horse, barn, stall, medical, checkups, costs, incidents, stock, pending supply và class; một số truy vấn tùy chọn bắt lỗi rồi dùng mảng/số rỗng. Trainer lấy barn và medical; groom lấy lịch hôm nay và supplies; vet lấy dữ liệu medical; owner lấy horse list. Vì vậy một ô 0 hoặc danh sách rỗng có thể là dữ liệu thực hoặc fallback khi endpoint lỗi.

`src/features/dashboard/components/*Dashboard.tsx` chứa các dashboard cũ dựa trên fixture. Không coi chúng là nguồn dữ liệu dashboard đang chạy nếu route hiện tại không dùng chúng.

## 3. Tìm kiếm và mở hồ sơ ngựa

Danh sách tại `app/[role]/horses.tsx` quản lý tìm kiếm, filter, sort và gọi `horseService.list`. Service tải trang theo `meta.totalPages`; adapter biến DTO thành view model. Trainer/groom có filter mặc định theo barn/ngựa liên quan; filter khác gồm sức khỏe, lifecycle, giới tính, aptitude, barn và placement.

Khi mở hồ sơ, `app/[role]/horse/[id].tsx` phân biệt ID API dạng UUID với nhánh demo. ID API tải horse, permission, dữ liệu theo tab và các service liên quan. Một số tab/biểu đồ vẫn có fixture/local fallback; không phải mọi phần của hồ sơ đều là endpoint thật. Hồ sơ mẫu có thể được dựng từ `src/mocks/raceos.json` và không tự chứng minh có bản ghi trên server.

## 4. Thêm hoặc chỉnh sửa hồ sơ, vị trí và vòng đời

Manager mở form đăng ký/chỉnh sửa; service gửi POST/PATCH theo thao tác. Placement có thể tải barn/stall/workload, gọi preview để xem cho phép/chặn, rồi gọi lệnh gán barn, stall hoặc groom. Preview chỉ là kết quả kiểm tra trước; lệnh ghi mới là thao tác thay đổi.

Lifecycle có bước xem trước và cập nhật trạng thái. Xóa/khôi phục cũng có preview route riêng trước lệnh thực thi. UI dùng permission DTO để ẩn/vô hiệu hóa hành động; server-side authorization không thể suy ra từ UI.

`recentHorses.ts` ghi vài ID gần đây ở AsyncStorage. Đây là tiện ích client, không phải lịch sử server.

## 5. Khám bệnh, ghi nhận y tế và follow-up

Màn `app/[role]/medical/visit.tsx` tải case/horse/request/care/history cần thiết, kiểm tra form, rồi chọn một trong hai đường ghi:

- Khám độc lập: `POST /horses/:horseId/medical-records`.
- Lần khám tiếp của case: `POST /medical-cases/:caseId/visits`.

Chấn thương mới được gửi cùng lần ghi khi form mở case; cập nhật chấn thương gắn với case đang hoạt động. Form giới hạn tổng draft/update theo rule client, yêu cầu marker 3D hợp lệ ở nhánh có injury và kiểm tra các trường sức khỏe. Những ngưỡng validation nằm trong source mobile; không có bằng chứng chúng được chuyên gia/server xác nhận.

Sau khi API ghi thành công, client lưu thêm metadata vị trí 3D vào AsyncStorage. Nếu bước sidecar local này lỗi, bản ghi y tế đã có thể tồn tại ở server nhưng marker không khôi phục được trên thiết bị. API timeline hiện chứa vị trí x/y/z nhưng không chứa model version/frame.

## 6. Đóng case y tế và sửa kết luận

Trang case tải case, horse, injury history, request và preview đóng case. Vet có thể gửi kết luận cuối, xử lý training lock theo lựa chọn giữ/nhả, và đánh dấu ngựa deceased nếu UI cho phép. Case đã đóng có luồng correction riêng. Preview đóng case cung cấp dữ liệu cho quyết định UI; chỉ endpoint close mới lưu trạng thái. Chi tiết xử lý khóa/điều kiện cuối cùng của server nằm ngoài mobile repo.

## 7. Groom: checklist, chạy tập, care và incident

`groomService.getToday()` gọi `/grooms/me/today`; adapter chuyển checklist, training run và care schedule thành task UI. Tùy trạng thái, groom có thể check-in, mark ready, hoàn tất chăm sóc hoặc tick checklist. Khi hoàn tất checklist, `ChecklistEvidenceSheet` cho chụp ảnh hoặc chọn từ library; ảnh tùy chọn. Ảnh được upload theo purpose `CHECKLIST_EVIDENCE`, sau đó PATCH checklist với `evidenceMediaId`; nếu không ảnh, gửi `done: true`. Checklist item trả về có thể chứa media ID hoặc photo URL để hiển thị evidence. Screen thường refresh sau thao tác; không thấy hàng đợi offline để gửi lại khi mạng quay lại.

Incident có thể chọn ảnh, upload media trước để lấy `photoMediaId`, rồi gọi report incident. Refer/resolve là thao tác riêng. Nếu upload thành công nhưng report lỗi, media đã tải lên có thể chưa được gắn với incident.

## 8. Lớp tập, người tham gia và đánh giá

Trainer có thể quản lý subject/plan/class, enroll horse, tạo hoặc cập nhật session, điểm danh, đánh dấu ready/start/complete/stop, và ghi evaluation/trial result/time trial. Service ở `training.service.ts` gom endpoint domain. `listAllVisibleSessions` trước tiên lấy ngựa nhìn thấy rồi lấy session cho từng ngựa; số request tăng theo số ngựa (N+1 pattern).

Trang tham gia buổi tập có thể hiển thị performance metrics qua REST và Socket.IO. Simulator tạo metric giả trên thiết bị để demo; không nhầm metric simulator với dữ liệu cảm biến vật lý.

## 9. Supplies, phí, báo cáo và thông báo

Supplies hỗ trợ item/stock, receipt, usage, lot/movement và request. Request có các bước tạo, chỉnh sửa/trạng thái; usage có cancel. Daily fees và finance/owner cost reports là các luồng đọc riêng. Endpoint báo cáo/chi phí được gọi từ mobile; công thức tính và dữ liệu nguồn do server quyết định, không nằm trong repo này.

Notifications tải theo cursor/limit và hỗ trợ đánh dấu đã đọc. Push-device registration gửi token thiết bị lên `/me/devices`; nhánh đăng ký push được triển khai cho Android. Không khẳng định push backend đã gửi/nhận thành công chỉ từ client code.

## 10. Live screen: demo cục bộ và realtime

`app/[role]/live/[id].tsx` đang dùng `liveSeries` hardcode và timer tăng điểm theo khoảng 1.6 giây. Màn này là mock visualization, không phải websocket stream.

Màn performance của participant dùng `performance.service.ts`, Socket.IO client và `sensor-simulator.ts`. Socket kết nối `/events` bằng auth token trong socket auth và nghe `performance.metrics`; simulator cũng có callback local mỗi tick và có thể gửi ingest lên backend khi có token. Đây là hai cơ chế khác nhau, cần phân biệt khi demo. Nếu server echo lại chính metric ingest trên socket, component có nguy cơ thêm trùng vì không thấy dedupe theo timestamp/source; điều này phụ thuộc hành vi server.

## 11. Phân biệt trạng thái dữ liệu

| Tình huống | Dấu hiệu trong source | Cách mô tả chính xác |
|---|---|---|
| API-backed | Service gọi `apiRequest` đến endpoint | Mobile có tích hợp contract; backend chưa được audit |
| Fixture/mock | `src/mocks`, hardcoded series, sample metric | Dữ liệu minh họa/demo |
| In-memory prototype | `RaceOSContext` | Mất khi app/runtime bị khởi động lại |
| Device-local | AsyncStorage keys | Chỉ tồn tại trên thiết bị cục bộ theo key |
| Fallback sau lỗi | `.catch(() => [])`, giá trị mặc định | UI có thể trông như dữ liệu rỗng; lỗi không nhất thiết được hiển thị |

## 12. Ma trận actor và luồng theo role

| Actor đã map | Luồng có trong mobile | Trạng thái dữ liệu điển hình |
|---|---|---|
| Head Trainer (`trainer`) | Horse list/barn, medical views, plan/class/session, participant, evaluation/trial, performance | API-backed cùng một số simulator/fallback |
| Veterinarian (`vet`) | Medical dashboard, checkup/request, visit/case, injury timeline, care, lock và close/correction | API contract; injury model metadata có sidecar local |
| Groom (`groom`) | Today's tasks, checklist, training check-in/ready, care completion, incident/photo | API-backed; ảnh qua media upload workflow |
| Horse Owner (`owner`) | Horse/profile, training/session remarks/video và costs/report theo route đang có | Chủ yếu service/API; một số profile/chart có fallback |
| Club Manager (`manager`) | Horse lifecycle/placement, stable, staff/users, training, supplies, finance/dashboard | Nhiều API aggregation; một số lỗi endpoint bị biến thành empty/zero |

Danh sách chức năng mô tả route và service phía mobile; chưa chứng minh server permission/data scope theo từng actor.

## 13. Sequence diagrams cho luồng quan trọng

### Login và khôi phục role

~~~mermaid
sequenceDiagram
  actor U as User
  participant UI as app/login.tsx
  participant A as AuthContext
  participant S as auth.service
  participant C as api-client
  participant B as Backend API
  U->>UI: email/password
  UI->>A: signIn(credentials)
  A->>S: login(credentials)
  S->>C: POST /auth/login
  C->>B: JSON request
  B-->>C: access + refresh token
  C-->>A: token pair
  A->>S: getMe(accessToken)
  S->>B: GET /auth/me
  B-->>A: user + role codes
  A->>A: map role and persist session
  A-->>UI: signed-in state
~~~

Nếu `/auth/me` lỗi hoặc role không hỗ trợ, app không hoàn tất session như một đăng nhập hợp lệ. Payload ở sơ đồ là hợp đồng mobile mong đợi, không phải response capture.

### Medical visit và sidecar injury

~~~mermaid
sequenceDiagram
  actor V as Veterinarian
  participant UI as medical/visit.tsx
  participant M as Injury3DMapper
  participant API as medical.service / api-client
  participant B as Backend API
  participant L as injury-model-metadata / AsyncStorage
  V->>UI: nhập khám và injury
  UI->>M: mở model, chọn marker
  M-->>UI: local position + region/type/status
  V->>UI: xác nhận và submit
  UI->>API: create standalone record hoặc follow-up visit
  API->>B: POST medical endpoint
  B-->>UI: record/case response
  UI->>L: persist model/frame sidecar
  UI-->>V: điều hướng tới case/visit
~~~

Nếu API write thành công nhưng sidecar write lỗi, record và marker persistence có kết quả khác nhau; xem [08-3D-INJURY-MAPPING.md](08-3D-INJURY-MAPPING.md).

### Groom incident kèm ảnh

~~~mermaid
sequenceDiagram
  actor G as Groom
  participant UI as IncidentsScreen
  participant Media as media.service
  participant Store as Signed media storage
  participant API as stable-care.service
  participant B as Backend API
  G->>UI: mô tả incident + chọn ảnh
  UI->>Media: request upload
  Media->>B: POST upload request
  B-->>Media: signed URL + media ID
  Media->>Store: PUT image bytes
  Store-->>Media: upload status
  Media->>B: POST upload complete
  UI->>API: report incident(photoMediaId)
  API->>B: POST /incidents
  B-->>UI: incident response
~~~

Upload complete và tạo incident là hai side effect tách rời; lỗi ở bước cuối có thể để media chưa được tham chiếu.

### Groom hoàn tất checklist có ảnh bằng chứng

~~~mermaid
sequenceDiagram
  actor G as Groom
  participant UI as app/groom/tasks.tsx hoặc work route
  participant Sheet as ChecklistEvidenceSheet
  participant Media as media.service
  participant Storage as Signed media storage
  participant Care as stable-care.service
  participant API as Backend API
  G->>UI: chọn task chưa hoàn tất
  UI->>Sheet: mở sheet evidence
  G->>Sheet: chụp/chọn ảnh hoặc bỏ qua
  Sheet-->>UI: local photo asset hoặc null
  alt Có ảnh
    UI->>Media: uploadChecklistEvidence
    Media->>API: POST upload request (CHECKLIST_EVIDENCE)
    API-->>Media: signed URL + media ID
    Media->>Storage: PUT file bytes
    Storage-->>Media: upload accepted
    Media->>API: POST upload complete
    Media-->>UI: evidenceMediaId
    UI->>Care: PATCH checklist item {evidenceMediaId}
  else Không ảnh
    UI->>Care: PATCH checklist item {done: true}
  end
  Care->>API: update checklist
  API-->>UI: checklist DTO
  UI->>UI: refresh list and close sheet
~~~

Nếu upload xong nhưng checklist PATCH lỗi, media có thể chưa được gắn task; thao tác và upload không phải một transaction duy nhất.

## 14. Flow contract: điều kiện, thành công và lỗi

| Flow / actor | Điều kiện trước | Hành động và request | Trạng thái khi thành công | Nhánh lỗi cần giải thích |
|---|---|---|---|---|
| Login / mọi role | Có credential và network; app phải hiểu role server trả về | Submit → `POST /auth/login` → `GET /auth/me` | Session lưu local, route theo mapped role | Invalid credential/network/unsupported role không hoàn tất login; server token policy chưa xác minh |
| Horse list/profile / role có route | Session/token; ID thật cho API branch | GET pages/detail/permissions → adapter → UI | List/profile cập nhật theo server response | Pagination/error; một số screen có fixture fallback; empty có thể là fallback |
| Placement / manager | Horse và capability/action phù hợp trong UI | Preview barn → user xác nhận → PUT barn/placement/stall/groom | Screen refresh profile/list sau mutation | Blocked preview không commit; update lỗi phải giữ/refresh authoritative state |
| Medical visit / vet | Horse/case context tải được; form hợp lệ; marker hợp lệ nếu có injury | POST standalone record hoặc follow-up visit | Record/case response; sidecar ghi nếu có marker | API error không tạo success state; nếu sidecar lỗi sau API success thì record/marker diverge |
| Close medical case / vet | Case mở và close preview được tải | Nhập conclusion/lock decision → POST close; correction dùng PATCH conclusion | Response case mới, UI chuyển về detail/list | Preview không đảm bảo close commit; lock release/server rules cần backend xác nhận |
| Checklist completion / groom | Task actionable và có token; photo permission nếu chọn ảnh | Optional camera/library → upload → PATCH `evidenceMediaId`; không ảnh thì PATCH `done` | Refresh checklist, ảnh có thể xem lại qua media URL | Hủy picker không ghi; upload/PATCH lỗi báo Alert; upload xong PATCH lỗi có thể tạo orphan media |
| Incident / groom | Horse/description; ảnh optional | Optional upload → POST `/incidents`; refer/resolve endpoint riêng | Incident DTO hiển thị sau refresh | Upload success + report failure tách hai side effect; network retry cần tránh tạo incident trùng |
| Training session / trainer + groom | Class/session/participant tồn tại và state cho phép action | Enroll/session CRUD; participant check-in/ready/start/complete/stop; evaluation/trial | DTO response được map lại vào calendar/participant screen | Server có thể từ chối transition; local simulator không chứng minh participant state backend |
| Supplies / manager | Role UI cho phép; item/request hợp lệ | POST receipt/usage/request; PATCH status; cancel usage | Stock/request DTO cập nhật và list refresh | Không thấy offline queue; lỗi có thể xảy ra sau backend commit nếu response mất |
| Performance / trainer view | Session participant ID; token tùy ingestion | REST summary/metrics; simulator local tick và có thể POST ingest; Socket.IO event song song | Metric points/summary cập nhật chart | Socket disconnect/reconnect; metric duplicate là khả năng nếu server echo; data simulator không phải hardware |
| Notifications / user | Session và cursor hiện tại | GET `/notifications?limit=50&cursor=...`; PATCH read/all | Feed/counter cập nhật | Pagination/network errors theo screen; push delivery không được chứng minh bởi inbox API |

Preconditions thể hiện điều kiện phía client/source. Backend vẫn có thể áp dụng điều kiện bổ sung và là nơi quyết định cuối cùng.

## Câu hỏi để tự kiểm tra

1. Login hoàn tất ở bước nào: nhận token hay xác nhận `/auth/me` và role?
2. Vì sao preview placement không được coi là cập nhật đã lưu?
3. Nếu API ghi medical record thành công nhưng AsyncStorage sidecar lỗi, dữ liệu nào đã tồn tại?
4. Live route hardcode khác performance screen realtime ở điểm nào?
5. Nêu một tình huống dashboard hiển thị 0 do fallback thay vì server trả 0.
