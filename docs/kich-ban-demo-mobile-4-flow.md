# Kịch bản demo mobile: 4 luồng nghiệp vụ

**Bản rà soát:** 25/10/2026  
**Ứng dụng:** `stable-os-vet-3d-injury-mapping`, nhánh `feature/vet-3d-injury-mapping`, commit `7cda4fc`  
**Mốc nghiệp vụ:** BE `horse-racing-ne`, nhánh `truong-req-gaps`, commit `79401d3` và các thay đổi đang có trong working tree. Ưu tiên hợp đồng và hành vi trong source BE; tài liệu demo cũ chỉ dùng để lấy mạch trình bày.

> Trong `horse-racing-ne/docs`, file ghi chú bạn nhắc tới hiện có tên `bao-fe-thay-doi-gop-y-demo.md` (thiếu chữ `cao` so với tên bạn ghi). File đang ghi cập nhật đến **23/10/2026**. Các thay đổi mới trong đó đã được tính vào kịch bản, gồm ghi danh/rời lớp theo thời điểm bấm; mở lại lịch chăm sóc đã hoàn tất; đính chính kết luận bệnh án đã đóng; sự cố tự đóng khi bác sĩ xử lý; và giữ checklist rỗng thay vì làm checklist biến mất.

## Dùng thanh điều hướng trên mobile

- Mỗi vai trò có tối đa 5 mục ở thanh dưới cùng. **More / Thêm** mở một bottom modal chứa các mục còn lại và **Sign out / Đăng xuất**.
- **Hồ sơ cá nhân** mở bằng avatar góc trên bên phải, không nằm dưới thanh điều hướng.
- Đổi vai trò trên cùng điện thoại: chạm **More / Thêm → Sign out / Đăng xuất**, đăng nhập tài khoản vai trò kế tiếp.
- Nếu muốn xem hướng dẫn bằng tiếng Việt, chạm nút ngôn ngữ góc trên bên phải cho đến khi nút hiện **EN** (nghĩa là app đang ở tiếng Việt).

| Vai trò | Mục chính dưới cùng | Mục thường dùng trong More / Thêm |
|---|---|---|
| Quản lý CLB | Home, Horses, Training, Incidents | Stable, Supplies, Staff, Care task types, Surcharges, Daily fees, Reports, Medical overview |
| HLV trưởng | Home, Horses, Training, Incidents | Stable, Alerts, Supplies |
| Groom | Home, Tasks, Stable, Incidents | Training, Inventory |
| Bác sĩ thú y | Home, Horses, Incidents, Medical | Examination requests, Medical cases, Periodic checkups, Medical care schedule, Alerts, Supplies |
| Chủ ngựa | Home, Horses, Training, Racing | Reports |

## Tài khoản và dữ liệu mẫu

Các tài khoản dưới đây đúng với file `horse-racing-ne/scripts/seed/SYSTEM-ACCOUNTS.md`; chỉ dùng được nếu bạn đã nạp bộ seed thực tế này vào BE đang chạy. Mật khẩu chung trong seed là `Password123@`.

| Vai trò demo | Tài khoản chính | Tài khoản thay thế |
|---|---|---|
| Quản lý CLB | `tran.quang.minh@phuocma.local` | — |
| HLV trưởng | `le.quoc.bao@phuocma.local` | `pham.hoang.nam@phuocma.local` |
| Bác sĩ thú y | `nguyen.thi.lan@phuocma.local` | `phan.duc.thinh@phuocma.local` |
| Groom | `bui.van.dung@phuocma.local` | `nguyen.hoang.phuc@phuocma.local` |
| Chủ ngựa | `nguyen.hai.dang@phuocma.local` | `tran.linh.chi@phuocma.local` |

Seed này có các hồ sơ phù hợp để minh họa trạng thái: Vân Tiêu (đang hoạt động, Khu Huấn luyện Bắc, ô B01, Groom Bùi Văn Dũng); Hỏa Diệm (đang chấn thương, có bệnh án); Hồng Vũ (cần theo dõi, có yêu cầu khám chờ); Bạch Tuyết (cách ly); Lão Mã (đã giải nghệ); Thiên Hà (đã chuyển nhượng); An Lạc (đã mất); Bích Ngọc (hồ sơ đã xóa mềm). Có sẵn giáo án, lớp huấn luyện ở nhiều trạng thái, kho vật tư, đề xuất chờ xử lý, khẩu phần và checklist.

