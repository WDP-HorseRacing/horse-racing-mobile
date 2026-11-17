# 01 — Bản đồ source code

Root của source: **/Users/dungnguyen/Documents/CODE-PROJECT/WDP/stable-os-vet-3d-injury-mapping**. Các path trong bảng dưới đây được tính tương đối từ root này.

## 1. Cấu trúc top-level

~~~text
app/                         Expo Router routes và screen entry points
src/
  adapters/                  DTO, chuyển đổi dữ liệu API sang model UI
  components/
    common/                  Screen shell, trạng thái loading/error, text chung
    ui/                      Button, Field, Panel, modal, badge, charts/widgets
    charts/                  Thành phần biểu đồ dùng lại
  config/                    API URL và theme
  context/                   Auth và i18n
  data/locales/              Catalog dịch tiếng Việt
  features/
    alerts/                  Feed thông báo
    auth/                    Role map và route gate
    dashboard/               Dashboard theo role
    horses/                  Thành phần hồ sơ ngựa
    medical/                 Medical workspace, validation, 3D injury map
    performance/             Telemetry chart và simulator UI
    stable-care/             Checklist, incident, kho, chăm sóc ngựa
    tasks/                   Task card dùng lại
    training/                Lịch huấn luyện, video, simulator, helpers
  hooks/                     useApiResource, focus refresh, theme
  services/                  API client và các nhóm endpoint
  types/                     Domain/UI TypeScript types
  utils/                     Error, navigation, validation, formatter, local recents
scripts/                     build viewer 3D và kiểm tra i18n
tests/                       5 file test source; không chạy trong audit này
docs/                        Báo cáo migration và kịch bản demo/QA
public/                      Static assets cho web
dist/                        Export artifact đã có sẵn; không dùng làm source of truth
~~~

Một số route file chỉ kết nối path với feature component dùng chung. Route workflow tĩnh và live chart fixture đã được gỡ.

## 2. Entry point và lifecycle

1. package.json đặt main: expo-router/entry, nên Expo Router khởi động app bằng convention route tree.
2. app/_layout.tsx đăng ký notification foreground handler và xếp provider theo thứ tự: SafeAreaProvider → I18nProvider → AuthProvider → AuthRouteGate → Stack.
3. AuthProvider đọc session từ AsyncStorage, làm mới token nếu cần, gọi /auth/me, rồi cung cấp user, role, token, signIn, signOut.
4. AuthRouteGate nhìn pathname và role; route role không khớp bị replace về role hiệu lực.
5. app/index.tsx chuyển root sang route của role hoặc /login.

AuthRouteGate là điều hướng/UX ở client. Chỉ backend mới có thể là ranh giới authorization; backend không nằm trong phạm vi source được đọc.

## 3. Route map

### Route dùng chung theo role

app/[role]/index.tsx là dashboard; app/[role]/horses.tsx là horse list; app/[role]/horse/[id].tsx là hồ sơ ngựa; các nhánh phụ gồm measurements.tsx, ownership.tsx, placement.tsx, stable-care.tsx. app/[role]/pedigree/[id].tsx là pedigree; app/[role]/incidents.tsx, inventory.tsx, alerts.tsx và work.tsx là các screen nghiệp vụ.

Nhánh medical dùng chung trong app/[role]/:

- app/[role]/medical.tsx → MedicalWorkspaceScreen.
- medical/care.tsx, medical/cases/index.tsx, medical/cases/[id].tsx, medical/checkups.tsx, medical/costs.tsx, medical/requests.tsx, medical/visit.tsx, medical/visits/[id].tsx, medical/visits/edit/[id].tsx.

### Groom

app/groom/tasks.tsx (checklist/tác vụ), stable.tsx, training.tsx, report.tsx (incident), inventory.tsx.

### Club Manager

app/manager/operations.tsx, stable.tsx, register-horse.tsx, edit-horse/[id].tsx, lifecycle/[id].tsx, owners/[id].tsx, staff.tsx, access.tsx, training.tsx, daily-fees.tsx, reports.tsx, inventory.tsx, care-task-types.tsx, surcharges.tsx.

### Horse Owner

app/owner/training.tsx, session/[id].tsx, remarks.tsx, remark/[id].tsx, trial/[id].tsx, reports.tsx, past-horses.tsx.

### Head Trainer

app/trainer/training.tsx, plans.tsx, class/new.tsx, plan/[id].tsx, plan/[id]/session/[sessionId].tsx, participant/[id].tsx, eval/[id].tsx, trial-result/[id].tsx, stable.tsx, alerts.tsx.

### Veterinarian

app/vet/medical.tsx, alerts.tsx, exam/[id].tsx, injury/[id].tsx, lock/[id].tsx, participant/[id].tsx.

app/profile/[role].tsx là route profile; app/login.tsx và app/+not-found.tsx là route ngoài nhóm role.

## 4. Service inventory — ai làm gì?

