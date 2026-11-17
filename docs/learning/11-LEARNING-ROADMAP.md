# 11 — Lộ trình học để bảo vệ HorseRacing

## Cách học

Học theo 8 bài, mỗi bài khoảng 60–90 phút. Thứ tự đi từ TypeScript/React tới API, kiến trúc, nghiệp vụ và 3D. Với mỗi bài, đọc lý thuyết, xem source đã chỉ, tự vẽ luồng không nhìn tài liệu, làm bài tập, rồi trả lời quiz thành tiếng. Không cần thuộc mọi endpoint; cần giải thích được một luồng đi xuyên các layer và nêu giới hạn đúng.

---

## Bài 1 — TypeScript, object và dữ liệu ứng dụng

**Mục tiêu:** Đọc được type/interface, object lồng nhau, enum/union và hiểu DTO không kiểm tra JSON ở runtime.

**Kiến thức cần học:** primitive/object types; interface/type alias; optional property; array/map; generic; Promise type; narrowing.

**Lý thuyết:** TypeScript thêm bộ kiểm tra kiểu lúc phát triển. Nó giúp editor/compiler phát hiện việc truyền sai kiểu, nhưng kiểu bị xóa khi chạy JavaScript. Một interface mô tả hình dạng dữ liệu mong đợi, không tự xác thực dữ liệu đến từ mạng.

**Ví dụ đơn giản:** `type Book = { title: string; pages: number }` giúp function nhận Book biết `pages` là số. Nếu JSON server có `pages: "unknown"`, type khai báo không tự sửa hay chặn dữ liệu đó lúc runtime.

**Trong HorseRacing:** Xem `src/services/horse.service.ts` DTOs và `src/services/medical.service.ts` `MedicalRecordDto`; theo cách `apiRequest<T>` gắn type cho response.

**Bài tập:** Chọn một response DTO; vẽ JSON object tối giản; đánh dấu field bắt buộc/tùy chọn. Giải thích bằng lời điều gì xảy ra nếu server bỏ một field mà screen kỳ vọng.

**Quiz:** `apiRequest<HorseDto>()` có chứng minh response đúng HorseDto không?

**Đáp án:** Không. Generic giúp kiểm tra cách sử dụng trong source TypeScript; JSON được parse lúc runtime mà không được schema validator tổng quát xác minh.

**Tiêu chí đã hiểu:** Có thể giải thích interface vs object runtime và nêu một rủi ro DTO/JSON mismatch.

---

## Bài 2 — React Native, component và navigation lifecycle

**Mục tiêu:** Lần được app start → layout → route → screen và hiểu vì sao UI render lại.

**Kiến thức cần học:** React component/props/state; render; effect/dependency; mount/unmount; React Native; Expo; Expo Router file routes.

**Lý thuyết:** Component là function mô tả UI từ props/state. Khi state thay đổi, React chạy render để tạo UI mới. Effect thực hiện side effect như tải dữ liệu; dependency xác định lúc cần chạy lại. Expo Router suy ra đường dẫn từ file trong `app/`.

**Ví dụ đơn giản:** `useState(false)` giữ trạng thái mở/đóng modal; nút gọi setter, React render lại modal.

**Trong HorseRacing:** Đi từ `package.json` main → `app/_layout.tsx` provider/stack → `app/index.tsx` redirect → `app/[role]/horses.tsx` list/detail route. So sánh route file với screen/feature component.

**Bài tập:** Vẽ đường đi của user chưa login và user đã login từ root. Tìm một `useEffect` tải dữ liệu và ghi rõ dependency.

**Quiz:** Thay đổi state trong component có tải lại toàn bộ native app không?

**Đáp án:** Không; React render lại phần cây component bị ảnh hưởng theo reconciliation. Không nên diễn giải như khởi động lại app hay gọi lại mọi API tự động.

**Tiêu chí đã hiểu:** Có thể chỉ đúng entry point, layout, route và giải thích một lần render lại.

---

## Bài 3 — Async programming, HTTP và API client

