# 09 — Nền tảng kỹ thuật để giải thích source

Tài liệu này liên kết khái niệm phổ biến với ví dụ thật trong app. Hãy trình bày theo thứ tự: vấn đề, lựa chọn trong source, giới hạn và cách kiểm chứng.

## 1. React Native, Expo và Expo Router

React Native dựng UI native bằng component React. Expo cung cấp SDK và cấu hình native; Expo Router ánh xạ file trong `app/` thành route. Package entry là `expo-router/entry`; `app/_layout.tsx` dựng provider và stack; `app/index.tsx` điều hướng root.

Dynamic route như `app/[role]/horse/[id].tsx` lấy segment role/ID từ URL. File route thường là composition layer gọi feature component/service. Không phải mọi route đều mỏng; một vài screen có form, mapping và request logic lớn ngay trong file.

## 2. TypeScript và DTO

TypeScript bắt lỗi kiểu lúc build/editor. DTO như `HorseListItemDto` hay `MedicalRecordDto` diễn đạt API shape dự kiến và hỗ trợ autocomplete. Runtime JSON vẫn có thể sai vì generic type bị erase; client API chưa có schema validation tổng quát.

## 3. State: server, context, local storage

- **Server state:** dữ liệu được service tải từ API; có thể stale và cần refresh.
- **Context state:** dữ liệu dùng chung trong React tree. AuthContext giữ session; I18nContext giữ ngôn ngữ.
- **Component state:** form/modal/loading riêng một màn.
- **Persistent device state:** AsyncStorage giữ một số key qua lần mở app.

Đừng gọi mọi state là “database”. AsyncStorage không chia sẻ thiết bị; API data có quyền lực và vòng đời khác fixture tĩnh.

## 4. Async flow, hook và race condition

`async/await` giúp viết Promise flow tuần tự. `useApiResource` khởi tạo tải, giữ trạng thái loading/error/data và expose refresh. Generation guard tránh request cũ cập nhật UI sau request mới. Đây là guard cho state; không hủy transport nếu API call cũ không nhận AbortSignal.

Trong React, effect có thể chạy lại khi dependency thay đổi hoặc component unmount. Cleanup/tính ổn định callback giúp giảm request thừa. Auth refresh promise ref coalesce các yêu cầu đồng thời cùng runtime.

## 5. REST, HTTP verbs và retry

REST contract dùng path/resource và HTTP methods: GET thường đọc, POST tạo/hành động, PATCH cập nhật một phần, PUT thường thay thế/đặt trạng thái. Ý nghĩa cuối cùng phụ thuộc API contract cụ thể. 401 là authentication failure; 403 thường là authenticated nhưng không được phép; 404 là không tìm thấy hoặc server che giấu resource; 5xx là lỗi server. Network timeout không đồng nghĩa API trả lỗi HTTP.

Client retry 401 đúng một lần sau refresh. Không retry mù POST/operation bất kỳ sau timeout vì server có thể đã commit dù client không nhận response; idempotency key hay dedup phải do contract quy định. Source không thể xác nhận endpoint nào có idempotency semantics.

## 6. Adapter, service và layering

- **Screen/route:** UI, state của màn và điều phối thao tác.
- **Service:** request path, query/body và endpoint theo domain.
- **Adapter:** ánh xạ DTO sang view model hoặc chuẩn hóa shape.
- **API client:** transport chung.

Đây là feature/service organization thực tế. Repo không triển khai Clean Architecture đầy đủ, dependency injection container hay repository interface nhất quán. Một số màn còn trộn view, validation, orchestration và error handling. Giải thích kiến trúc theo những gì tồn tại, không gắn nhãn pattern chưa có.

## 7. Pagination, debounce và N+1

Pagination giới hạn payload theo page. Horse list dùng debounce khoảng 300 ms để không gửi request cho từng phím ngay lập tức. N+1 xảy ra khi lấy danh sách cha rồi gọi endpoint con từng item; `listAllVisibleSessions` có pattern này theo horse. Hướng cải thiện thường là batch endpoint hoặc backend aggregate nếu contract cho phép.

## 8. Realtime và simulator

Socket.IO duy trì kết nối/event; REST phù hợp request/response. Source kết nối `/events`, authenticate qua socket auth và xử lý `performance.metrics`. Simulator trong app sinh dữ liệu giả, đôi lúc gọi ingest. Mẫu metric không phải tín hiệu thiết bị thật. Khi có cả local callback và server echo cần correlation ID/dedup để tránh trùng; server echo hiện chưa xác minh.

