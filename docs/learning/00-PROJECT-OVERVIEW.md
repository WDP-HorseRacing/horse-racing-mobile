# 00 — Tổng quan dự án HorseRacing Mobile

> Tài liệu được lập từ implementation trong repo **stable-os-vet-3d-injury-mapping**. Tên source trong yêu cầu có thứ tự từ khác; thư mục thực tế được kiểm tra là  
> **/Users/dungnguyen/Documents/CODE-PROJECT/WDP/stable-os-vet-3d-injury-mapping**.

## Mục đích của bộ tài liệu

Đây là giáo trình để bạn lần theo code và giải thích được quyết định kỹ thuật khi bảo vệ. Mỗi nhận định được phân thành:

- **Implemented** — có code đang được route hoặc module gọi.
- **Partially implemented** — có phần xử lý nhưng còn giới hạn.
- **Mocked / hardcoded** — dữ liệu hoặc hành vi được tạo sẵn trong source.
- **Not found / cannot verify** — không thấy bằng chứng trong mobile source hoặc cần backend/device để xác nhận.

Phạm vi được scan là source mobile, không phải backend. Do đó API endpoint và DTO trong tài liệu phản ánh **hợp đồng mà mobile mong đợi**; chưa thể xác nhận backend thật có triển khai đúng hay dữ liệu thật có đúng schema. Các ví dụ request/response là ví dụ dựng từ TypeScript DTO, không phải capture từ server.

## Bản tóm tắt một phút

- **Framework:** React Native 0.88.1, Expo SDK 58 theo package.json; TypeScript strict; Expo Router 58.
- **Ứng dụng:** iOS, Android và web export; project name là HorseRacing.
- **Điểm vào:** package.json đặt main là expo-router/entry; app/_layout.tsx tạo provider tree và route gate.
- **Điều hướng:** file-based routing trong app/; route theo vai trò như /trainer, /vet, /groom, /owner, /manager.
- **Kiến trúc thực tế:** UI screen trong app/ và src/features/ gọi service trực tiếp hoặc qua hook; service gọi API client; adapter chuyển một số DTO sang model UI. Đây là kiến trúc theo feature/service, không phải Clean Architecture được phân lớp độc lập hoàn toàn.
- **State:** state cục bộ React cho form/screen; AuthContext và I18nContext dùng chung; API-backed data thường qua useApiResource; fixture demo nằm trong src/data/fixtures.
- **Backend giao tiếp:** fetch qua src/services/api-client.ts, Bearer token, JSON, timeout 15 giây, refresh và retry một lần khi 401. Realtime dùng Socket.IO riêng.
- **Vai trò đã được map trong code:** Head Trainer, Groom, Veterinarian, Horse Owner, Club Manager.
- **3D injury map:** Three.js chạy trong react-native-webview, dùng GLB v2 đóng gói sẵn; chạm bề mặt được raycast thành tọa độ horse-root-local. Vùng cơ thể chỉ là gợi ý heuristic và bác sĩ có thể sửa.
- **Lưu vị trí 3D:** API gửi x/y/z trong injury record, nhưng model version và coordinate frame hiện được ghi ở AsyncStorage cục bộ. Mobile chỉ vẽ lại điểm nếu metadata local khớp đúng injury response.
- **Mock còn tồn tại:** các fixture trong `src/data/fixtures/`; route live cũ `app/[role]/live/[id].tsx`; nhánh examination không UUID trong `app/vet/exam/[id].tsx`; một số dashboard prototype.

## Sơ đồ kiến trúc mức ứng dụng

~~~mermaid
flowchart TD
  U[Người dùng] --> R[Expo Router: app/]
  R --> G[AuthRouteGate]
  G --> S[Screen trong app/ hoặc src/features/]
  S --> H[React state / Context / useApiResource]
  H --> A[Adapter: DTO sang model UI]
  H --> V[Service modules]
  V --> C[api-client.ts]
  C -->|HTTPS JSON + Bearer| B[Backend API]
  V -->|Socket.IO websocket| E[Realtime /events]
  S --> L[AsyncStorage: session, ngôn ngữ, metadata cục bộ]
  S --> W[WebView + Three.js: injury map]
~~~

Đường đi này là sơ đồ tổng quát. Một số route prototype lấy fixture trực tiếp, và một số screen gọi service trực tiếp mà không qua adapter riêng.

## Các nhóm chức năng đang có bằng chứng implementation

