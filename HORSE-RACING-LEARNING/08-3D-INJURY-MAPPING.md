# 08 — Injury mapper 3D

## 1. Mục tiêu và giới hạn

Mapper cho bác sĩ chọn vị trí tương đối trên mô hình ngựa, gắn vùng cơ thể/loại injury/trạng thái hồi phục và lưu dữ liệu cùng luồng medical visit. Đây là công cụ nhập liệu trực quan. Mô hình GLB là asset hình thể tổng quát; tọa độ/region không phải chẩn đoán, bản đồ giải phẫu đã kiểm định hay phép đo lâm sàng.

## 2. Thành phần liên quan

- `src/features/medical/injury-mapper/Injury3DMapper.tsx` — React Native UI, state draft/update, WebView bridge và tương tác form.
- `src/features/medical/injury-mapper/viewer-entry.ts` — mã chạy trong WebView, tải Three.js/GLTF và xử lý camera/raycast.
- `src/features/medical/injury-mapper/injury-coordinate.mjs` — kiểm tra tọa độ và ước lượng body region.
- `src/features/medical/injury-mapper/injury-regions.mjs` — lựa chọn body region.
- `src/features/medical/injury-mapper/injury-mapper-policy.ts` — giới hạn/validation nghiệp vụ client.
- `src/features/medical/injury-mapper/injury-mapper-protocol.ts` — message protocol giữa RN và viewer.
- `src/features/medical/injury-mapper/injury-model-metadata.ts` — đọc/ghi sidecar placement local.
- `src/features/medical/injury-mapper/injury-mapper.types.ts` — kiểu dữ liệu.
- `scripts/build-injury-mapper.mjs` — build bundle viewer được nhúng.
- `assets/horse-anatomy-v2.glb`, `THIRD_PARTY_ASSETS.md` — asset và credit.

`Injury3DMapper.tsx` đóng vai trò cầu nối: RN quản lý draft/form/API state; WebView chịu trách nhiệm vẽ mô hình và trả kết quả chọn tọa độ.

## 3. Tọa độ và mô hình

Model metadata hiện đặt `INJURY_MODEL_VERSION` là `horse-anatomy-v2` và frame `HORSE_ROOT_LOCAL`. Asset documentation mô tả quy ước: đơn vị mét đã normalize, móng ở y=0, hướng tiến +Z, +X bên trái và +Y lên trên. Viewer dùng Three.js `GLTFLoader`, `WebGLRenderer`, `PerspectiveCamera` và `OrbitControls`; bounding box dùng để đặt camera ban đầu.

Khi raycast chạm mesh, viewer đổi world point về local coordinates của root horse qua `worldToLocal`. Điểm được kiểm tra hữu hạn/giới hạn trước khi gửi qua bridge. Vùng cơ thể được gợi ý bằng threshold theo trục tọa độ, không phải nhận diện anatomy mesh hoặc vùng tổn thương theo topology. Người dùng có thể chỉnh region thủ công.

## 4. Luồng chọn điểm

1. RN render WebView bằng HTML với CSP hạn chế; trang dùng `about:blank`, tắt file access.
2. Asset GLB và viewer bundle được tải/đóng gói; GLB được chuyển thành base64.
3. RN gửi model cho WebView theo chunk base64 96.000 ký tự.
4. Viewer decode/load GLB, fit camera và gửi trạng thái sẵn sàng.
5. Ở chế độ rotate, gesture điều khiển orbit; pan bị tắt. Ở chế độ mark, orbit bị khóa.
6. Tap đơn được raycast; thao tác di chuyển quá 7 px không được coi là tap. Viewer ưu tiên bắt marker hiện có rồi mới raycast model.
7. Hit point chuyển sang horse root-local, qua validation/region heuristic rồi gửi message về RN.
8. RN mở/chỉnh marker draft với region/type/status/note; submit medical form gửi injury trong request API phù hợp.

Protocol có giới hạn payload/số marker lớn hơn giới hạn nghiệp vụ UI. Form cho tối đa 20 marker mới/update theo policy trong visit; protocol chặn payload có tối đa 100 marker. Note bị giới hạn 1000 ký tự. Injury type có 9 lựa chọn, body region 11 lựa chọn, recovery status 3 lựa chọn theo constants hiện tại.

## 5. Gesture và marker state

