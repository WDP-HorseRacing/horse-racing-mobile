# 02 — Architecture thực tế

## 1. Kết luận kiến trúc

Source hiện tại là một **mobile client theo feature và service**:

- Expo Router quyết định screen theo đường dẫn file.
- Screen và feature component giữ UI state, gọi hook hoặc service.
- Các service đóng gói endpoint nghiệp vụ và gọi một API client chung.
- Một số domain có adapter/mapping giữa response DTO và model tiện cho UI.
- Context dùng cho auth, ngôn ngữ và một tập state prototype; không có store toàn app kiểu Redux.

Không có bằng chứng để gọi đây là Clean Architecture hoặc MVVM hoàn chỉnh. Không thấy lớp repository interface thống nhất, domain use-case layer riêng, DI container, hay view model tách khỏi screen. Nhiều screen import service trực tiếp.

## 2. Các lớp có thể nhận diện

| Lớp trong thực tế | Trách nhiệm | Ví dụ |
|---|---|---|
| Route / UI | Nhận params, render form/list, bắt thao tác, điều hướng | app/[role]/medical/visit.tsx, app/groom/tasks.tsx |
| State / orchestration | Loading/error/refresh, state của form, stale-response guard | src/hooks/useApiResource.ts, useState trong screen |
| Adapter / validation | Map DTO, chuẩn hóa dữ liệu và kiểm tra input trước khi gửi | src/adapters/medical.adapter.ts, src/features/medical/medical-validation.ts |
| Service | Đặt endpoint, method, query/body và kiểu response dự kiến | src/services/medical.service.ts |
| Transport | Bearer header, timeout, parse JSON, map lỗi, refresh khi 401 | src/services/api-client.ts |
| Platform / persistence | Storage, notification, file picker/upload, WebView | AuthContext, media.service, Injury3DMapper |
| Backend | Lưu dữ liệu và áp dụng business/authorization thật | Không nằm trong source được kiểm tra |

Đây là các lớp logic, không phải ranh giới thư mục tuyệt đối. Ví dụ form validation có thể nằm trong screen hoặc helper; screen đôi khi gọi nhiều service để tổng hợp một màn hình.

## 3. Architecture diagram

~~~mermaid
flowchart TD
  Route[Expo Router file route] --> Gate[AuthRouteGate]
  Gate --> Screen[Screen / feature UI]
  Screen --> Local[React local state]
  Screen --> Hook[useApiResource]
  Screen --> Context[AuthContext / I18nContext]
  Hook --> Adapter[Adapter / mapper nếu có]
  Hook --> Service[Domain service]
  Screen --> Service
  Service --> Client[apiRequest]
  Client --> API[Backend API]
  Service --> Realtime[Socket.IO service khi cần]
  Realtime --> Events[/events websocket]
  Screen --> Native[Expo modules / WebView / AsyncStorage]
~~~

## 4. Dependency flow

~~~mermaid
flowchart LR
  app[app routes] --> features[src/features]
  app --> hooks[src/hooks]
  app --> services[src/services]
  features --> services
  features --> adapters[src/adapters]
  services --> adapters
  services --> client[api-client]
  client --> config[src/config/api]
  features --> components[src/components]
  app --> components
  contexts[src/context] --> services
  contexts --> storage[AsyncStorage]
  mocks[src/data/fixtures] -. prototype/fallback .-> app
~~~

Một dấu hiệu kiến trúc quan trọng: chiều phụ thuộc không hoàn toàn một chiều. AuthContext gọi authService; feature gọi service; service dùng adapter types; một số adapters import service DTO. Không thấy DI container để thay service theo môi trường hoặc test fake một cách xuyên suốt.

## 5. State management

### API-backed state

`useApiResource(load, enabled)` giữ `data`, `isLoading`, `isRefreshing`, `error`. Mỗi lần load tăng generation; nếu response thuộc request cũ thì không ghi đè dữ liệu mới. Hàm `retry` chạy lại loading mode, `refresh` bật refresh indicator, `revalidate` chạy im lặng và thường được gọi lại khi screen focus.

Ví dụ trước/sau:

| Thời điểm | State |
|---|---|
| Screen mount, enabled=true | data=null, isLoading=true |
| GET thành công | data=response, isLoading=false |
| Pull to refresh | isRefreshing=true, dữ liệu cũ vẫn còn |
| Refresh thành công | data=response mới, isRefreshing=false |
| Refresh thất bại | error được đặt; dữ liệu cũ không bị xóa tự động |

Hook không hủy request mạng khi có request mới; nó chỉ bỏ qua response cũ. Offline cache hay mutation queue không được triển khai ở hook này.

### Form và prototype state

Các form dùng `useState` ngay trong screen. `AuthContext` là state dùng chung cho session; `I18nContext` cho language. Fixture demo được lưu tĩnh trong `src/data/fixtures` và không còn được bọc trong context toàn app.

## 6. Navigation và role gate