**Mục tiêu:** Trace request-response, phân biệt HTTP error với network/timeout và giải thích refresh/retry.

**Kiến thức cần học:** Promise, async/await, try/catch/finally, HTTP verbs/status, JSON, headers, timeout, AbortController, retry semantics.

**Lý thuyết:** `await` đợi Promise settle; lỗi reject đi vào catch. Request có method/path/header/body; response có status/header/body. Timeout có thể xảy ra dù server đã nhận request nên retry write operation có thể tạo trùng nếu API không idempotent.

**Ví dụ đơn giản:** GET `/books` trả 200 với JSON array; mất wifi thì không có HTTP status vì response chưa đến.

**Trong HorseRacing:** Đọc `src/services/api-client.ts`, `src/config/api.ts`, `src/hooks/useApiResource.ts`. Trace `horseService.list` qua page loop và adapter tới UI.

**Request mẫu:** `GET https://api.horse.io.vn/api/v1/horses?page=1&limit=100`, header `Accept: application/json`, `Authorization: Bearer <access-token>`. Response minh họa theo DTO có `items` và pagination metadata; đây là ví dụ shape, không phải capture server.

**Bài tập:** Vẽ sequence diagram cho horse list; thêm nhánh 401→refresh→retry và nhánh timeout.

**Quiz:** Vì sao không retry tự động mọi POST sau timeout?

**Đáp án:** Server có thể đã commit nhưng response bị mất; retry có thể lặp side effect. Cần idempotency key hoặc semantics của endpoint.

**Tiêu chí đã hiểu:** Có thể lần từ screen đến fetch và chỉ rõ ba nhóm lỗi khác nhau.

---

## Bài 4 — State, auth, role và storage

**Mục tiêu:** Phân biệt server/context/component/local state và trình bày session lifecycle đúng.

**Kiến thức cần học:** React Context, state sharing, bearer token, refresh token, expiry, route guard, AsyncStorage, authorization.

**Lý thuyết:** Access token chứng minh phiên cho API trong thời hạn; refresh token dùng xin access token mới theo contract server. Role dùng chọn trải nghiệm/route. Authentication là xác định user; authorization là cho phép user thực hiện hành động. Client route guard chỉ cải thiện UX.

**Ví dụ đơn giản:** Thẻ thư viện xác định thành viên; quyền mượn sách phụ thuộc chính sách thư viện. UI ẩn nút mượn không thay cho kiểm tra quầy/server.

**Trong HorseRacing:** Đọc `src/context/AuthContext.tsx`, `src/features/auth/AuthRouteGate.tsx`, `src/features/auth/role-mapper.ts`, `src/services/auth.service.ts`; kiểm tra session key trong AsyncStorage.

**Bài tập:** Viết lại flow login và refresh thành 7 bước; liệt kê state nào bị xóa khi logout và điều gì cần backend xác nhận.

**Quiz:** `AuthRouteGate` có chứng minh người dùng không thể gọi endpoint bị cấm không?

**Đáp án:** Không. App client có thể sửa/bỏ qua; backend phải authorization trên từng request/resource.

**Tiêu chí đã hiểu:** Có thể phân biệt authentication/authorization, local/server state, và nêu rủi ro AsyncStorage.

---

## Bài 5 — Kiến trúc codebase, service, adapter và lỗi

**Mục tiêu:** Nói được architecture thực tế mà không gán pattern không có bằng chứng.

**Kiến thức cần học:** separation of concerns; feature/service organization; adapter; dependency direction; state flow; technical debt; SOLID khái quát.

**Lý thuyết:** Tách trách nhiệm giúp thay đổi một phần ít làm ảnh hưởng phần khác. Adapter chuyển dữ liệu giữa hai hình dạng. Dependency injection là truyền dependency từ bên ngoài thay vì tự tạo sâu trong module; source không có container DI thống nhất, nên không nên khẳng định có DI framework.

**Ví dụ đơn giản:** Adapter đổi ngày `2026-11-17` thành nhãn `17 Nov` cho UI, còn nguồn dữ liệu giữ format API.

