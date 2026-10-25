# Kịch bản quay mobile — Flow 2: Lập và thực hiện giáo án huấn luyện

**Mốc đối chiếu:** BE `horse-racing-ne` nhánh `truong-req-gaps`, `docs/bao-fe-thay-doi-gop-y-demo.md` đến 23/10/2026; mobile `stable-os-vet-3d-injury-mapping` nhánh `feature/vet-3d-injury-mapping`, đọc source 25/10/2026. **Độ dài gợi ý:** 15–22 phút. Demo đi từ môn học → giáo án → lớp → buổi → Groom → cảm biến → kết quả → người xem.

## 0. Chuẩn bị thời gian và dữ liệu

1. Nếu đã nạp seed thực tế, dùng Quản lý `tran.quang.minh@phuocma.local`, HLV khu Bắc `le.quoc.bao@phuocma.local`, Groom tương ứng với ngựa đã chọn, Vet `nguyen.thi.lan@phuocma.local`, chủ `nguyen.hai.dang@phuocma.local`; mật khẩu seed `Password123@`. **Bình Minh** từ video Flow 1 là ngựa thử tốt nếu đã xếp ô/Groom và sức khỏe đủ điều kiện. Nếu quay Flow 2 độc lập, chuẩn bị một ngựa ACTIVE/ELIGIBLE trong khu của HLV, không có buổi trùng giờ. Không dùng Hồng Vũ (đang theo dõi) hay Hỏa Diệm (bị khóa).
2. Đặt giờ demo theo **giờ CLB**. Để điểm danh và báo sẵn sàng ngay trước camera, tạo một buổi bắt đầu khoảng **10 phút sau thời điểm thao tác**, thời lượng môn ít nhất 15 phút; tuyệt đối không chọn giờ bắt đầu đã qua. Nếu mất nhiều thời gian ở các màn trước, tạo buổi sát thời điểm quay phân cảnh Groom. BE cho điểm danh từ 30 phút trước giờ bắt đầu đến lúc kết thúc; báo sẵn sàng và bắt đầu từ khoảng 15 phút trước giờ bắt đầu theo quyền.
3. Seed có `Lớp huấn luyện tốc độ` với một buổi đang diễn ra lúc **mới nạp seed**. Buổi này tự hết hạn theo đồng hồ; nạp lại seed sát giờ quay nếu muốn dùng nó để cho thấy nhiều trạng thái cùng lúc. Kịch bản chính bên dưới tạo lớp và buổi mới để không phụ thuộc buổi seed đã hết giờ.
4. Chuẩn bị một video chạy thử ngắn trên iPhone nếu muốn quay phần tải video. Chọn mã lớp và tên môn **chưa dùng**, ví dụ `PM-DEMO-2510` và `Kiểm tra 1200 m demo`. Khi quay lại lần hai, đổi mã/tên hoặc nạp lại seed.
5. Điều hướng: Quản lý và HLV có **Training/Huấn luyện** ngay thanh dưới. Groom mở **More → Training/Nhiệm vụ huấn luyện**. Vet mở **More → Alerts/Thông báo**. Owner có **Training** thanh dưới. Đổi role qua **More → Sign out/Đăng xuất**; màn phụ có mũi tên **←**.

## 1. Mở video: danh mục môn học · Quản lý CLB

**Lời dẫn:** “Quản lý định nghĩa môn tập dùng chung; HLV lập giáo án và xếp lịch từ các môn này.”

1. Đăng nhập Quản lý → thanh dưới **Training** → tab **Môn học**. Chỉ ba môn seed: Chạy nền sức bền, Tốc độ và sức bền tim mạch, Chạy kiểm tra cự ly 1200 m. Chạm một thẻ để đọc loại **REGULAR/TIME_TRIAL**, cường độ **LIGHT/HEAVY**, cự ly và thời lượng.
2. Chạm **Add subject/Thêm môn**. Nhập **Subject name** `Kiểm tra 1200 m demo`; **Session type** `TIME_TRIAL`; **Intensity** `HEAVY`; **Planned distance** `1200` m; **Session duration** `30` phút; **Target time** `78000` ms; mặt sân nếu cần → **Create subject/Tạo môn**. Mobile hiện lấy target của môn làm **giá trị ban đầu cho từng buổi**; BE lưu target thật ở buổi tập.
3. Nếu muốn quay luật tên duy nhất, thử thêm tên `kiểm tra 1200 m demo` với chữ thường: BE trả **409 trùng tên**, không tạo môn thứ hai. Đóng form, giữ môn vừa tạo.

