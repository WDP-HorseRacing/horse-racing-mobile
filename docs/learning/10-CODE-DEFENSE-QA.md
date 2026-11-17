# 10 — Bảo vệ code và hỏi đáp

## 1. Cách trả lời câu hỏi kiến trúc

Dùng cấu trúc ngắn bốn phần:

1. **Mục tiêu:** người dùng cần làm gì?
2. **Cơ chế:** route, state, service/API nào thực hiện?
3. **Lý do:** vì sao luồng này phù hợp với app?
4. **Giới hạn:** phần nào local/mock, phụ thuộc backend hoặc chưa được xác minh?

Ví dụ: “Danh sách horse dùng service để tải theo trang, adapter chuẩn hóa location/health rồi FlatList render. Debounce giảm request khi gõ. Một số fallback có thể biến lỗi thành danh sách rỗng; vì vậy UI rỗng cần phân biệt với endpoint trả empty.”

## 2. Câu hỏi thường gặp và câu trả lời dựa trên source

### Vì sao dùng Expo Router?

Route được tổ chức theo file trong `app/`, dynamic segment biểu diễn role/resource ID, còn `_layout.tsx` chia sẻ provider và stack. Source hiện đã chuyển sang Expo SDK 58 theo package manifest; README cũ ghi SDK 57 nên không dùng README làm nguồn version hiện hành.

### Authentication được hoàn tất khi nào?

Sau login token, app gọi `/auth/me`, map role được hỗ trợ, rồi persist session/set state. Nhận access token đơn lẻ chưa đủ để app xác định user context/route role.

### UI bảo vệ dữ liệu ra sao?

Route gate lọc navigation; permission DTO điều khiển tabs/actions. Đây là UX enforcement phía client. Backend phải xác minh quyền cho từng request; mobile repo không chứa server để chứng minh điều đó.

### Dữ liệu nào thật và dữ liệu nào demo?

Service gọi API là tích hợp theo contract. Fixtures, live hardcoded series và simulator là local/demo. Một màn có thể trộn: ví dụ hồ sơ horse UUID dùng API nhưng một số chart/fallback còn fixture.

### Vì sao dùng local AsyncStorage cho một số dữ liệu?

App lưu preference/session/recent IDs và injury model metadata. Tuy nhiên session là dữ liệu nhạy cảm và source hiện không dùng secure storage. Injury metadata local làm marker phụ thuộc thiết bị. Đây là giới hạn cần nêu, không nên nói AsyncStorage là mã hóa an toàn.

### Tại sao có adapter?

API response lồng/nested hoặc enum server không trùng view model. Adapter như `mapHorseSummary` và mapper groom chuyển shape cho UI để screen bớt phụ thuộc DTO chi tiết.

### API lỗi thì sao?

API client phân loại HTTP/network/timeout và tạo ApiError. Hook/screen có thể render error, alert hoặc fallback. Một số dashboard bắt lỗi tùy chọn về zero/empty; cần nhìn implementation cụ thể trước khi khẳng định lỗi được người dùng thấy.

### 3D mapper có định vị tổn thương chính xác không?

Không thể khẳng định điều đó. Nó raycast lên model tổng quát và lưu tọa độ local; region được gợi ý bằng threshold, có thể chỉnh. Model/coordinate convention không được mô tả là bản đồ lâm sàng đã chuẩn hóa.

### Vì sao marker có thể mất khỏi timeline?

API có tọa độ nhưng không có model/frame metadata. Client dựa thêm sidecar AsyncStorage để kiểm tra model/frame/region/type. Mất hoặc lệch sidecar khiến marker không còn được dựng dù medical record có thể còn ở server.

### Realtime đã kết nối cảm biến thật chưa?

Code có Socket.IO client và simulator. Simulator tạo dữ liệu giả; source không chứng minh thiết bị phần cứng thực đã kết nối hoặc backend gửi đúng telemetry thật.

## 3. Câu hỏi sâu hơn