Nếu DB của bạn đang dùng seed khác, giữ nguyên các thao tác nhưng thay tên ngựa/khu bằng bản ghi tương ứng. Kịch bản không tự nạp lại seed. Các thao tác ghi nhận ngựa mất, xóa hồ sơ, xuất kho, hoàn tất/đóng bệnh án làm thay đổi dữ liệu; nên quay lại seed trước lần quay tiếp theo nếu cần trạng thái ban đầu.

---

# Video 1 — Flow 1: Hồ sơ, lý lịch và xếp chỗ ngựa

**Thời lượng gợi ý:** 12–15 phút  
**Vai trò:** Quản lý CLB → HLV trưởng → Groom → Bác sĩ/Chủ ngựa → Quản lý CLB.

### 1.1 Danh sách và tìm kiếm

1. Đăng nhập **Quản lý CLB** → thanh dưới **Horses / Ngựa**.
2. Gõ tên ngựa, Horse ID hoặc số chip vào ô tìm kiếm; thử mở **Filters / Bộ lọc**.
3. Lọc thử sức khỏe, vòng đời, khu, giới tính, sở trường, trạng thái xếp chỗ; bật **Include deleted profiles / Bao gồm hồ sơ đã xóa** để tìm Bích Ngọc nếu seed đã nạp.
4. Mở một thẻ ngựa. Cho thấy danh sách tải thêm khi cuộn, không có điều khiển số trang.

**Lời dẫn:** “Quản lý có thể tìm ngựa theo định danh và thu hẹp đàn theo các thuộc tính nghiệp vụ; các hồ sơ đã xóa chỉ xuất hiện khi bật đúng bộ lọc.”

### 1.2 Tạo hồ sơ

1. Từ **Horses / Ngựa** chạm **Register / Thêm ngựa**.
2. Thử bấm lưu khi form trống để thấy các trường bắt buộc. Nhập tên, giới tính, số chip 15 chữ số và chủ sở hữu; nhập giống, màu, ngày sinh nếu có.
3. Chọn ảnh từ thư viện hoặc chụp ảnh. Có thể chọn cha/mẹ trong hồ sơ có sẵn và khu ban đầu.
4. Lưu hồ sơ. Mở trang ngựa vừa tạo và chỉ ra vị trí ban đầu là **Chờ xếp ô**; form tạo hồ sơ không xếp stall.

**Lời dẫn:** “BE giữ chủ và số chip làm dữ liệu bắt buộc. Khi tạo hồ sơ, Quản lý chỉ đưa ngựa về khu; HLV khu sẽ chọn ô và giao Groom.”

### 1.3 Chi tiết, phả hệ và các tab theo quyền

1. Trong trang hồ sơ, mở **Overview / Tổng quan** để xem nhận dạng, chủ sở hữu, khu, ô, Groom và phả hệ.
2. Chuyển qua các tab có quyền: **Training / Huấn luyện**, **Health / Sức khỏe**, **Performance / Hiệu suất**, **Costs / Chi phí**, **Care / Chăm sóc**, **Timeline / Nhật ký**. Tab hiển thị tùy vai trò và quyền của người đăng nhập.
3. Mở **Body measurements / Chỉ số cơ thể** để xem lịch sử, biểu đồ và xu hướng.

### 1.4 Cập nhật hồ sơ và chỉ số

1. Là **Quản lý CLB**, từ hồ sơ chạm **Edit horse profile / Sửa hồ sơ**, sửa một trường thường và lưu; nếu có ảnh thì đổi ảnh tại form này.
2. Đăng nhập **HLV trưởng**, mở cùng hồ sơ, đổi **Race aptitude / Sở trường** và lưu.
3. Đăng nhập **Bác sĩ** (hoặc vai trò được cấp quyền ghi số đo) → hồ sơ → **Body measurements**. Nhập cân nặng/thân nhiệt, lưu và quan sát điểm mới trong lịch sử.
4. Nếu muốn minh họa xác nhận bất thường, nhập một giá trị ngoài khoảng thường. Form không có ngày đo; giờ đo do BE ghi lúc lưu. Bản ghi đo thủ công sai có thể xóa kèm lý do theo quyền.

### 1.5 Đổi khu, xếp ô và giao Groom