Viewer phân biệt rotate và mark mode để giảm việc vừa xoay vừa tạo marker. Tương tác raycast sử dụng tọa độ normalized device coordinates từ vị trí chạm. Marker có thể được chọn trước để sửa/xóa; thao thao tác pointer đơn được hỗ trợ. UI RN vẫn cần xác nhận/chỉnh thuộc tính injury trước khi lưu medical record.

Code có trạng thái confirmed cho draft, nhưng behavior không hoàn toàn đồng nhất: outer submit yêu cầu marker confirmed, trong khi đóng modal có nhánh auto-confirm draft hợp lệ (comment trong code nói tránh chặn). Khi giải thích, nên mô tả chính xác rằng UI có cơ chế confirm nhưng một đường đóng modal tự xác nhận dữ liệu hợp lệ; không tuyên bố mọi draft luôn buộc người dùng bấm confirm riêng.

## 6. Persist: API và sidecar local

API visit gửi injury position và trường domain. `InjuryTimelineItemDto` có position x/y/z nhưng không có modelVersion/frame. Sau khi API thành công, `injury-model-metadata.ts` ghi sidecar theo horse ID vào AsyncStorage với modelVersion, frame, position, bodyRegion và type.

Khi dựng marker timeline cũ, client chỉ hiển thị khi API point khớp sidecar cục bộ và model/frame tương ứng. Hệ quả:

- Cài lại app/đổi thiết bị/mất AsyncStorage có thể làm marker lịch sử không render.
- Đổi model version hoặc frame có thể làm marker cũ bị ẩn để tránh đặt nhầm tọa độ.
- Nếu cập nhật tọa độ injury bằng luồng không cập nhật sidecar, API và local metadata có thể lệch.
- Sidecar không phải dữ liệu dùng chung hoặc server source of truth.

Luồng visit tạo metadata sau khi ghi API. Nếu ghi local lỗi, medical record đã lưu nhưng marker restore bị ảnh hưởng. Trong audit không tìm thấy metadata model/frame trong injury DTO server để phục hồi độc lập.

## 7. Rủi ro kỹ thuật và giới hạn sản phẩm

1. **Scale/semantic precision:** body region dựa trên ngưỡng trục và người dùng chọn thủ công; không suy ra mô/tổ chức giải phẫu chính xác.
2. **Model dependency:** các vị trí phụ thuộc phiên bản/coordinate frame. Model mới cần migration/compatibility plan nếu tọa độ lịch sử phải giữ ý nghĩa.
3. **Local metadata:** metadata chỉ ở AsyncStorage; marker không bền xuyên thiết bị.
4. **Bridge payload:** base64 bundle/model gửi qua WebView bridge làm tăng memory/serialization overhead; model/chunk/failure path cần được đánh giá trên thiết bị mục tiêu.
5. **Rounding/matching:** API position và local sidecar cần cùng quy tắc serialize/so khớp; sai khác nhỏ có thể làm marker biến mất.
6. **Not a diagnostic system:** không mô tả mapper như công cụ chẩn đoán hoặc tọa độ lâm sàng được hiệu chuẩn.

Đây là các đặc tính/rủi ro có thể đọc từ thiết kế hiện tại; mức độ ảnh hưởng thực tế cần kiểm tra trên thiết bị, dữ liệu và backend tương ứng.

## 8. Cách trình bày với hội đồng

> “React Native quản lý form và dữ liệu visit; Three.js chạy bên trong WebView để vẽ GLB và raycast. Viewer chuyển điểm va chạm sang frame local của root ngựa rồi gửi qua bridge. App lưu tọa độ injury trong API, còn metadata phiên bản model/frame hiện lưu cục bộ để tái tạo marker. Vì sidecar chưa nằm trong API, marker lịch sử có thể phụ thuộc thiết bị. Region là heuristic gợi ý và bác sĩ có thể sửa; đây là nhập vị trí tương đối, không phải chẩn đoán.”

## Câu hỏi để tự kiểm tra

1. Tại sao phải đổi world coordinate sang root-local coordinate?
2. `HORSE_ROOT_LOCAL` và `horse-anatomy-v2` có vai trò gì khi đổi model?
3. Tại sao API injury có x/y/z chưa đủ để khôi phục marker?
4. Raycast/region heuristic không thể chứng minh điều gì về bệnh lý?
5. Nếu chuyển sang lưu metadata trên server, cần cập nhật DTO/API và chiến lược tương thích nào?