## 2. Giáo án có giai đoạn và số buổi tối thiểu · HLV trưởng

1. **More → Sign out** → đăng nhập Lê Quốc Bảo → thanh dưới **Training** → **Manage training plans/Quản lý giáo án** → **Create training plan/Tạo giáo án**.
2. Nhập tên `Giáo án thử chạy 1200 m`; mô tả mục tiêu. Thêm **Phase/Giai đoạn 1**, số tuần `1`. Trong danh sách môn của giai đoạn, chạm `Kiểm tra 1200 m demo` và đặt **Minimum sessions per week/Số buổi tối thiểu mỗi tuần** là `1`. Có thể thêm môn nhẹ để minh họa giáo án nhiều môn, nhưng đừng xếp hai buổi sát nhau cho cùng ngựa trong video.
3. Bấm **Save/Create plan/Lưu giáo án** ở cuối. Mở thẻ giáo án vừa tạo; chỉ ra giai đoạn 1 tuần và 1 buổi chạy thử tối thiểu. Mở giáo án 6 tuần có sẵn trong seed để cho thấy giai đoạn 1 và 2 khác nhau.
4. Giải thích: số buổi/tuần là **mức tối thiểu để theo dõi tiến độ**, app không tự sinh buổi vào ngày cố định. HLV phải xếp buổi cụ thể.

## 3. Tạo lớp, ghi danh và xếp buổi · HLV trưởng

1. Nhấn **←** về **Training** → **Create training class/Tạo lớp**. Nhập **Class code** `PM-DEMO-2510`; **Class name** `Lớp kiểm tra 1200 m`; chọn giáo án vừa tạo, **Start date** là ngày CLB hôm nay dạng `YYYY-MM-DD`, **Maximum horses** `4`, sở trường để trống nếu muốn nhận mọi ngựa đủ điều kiện → **Create active class/Tạo lớp hoạt động**. Sau khi lưu lớp là **ACTIVE**, không có bước công bố.
2. Mở thẻ lớp vừa tạo → tab **Horses/Ngựa** → nút **Đăng ký** → bottom sheet **Đăng ký ngựa vào lớp**. Gõ `Bình Minh` vào **Tìm ngựa đủ điều kiện**, chạm dấu **+** ngay card ngựa; khi hiện dấu ✓ là đã ghi danh, đóng sheet. Nếu ngựa không nằm trong danh sách, kiểm tra khu, khóa tập, lớp khác/trùng giờ và sức khỏe. Ghi danh lấy **giờ bấm**, không có ô `enrolledAt`.
3. Ở chi tiết lớp, mở tab **Sessions/Buổi tập** → **Schedule session/Xếp buổi**. Nhập **Session date** ngày hôm nay, **Start time** khoảng **10 phút nữa**, chọn card môn `Kiểm tra 1200 m demo`, **Repeat every week** để `1`, **Location** `Sân Bắc`, ghi chú nếu cần → chạm **Schedule session** ở cuối sheet. Mobile tự lấy **tên môn làm tên buổi**, tự tính **giờ kết thúc = giờ bắt đầu + 30 phút** và sao chép target `78000` ms vào buổi; sheet này **không có ô riêng để nhập tên, giờ kết thúc hay target**.
4. Quay tab tiến độ: môn đã có `1/1` buổi tối thiểu trong tuần. Nếu cần minh họa ràng buộc, thử xếp thêm một buổi trùng giờ rồi cho thấy cảnh báo và bấm hủy. BE kiểm tra HLV trùng hai lớp, Groom trùng lượt, tối đa **2 buổi/ngày/ngựa**, tối đa **1 buổi nặng/ngày**, cách hai buổi tối thiểu **3 giờ**.
5. Mở chi tiết buổi → ở thẻ ngựa, xem **Assign Groom/Change assigned Groom**. Nếu Groom chưa tự gắn hoặc muốn người dắt hộ, chọn Groom khác còn rảnh. HLV có thể giao người dắt cho **từng lượt**; Groom phụ trách ngựa không tự động là người dắt mọi buổi sau khi đã đổi tay.

**Lời dẫn:** “Lớp đã hoạt động ngay khi tạo. Việc ghi danh và xếp buổi được BE kiểm tra theo sức khỏe, khu, cường độ và lịch của cả HLV, Groom và ngựa.”

## 4. Điểm danh, báo sẵn sàng, báo vắng · Groom