1. Quản lý mở hồ sơ một ngựa đang hoạt động → **Manage barn, stall and Groom / Quản lý khu, ô và Groom** → chọn khu mới, nhập lý do và xem trước → xác nhận đổi khu.
2. Đăng nhập **HLV trưởng của khu đó** → **More / Thêm → Stable / Sơ đồ chuồng**.
3. Trong **Awaiting placement / Chờ xếp ô**, chọn ngựa → chọn ô trống → xác nhận xếp ô.
4. Chạm **Assign Groom / Giao Groom**, chọn nhân viên phù hợp theo khối lượng công việc. Đăng nhập Groom để cho thấy thông báo và ngựa xuất hiện trong việc hôm nay.

**Lưu ý theo BE 23/10:** đổi/giao Groom bị từ chối nếu ngựa đang có lượt **Có mặt, Sẵn sàng hoặc Đang tập** ở bất kỳ lớp nào. Hãy xếp chỗ trước buổi tập hoặc sau khi lượt kết thúc.

### 1.6 Chuyển chủ và vòng đời

1. Quản lý mở **Ownership history / Lịch sử chủ sở hữu** → chuyển ngựa cho chủ khác trong CLB, nhập lý do; cho thấy lịch sử sở hữu được giữ lại.
2. Với một hồ sơ dùng riêng cho demo, mở **Lifecycle, delete or restore / Vòng đời, xóa hoặc khôi phục**. Xem trước giải nghệ, chuyển nhượng ra ngoài và các hệ quả; xác nhận một thao tác nếu muốn minh họa kết quả thật.
3. Mở hồ sơ đã chuyển nhượng như Thiên Hà để xem trước kích hoạt lại. BE yêu cầu chọn chủ mới và đưa sức khỏe về **Cách ly**. Nếu kích hoạt, HLV cần xếp lại khu/ô/Groom theo quy trình.
4. Với hồ sơ thử riêng, xem trước ghi nhận ngựa mất: ngày mất do hệ thống ghi theo ngày CLB, không nhập lùi. Đóng bệnh án đang mở trước khi Quản lý ghi nhận mất; bác sĩ cũng có thể ghi nhận mất khi đóng bệnh án theo đúng luồng y tế.
5. Bật lọc hồ sơ đã xóa, mở **Lifecycle…** để xem trước khôi phục Bích Ngọc hoặc một hồ sơ đã xóa; xác nhận nếu muốn. Chỉ xóa hồ sơ không còn dữ liệu nghiệp vụ.

**Lời kết:** “Flow 1 nối hồ sơ với việc xếp chuồng, phân công người chăm, cập nhật sức khỏe và giữ lịch sử khi ngựa đổi chủ hoặc rời CLB.”

---

# Video 2 — Flow 2: Giáo án, lịch tập và theo dõi thể lực

**Thời lượng gợi ý:** 15–20 phút  
**Vai trò:** Quản lý CLB → HLV trưởng → Groom → Bác sĩ → HLV trưởng → Chủ ngựa.

### 2.1 Môn tập và giáo án

1. **Quản lý CLB** → **Training / Huấn luyện** → **Add subject / Thêm môn**. Nhập tên, loại buổi, cường độ Nhẹ/Nặng, cự ly, thời lượng; nếu là chạy thử thì nhập mục tiêu thời gian. Lưu.
2. Thử thêm lại cùng tên với khác hoa/thường. BE chặn tên trùng không phân biệt hoa thường.
3. Đăng nhập **HLV trưởng** → **Training / Huấn luyện → Manage training plans / Quản lý giáo án** → tạo giáo án, thêm giai đoạn, độ dài giai đoạn, môn và số buổi tối thiểu mỗi tuần → lưu.

### 2.2 Mở lớp, xếp buổi và ghi danh

1. HLV → **Training / Huấn luyện → Create training class / Tạo lớp**. Chọn giáo án, nhập mã/tên, ngày bắt đầu từ hôm nay trở đi và sĩ số. Lớp chuyển sang hoạt động ngay khi tạo.
2. Mở lớp → tab **Sessions / Lịch buổi**. Chọn ô thời gian tương lai, chọn môn thuộc giai đoạn đó, nhập giờ; nếu môn chạy thử thì kiểm tra mục tiêu. Lưu buổi.
3. Thêm một buổi lặp hằng tuần nếu phù hợp. Thử chọn giờ đã qua hoặc lịch trùng để minh họa BE từ chối. Tuần thiếu số buổi tối thiểu được đánh dấu để HLV biết, không tự tạo buổi.
4. Chạm **Enroll horses / Ghi danh ngựa**, chọn các ngựa đủ điều kiện. Những ngựa khóa tập, sai phạm vi hoặc trùng lịch sẽ bị lọc/chặn theo dữ liệu BE.