**Trong HorseRacing:** Dùng `02-ARCHITECTURE.md`, `src/services/`, `src/adapters/`, `src/hooks/useApiResource.ts` và `app/[role]/horses.tsx`. Quan sát screen nào gọi service trực tiếp, screen nào qua hook.

**Bài tập:** Chọn một feature và vẽ screen → state/hook → adapter/service → api-client → backend. Ghi trách nhiệm có bằng chứng cho mỗi node.

**Quiz:** Vì sao không gọi source này là Clean Architecture hoàn chỉnh?

**Đáp án:** Layer boundaries không nhất quán, screen gọi service trực tiếp, business logic/UI orchestration còn trộn; không thấy repository abstraction/DI rõ xuyên suốt. Cách gọi phù hợp là feature/service organization.

**Tiêu chí đã hiểu:** Có thể giải thích dependency flow và nêu một trade-off cụ thể.

---

## Bài 6 — Business flow, validation và nguồn dữ liệu

**Mục tiêu:** Trace một flow nghiệp vụ từ hành động đến kết quả, nhận ra mock/fallback.

**Kiến thức cần học:** actor/precondition; state transition; API side effect; optimistic vs server-confirmed update; pagination; error branch; business rule.

**Lý thuyết:** Một feature không chỉ là screen: nó gồm actor, trạng thái trước, hành động, request, phản hồi, trạng thái sau và lỗi. Preview thường chỉ kiểm tra dự kiến; command mới thực hiện thay đổi. Fallback có thể giữ app render được nhưng che lỗi.

**Ví dụ đơn giản:** Đặt bàn: xem còn chỗ là preview; xác nhận đặt mới tạo booking.

**Trong HorseRacing:** Chọn horse placement, groom checklist hoặc medical visit từ `05-BUSINESS-FLOWS.md`; đọc route/service tương ứng. So sánh REST/Socket.IO data với `sensor-simulator.ts`, đang tạo metric cục bộ rồi ingest lên backend.

**Bài tập:** Viết preconditions, success path và hai error path của medical visit. Gắn mỗi bước với file thật.

**Quiz:** Nếu dashboard đổi API lỗi thành `[]`, UI empty chứng minh điều gì?

**Đáp án:** Chỉ chứng minh UI nhận mảng rỗng; có thể do server trả empty hoặc catch fallback. Phải xem error/loading/service log.

**Tiêu chí đã hiểu:** Có thể mô tả state trước/sau và đánh dấu rõ API, mock, local hoặc cannot verify.

---

## Bài 7 — Three.js, coordinate frame và lưu marker

**Mục tiêu:** Giải thích mapper 3D từ model load tới API/local persistence, không phóng đại độ chính xác.

**Kiến thức cần học:** GLB, scene/camera/renderer; raycast; vector; world/local coordinates; frame/version; WebView bridge; AsyncStorage.

**Lý thuyết:** Camera tạo tia từ điểm chạm vào scene; raycaster tìm giao với mesh. Tọa độ world phụ thuộc transform scene; local tọa độ gắn tương đối với horse root. Đổi model/frame mà không chuyển đổi dữ liệu có thể đổi ý nghĩa điểm.

**Ví dụ đơn giản:** Sticker dán lên quả bóng nên lưu vị trí tương đối theo bóng, không theo tọa độ của căn phòng.

**Trong HorseRacing:** Đọc `Injury3DMapper.tsx`, `viewer-entry.ts`, `injury-coordinate.mjs`, `injury-model-metadata.ts`, `medical.service.ts` và `08-3D-INJURY-MAPPING.md`.

**Bài tập:** Vẽ chuỗi tap → NDC/raycast → world hit → `worldToLocal` → region suggestion → RN draft → medical API + sidecar.

**Quiz:** Vì sao x/y/z API chưa đủ khôi phục marker trên một thiết bị khác?

**Đáp án:** Metadata model/frame/region/type hiện được lưu cục bộ; server DTO chỉ có vị trí. Thiết bị mới không có sidecar khớp để xác nhận cách dựng điểm.