- `package.json` dùng `expo-router/entry`; route khai báo qua file trong `app/`.
- Dynamic segment như `[role]`, `[id]`, `[sessionId]` trở thành params.
- Screen dùng `router.push`, `router.replace`, `Redirect`, và `useLocalSearchParams`.
- `AuthRouteGate` nhận role từ `AuthContext`, kiểm tra prefix path, chuyển user đã đăng nhập về role của mình nếu mở route role khác.
- `src/features/auth/role-mapper.ts` map backend roles HEAD_TRAINER, GROOM, VETERINARIAN, HORSE_OWNER, CLUB_MANAGER lần lượt thành trainer, groom, vet, owner, manager.
- Nhiều screen tải `/horses/:id/permissions` để ẩn/hiện tab và action theo horse.

Client role gate giúp UI không đưa người dùng nhầm vào màn hình. Chưa thể suy luận backend authorization có đúng hay không từ mobile source; endpoint permission trả DTO nhưng server implementation không được đọc.

## 7. API communication và error propagation

1. Screen tạo callback load và đưa vào `useApiResource`.
2. Callback gọi service với token lấy từ `useAuth()`.
3. Service tạo URL, method, query/body và truyền token cho `apiRequest`.
4. `apiRequest` đặt Accept, Content-Type khi có body, Authorization Bearer khi có token; đặt timeout mặc định 15 giây.
5. Response 204 trở thành undefined; response khác được parse JSON. JSON hỏng trở thành payload message dạng text.
6. HTTP error tạo `ApiError(status, payload)`. Network, timeout và abort tạo `Error` với thông báo tiếng Việt.
7. 401 có thể gọi refresh handler, rồi retry request gốc tối đa một lần.
8. Screen hiển thị `AsyncStateView`, Alert hoặc `extractErrorMessage`.

Không có Axios interceptor: refresh/retry là code thủ công trong `api-client.ts`. Không có runtime schema validation tổng quát; `apiRequest<T>` parse JSON rồi cast sang T. TypeScript giúp lúc compile nhưng không xác nhận JSON thật khớp DTO.

## 8. Example: request danh sách ngựa

Luồng cụ thể:

~~~mermaid
sequenceDiagram
  actor U as Người dùng
  participant R as app/[role]/horses.tsx
  participant H as useApiResource
  participant S as horseService.list
  participant C as apiRequest
  participant B as API backend
  U->>R: nhập từ khóa / chọn filter
  R->>R: debounce 300 ms và tạo filters
  R->>H: loadHorses()
  H->>S: list(token, search, filters)
  S->>C: GET /horses?page=1&limit=100...
  C->>B: Authorization: Bearer token
  B-->>C: Page<HorseListItemDto>
  C-->>S: JSON đã parse
  S->>S: gom các trang theo meta.totalPages
  S-->>H: HorseListItemDto[]
  H-->>R: set data, render FlatList
~~~

Sau đó screen gọi mapper để đổi DTO thành summary cho `HorseRow`. Nếu API lỗi, resource giữ error để `AsyncStateView` hiển thị nút thử lại. Backend có thể trả status/data khác DTO; mobile source không xác nhận response thực tế.

## 9. Authentication và persistence cấp kiến trúc

- Session được giữ trong `AuthContext`; storage key là `raceos.auth.session.v1`.
- Access và refresh token được lưu trong AsyncStorage dạng JSON; source không dùng SecureStore.
- Khi khởi động, restore token; refresh nếu tới cửa sổ gần hết hạn; gọi `/auth/me`; map role.
- Timer làm mới token trước hạn và AppState active cũng kích hoạt refresh.
- API 401 dùng handler từ AuthContext; refresh Promise dùng chung để hạn chế nhiều request cùng refresh đồng thời.
- Logout chờ refresh đang chạy, gọi endpoint logout nếu có refresh token, rồi xóa local session và stored push token.

## 10. Business logic nằm ở đâu?

- Validation của form: screen hoặc helper domain, ví dụ `medical-validation.ts`, `stable-care-validation.ts`, `horse-validation.ts`.
- Quy tắc injury point và coordinate range: `injury-mapper-policy.ts`.
- Chuẩn hóa dữ liệu: adapters như horse, medical, training, groom.
- State transition request: service method cùng payload type; UI quyết định khi nào gọi.
- Business rule phía server (ownership, eligibility, financial ledger, locking, permission): mobile chỉ gửi command hoặc hiển thị preview/response; không đọc được implementation thật.

Để bảo vệ dự án, diễn đạt chính xác là “mobile xác thực các điều kiện form này và gửi lệnh tới endpoint”; không nói “backend chắc chắn áp dụng quy tắc” nếu chưa kiểm tra backend.

## 11. Ưu điểm và đánh đổi nhìn thấy từ source

**Điểm thuận lợi:** endpoint tập trung theo domain; dùng chung transport/error logic; UI có loading/error/refresh chuẩn hóa; route theo role dễ tìm; adapter cho phép UI không phải dùng raw response ở mọi nơi; injury viewer được đóng gói offline.

**Đánh đổi:** screen có thể điều phối nhiều service; business logic form ở screen làm screen lớn; không có abstraction repository/DI toàn cục; response type không runtime-validate; một số prototype/fallback song song với API flow khiến người đọc cần kiểm tra nhánh UUID và route active.