1. **Điều gì xảy ra nếu refresh token hết hạn?** Client refresh thất bại rồi session restore/401 path chuyển lỗi; exact invalidation/expiry policy phía server cần contract.
2. **Nếu timeout khi tạo visit, có thể gửi lại ngay không?** Không tự kết luận an toàn: server có thể đã commit. Cần request ID/idempotency contract hoặc tải lại case trước khi retry.
3. **Nếu đổi role trong response `/auth/me`?** Auth state/route được quyết định từ role mapping; kiểm tra thứ tự role server trả về và route gate. Backend permission vẫn độc lập.
4. **Nếu app offline khi tick checklist?** Không thấy offline queue; thao tác cần mạng và retry/refresh theo UI flow.
5. **Nếu có nhiều metric cùng lúc?** Socket event handler/callback cập nhật UI; cần kiểm tra ordering, dedup và backpressure trên thiết bị/server.
6. **Nếu API injury coordinate dùng model cũ?** DTO thiếu version/frame; local sidecar chỉ khôi phục khi metadata tương thích. Cần server schema/versioning hoặc migration.
7. **Nếu preview placement hợp lệ nhưng update thất bại?** Preview không commit; màn phải hiển thị lỗi và tải lại authoritative state.

## 4. Những phát biểu nên tránh

- “Backend bảo mật đúng” nếu chỉ thấy AuthRouteGate/ẩn button.
- “Dữ liệu toàn bộ real-time” khi live route dùng hardcoded series hoặc simulator.
- “Mọi chart lấy server” khi có mock fallback.
- “Vị trí injury chính xác/được chuẩn hóa y khoa” khi asset là model tổng quát và heuristic theo trục.
- “Session an toàn vì được lưu local” khi key nằm trong AsyncStorage.
- “README mô tả dependency hiện tại” khi package manifest khác phiên bản.
- “API luôn trả đúng DTO” khi không có runtime schema validation.

## 5. Checklist demo trực tiếp

- Nêu app role và cách login xác nhận `/auth/me`.
- Mở route role, horse list, detail và chỉ ra service/adapter.
- Phân biệt UUID API route và demo/fixture path.
- Trình bày medical visit flow, injury marker và sidecar local.
- Mở code live hardcoded và performance realtime để chỉ ra khác nhau.
- Nói rõ backend source không nằm trong phạm vi audit.
- Khi endpoint hiển thị empty, kiểm tra loading/error/fallback trước khi diễn giải.

## 6. Cách thừa nhận điều chưa biết

Dùng câu kiểm chứng được: “Trong mobile repo, client gọi endpoint X với payload Y. Tôi chưa xác minh server authorization/storage/side-effect vì backend không có trong phạm vi. Để khẳng định, cần đối chiếu handler/schema/test hoặc log của server.” Đây là câu trả lời chính xác hơn việc suy đoán implementation backend.

## 7. Bộ câu hỏi theo 14 nhóm hội đồng

Mỗi câu dưới đây có đáp án mẫu, giải thích, code evidence, câu hỏi nối tiếp và lỗi trả lời thường gặp. Khi trình bày, mở đúng file để bảo vệ bằng chứng thay vì học thuộc câu chữ.

### 1. General Project Questions

**Question:** Mobile HorseRacing giải quyết nhu cầu gì và có những vai trò nào?

**Short Answer:** Mobile client cung cấp các luồng quản lý ngựa, stable/care, medical, training/performance và thông tin owner/manager theo năm app role đã map.

**Detailed Explanation:** `role-mapper.ts` ánh xạ HEAD_TRAINER, GROOM, VETERINARIAN, HORSE_OWNER, CLUB_MANAGER lần lượt thành trainer, groom, vet, owner, manager. Các route và service chứng minh chức năng phía mobile; chúng không chứng minh toàn bộ sản phẩm/backend.

**Code Evidence:** `src/features/auth/role-mapper.ts`; `app/[role]/index.tsx`; `src/services/`.

**Follow-up Questions:** Role nào có quyền tạo visit? Owner xem được dữ liệu nào? → cần đối chiếu screen/permission DTO/API; server policy chưa được audit.

**Common Mistakes:** Nói có sáu role hoặc khẳng định mọi role có quyền tương tự nhau.

### 2. Architecture Questions

**Question:** Đây có phải Clean Architecture không?

**Short Answer:** Không có đủ bằng chứng để gọi là Clean Architecture hoàn chỉnh; thực tế là tổ chức theo feature/service với một số adapter và API client dùng chung.

**Detailed Explanation:** Route/screen gọi hook/service; service dùng transport chung; adapter xuất hiện ở một số domain. Nhiều screen điều phối API/business validation trực tiếp; không thấy use-case/repository interface/DI boundary nhất quán.