**Cập nhật BE 23/10:** app không nhập `enrolledAt`/`leftAt`; ghi danh và rời lớp lấy thời điểm hệ thống nhận thao tác. Khi cần rút ngựa, mở chi tiết lượt ghi danh và nhập lý do, không chọn ngày rút.

### 2.3 Groom điểm danh, HLV thực hiện buổi tập

1. Đăng nhập **Groom được giao dắt ngựa** → **More / Thêm → Training / Nhiệm vụ huấn luyện**. Trong khung giờ cho phép, chạm **Check in / Điểm danh**, sau đó **Mark ready / Báo sẵn sàng**. Có thể báo vắng kèm lý do và điểm danh lại trong cửa sổ BE cho phép.
2. Groom không bắt đầu/kết thúc lượt. Đăng nhập **HLV trưởng** → **Training / Huấn luyện → lớp → buổi tập**. Chạm **Start training / Bắt đầu tập** cho lượt phù hợp.
3. Với một lượt đang chạy, giữ màn hình buổi tập mở và chạm **Phát nhịp tim tự động**. Cho xem nhịp tim/tốc độ cập nhật. Chạm **Vọt nhịp tim** để gửi điểm vượt ngưỡng và tạo cảnh báo; BE dùng ngưỡng CLB (cảnh báo 220 bpm, nguy cấp 240 bpm, tốc độ 18 m/s).
4. Dùng một lượt demo khác để chạm **Stop early / Dừng sớm**, nhập lý do. Lượt dừng vẫn có thể ghi đánh giá/kết quả sau buổi.

### 2.4 Cảnh báo, chạy thử, đánh giá và chủ ngựa

1. Đăng nhập **Bác sĩ** → **More / Thêm → Alerts / Thông báo** để cho thấy thông báo cảnh báo thể lực đã được lưu trong hộp thư. Có thể xem số liệu ở màn hiệu suất buổi tập của HLV.
2. Với buổi chạy thử, HLV mở lượt đã hoàn tất → nhập thời gian, số lần thử, ghi chú và tải video; nếu sửa kết quả đã lưu, nhập lý do đính chính. Thêm đánh giá buổi tập với điểm và nhận xét.
3. Đăng nhập **Chủ ngựa** → **Horses / Ngựa của tôi → chọn ngựa → Training / Huấn luyện**. Cho xem lịch sử buổi, tổng kết và video/kết quả được phép xem. Dữ liệu nhịp tim chi tiết và cảnh báo vẫn theo quyền nội bộ.
4. (Nếu còn thời gian) Quản lý → mục dưới cùng **Training / Huấn luyện** xem tiến độ lớp; **More / Thêm → Staff / Nhân sự** xem trước bàn giao HLV rồi hủy hộp xác nhận.

**Giới hạn cần nói đúng khi quay:** bộ giả lập mobile hiện gửi điểm khoảng 3 giây/lần; nút vọt gửi một điểm cao, không tạo spike 5 giây. Bộ giả lập dừng khi rời màn hình và chưa có hàng đợi gửi bù offline. Hiện không nên trình bày rằng mô phỏng tiếp tục chạy nền hoặc bác sĩ bấm thông báo sẽ mở được biểu đồ live: đường dẫn hiện tại có thể bị role guard đưa về màn hình Vet. Để quay ổn định, trình diễn biểu đồ trên màn HLV đang mở; sau đó chỉ cho thấy cảnh báo trong **More → Alerts** của Vet.

**Lưu ý thời điểm:** các nút điểm danh/báo sẵn sàng chỉ hiện trong cửa sổ trước giờ buổi tập. Nếu seed có buổi **ONGOING** dùng cho mô phỏng, mở buổi đó trước; nếu đã tự kết thúc, tạo buổi mới trong tương lai và thực hiện vào đúng khung giờ.

---

# Video 3 — Flow 3: Yêu cầu khám, điều trị và theo dõi bệnh án

**Thời lượng gợi ý:** 15–18 phút  
**Vai trò:** Groom → Bác sĩ → HLV/Groom → Bác sĩ → Chủ ngựa/Quản lý.