**Tiêu chí đã hiểu:** Có thể trình bày coordinate frame/version và nêu rõ mapper không phải diagnostic tool.

---

## Bài 8 — Bảo vệ đồ án và trade-offs

**Mục tiêu:** Trả lời phản biện chính xác, ngắn gọn và có code evidence.

**Kiến thức cần học:** trade-off, scope boundary, scalability, reliability, security assumptions, test strategy, limitations.

**Lý thuyết:** Hội đồng đánh giá khả năng giải thích quyết định và giới hạn. Phân biệt điều source chứng minh, inference có điều kiện và điều cần server/device để xác nhận.

**Ví dụ đơn giản:** “Tôi biết client gọi API X; tôi chưa kiểm tra backend authorization nên không kết luận server policy.” Đây là trả lời có phạm vi rõ hơn đoán implementation.

**Trong HorseRacing:** Luyện `10-CODE-DEFENSE-QA.md`, mở code evidence mỗi câu: `api-client.ts`, `AuthContext.tsx`, medical visit, live route, mapper.

**Bài tập:** Quay audio/video thử trình bày 5 phút; câu trả lời phải dẫn ít nhất ba file và tự nêu một trade-off.

**Quiz:** Hãy trả lời: “Nếu 100.000 horse, app có scale không?”

**Đáp án:** Không thể kết luận chỉ từ mobile. Client hiện có page loop và một N+1 training pattern có thể làm tăng request/latency; cần profile/backend pagination/batch/cache/load test để đánh giá ở quy mô đó.

**Tiêu chí đã hiểu:** Trả lời trong 60–90 giây, có evidence, không gọi mock là production, không suy đoán backend.

---

## Ma trận ưu tiên kiến thức

| Cấp độ | Chủ đề | Mức quan trọng | Hiểu đến mức | File học |
|---|---|---|---|---|
| 1 — Programming | TypeScript, object/DTO, Promise, error handling | Critical | Trace object và async flow | `api-client.ts`, service DTOs |
| 2 — Mobile | React render/effect, Expo Router, Context, AsyncStorage | Critical | Trace startup/route/state | `app/_layout.tsx`, `AuthContext.tsx` |
| 2 — Mobile | API integration, pagination, upload | High | Mô phỏng request/response | `api-client.ts`, domain services |
| 3 — Engineering | Layering, adapter, separation, SOLID trade-offs | High | Mô tả evidence và hạn chế | `02-ARCHITECTURE.md`, adapters/services |
| 3 — Engineering | Testing, reliability, error strategy | High | Đề xuất cách kiểm chứng, không tuyên bố test chưa chạy | `AsyncStateView.tsx`, hooks/services |
| 4 — Project | Auth/security và role authorization | Critical | Nêu client/server boundary | `AuthContext.tsx`, `AuthRouteGate.tsx` |
| 4 — Project | Medical business flow | Critical | Trace form tới API và sidecar | `medical/visit.tsx`, `medical.service.ts` |
| 4 — Project | Three.js coordinate systems | High | Giải thích raycast/local frame | mapper components |
| 4 — Project | Realtime/simulator | Medium | Phân biệt socket và telemetry được mô phỏng | realtime service, simulator, participant view |

## Kế hoạch ôn 7 ngày

1. **Ngày 1:** Bài 1–2; vẽ app startup và route.
2. **Ngày 2:** Bài 3; trace GET horse list và 401 refresh.
3. **Ngày 3:** Bài 4–5; giải thích role, storage, dependency flow.
4. **Ngày 4:** Bài 6; trình bày medical visit hoặc groom checklist.
5. **Ngày 5:** Bài 7; vẽ mapper sequence và nêu sidecar limitation.
6. **Ngày 6:** Bài 8; luyện câu hỏi architecture/security/API.
7. **Ngày 7:** Mock defense 15 phút; sửa câu trả lời dựa trên code evidence, không dựa trên trí nhớ.
