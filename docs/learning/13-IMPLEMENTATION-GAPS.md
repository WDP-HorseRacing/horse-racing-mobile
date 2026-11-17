# 13 — Hạn chế, rủi ro và điểm cần kiểm chứng

Phân loại ở đây tránh gọi mọi khả năng là bug. **Confirmed** nghĩa là đặc tính có bằng chứng trong mobile source; **Potential** là rủi ro có điều kiện cần tái hiện; **Cannot verify** cần backend, thiết bị hoặc hạ tầng ngoài repo. Không sửa source trong lần audit này.

## 1. Ưu tiên cao — dữ liệu y tế và tính liên tục của marker

| Mức | Phân loại | Bằng chứng | Tác động có thể có | Hướng xử lý để nhóm cân nhắc |
|---|---|---|---|---|
| P1 | Confirmed limitation | Injury API DTO có x/y/z; modelVersion/frame nằm trong AsyncStorage sidecar theo horse ID | Đổi thiết bị, gỡ app hoặc mất key có thể làm marker cũ không render dù record còn | Đưa model/frame/version vào API schema; có migration/version policy; kiểm thử restore sau reinstall/đăng nhập thiết bị khác |
| P1 | Confirmed limitation | Visit ghi API trước rồi mới lưu sidecar | API record có thể thành công trong khi local metadata write lỗi | Trả trạng thái partial success có thể phục hồi; retry/idempotent metadata write; telemetry rõ ràng |
| P1 | Cannot verify | Chỉ mobile repo được kiểm tra; backend implementation không nằm trong audit này | Không xác nhận authorization, persistence, audit trail hay validation y tế; có static contract test đọc OpenAPI JSON từ sibling path nhưng test chưa chạy và contract không được mở riêng | Review backend handlers/schema/policies và integration tests trước khi tuyên bố end-to-end |
| P1 | Confirmed limitation | Medical validation ranges là constants phía client | Không bảo đảm dữ liệu hợp lệ nếu API bị gọi ngoài app; chuẩn lâm sàng chưa được xác nhận | Backend validation; duyệt bởi chuyên gia; version hóa rule và ghi nguồn |

## 2. Ưu tiên cao — credential và role security

| Mức | Phân loại | Bằng chứng | Tác động có thể có | Hướng xử lý để nhóm cân nhắc |
|---|---|---|---|---|
| P1 | Confirmed limitation | Session access/refresh token trong AsyncStorage; không thấy SecureStore | Credential có thể không có bảo vệ keychain/keystore chuyên biệt | Đánh giá threat model; dùng secure storage cho credential nếu phù hợp; xem xét purge/logout lifecycle |
| P1 | Cannot verify | Route gate/permission DTO ở client; backend source ngoài phạm vi | Không chứng minh server kiểm tra quyền theo role/club/horse | Audit authorization ở mọi endpoint theo resource scope; test truy cập chéo role/club |
| P2 | Confirmed design detail | Multiple roles xử lý bằng role map/role đầu tiên được hỗ trợ | Nếu thứ tự roles response không ổn định, app role có thể khác kỳ vọng | Làm rõ priority trong API contract; test nhiều role và role không hỗ trợ |

## 3. Ưu tiên vừa — dữ liệu sai nguồn, lỗi bị che và tải

| Mức | Phân loại | Bằng chứng | Tác động có thể có | Hướng xử lý để nhóm cân nhắc |
|---|---|---|---|---|
| P2 | Confirmed | Dashboard tùy chọn bắt lỗi về `[]`/`0` | Empty state trông như kết quả hợp lệ dù API lỗi | Phân biệt partial failure với giá trị rỗng; log endpoint nào lỗi; hiển thị banner trạng thái |
| P2 | Confirmed | `app/[role]/live/[id].tsx` có hardcoded `liveSeries` và timer | Người xem có thể nhầm demo với telemetry thật | Đánh nhãn demo trong UI hoặc thay bằng realtime API nếu sản phẩm yêu cầu |
| P2 | Confirmed | Một số hồ sơ/legacy dashboard/prototype trộn fixture/local state và API | Khó biết dữ liệu nào authoritative trong demo và bảo vệ | Tách nhánh fixture rõ, đánh dấu sample data, bỏ legacy route/component nếu không còn dùng |
| P2 | Confirmed pattern | `trainingService.listAllVisibleSessions` tải session cho từng horse | Nhiều request và độ trễ tăng theo danh sách horse | Batch/aggregate endpoint, giới hạn concurrency, pagination hợp lý; đo thực tế |
| P2 | Confirmed | `apiRequest<T>` parse JSON nhưng không validate schema runtime tổng quát | Shape mismatch có thể gây lỗi sâu ở UI | Dùng validator cho payload critical hoặc defensive normalization; ghi contract version |
| P2 | Confirmed | Generation guard bỏ stale state update nhưng không abort request cũ | Request thừa và tiêu thụ băng thông khi search/filter đổi nhanh | Kết nối AbortSignal cho resource hook; hủy khi request bị thay thế/unmount |

## 4. Ưu tiên vừa — realtime và upload