### 3.1 Groom báo sự cố và bác sĩ tiếp nhận

1. Đăng nhập **Groom** → thanh dưới **Incidents / Sự cố** (hoặc **Tasks / Việc hôm nay** → chọn ngựa → **Report incident / Báo sự cố**).
2. Chọn ngựa mình phụ trách, nhập triệu chứng và vị trí; chọn mức **Urgent / Khẩn** để gửi yêu cầu khám khẩn. Ảnh có thể đính kèm nếu cần.
3. Đăng nhập **Bác sĩ** → **Home / Bảng điều khiển** để xem hàng chờ; nếu chưa thấy, mở **More / Thêm → Examination requests / Yêu cầu khám** và kéo xuống làm mới.
4. Mở yêu cầu mới → **Start examination / Bắt đầu ghi nhận khám**. Xem thông tin Groom báo và chọn kết luận phù hợp.

**Theo BE 23/10:** nếu bác sĩ khám hoặc bỏ qua yêu cầu từ sự cố, sự cố tự chuyển sang đã xử lý. Không yêu cầu HLV đóng lại thủ công. Nếu bác sĩ hủy buổi khám khiến yêu cầu quay về hàng chờ, sự cố có thể mở lại.

### 3.2 Ghi buổi khám, 3D chấn thương và lệnh khóa

1. Trên form khám, nhập chẩn đoán, kết quả sức khỏe, ghi chú chăm sóc cho Groom, thuốc/liều/tần suất nếu có, lịch tái khám và chi phí của chính buổi khám.
2. Nếu phát hiện chấn thương, mở **Injury 3D map / Bản đồ chấn thương 3D**. Chờ mô hình tải xong, chạm đúng vùng giải phẫu để đặt điểm, kiểm tra vùng và mức hồi phục, sau đó xác nhận. Không nhập tọa độ bằng tay.
3. Lưu buổi khám. Thời điểm khám/đo do hệ thống ghi tại thời điểm lưu; không nhập ngày giờ lùi.
4. Từ hồ sơ ngựa, mở tab **Health / Sức khỏe** → **Lock training / Khóa huấn luyện**; nhập lý do và thời điểm dự kiến gỡ. Nếu lượt của ngựa đang ở trạng thái Có mặt/Sẵn sàng/Đang tập, hoàn tất lượt trước rồi mới khóa.
5. Đăng nhập HLV → **Horses / Ngựa → hồ sơ → Health / Sức khỏe hoặc Training / Huấn luyện** để cho thấy khóa và lượt sắp tới bị chặn. Đăng nhập Groom để xem thông báo và phần hướng dẫn chăm sóc; Groom không mở được chẩn đoán, đơn thuốc hay chi phí bệnh án.

### 3.3 Tái khám, lịch chăm sóc, đóng và đính chính bệnh án

1. Bác sĩ → **More / Thêm → Medical cases / Bệnh án** → mở ca đang điều trị → **Follow-up examination / Ghi buổi tái khám**. Cập nhật diễn tiến từng vết chấn thương; đánh dấu đã lành trước khi đóng ca bình thường.
   - Mobile tải danh sách qua `GET /medical-cases`; working tree BE hiện có route này để xem ca theo trạng thái. Nếu BE đang chạy process cũ chưa có route, app sẽ báo chế độ dự phòng và chỉ hiện các ca đang mở từ dashboard. Khởi động lại BE sau khi cập nhật source để xem cả lịch sử ca đã đóng.
2. Bác sĩ → **More / Thêm → Medical care schedule / Lịch chăm sóc** → tạo lịch phù hợp và chọn người thực hiện. Tiêm phòng/tẩy giun chỉ giao bác sĩ hoặc chưa giao; lịch làm móng có thể giao Groom theo quy tắc BE.
3. Nếu minh họa lịch hoàn tất nhầm: mở một lịch tiêm phòng/tẩy giun/làm móng đã hoàn tất → **Reopen / Mở lại**, nhập lý do. API BE không cho mở lại lịch tái khám/khám định kỳ.
4. Đóng bệnh án: xem trước kết quả, nhập kết luận cuối. Chi phí là tổng các buổi khám, không nhập lại một khoản tổng khi đóng. Nếu đang còn khóa từ ca hiện tại hoặc ca trước, chọn **Release / Gỡ** hoặc **Keep / Giữ** và nhập thời điểm dự kiến gỡ mới.
5. Sau khi đóng, có thể mở menu đính chính kết luận cuối, sửa nội dung và nhập lý do. Đây là đính chính bệnh án đã đóng, không mở lại điều trị.

