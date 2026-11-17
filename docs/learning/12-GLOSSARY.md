# 12 — Bảng thuật ngữ

| Thuật ngữ | Giải thích dễ hiểu | Ví dụ trong project |
|---|---|---|
| API | Giao diện để app gửi yêu cầu/nhận dữ liệu từ service khác | Các service trong `src/services/` |
| Adapter | Chuyển một hình dạng dữ liệu sang hình dạng UI cần | `src/adapters/horse.adapter.ts` |
| AsyncStorage | Kho key/value bất đồng bộ trên thiết bị | Auth session, ngôn ngữ, injury metadata |
| Authentication | Xác minh user là ai | Login và `/auth/me` |
| Authorization | Kiểm tra user có được làm hành động/resource đó không | Server cần kiểm tra; client có route/permission UI |
| Access token | Credential ngắn hạn gửi cùng API request | `Authorization: Bearer ...` |
| Refresh token | Credential dùng xin access token mới theo contract | `/auth/refresh` |
| Bearer token | Token gửi trong HTTP Authorization header | API client |
| Backend | Service/server xử lý API, dữ liệu và quyền | Không nằm trong repo được audit |
| Body region | Nhãn vùng trên cơ thể ngựa | Mapper gợi ý từ tọa độ, user sửa được |
| Cache | Bản sao dữ liệu để giảm tải/đọc nhanh | Một số local state; không có cache layer tổng quát thấy được |
| Component | Khối UI React có state/props | Screen và components trong `src/components/` |
| Context | Cơ chế chia sẻ state qua cây React | `AuthContext`, `I18nContext` |
| Coordinate frame | Hệ trục mà các tọa độ được đo | `HORSE_ROOT_LOCAL` |
| DTO | Kiểu mô tả dữ liệu truyền qua API | `MedicalRecordDto`; không validate runtime |
| Effect | React hook để thực hiện side effect theo lifecycle/dependency | Tải dữ liệu, subscription |
| Endpoint | Đường dẫn API cụ thể | `/grooms/me/today` |
| Expo | Bộ công cụ/phân phối SDK cho ứng dụng React Native | Expo SDK 58 |
| Expo Router | Routing dựa trên file | Route files trong `app/` |
| Fallback | Giá trị dùng khi luồng chính lỗi/không có | `.catch(() => [])` ở một số dashboard |
| GLB | Định dạng glTF binary cho model 3D | `assets/horse-anatomy-v2.glb` |
| Heuristic | Quy tắc xấp xỉ, không phải thuật toán anatomy chính xác | Threshold tọa độ để gợi ý body region |
| HTTP 401 | Request chưa được xác thực/credential hết hạn theo server | API client thử refresh token một lần |
| HTTP 403 | Server từ chối quyền (nghĩa thông thường; contract cụ thể cần xác nhận) | Không suy ra từ route guard |
| Idempotency | Gửi thao tác lặp lại nhưng tạo cùng kết quả, không lặp side effect | Cần API contract khi retry POST sau timeout |
| In-memory state | State chỉ còn trong RAM của runtime | Form state trong component |
| JSON | Cách biểu diễn dữ liệu dạng text | Request/response REST |
| Local state | State riêng một screen/component | Form/modal state |
| N+1 requests | Một request danh sách rồi thêm một request cho từng item | Session list theo từng horse |
| Navigation | Chuyển màn/route | Expo Router và role gate |
| Pagination | Chia list lớn thành nhiều trang | Horse/user services |
| Promise | Đại diện kết quả bất đồng bộ có thể thành công/thất bại | `fetch`, service call |
| Raycast | Tìm vật thể 3D bị tia từ điểm nhìn/chạm cắt qua | Viewer chọn vị trí trên horse mesh |
| Realtime | Nhận event khi có dữ liệu mới thay vì chỉ polling | Socket.IO `performance.metrics` |
| Refresh | Tải lại API data hoặc làm mới access token tùy ngữ cảnh | `useApiResource.refresh`, auth refresh |
| REST | Phong cách thiết kế API trên HTTP resources/methods | `/horses`, GET/POST/PATCH |
| Role | Nhóm người dùng để chọn trải nghiệm/quyền | trainer, groom, vet, owner, manager |
| Root-local | Tọa độ tương đối với root của model ngựa | Injury marker local position |
| Screen | Thành phần route có trách nhiệm render màn hình | `app/[role]/medical/visit.tsx` |
| Service | Module dựng request cho domain endpoint | `medical.service.ts`, `horse.service.ts` |
| Server state | Dữ liệu mà backend là nguồn chính | Horse/case tải từ API |
| Sidecar metadata | Dữ liệu phụ kèm record chính để diễn giải/render | Injury model version/frame lưu local |
| Signed URL | URL tạm do server cấp cho upload/download | Media upload flow |
| Socket.IO | Thư viện kết nối và trao đổi event qua socket | `realtime.service.ts` |
| State | Giá trị làm UI thay đổi khi cập nhật | Loading, selected horse, form values |
| Timeout | Ngưỡng chờ request; hết ngưỡng thì client dừng chờ | API client mặc định 15 giây |
| TypeScript | JavaScript có type checking lúc phát triển | Source `.ts`/`.tsx` |
| UI | Giao diện người dùng nhìn và thao tác | Route/components |
| View model | Hình dạng dữ liệu thuận cho trình bày UI | Adapter output |
| WebView | Khung native nhúng trang web | Three.js injury viewer |
| World coordinate | Tọa độ theo scene/world frame | Hit point trước `worldToLocal` |
| `useApiResource` | Hook quản lý trạng thái tải API phổ biến | data/loading/error/refresh |
| `ApiError` | Lỗi HTTP có status/payload từ client | `src/services/api-client.ts` |

## Cặp thuật ngữ dễ nhầm

| Cặp | Khác nhau |
|---|---|
| Authentication / Authorization | User là ai / user được phép làm gì |
| DTO / runtime validation | Kiểu biên dịch / kiểm tra dữ liệu lúc chạy |
| Preview / commit | Kiểm tra dự kiến / thực sự lưu thay đổi |
| Server state / local state | Dữ liệu authoritative qua API / state chỉ trên app hoặc thiết bị |
| Mock / realtime | Dữ liệu giả hoặc timer / event đến qua kết nối server |
| World / local coordinate | Theo scene tổng / tương đối với object/root |
| HTTP error / network error | Server đã trả status lỗi / không nhận response HTTP |