1. HLV thoát tài khoản → đăng nhập **đúng Groom được gắn trên lượt Bình Minh**. Thanh dưới **More → Training/Nhiệm vụ huấn luyện**; ở **Lịch tập được giao**, tìm `Buổi kiểm tra 1200 m` và card Bình Minh. Nếu chưa thấy, vuốt xuống tải lại; xem thẻ thời gian để chắc vẫn trong khung điểm danh.
2. Chạm **Điểm danh** → thẻ chuyển **Có mặt/PRESENT**. Chạm **Báo sẵn sàng** → **READY**. Nếu muốn quay nhánh vắng, dùng **một lượt khác**: chạm **Báo vắng**, nhập lý do, xác nhận; khi còn trong cửa sổ điểm danh chạm **Điểm danh lại** để về PRESENT. Không báo vắng Bình Minh nếu dùng chính nó để bắt đầu chạy ngay.
3. Quay nhanh **Tasks/Việc hôm nay**: lịch dắt ngựa tập và công việc chăm sóc cùng xuất hiện theo Groom. Groom chỉ điểm danh/báo sẵn sàng/báo vắng, không bấm bắt đầu hoặc kết thúc lượt tập.

## 5. HLV bắt đầu tập, giả lập cảm biến và xử lý cảnh báo

1. Đăng xuất Groom → đăng nhập HLV → thanh dưới **Training → Classes/Lớp → Lớp kiểm tra 1200 m → buổi vừa xếp**. Ở Bình Minh đã READY, chạm **Start training/Bắt đầu tập**. Nếu nút chưa hiện, kiểm tra mốc 15 phút trước giờ buổi và trạng thái READY; chờ tới cửa sổ được phép.
2. Khi lượt là **ONGOING**, cuộn tới hộp **Giả lập cảm biến IoT** trong card Bình Minh → chạm **Phát nhịp tim tự động**. Giữ màn hình này mở. Cho thấy dòng **Live** đổi nhịp tim/tốc độ và sau vài điểm chạm **Performance/Hiệu suất** để đọc số điểm, trung bình/đỉnh/cảnh báo; bấm **←** về buổi.
3. Chạm **⚡ Vọt nhịp tim** một lần. Đợi kết quả cập nhật; BE áp ngưỡng CLB: cảnh báo nhịp tim từ 220 bpm, nguy cấp từ 240 bpm, tốc độ tối đa 18 m/s. Nút này gửi **một điểm** cao, không phải một đợt 5 giây. Chạm **Dừng phát** trước khi rời màn hình hoặc hoàn tất lượt.
4. Mở **More → Alerts** của HLV hoặc sau đó đăng nhập Vet → **More → Alerts** để cho thấy cảnh báo đã lưu. **Không trình bày rằng Vet chạm thông báo mở được biểu đồ live trên app hiện tại**: đường dẫn thông báo có thể bị quyền route của Vet chặn. Biểu đồ/số liệu chi tiết quay trên màn HLV.
5. Nếu muốn chứng minh thao tác an toàn, ở **một lượt khác** đã ONGOING chạm **Dừng sớm lượt tập**, nhập lý do (ví dụ `Ngựa có dấu hiệu mệt, dừng để kiểm tra`), xác nhận → trạng thái **STOPPED**. Không dừng sớm Bình Minh nếu cần kết quả chạy thử đầy đủ.

## 6. Hoàn tất buổi, kết quả chạy thử, đánh giá, video

1. Trên card Bình Minh, chạm **Complete training/Hoàn tất lượt** khi đủ dữ liệu cho demo. Với TIME_TRIAL, app hỏi ghi thời gian ngay hoặc để sau; nhập đúng dạng **`mm:ss.s`**, ví dụ `01:17.5`, thêm ghi chú → lưu. Nếu chọn để sau, vào lại chi tiết lượt → **Record trial result/Ghi kết quả chạy thử**.
2. Chạm **Performance** của lượt đã xong để cho thấy thống kê nhịp tim, tốc độ, cảnh báo. Quay lại thẻ lượt → **Record evaluation/Đánh giá**; nhập điểm và nhận xét (ví dụ `Đạt nhịp độ, theo dõi hồi phục sau nước rút`) → lưu. BE chặn lưu trùng đánh giá, trả 409 thay vì tạo bản thứ hai.
3. Ở phần **Trial result/Kết quả chạy thử**, mở kết quả vừa ghi → **Attach trial video/Đính kèm video** → chọn clip đã chuẩn bị → **Save video**. Nếu cần minh họa sửa sai, vào **Edit trial result/Sửa kết quả**, sửa thời gian và nhập lý do đính chính; BE cho sửa kết quả đã lưu không giới hạn 7 ngày nhưng cần lý do.
4. Mở lại lớp → tiến độ, lịch sử buổi, số lượt đã hoàn tất. Nếu lớp một tuần còn chưa đủ số buổi, chỉ nói rõ tiến độ; không tự ý bấm **Complete class** khi còn nghĩa vụ chưa đạt.

