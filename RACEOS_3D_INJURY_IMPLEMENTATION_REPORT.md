# Báo cáo triển khai 3D Injury Mapping — RaceOS Mobile

**Trạng thái:** Đã triển khai trên nhánh riêng và đã kiểm tra type, lint, i18n, unit tests cùng Metro export cho iOS/Android. Chưa thể xác nhận thao tác WebGL trên thiết bị thật hoặc simulator trong môi trường hiện tại.

## 1. Branch/worktree đã tạo

- Branch: `feature/vet-3d-injury-mapping`
- Worktree: `/Users/dungnguyen/Documents/CODE-PROJECT/WDP/stable-os-vet-3d-injury-mapping`
- Worktree ban đầu của `stable-os` vẫn ở branch `dev` và không có thay đổi.
- Chỉ sửa Mobile `stable-os`; không sửa `horse-racing-ne` hoặc `horse-racing-fe`, không merge vào `dev`.

## 2. Những thay đổi Mobile

- Thêm modal toàn màn hình cho Veterinarian trong form khám, trang hồ sơ ngựa, chi tiết medical record, bệnh án và lịch sử chấn thương.
- Thêm viewer Three.js, điều khiển xoay/thu phóng, chọn điểm trên bề mặt, marker nhiều vị trí, vùng gợi ý và form xác nhận native.
- Đồng bộ `MedicalRecordDto`, `InjuryDto` và timeline chấn thương với response hiện tại của Backend.
- Bỏ `examDate` khỏi body tạo lượt khám. Sửa body injury sang `newInjuries[]`; tái khám gửi `injuryUpdates[]` riêng.
- Thêm dependency, Metro asset extensions, script build viewer, metadata license, localization tiếng Việt và kiểm thử.

## 3. Renderer đã chọn

Chọn **Three.js + `react-native-webview`**. React Native giữ form, drafts, validation, quyền và API; WebView chỉ render mô hình, camera, raycast và marker. Viewer bundle được tạo từ TypeScript bằng esbuild và đóng gói cùng app; không tải script/model từ Internet.

## 4. Model GLB và license