| Nhóm | UI chính | Dữ liệu / service |
|---|---|---|
| Đăng nhập và phân vai trò | app/login.tsx, src/features/auth/ | AuthContext, auth.service, api-client |
| Hồ sơ/ngựa, quyền và bố trí chuồng | app/[role]/horses.tsx, app/[role]/horse/[id].tsx, app/manager/* | horse.service, stable.service, horse adapters |
| Chăm sóc và tác vụ groom | app/groom/tasks.tsx, src/features/stable-care/ | groom.service, stable-care.service, media.service |
| Y tế và bệnh án | app/[role]/medical/*, app/vet/* | medical.service, medical adapter |
| Huấn luyện | app/trainer/*, app/manager/training.tsx, app/owner/*training* | training.service, training adapter |
| Hiệu suất và telemetry | src/features/performance/, màn session trainer | performance.service, realtime.service, simulator |
| Kho, phí và báo cáo | src/features/stable-care/SuppliesScreen.tsx, manager/owner reports | supplies, billing, reports services |
| Thông báo và audit | notifications feed, horse timeline | notifications, audit services; push đăng ký Android |

## Điểm cần học trước khi thuyết trình

1. Biết phân biệt **server state** với **prototype state**: API-backed pages không dùng chung nguồn dữ liệu với mọi fixture.
2. Có thể trace một request: screen → hook/state → service → api client → response/error → refresh UI.
3. Nắm auth: login → token pair → /auth/me → role mapping → session storage → refresh.
4. Nắm injury mapper: model local axes → raycast → local coordinates → heuristic region → native confirmation → visit payload → server injury DTO + local version metadata.
5. Nói rõ giới hạn: mobile source không chứng minh logic backend, quyền backend, database, production push, hay đo hiệu năng 3D trên thiết bị thật.

## Mục lục học tập

1. [01 — Bản đồ source code](01-SOURCE-CODE-MAP.md)
2. [02 — Architecture thực tế](02-ARCHITECTURE.md)
3. [03 — Dependencies](03-DEPENDENCIES.md)
4. [04 — Deep dive theo module](04-MODULE-BREAKDOWN.md)
5. [05 — Business flows](05-BUSINESS-FLOWS.md)
6. [06 — API integration](06-API-INTEGRATION.md)
7. [07 — Authentication và security](07-AUTHENTICATION-AND-SECURITY.md)
8. [08 — 3D Injury Mapping](08-3D-INJURY-MAPPING.md)
9. [09 — Technical knowledge](09-TECHNICAL-KNOWLEDGE.md)
10. [10 — Code defense Q&A](10-CODE-DEFENSE-QA.md)
11. [11 — Learning roadmap](11-LEARNING-ROADMAP.md)
12. [12 — Glossary](12-GLOSSARY.md)
13. [13 — Implementation gaps](13-IMPLEMENTATION-GAPS.md)

## Sai khác giữa tài liệu có sẵn và source

- README.md nói Expo SDK 57; package.json khai báo expo ~58.0.23 và React Native 0.88.1. Implementation hiện tại phù hợp nhãn SDK 58.
- README liệt kê src/native/; thư mục đó không có trong file map. UI thật ở src/components/, feature ở src/features/, API ở src/services/.
- RACEOS_3D_INJURY_IMPLEMENTATION_REPORT.md còn mô tả v1 là model active. Source hiện import horse-anatomy-v2.glb, đặt INJURY_MODEL_VERSION là horse-anatomy-v2; asset report hiện hành cũng đánh dấu v2 là active. Dùng source hiện tại làm bằng chứng.
- docs/EXPO_SDK_58_MIGRATION_REPORT.md ghi một số phiên bản Expo packages thấp hơn package.json hiện tại. Khi trả lời version, ưu tiên manifest và lockfile hiện tại.

## Trạng thái audit

| Phase | Nội dung | Trạng thái |
|---|---|---|
| A | Scan source và lập bản đồ | Hoàn thành |
| B | Architecture và dependencies | Hoàn thành |
| C | Module và business flows | Hoàn thành |
| D | API, authentication, 3D injury mapping | Hoàn thành |
| E | Nền tảng kỹ thuật và code defense | Hoàn thành |
| F | Lộ trình học cá nhân | Hoàn thành |

Các phase được diễn giải chi tiết ở những file tiếp theo. Tài liệu không chạy build hoặc test trong đợt audit này.