| File | Nhóm trách nhiệm |
|---|---|
| src/services/api-client.ts | JSON fetch, Bearer header, timeout, JSON/error parsing, retry một lần sau 401 |
| src/services/auth.service.ts, src/context/AuthContext.tsx | login/me/refresh/logout/change-password, lưu và khôi phục session |
| src/services/horse.service.ts | horse CRUD, permissions, measurements, ownership, placement, lifecycle, archive/restore, pedigree |
| src/services/medical.service.ts | dashboard, examination, medical records/cases, requests, locks, injury timeline, care schedules, cost |
| src/services/training.service.ts | subjects/plans/classes/sessions, enrollments, attendance, evaluation, time trials |
| src/services/performance.service.ts, src/services/realtime.service.ts | performance REST và Socket.IO metrics |
| src/services/stable-care.service.ts, src/services/groom.service.ts | checklist, incident, feeding, care tasks, surcharge, groom ngày hôm nay |
| src/services/supplies.service.ts, src/services/stable.service.ts | kho, stock movement/request, barn/stall/groom workload |
| src/services/media.service.ts | signed upload request, binary PUT, complete, signed download URL |
| src/services/notifications.service.ts, src/services/push-device.service.ts | notification inbox/read, alerts, đăng ký push token Android |
| src/services/users.service.ts, src/services/audit.service.ts | staff/access và audit log |
| src/services/billing.service.ts, src/services/reports.service.ts | daily fee và báo cáo tài chính |

## 5. Context, hook, local storage

### Context

- AuthContext: session và vai trò hiệu lực.
- I18nContext: language en/vi, catalog JSON và t(); ngôn ngữ lưu qua AsyncStorage.
- Không còn fixture nghiệp vụ hoặc facade `raceos-data`; state dùng chung hiện còn AuthContext và I18nContext.

### Hook dữ liệu

src/hooks/useApiResource.ts chuẩn hóa trạng thái data / isLoading / isRefreshing / error cùng retry / refresh / revalidate. Hook dùng request generation để bỏ qua response cũ khi request mới bắt đầu hoặc screen unmount; nó không abort request mạng cũ.

src/hooks/useRefreshOnFocus.ts gọi refresh im lặng khi user quay lại screen đã mở.

### Các key local đã xác định

| Nơi lưu | Key / ví dụ | Nội dung |
|---|---|---|
| AuthContext.tsx | raceos.auth.session.v1 | access token, refresh token, expiresAt/expiresIn |
| I18nContext.tsx | @raceos/language | en/vi |
| app/login.tsx | @last_login_email | Email gợi ý lần đăng nhập sau |
| utils/recentHorses.ts | @raceos_recent_created_horses | ID để sort horse mới tạo |
| push-device.service.ts | raceos.push.device-token.v1 | Android device push token |
| injury-model-metadata.ts | @stable-os/injury-map/v1/{horseId} | metadata model/frame cho injury point trên thiết bị |

AsyncStorage chỉ chứng minh dữ liệu được lưu cục bộ; source không bật mã hóa cho các key này.

## 6. Data flow và dependency flow

~~~mermaid
flowchart LR
  Screen[Screen / feature component] --> Hook[useApiResource hoặc event handler]
  Hook --> Adapter[Adapter / mapper khi cần]
  Hook --> Service[Domain service]
  Service --> Client[apiRequest]
  Client --> Fetch[fetch + JSON]
  Fetch --> API[API base URL]
  API --> Fetch --> Client --> Service --> Adapter --> Hook --> Screen
~~~

Luồng dependency thường đi từ UI đến service. Screen nhiều nơi import service trực tiếp; vì vậy layer UI và network không tách biệt hoàn toàn. Mapper/adapter là ranh giới dữ liệu cho một số domain, không phải repository interface thống nhất toàn app.

## 7. Ranh giới dữ liệu hiện tại

- Các hồ sơ ngựa dùng ID UUID và tải dữ liệu từ horse/API services; ID không hợp lệ quay lại danh sách, không fallback sang ngựa mẫu.
- `app/vet/exam/[id].tsx` chuyển hồ sơ hợp lệ sang medical visit/case API; ID không phải UUID quay lại workspace y tế.
- Route workflow fixture và live chart hardcoded đã bị gỡ.
- `sensor-simulator.ts` là ngoại lệ có chủ ý: tạo metric cục bộ rồi gửi ingest đến backend khi có token.
- Access Control không có API đọc/ghi cấu hình quyền trong mobile service/backend scan; screen hiện báo rõ chưa được backend hỗ trợ, không còn danh sách/quyền mẫu.

## 8. Đọc source theo thứ tự

1. package.json, app.json, app/_layout.tsx, app/index.tsx.
2. AuthContext.tsx, AuthRouteGate.tsx, api-client.ts, auth.service.ts.
3. Một flow nhỏ: app/groom/tasks.tsx → groom.service.ts → stable-care.service.ts.
4. Flow y tế: app/[role]/medical/visit.tsx → medical.service.ts → medical.adapter.ts.
5. 3D: Injury3DMapper.tsx → viewer-entry.ts → policy/protocol/metadata helpers.
6. Sau cùng đọc API inventory, gaps và câu hỏi defense trong các file còn lại.