### 3.4 Quyền xem và chi phí

1. Đăng nhập **Chủ ngựa** → **Horses / Ngựa của tôi → hồ sơ → Health / Sức khỏe** hoặc **More / Thêm → Reports / Chi phí** để xem kết luận và phần chi phí mình chịu; không xem liều thuốc/yêu cầu nội bộ.
2. **Quản lý CLB** → **More / Thêm → Medical overview / Tổng quan y tế** → nút **Cost report / Báo cáo chi phí** để xem tổng theo khoảng ngày và theo ngựa.

**Lời kết:** “Yêu cầu từ Groom thành hàng chờ khám; bác sĩ ghi nhận trên mô hình 3D, điều trị và khóa tập; diễn tiến, chi phí và quyền xem được giữ theo từng buổi và từng người sở hữu.”

---

# Video 4 — Flow 4: Chăm sóc, dinh dưỡng, vật tư và chi phí

**Thời lượng gợi ý:** 15–18 phút  
**Vai trò:** Quản lý CLB → HLV trưởng → Groom → Bác sĩ/HLV → Chủ ngựa.

### 4.1 Kho chung và đề xuất bổ sung

1. Đăng nhập **Quản lý CLB** → **More / Thêm → Supplies / Vật tư**. Mở vật tư như Cỏ khô Timothy hoặc Yến mạch cán; cho thấy số tồn, ngưỡng, lô nhập và sổ kho. Giá nhập chỉ hiển thị cho vai trò được phép.
2. Đăng nhập **Groom** → **More / Thêm → Inventory / Vật tư** → chọn vật tư thức ăn → **Issue / Xuất dùng**. Nhập số lượng nhỏ và ghi chú bắt buộc; lưu để số tồn/sổ kho thay đổi.
3. Với dòng xuất vừa tạo, dùng **Cancel issue / Hủy lần xuất** nếu muốn trình diễn nghiệp vụ hoàn tác; nhập lý do. Chỉ người xuất trong thời hạn BE cho phép hoặc Quản lý có quyền hủy.
4. Groom mở vật tư → **Request restock / Đề xuất bổ sung**, mô tả nhu cầu bằng chữ rồi gửi. Không nhập số lượng yêu cầu nếu form mobile/BE chỉ yêu cầu nội dung nhu cầu.
5. Quản lý → tab **Requests / Đề xuất** trong trang Vật tư → duyệt hoặc từ chối kèm lý do. Với đề xuất được duyệt, cấp theo số lượng thực nhận và đơn giá thực tế; cho thấy tồn kho, lô mới và sổ nhập. Đề xuất đã duyệt có thể bị Quản lý hủy với lý do theo BE.

### 4.2 Khẩu phần và việc riêng

1. Đăng nhập **HLV trưởng** → **Horses / Ngựa → Vân Tiêu → Stable care and feeding / Chăm sóc chuồng và dinh dưỡng**.
2. Chạm **Create feeding plan / Lập khẩu phần**. Thêm vật tư theo bữa và lượng, lưu nháp, rồi **Apply / Áp dụng**. Có thể sao chép kế hoạch của ngựa khác nếu dữ liệu có sẵn.
3. Chạm **Add or exempt task / Thêm hoặc miễn việc**. Thêm việc riêng hoặc miễn một việc chung cho khoảng ngày, điền lý do miễn, lưu.
4. (Nếu cần) Quản lý → **More → Care task types / Loại việc** để thêm/ngưng loại việc. BE không cho đổi tên loại việc đã có trong checklist.

### 4.3 Groom thực hiện checklist và lịch chăm sóc