## 7. Học viên/chủ ngựa và Quản lý xem kết quả

1. Đăng xuất HLV → đăng nhập **chủ của ngựa đã chạy**. Với Bình Minh từ Flow 1 là Nguyễn Hải Đăng → thanh dưới **Horses → Bình Minh → Training/Performance/Racing**; mở buổi vừa quay và video/kết quả được phép xem. Có thể vào **Training** thanh dưới để xem lịch sử theo tài khoản chủ.
2. Đăng nhập Quản lý → **Training → Lớp huấn luyện** cho thấy lớp, tiến độ, **Hiệu suất** cho dữ liệu tổng hợp. Tab **Bàn giao** cho xem trước các khu/giáo án/lớp của một HLV; **không xác nhận** bàn giao chỉ để minh họa vì nó làm thay đổi quyền vận hành.
3. Quay cảnh **rời lớp** trên một ngựa thử khác nếu cần: chi tiết lớp → tab **Horses/Ngựa → Chỉnh sửa** → bottom sheet **Chỉnh sửa danh sách lớp** → chạm dấu **−** trên card ngựa cần gỡ. Màn mobile hiện tại gọi API ngay, **không có hộp nhập lý do**; BE tự ghi thời điểm rời theo lúc bấm, không có ô `leftAt`. Có thể rời cả trước ngày khai giảng. Không rút Bình Minh trước khi hoàn tất video của nó.

**Lời kết:** “Từ môn, giáo án, lớp và lịch, Groom xác nhận ngựa sẵn sàng, HLV vận hành lượt và thấy cảm biến, sau đó lưu kết quả để chủ và Quản lý theo dõi.”

## Nếu bị kẹt trong lúc quay

| Vấn đề | Xử lý tại chỗ |
|---|---|
| Buổi seed đang chạy không còn | Seed tạo buổi `IN_PROGRESS` theo thời điểm nạp; nạp lại sát giờ hoặc dùng buổi mới bắt đầu +10 phút. |
| Không thấy nút điểm danh/báo sẵn sàng | Kiểm tra Groom đúng người dắt, cửa sổ 30/15 phút, ngựa đủ điều kiện. |
| Không xếp được buổi/ghi danh | Đổi giờ hoặc ngựa; BE chặn lịch trong quá khứ, trùng giờ và giới hạn 2 buổi/ngày, 1 buổi nặng/ngày, nghỉ 3 giờ. |
| Không hiện hộp cảm biến | Chỉ xuất hiện cho lượt **ONGOING** trên màn chi tiết buổi của HLV. |
| Vet bấm cảnh báo không mở chart | Giới hạn điều hướng mobile hiện tại; quay cảnh báo trong hộp thư Vet và chart trên HLV. |
| Trial result không lưu | Lượt cần **COMPLETED/STOPPED** và buổi loại **TIME_TRIAL**; kiểm tra định dạng thời gian/attempt. |
| Không thấy/sửa được target chạy thử trên màn buổi | BE mới lưu `targetTimeMs` ở buổi và đã bỏ API `/time-trial`; mobile hiện sao chép target từ môn khi xếp buổi nhưng còn đường gọi API cũ trong màn **Edit time-trial setup**. Không dùng nút sửa đó trong video; nếu cần mốc 78 giây, nhập `78000` ở môn trước khi xếp. |

**Nguồn đối chiếu:** `horse-racing-ne/docs/bao-fe-thay-doi-gop-y-demo.md`, các module training BE, `stable-os-vet-3d-injury-mapping/app/manager/training.tsx`, `app/trainer/plans.tsx`, `app/trainer/class/new.tsx`, `app/trainer/plan/[id].tsx`, `app/trainer/plan/[id]/session/[sessionId].tsx`, `app/groom/training.tsx`. Kịch bản dựa trên source, chưa xác nhận đã thao tác hết trên iPhone/DB hiện tại.