**Code Evidence:** `02-ARCHITECTURE.md`; `app/[role]/medical/visit.tsx`; `src/services/api-client.ts`; `src/adapters/`.

**Follow-up Questions:** Một cải tiến architecture cụ thể? → tách orchestration có giá trị cao, thêm test seams/contract validation trước refactor rộng.

**Common Mistakes:** Gọi mỗi folder là một Clean Architecture layer hoặc tuyên bố có repository pattern toàn cục.

### 3. Programming Language Questions

**Question:** TypeScript bảo vệ app khỏi API trả sai dữ liệu như thế nào?

**Short Answer:** TypeScript giúp kiểm tra cách dùng trong lúc phát triển; hiện `apiRequest<T>` không validate JSON tổng quát lúc runtime.

**Detailed Explanation:** Type/interface bị xóa khi build JavaScript. Server có thể trả sai/mất field mà compile vẫn thành công; normalize hoặc schema validator cần ở boundary nếu payload critical.

**Code Evidence:** DTOs trong `src/services/medical.service.ts`, `src/services/horse.service.ts`; `src/services/api-client.ts`.

**Follow-up Questions:** Khi nào thêm runtime schema validation? → ở API boundary cho dữ liệu critical/unstable.

**Common Mistakes:** Nói interface tự deserialize/validate JSON.

### 4. Mobile Framework Questions

**Question:** Tại sao nhóm chọn Expo/React Native thay vì native iOS/Android?

**Short Answer:** Source cho thấy app hiện được xây bằng Expo/React Native; lý do lịch sử chọn công nghệ không thể xác minh chỉ từ implementation. Lựa chọn này cho phép chia sẻ phần lớn UI/logic giữa nền tảng, đồng thời vẫn dùng Expo/native modules.

**Detailed Explanation:** Package/config khai báo Expo SDK 58, React Native 0.88.1, Expo Router và build cho iOS/Android/web. Ưu điểm/đánh đổi là lý do kỹ thuật phổ biến; không nên gán động cơ chắc chắn cho nhóm nếu không có design record.

**Code Evidence:** `package.json`; `app.json`; `app/_layout.tsx`; `app/` route files.

**Follow-up Questions:** Native module/WebView cần kiểm tra gì? → compatibility theo SDK/platform và thiết bị thực.

**Common Mistakes:** Nói “chọn vì dễ nhất” hoặc hứa một codebase đồng nhất tuyệt đối.

### 5. State Management Questions

**Question:** App dùng Redux để giữ state à?

**Short Answer:** Không thấy Redux trong source audit; dùng React local state, Auth/I18n Context và `useApiResource` cho một số API-backed state.

**Detailed Explanation:** AuthContext là session dùng chung, I18nContext là locale; hook có data/loading/error cho resource. Form state cục bộ gắn với vòng đời của screen.

**Code Evidence:** `src/context/AuthContext.tsx`; `src/context/I18nContext.tsx`; `src/hooks/useApiResource.ts`.

**Follow-up Questions:** Form state cục bộ có sống sau khi đóng screen không? → không; nó theo vòng đời component.

**Common Mistakes:** Gọi Context là database hoặc nói toàn bộ API response nằm trong một global store.

### 6. API Integration Questions

**Question:** Khi token hết hạn giữa lúc gọi API, chuyện gì xảy ra?

**Short Answer:** Nếu nhận 401 và có token/refresh handler, API client thử refresh rồi retry request gốc một lần.

**Detailed Explanation:** AuthContext giữ refresh Promise dùng chung; client gắn Bearer token, timeout 15 giây, parse response và map HTTP error. Nếu refresh thất bại, error đi lên screen/auth flow; không khẳng định mọi screen hiển thị giống nhau.

**Code Evidence:** `src/services/api-client.ts`; `src/context/AuthContext.tsx`; `src/services/auth.service.ts`.

**Follow-up Questions:** POST bị timeout có thể retry không? → phụ thuộc idempotency, vì server có thể đã commit.

**Common Mistakes:** Nói mọi lỗi retry tự động hoặc timeout chắc chắn đồng nghĩa request chưa tới server.

### 7. Authentication and Security Questions

**Question:** Làm sao bảo vệ API khỏi user truy cập sai role?

**Short Answer:** Mobile có route gate và permission-driven UI, nhưng chỉ backend có thể bảo vệ endpoint; backend authorization chưa được xác minh trong repo này.