| Mức | Phân loại | Bằng chứng | Tác động có thể có | Hướng xử lý để nhóm cân nhắc |
|---|---|---|---|---|
| P2 | Potential | Participant view append local simulator tick và socket events; không thấy dedup timestamp/source | Có thể hiển thị metric trùng nếu backend echo ingest | Có correlation/event ID, dedupe window và kiểm tra server echo semantics |
| P2 | Confirmed architecture risk | Incident/checklist upload là xin URL → PUT → complete → domain PATCH/POST | Lỗi giữa chừng có thể để media chưa được gắn; upload orphan cần cleanup | Retry state theo từng bước; server cleanup; idempotent complete; hiển thị rõ trạng thái |
| P2 | Cannot verify | Socket reconnect và parse client-side đã có, server delivery guarantees không có trong repo | Không thể khẳng định thứ tự, exactly-once hoặc không mất event | Xác minh sequence/replay/ack server contract; test reconnect và event duplication |

## 5. Maintainability và consistency

| Mức | Phân loại | Bằng chứng | Tác động có thể có | Hướng xử lý để nhóm cân nhắc |
|---|---|---|---|---|
| P2 | Confirmed | Một số route lớn trộn UI, form validation, orchestration và API calls; architecture không layer thống nhất | Khó unit test logic và làm feature thay đổi an toàn | Tách use-case/helper theo nhu cầu thực tế; giữ screen mỏng dần; không refactor diện rộng khi chưa có test |
| P2 | Confirmed pattern | Checklist evidence upload/patch/refresh được điều phối ở nhiều entry point (`app/groom/tasks.tsx`, `app/[role]/work.tsx`, `RoleDashboard.tsx`, `HorseStableCareScreen.tsx`) | Các screen có thể lệch error/loading/refresh behavior khi feature đổi; endpoint method đã được gom qua `stableCareService` | Cân nhắc gom orchestration vào hook/use case dùng chung; giữ UI chỉ chọn photo/hiển thị status |
| P2 | Confirmed docs drift | README nói SDK 57 và `src/native/`, trong khi manifest là SDK 58 và folder map không có `src/native/` | Onboarding/build instructions và defense có thể dùng thông tin cũ | Cập nhật README sau khi maintainer xác nhận; dùng manifest/lockfile làm nguồn version |
| P2 | Confirmed docs drift | 3D implementation report còn nêu v1 active, source import v2 | Có thể giải thích sai model/frame khi trình bày | Cập nhật báo cáo cũ, nêu model version rõ ở một nơi authoritative |
| P3 | Confirmed manifest/source observation | Một vài direct dependency khai báo nhưng không thấy import trực tiếp trong source: linear-gradient, reanimated, expo-system-ui | Dependency thừa hoặc được dùng gián tiếp/plugin/platform | Kiểm tra platform/transitive/plugin rồi loại bỏ nếu thực sự không cần; không xóa chỉ theo grep |
| P3 | Confirmed | Pagination phụ thuộc metadata `totalPages`; vài service có fallback khi metadata không đủ | Có thể dừng sớm hoặc số request không như dự kiến | Chuẩn hóa pagination contract và fallback; test response thiếu/sai metadata |

## 6. Test coverage evidence và giới hạn

Repo khai báo `pnpm test` chạy Node test runner trên `tests/*.test.mjs` và có năm file: `api-contract.test.mjs`, `i18n.test.mjs`, `navigation.test.mjs`, `injury-mapper.test.mjs`, `mobile-unit.test.mjs`. `api-contract.test.mjs` static-scans service calls/DTOs và so sánh với OpenAPI JSON tại `../horse-racing-ne/docs/openapi.contracts.json`; đây là kiểm tra hợp đồng tĩnh, không gọi live backend. File test có allowlist `KNOWN_MISSING_ROUTES` và `KNOWN_GAPS`, gồm một số response-shape/nullable khác biệt (ví dụ `healthOutcome`), nên các mục được liệt kê được miễn khỏi assertion. Đây là bằng chứng có ngoại lệ trong test contract, không phải bằng chứng backend production sai. Test chưa được chạy trong đợt audit; OpenAPI sibling cũng không được đọc riêng.

## 7. Chưa thấy trong source mobile

Các mục sau là **not found in mobile source**, không phải kết luận backend hoặc pipeline không có:

- Offline queue/sync conflict resolution.
- Schema validation runtime tổng quát cho response DTO.
- SecureStore integration cho session credential.
- Automated API contract integration với server trong phạm vi source audit.
- Telemetry/analytics/error reporting được cấu hình xuyên suốt.
- End-to-end evidence về push delivery và thiết bị cảm biến thật.
- Migration server-side cho injury model version/frame.

## 8. Ma trận kiểm chứng đề xuất

| Câu hỏi | Bằng chứng cần lấy |
|---|---|
| Backend kiểm tra quyền theo horse/club thế nào? | Handler/middleware, policy, test truy cập cross-tenant |
| Injury position có được lưu lâu dài và đúng unit/frame không? | Schema, migration, API response thật, test round-trip |
| Marker phục hồi sau đổi thiết bị không? | Integration test với server data, không dùng AsyncStorage cũ |
| Ingest có bị echo/double-count? | Socket server emit path, event IDs, client/server logs |
| Retry thao tác medical có tạo record trùng? | Idempotency contract và test timeout sau commit |
| Upload orphan được xử lý thế nào? | Upload state server, expiration job, cleanup metrics |
| App hoạt động offline đến đâu? | Thử nghiệm airplane mode từng flow và tài liệu queue/retry |

## Ưu tiên học và trình bày

1. Nắm chính xác luồng medical record và sidecar marker.
2. Phân biệt AuthRouteGate với backend authorization.
3. Nhận diện live mock, simulator và API-backed dashboard.
4. Mô tả lỗi/fallback mà không gọi empty state là dữ liệu thật.
5. Trình bày các điểm backend chưa kiểm chứng như câu hỏi mở, không suy đoán.