## 9. WebView, Three.js và raycasting

WebView nhúng một trang web trong native app. Three.js render scene 3D bằng WebGL. Raycasting biến điểm chạm thành tia camera và tìm mesh giao cắt. `worldToLocal` đổi điểm từ world frame sang local frame của horse root, để vị trí gắn với model khi scene transform thay đổi.

Coordinate frame và model version là một phần của ý nghĩa tọa độ. Nếu chỉ lưu x/y/z mà đổi model/frame, cùng một bộ số có thể trỏ tới vị trí khác. Trong source, metadata frame/version còn ở local sidecar.

## 10. Upload và signed URL

Signed URL là URL có quyền tạm thời do server cấp để upload/download object mà không đưa object bytes qua JSON API chính. Flow ở đây gồm xin upload, PUT file và báo complete. Cần xử lý sai MIME, kích thước, thất bại giữa chừng và orphan upload.

## 11. AsyncStorage, lifecycle và offline

AsyncStorage là key/value storage bất đồng bộ, phù hợp preference/cache không nhạy cảm hơn credential. Repo lưu session ở đây và không thấy secure storage integration. Offline queue/sync conflict resolver không thấy trong source; network failure có thể khiến thao tác cần thử lại thủ công.

## 12. UI fallback và observability

Fallback `[]`/`0` tăng khả năng UI tiếp tục render nhưng có thể che endpoint failure. Error state rõ ràng giúp phân biệt “không có dữ liệu” với “không tải được”. `ApiError` giữ status/payload để UI trích thông điệp. Không thấy hệ thống analytics/error reporting xuyên suốt được cấu hình trong dependency/source audit.

## 13. OOP, SOLID, Dependency Injection và Repository Pattern

### OOP vừa đủ để đọc code

Phần lớn app dùng function component, hooks và object data; không phải kiến trúc class-heavy. Một class có ý nghĩa rõ là `ApiError extends Error` trong `src/services/api-client.ts`: constructor giữ status/payload để caller phân biệt lỗi HTTP với lỗi chung. **Class** gom dữ liệu/hành vi theo kiểu; **inheritance** ở đây dùng để giữ semantics Error chuẩn. Không cần giả định có kế thừa sâu giữa domain model.

### SOLID như lăng kính đánh giá

- **Single Responsibility:** API client xử lý transport, service mô tả endpoint, adapter map DTO. Một số screen lớn lại làm nhiều orchestration/validation/UI nên chưa luôn có trách nhiệm hẹp.
- **Open/Closed:** thêm domain service có thể không cần đổi transport client; nhưng endpoint cụ thể vẫn thêm method vào service. Không có plugin architecture tổng quát.
- **Liskov Substitution:** không thấy hierarchy subtype lớn cần phân tích trong feature flow.
- **Interface Segregation:** DTO/API interfaces thường theo domain; không thấy interface repository abstraction thống nhất.
- **Dependency Inversion:** nhiều screen/context import service cụ thể trực tiếp; không thấy DI container. API client có unauthorized refresh callback có thể set để tách auth refresh khỏi transport phần nào, nhưng đây không phải DI toàn app.

**Ví dụ ngoài app:** service đặt vé gọi interface `PaymentGateway`, còn implementation được inject; test có thể thay bằng fake. Trong HorseRacing, `medical.service.ts` gọi `apiRequest` trực tiếp và `visit.tsx` điều phối service; pattern truyền dependency thay thế chưa áp dụng nhất quán.

### Repository Pattern

Repository thường tạo abstraction giữa domain/use-case và nguồn dữ liệu. Trong repo này service là endpoint wrapper, nhưng không thấy repository layer thống nhất đứng giữa screen và service. Vì vậy khi trả lời, gọi đúng là “domain services” thay vì khẳng định có repository pattern.

### Testing strategy nhìn từ test source

`tests/` có Node test files cho API client/validation/mapper/navigation/i18n và static OpenAPI comparison. Chúng có thể kiểm tra logic cô lập nhanh. Chúng không thay cho E2E device camera/WebView, live backend authorization, push delivery, hoặc telemetry hardware. Test suite chưa được chạy trong audit.

## Câu hỏi luyện giải thích

1. Vì sao DTO không đồng nghĩa runtime validation?
2. Generation guard xử lý race nào và không xử lý race nào?
3. Vì sao không retry POST sau timeout một cách mặc định?
4. Nêu ranh giới giữa screen, service, adapter và API client.
5. Tại sao vị trí 3D cần kèm model/frame?