**Detailed Explanation:** Client có thể bị sửa/bypass. Server cần xác thực token và kiểm tra quyền/resource scope ở mỗi request. Session hiện được lưu bằng AsyncStorage, không thấy SecureStore integration.

**Code Evidence:** `src/features/auth/AuthRouteGate.tsx`; `src/features/auth/role-mapper.ts`; `src/services/horse.service.ts` permissions; `src/context/AuthContext.tsx`.

**Follow-up Questions:** Logout có revoke refresh token không? → client gọi endpoint rồi xóa local state; kết quả server cần kiểm chứng.

**Common Mistakes:** Gọi việc ẩn nút là security enforcement hoặc nói AsyncStorage mã hóa token.

### 8. Database and Data Modeling Questions

**Question:** Injury được lưu trong database thế nào?

**Short Answer:** Mobile gửi injury qua medical API với position x/y/z và các trường domain; database schema/server persistence không nằm trong repo nên không thể khẳng định cấu trúc database.

**Detailed Explanation:** DTO cho biết client mong đợi record/timeline shape. Model version/frame được sidecar local lưu, không có trong injury timeline DTO đã audit; đây là điểm dữ liệu API và cách render gắn với nhau chưa đầy đủ.

**Code Evidence:** `src/services/medical.service.ts`; `src/features/medical/injury-mapper/injury-model-metadata.ts`; `app/[role]/medical/visit.tsx`.

**Follow-up Questions:** Tọa độ có unit/frame/version không? → UI/model metadata nói meter/root-local/v2; API timeline không chứa hai metadata version/frame.

**Common Mistakes:** Bịa bảng SQL, quan hệ FK hoặc đảm bảo retention từ DTO phía client.

### 9. 3D Injury Mapping Questions

**Question:** Tap trên mô hình được chuyển thành vị trí injury thế nào?

**Short Answer:** Viewer raycast từ tap tới horse mesh, chuyển world hit sang `HORSE_ROOT_LOCAL`, kiểm tra bounds, gợi ý region rồi gửi qua bridge cho RN form.

**Detailed Explanation:** Viewer dùng Three.js và GLB. Mốc tọa độ phụ thuộc asset/version; region suggestion là heuristic theo trục và người dùng có thể chỉnh. API lưu x/y/z; sidecar local có version/frame để dựng marker.

**Code Evidence:** `src/features/medical/injury-mapper/viewer-entry.ts`; `injury-coordinate.mjs`; `Injury3DMapper.tsx`; `injury-model-metadata.ts`.

**Follow-up Questions:** Có thể dùng làm chẩn đoán không? → không; đây là nhập vị trí tương đối trên model tổng quát.

**Common Mistakes:** Nói AI nhận diện injury, anatomy mesh semantic, hoặc độ chính xác mm nếu không có bằng chứng.

### 10. Business Logic Questions

**Question:** Medical standalone record khác follow-up visit thế nào?

**Short Answer:** Visit screen gửi standalone tới `/horses/:horseId/medical-records`; nếu có active case thì gửi follow-up tới `/medical-cases/:caseId/visits`.

**Detailed Explanation:** UI tải dữ liệu liên quan, validate fields/marker, yêu cầu xác nhận và chọn endpoint theo case context. Injury mới chỉ gửi theo nhánh mở case; follow-up dùng injury updates. Server rules còn cần kiểm chứng.

**Code Evidence:** `app/[role]/medical/visit.tsx`; `src/services/medical.service.ts`.

**Follow-up Questions:** Nếu gửi thành công nhưng local metadata thất bại? → server record có thể đã commit, marker restore có thể không.

**Common Mistakes:** Gộp visit/case thành cùng một loại record hoặc bỏ qua sidecar write.

### 11. Error Handling Questions

**Question:** Nếu mất Internet giữa thao tác thì app làm gì?

**Short Answer:** API client có timeout/network error handling; không thấy offline queue chung. UI tùy screen có thể báo lỗi, giữ dữ liệu cũ hoặc fallback thành empty.

**Detailed Explanation:** `useApiResource` giữ state và refresh; error widgets/Alert hiển thị một số failures. Một số optional dashboard catch về zero/empty. Write operation có thể cần retry thủ công; retry POST phải xem idempotency.