- Model: [Standing horse — Innerscene Free Parts Library](https://www.innerscene.com/tools/library/3d-parts/standing-horse-01d8563f).
- License được trang model và điều khoản thư viện ghi là **CC0 1.0 Universal**: [library terms](https://www.innerscene.com/tools/library/terms).
- File: `horse-anatomy-v1.glb`, 4,990,516 bytes; 32 mesh, 7 material, không có texture; khoảng 208,238 tam giác.
- SHA-256: `0ca21251cd3d98d2af263885a5ab21147057b1fd152f08a1f8703f9bc0ebe2cd`.
- Nhà phát hành mô tả đây là model minh họa ngựa trưởng thành, không phải tài liệu tham chiếu thú y. Không dùng nó làm căn cứ chẩn đoán hoặc đo giải phẫu.
- License/provenance được ghi tại `src/features/medical/injury-mapper/assets/THIRD_PARTY_ASSETS.md`; notice MIT của Three.js được giữ trong viewer bundle.

## 5. Coordinate convention

- Model version: `horse-anatomy-v1`; frame nội bộ: `HORSE_ROOT_LOCAL`.
- Đơn vị mét; `+Y` hướng lên, `+Z` hướng đầu ngựa, `+X` là bên trái ngựa theo hướng nhìn của ngựa.
- Raycast surface point được chuyển từ world sang local bằng ma trận inverse của GLTF scene root. Không thay đổi scale, rotation hoặc translation của root; camera không tham gia vào tọa độ gửi Backend.
- Kiểm tra GLB sau biến đổi node cho bounds xấp xỉ `[-0.353, 0.353]`, y `[0.005, 2.147]`, z `[-1.180, 1.346]`. Giới hạn an toàn trên Mobile rộng hơn bounds này để tránh làm tròn làm mất điểm.
- Body gửi Backend chỉ chứa `position: { x, y, z }`; không gửi `modelVersion` hoặc `coordinateFrame`.

## 6. Region mapping

`injury-regions.mjs` dùng ngưỡng trục root-local để gợi ý 11 enum Backend: `HEAD`, `NECK`, `BACK`, `CHEST`, `ABDOMEN`, `PELVIS`, bốn vùng chân và `OTHER`. Đây là heuristic trên model minh họa, không dựa vào mesh index. Bác sĩ phải bấm xác nhận rõ; sửa vùng, loại hoặc trạng thái sẽ hủy xác nhận để bắt buộc xác nhận lại.

## 7. WebView bridge

- Protocol JSON có type và validation ở cả hai chiều; giới hạn kích thước message, chunk, số marker, model version, enum và tọa độ.
- WebView → RN: `VIEWER_READY`, `MODEL_LOADED`, `POINT_SELECTED`, `MARKER_SELECTED`, `VIEWER_ERROR`.
- RN → WebView: `LOAD_MODEL_START`, `LOAD_MODEL_CHUNK`, `LOAD_MARKERS`, `FOCUS_MARKER`, `REMOVE_DRAFT_MARKER`, `RESET_CAMERA`, `SET_MODE`.
- GLB được Metro đóng gói offline rồi chuyển qua bridge theo chunk Base64 96 KB. CSP chặn kết nối ra ngoài; WebView không mở URL ngoài, không bật file access và không thực thi message như code.
- Khi app vào nền, vòng render tạm dừng. Khi viewer đóng, listener, geometry, material, texture và renderer được giải phóng. Mất WebGL context được báo lỗi rõ ràng.

## 8. API integration

- Đã đối chiếu DTO và service trong Backend ở chế độ chỉ đọc.
- Tạo khám độc lập: `POST /api/v1/horses/:horseId/medical-records`; marker mới nằm trong `newInjuries[]`.
- Tái khám: `POST /api/v1/medical-cases/:caseId/visits`; chấn thương mới ở `newInjuries[]`, cập nhật chấn thương cũ ở `injuryUpdates[]` theo `injuryId`.
- Lịch sử: `GET /api/v1/horses/:horseId/injuries`; chi tiết lượt khám và bệnh án tiếp tục dùng `GET /medical-records/:id` và `GET /medical-cases/:id` hiện có.
- DTO mới chỉ gửi `bodyRegion`, `position`, `injuryType`, `recoveryStatus` và `notes` nếu có. Không gửi `examDate`; Backend đóng dấu giờ khám. Không tạo endpoint hoặc field Backend mới.
- Chỉ tạo injury mới sau khi người dùng đặt marker, hoàn thiện trường bắt buộc và xác nhận. Khám độc lập có injury mới phải chọn kết luận `ISSUE`, đúng quy tắc Backend.

## 9. Marker persistence

- Sau response tạo lượt khám, Mobile đối chiếu marker trả về với drafts rồi lưu metadata `{modelVersion, coordinateFrame, position, bodyRegion, injuryType}` vào AsyncStorage theo horse/injury.
- Khi đọc lại API, chỉ vẽ marker nếu metadata trên cùng thiết bị khớp model/frame, tọa độ, vùng và loại với response. Điểm vẽ nằm tại đúng XYZ đã lưu.
- Draft giữ ở state của form khi đóng/mở viewer và khi API trả lỗi; nút lưu bị khóa trong lúc request chạy; bấm lặp một điểm draft sẽ chọn lại marker hiện có thay vì thêm marker trùng chính xác.

## 10. Legacy handling

Backend chưa lưu `modelVersion` hoặc coordinate frame. Vì vậy dữ liệu cũ, dữ liệu trên thiết bị khác hoặc dữ liệu không có local metadata vẫn xuất hiện trong lịch sử với vùng/trạng thái nhưng không được đặt lên mô hình theo XYZ phỏng đoán. API hiện tại không đủ thông tin để chứng minh tọa độ đó thuộc `horse-anatomy-v1`.

## 11. Fallback

Không tạo 2D anchor để giả lập XYZ: Backend yêu cầu tọa độ đầy đủ và form hiện không thể tạo tọa độ surface chính xác nếu model/WebGL không chạy. Khi lỗi, app báo không thể lưu injury mới cho đến khi tải được mô hình, giữ draft đang có và cho đóng/mở lại để thử lại. Các trường khám không phụ thuộc injury vẫn dùng được.

## 12. Test results

- `pnpm check`: **pass** — TypeScript, ESLint, Prettier và i18n.
- `node --test tests/injury-mapper.test.mjs`: **6/6 pass** — tọa độ world→root-local, region mapping, validation, serialization, khôi phục legacy-safe và bridge.
- `node --test tests/mobile-unit.test.mjs`: **23/23 pass** — gồm kiểm tra POST khám độc lập/tái khám với `newInjuries`/`injuryUpdates` và không có `examDate`.
- `pnpm build:injury-mapper`: **pass**, bundle 631.9 KB.
- `pnpm exec expo export --platform ios`: **pass**; export chứa GLB và bundle viewer.
- `pnpm exec expo export --platform android`: **pass**; export chứa GLB và bundle viewer.
- Toàn bộ `pnpm test`: **41 pass, 4 fail**. Bốn assertion fail nằm trong `tests/api-contract.test.mjs` và nêu các chênh lệch contract đang có ở nhiều module (Google callback, training/time-trial, lifecycle, supplies, medical case cost và các response khác). Không có lỗi injury marker trong danh sách; các test injury mới và medical unit đều pass. Backend/Web không được chỉnh để làm xanh các audit này.
- Chưa chạy device interaction: không có Android `adb`; iOS `simctl` không thể kết nối `CoreSimulatorService`/không tìm được runtime.

## 13. Performance results

Đã đo asset tĩnh: GLB 4.99 MB, khoảng 208k tam giác, 32 mesh và không texture; viewer JS bundle 631.9 KB. Export bundle Hermes là khoảng 4.3 MB iOS và 4.6 MB Android. Chưa đo FPS, thời gian tải trên thiết bị, bộ nhớ GPU hoặc tình huống low-memory vì simulator/device không khả dụng; không tuyên bố đã benchmark runtime.

## 14. Những giới hạn còn tồn tại

- Cần kiểm tra trên iOS/Android thật: WebGL, thao tác xoay/pinch/tap, background/foreground, lỗi API, low-memory và độ rõ của marker.
- Local metadata không đồng bộ giữa thiết bị và mất khi app data bị xóa. API chưa đủ metadata để khôi phục marker trên máy khác hoặc sau cài lại.
- Không có idempotency key trong API. App chặn double tap khi đang lưu và điểm draft trùng chính xác, nhưng nếu kết nối mất sau khi server đã commit, client không thể chứng minh request đó đã được ghi để ngăn người dùng tạo lại sau khi mở form mới.
- Model và region classifier chỉ hỗ trợ ghi nhận vị trí; không thay thế tài liệu giải phẫu hoặc chẩn đoán.
- Khi đồng bộ `package-lock.json`, npm báo 31 advisory trong toàn bộ dependency tree (10 moderate, 20 high, 1 critical). Chưa chạy remediation; chưa xác định các advisory này có liên quan đến dependency mới hay có từ trước.

## 15. Những việc cần Backend hỗ trợ về sau

- Lưu/trả `modelVersion` và `coordinateFrame` cùng injury position; có kế hoạch đánh dấu hoặc chuyển đổi dữ liệu lịch sử chưa biết hệ tọa độ.
- Hỗ trợ idempotency key cho thao tác tạo khám để xử lý retry an toàn khi timeout không rõ kết quả.
- Sau khi các field trên có mặt, Mobile có thể khôi phục marker nhất quán trên thiết bị khác thay vì chỉ dựa vào metadata cục bộ.
