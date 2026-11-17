# 07 — Authentication, authorization và dữ liệu nhạy cảm

## 1. Ranh giới điều khiển truy cập

Mobile có nhiều lớp tiện ích cho UX:

- `AuthContext` giữ user, token và app role.
- `AuthRouteGate` hạn chế route theo role.
- `HorsePermissionsDto` điều khiển tab/nút theo capability của horse.
- Form validation chặn một số giá trị không hợp lệ trước khi gửi.

Các lớp này không thể thay thế kiểm tra authorization trên server. Mobile app có thể bị sửa hoặc gọi API ngoài UI; repo không chứa backend để xác nhận server kiểm tra user, tenant/club, role, ownership hoặc capability trên mọi endpoint.

## 2. Role và định tuyến

`src/features/auth/role-mapper.ts` chuyển mã server thành route role:

| Role từ auth | App role |
|---|---|
| `HEAD_TRAINER` | `trainer` |
| `GROOM` | `groom` |
| `VETERINARIAN` | `vet` |
| `HORSE_OWNER` | `owner` |
| `CLUB_MANAGER` | `manager` |

Nếu danh sách role có nhiều mã, helper chọn role đầu tiên được hỗ trợ theo thứ tự response. Đây là quyết định client; ý nghĩa thứ tự và ưu tiên phải khớp contract backend. `AuthRouteGate` bảo vệ luồng UI nhưng không phải hàng rào bảo mật dữ liệu.

## 3. Token lifecycle

1. Login gửi email/password tới `/auth/login`.
2. App dùng access token gọi `/auth/me` trước khi hoàn tất login.
3. Session chứa access token, refresh token và thời hạn được lưu tại `raceos.auth.session.v1`.
4. Refresh chủ động trước khi access token hết hạn và khi AppState trở lại active.
5. API client xử lý 401 qua refresh handler rồi retry một lần.
6. Logout gọi endpoint logout rồi xóa local session dù endpoint lỗi.

Promise refresh chia sẻ qua ref giảm refresh đồng thời trong cùng runtime. Đây không phải khóa dùng chung giữa nhiều process/thiết bị. Không có bằng chứng ở mobile về rotation/reuse detection/revocation policy; đó là hành vi backend cần xác minh.

## 4. Lưu trữ cục bộ

Các key liên quan đã thấy trong source:

| Key | Nội dung/ý nghĩa |
|---|---|
| `raceos.auth.session.v1` | Access/refresh token và expiry |
| `@raceos/language` | Ngôn ngữ |
| `@last_login_email` | Email đăng nhập gần nhất |
| `@raceos_recent_created_horses` | ID horse vừa tạo/gần đây |
| `raceos.push.device-token.v1` | Push token thiết bị |
| `@stable-os/injury-map/v1/{horseId}` | Sidecar metadata vị trí injury 3D |

Các key đang dùng AsyncStorage, không thấy `expo-secure-store` hoặc lớp mã hóa do app tự triển khai. AsyncStorage không nên được mô tả như kho credential mã hóa. Threat model, backup behavior, keychain integration và chính sách lưu dữ liệu phải được xác nhận riêng trước phát hành có dữ liệu production.

Logout xóa auth session, không nhất thiết xóa mọi cache/local key. Sidecar injury metadata có thể tồn tại sau khi đăng xuất; source audit chưa chứng minh có quy trình purge toàn bộ dữ liệu theo user.

## 5. Dữ liệu y tế và vị trí 3D

Medical record được gửi tới API; một phần metadata model/frame/region/type được lưu cục bộ theo horse ID. API injury timeline có x/y/z nhưng không có model version/frame. Vì vậy:

- Server record và local marker metadata có hai vòng đời khác nhau.
- Mất thiết bị, clear app data hoặc metadata mismatch có thể làm marker cũ không render, dù medical record còn.
- Metadata local không phải nguồn audit trail dùng chung giữa bác sĩ.
- Tọa độ từ mô hình minh họa không nên được coi là chẩn đoán hoặc đo lường lâm sàng chính xác.

File `THIRD_PARTY_ASSETS.md` ghi model 3D bên thứ ba và quy tắc credit; model là asset hình ảnh dùng để nhập vị trí tương đối, không phải atlas lâm sàng đã kiểm định.

## 6. Network và lỗi

`api-client.ts` đặt token ở Authorization header, dùng timeout và 401 refresh retry. Không thấy token trong URL query cho REST. Socket truyền token trong auth handshake. Signed upload dùng URL riêng từ upload request; URL signed có thể cấp quyền tạm thời và cần được xử lý như dữ liệu nhạy cảm, nhưng thời hạn/permission do server quyết định.

Không có bằng chứng về certificate pinning, app attestation, root/jailbreak detection, rate limiting phía client, hay mã hóa payload tùy chỉnh. Không kết luận các biện pháp đó có hoặc không có ở backend/distribution pipeline.

## 7. Validation và các giá trị cố định

`src/features/medical/medical-validation.ts` có giới hạn client cho cân nặng 30–1500 kg, chiều cao 50–250 cm, BCS 1–9 và thân nhiệt 30–45°C; “normal range” cũng là constants trong app. Các mức này chỉ cho biết form đang chặn/cảnh báo theo logic mobile. Chúng không phải bằng chứng chuẩn y khoa, không thay thế validation server hay phán đoán thú y.

Một số validation nhập tay khác như giới hạn marker/note và loại/size file được triển khai trong UI/client. Mọi dữ liệu từ client vẫn cần server kiểm tra lại.

## 8. Checklist xác minh trước triển khai

Các nội dung sau cần tài liệu/backend hoặc kiểm tra hạ tầng ngoài repo mobile:

- Server-side authorization theo club, role, horse ownership và medical capability.
- Token expiry, refresh rotation, revoke, replay handling và logout semantics.
- Chính sách mã hóa/retention/backup cho token và dữ liệu y tế trên thiết bị.
- Xử lý lỗi push token, token rotation và quyền notification theo OS.
- Signed URL expiry, content type/size enforcement và orphan-upload cleanup.
- Audit log server cho medical updates, corrections, close case và permission changes.

Đây là các điểm chưa thể xác nhận từ source mobile; danh sách không tuyên bố backend đang thiếu chúng.

## Câu hỏi để tự kiểm tra

1. Vì sao ẩn nút theo role không chứng minh endpoint được bảo vệ?
2. Token được lưu ở đâu và source có dùng SecureStore không?
3. Điều gì khiến injury marker có thể mất dù medical record còn?
4. Client-side normal range có thể được gọi là chuẩn lâm sàng không? Vì sao?
5. Kể ba câu hỏi bảo mật cần trả lời bằng backend/hạ tầng.