**Code Evidence:** `src/services/api-client.ts`; `src/hooks/useApiResource.ts`; `src/components/common/AsyncStateView.tsx`; dashboard route.

**Follow-up Questions:** Empty screen có nghĩa không có record? → chưa chắc, cần phân biệt error/fallback.

**Common Mistakes:** Hứa app hoạt động offline toàn diện hoặc retry mọi mutation an toàn.

### 12. Testing Questions

**Question:** Làm sao chứng minh feature hoạt động và phần nào đã được test?

**Short Answer:** Repo có 5 file test và script `pnpm test`; lần audit này không chạy test/build. Có unit/helper checks và static contract checks; đó không đồng nghĩa đã xác nhận mọi flow trên server/thiết bị.

**Detailed Explanation:** `tests/injury-mapper.test.mjs` kiểm tra tọa độ/policy/protocol; `tests/mobile-unit.test.mjs` kiểm tra API client, mapper và validation; `tests/navigation.test.mjs` kiểm tra helper/hook behavior; `tests/i18n.test.mjs` kiểm tra catalog; `tests/api-contract.test.mjs` static compare mobile calls/DTO với OpenAPI JSON ở sibling `../horse-racing-ne/docs/openapi.contracts.json`. Contract test không gọi live server; OpenAPI sibling không được đọc trong audit mobile-only.

**Code Evidence:** `package.json` script `test`; `tests/api-contract.test.mjs`, `tests/injury-mapper.test.mjs`, `tests/mobile-unit.test.mjs`, `tests/navigation.test.mjs`, `tests/i18n.test.mjs`; logic được kiểm tra gồm `injury-coordinate.mjs`, `medical-validation.ts`, adapters và `api-client.ts`.

**Follow-up Questions:** Bạn đã chạy gì cho audit này? → đọc/scanned source và tạo docs; không chạy test/build. Test contract so sánh với nguồn nào? → file OpenAPI JSON ở sibling path nêu trên; phần đó không được mở/đánh giá trong scope.

**Common Mistakes:** Nói test pass khi chưa chạy hoặc tự nhận có coverage chưa kiểm tra.

### 13. Technical Limitations Questions

**Question:** Tính năng 3D hiện có hạn chế nào quan trọng nhất?

**Short Answer:** Marker cần local sidecar model/frame metadata; body-region heuristic không phải anatomy mapping lâm sàng; model là asset tổng quát.

**Detailed Explanation:** API x/y/z không mang model version/frame. Sidecar mất/mismatch có thể ẩn marker. Gesture/model WebView cần kiểm chứng trên thiết bị mục tiêu; server/device performance không được audit.

**Code Evidence:** `08-3D-INJURY-MAPPING.md`; `injury-model-metadata.ts`; `injury-regions.mjs`; `THIRD_PARTY_ASSETS.md`.

**Follow-up Questions:** Ưu tiên cải thiện gì? → version/frame schema và cross-device round-trip trước, có clinician review cho region semantics.

**Common Mistakes:** Chỉ kể UI limitation hoặc gọi heuristic là thuật toán diagnostic.

### 14. Design Decisions and Trade-offs

**Question:** Vì sao app dùng REST, Expo Router và WebView/Three.js; có trade-off gì?

**Short Answer:** Implementation cho thấy REST cho request/response, Expo Router cho file-based routes, Socket.IO riêng cho performance events, WebView/Three.js cho viewer 3D. Lý do lịch sử chọn các công nghệ chưa được ghi nhận; trade-off có thể phân tích từ code.

**Detailed Explanation:** REST service tập trung contract; Socket.IO cung cấp event push; WebView tái sử dụng Three.js/GLTFLoader nhưng thêm bridge/loading/memory complexity. File-based routing làm route discovery dễ, nhưng role route có thể có logic nhiều nơi. Cần tránh suy diễn design intent không có ADR.

**Code Evidence:** `package.json`; `app/`; `src/services/api-client.ts`; `src/services/realtime.service.ts`; `src/features/medical/injury-mapper/`.

**Follow-up Questions:** Nếu tải dữ liệu lớn hơn? → kiểm tra pagination, N+1, cache, request concurrency và profile thiết bị/server.

**Common Mistakes:** Nói “tốt nhất/chuẩn nhất” không có yêu cầu so sánh, hoặc khẳng định nhóm đã cân nhắc alternative nếu không có tài liệu.