1. Đăng nhập **Groom được giao Vân Tiêu** → **Tasks / Việc hôm nay**. Cho thấy checklist, khẩu phần theo bữa, lịch chăm sóc đến hạn và nhiệm vụ dắt ngựa tập.
2. Chạm hoàn tất một việc, thêm ghi chú cho một dòng và đánh dấu thêm một việc. Chỉ ra tiến độ/người/giờ ghi nhận.
3. Nếu checklist chưa sinh hoặc dữ liệu vừa thay đổi, Quản lý → **Horses / Ngựa → chọn Vân Tiêu → Stable care and feeding / Chăm sóc chuồng và dinh dưỡng → Daily checklist / Checklist hằng ngày → Regenerate today’s checklist / Sinh lại checklist hôm nay**. Sau cập nhật BE, checklist vẫn được giữ ở trạng thái hoàn tất dù tất cả dòng việc bị gỡ; nội dung rỗng không có nghĩa là hồ sơ biến mất.

### 4.4 Sự cố, phụ phí và báo cáo

1. Groom → **Incidents / Sự cố** → chọn ngựa, nhập tình trạng và đính kèm ảnh nếu có; ảnh là tùy chọn. Gửi sự cố thường để HLV xử lý/đóng hoặc chuyển bác sĩ; gửi khẩn để vào hàng đợi y tế.
2. HLV → **Incidents / Sự cố** → mở sự cố thường, nhập kết quả xử lý và đóng. Với sự cố đang chờ bác sĩ, không đóng tay; BE tự đóng khi bác sĩ khám/bỏ qua và mở lại nếu buổi khám bị hủy trả yêu cầu về hàng chờ.
3. Quản lý → **Horses / Ngựa → Vân Tiêu → Care surcharges / Phụ phí** → tạo phụ phí theo ngày, số tiền/ngày và lý do/nội dung.
4. HLV khu → hồ sơ ngựa → **Care surcharges / Phụ phí** → xác nhận **Applied / Đã áp dụng**. Chủ ngựa → hồ sơ cùng ngựa → xem phụ phí ở chế độ chỉ đọc.
5. Quản lý → **More → Reports / Báo cáo**, đặt khoảng ngày. Cho thấy phí nuôi, chi phí y tế, phụ phí, tiền nhập vật tư, tiền vật tư đã dùng và **Inventory value / Giá trị tồn kho** (BE bổ sung trường này ngày 23/10).
6. Chủ ngựa → **More → Reports / Chi phí của tôi** để xem tổng chi phí theo ngựa trong phạm vi được phép.

**Lời kết:** “Flow 4 nối khẩu phần và checklist hằng ngày với xuất kho theo lô, xử lý sự cố, phụ phí riêng từng ngựa và báo cáo tài chính cho CLB/chủ ngựa.”

---

## Các điểm cần nhớ khi quay

- Dùng tài khoản đúng vai trò; nếu nút không xuất hiện, kiểm tra vai trò và khu phụ trách trước khi kết luận tính năng lỗi.
- Mỗi màn hình có nút làm mới/kéo xuống để nạp dữ liệu mới sau khi đổi tài khoản hoặc sau khi vai trò khác thao tác.
- Không chuyển Groom hoặc đổi khu cho ngựa đang có lượt tập **Có mặt/Sẵn sàng/Đang tập**; đây là luật BE mới, không phải lỗi giao diện.
- Không nhập ngày đo/ngày khám lùi; ghi danh/rời lớp và ngày mất cũng do BE ghi theo thời điểm thao tác.
- Đóng bệnh án bình thường phải xử lý chấn thương chưa lành; nếu còn khóa tập, phải chọn rõ gỡ hay giữ khóa.
- Trước khi quay nên mở sẵn ảnh/video cần tải, cấp quyền thư viện/camera và kiểm tra iPhone truy cập được BE trên cùng mạng.
- Đây là kịch bản thao tác theo source code, không phải xác nhận đã quay thử trên iPhone hoặc đã xác minh dữ liệu trong DB đang chạy. Dữ liệu thực tế phụ thuộc seed đã được nạp vào môi trường local của bạn.

## Nguồn đối chiếu

- `horse-racing-ne/docs/bao-fe-thay-doi-gop-y-demo.md` — ghi chú cập nhật API đến 23/10/2026.
- `horse-racing-ne/docs/flow1-horses.md`, `flow2-training.md`, `Flow_3_Quan_ly_Y_te.md`, `flow4-stable-care.md`.
- `stable-os-vet-3d-injury-mapping/src/features/auth/roles.ts` — cấu hình thanh điều hướng và More theo vai trò.
- `horse-racing-ne/scripts/seed/SYSTEM-ACCOUNTS.md` và `scripts/seed/realistic-system-data.sql` — tài khoản/dữ liệu minh họa (nếu bộ seed này đã được nạp).
