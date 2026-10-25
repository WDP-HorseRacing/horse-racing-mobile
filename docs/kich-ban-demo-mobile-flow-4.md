# Kịch bản quay mobile — Flow 4: Chăm sóc chuồng trại, dinh dưỡng và vật tư

**Mốc đối chiếu:** BE `horse-racing-ne` nhánh `truong-req-gaps`, `docs/bao-fe-thay-doi-gop-y-demo.md` đến 23/10/2026; mobile `stable-os-vet-3d-injury-mapping` nhánh `feature/vet-3d-injury-mapping`, đọc 25/10/2026. **Độ dài gợi ý:** 16–22 phút. Video đi hết kho, khẩu phần, việc chung/riêng, checklist, sự cố, phụ phí và báo cáo.

## 0. Chuẩn bị và đường vào của từng role

1. Với seed thực tế, dùng Quản lý `tran.quang.minh@phuocma.local`, HLV khu Bắc `le.quoc.bao@phuocma.local`, Groom của Vân Tiêu `bui.van.dung@phuocma.local`, Vet `nguyen.thi.lan@phuocma.local`, chủ Vân Tiêu `nguyen.hai.dang@phuocma.local`; mật khẩu `Password123@`. Nếu DB khác, thay bằng ngựa có khu, ô, Groom, vật tư và chủ tương ứng.
2. Dữ liệu seed: **Vân Tiêu** ở Khu Huấn luyện Bắc, ô B01, có Groom Bùi Văn Dũng; kho chung có **Yến mạch cán**, **Cỏ khô Timothy**, **Bột điện giải**, **Povidone-Iodine**. Có khẩu phần ACTIVE, checklist hôm nay, đề xuất vật tư ở các trạng thái. Để quay **tạo mới** không đụng khẩu phần ACTIVE của Vân Tiêu, có thể dùng **Bình Minh** đã tạo/xếp Groom ở Flow 1; nếu chưa có, chọn ngựa khác trong khu HLV mà chưa có plan ACTIVE. Dùng Vân Tiêu để cho thấy dữ liệu có sẵn.
3. Quản lý mở **More → Stable/Sơ đồ chuồng**, **More → Supplies/Vật tư**, **More → Care task types/Loại việc**, **More → Daily fees/Phí nuôi**, **More → Reports/Báo cáo**. HLV mở **Horses → ngựa → Stable care and feeding/Chăm sóc chuồng và dinh dưỡng**; Groom mở **Tasks/Việc hôm nay**, **Incidents/Sự cố**, **More → Inventory/Vật tư**. Vet có **More → Supplies** và **More → Medical care schedule**. Đăng xuất trong **More → Sign out**.
4. Chuẩn bị một ảnh minh họa sự cố móng ngựa nếu quay nhánh ảnh. Chọn số lượng xuất nhỏ, ví dụ `2` kg, để không cạn kho cho các lần quay sau. Mọi lần xuất/hủy/nhập/cấp hàng thay đổi DB; nếu cần quay lại từ đầu, nạp lại seed.

## 1. Kho dùng chung, lô và nhập hàng · Quản lý CLB

**Lời dẫn:** “Cả CLB dùng một kho. Vật tư có tồn, ngưỡng cảnh báo, lô nhập và sổ nhập xuất; khẩu phần được lập riêng, không tự trừ tồn.”

1. Đăng nhập Quản lý → **More → Supplies/Vật tư → Stock/Tồn kho**. Ở đầu màn quay số mặt hàng, số mặt hàng sắp hết và đề xuất chờ. Chạm chip **Low stock/Sắp hết** để lọc, rồi **All/Tất cả**.
2. Ở thẻ **Yến mạch cán**, chỉ số lượng, đơn vị, ngưỡng; chạm **Stock details/Chi tiết kho** để mở lô hàng và lịch sử chuyển động. Quay thông tin giá trị/lô theo quyền Quản lý. Quay lại thẻ.
3. Chạm **Receive/Nhập hàng** trên Yến mạch cán → nhập **Quantity received/Số thực nhận** `20` kg, **Actual unit price/Đơn giá** ví dụ `18000` VND, ghi chú `Nhập bổ sung tuần demo` → **Save/Lưu**. Mở **Stock details** lại để thấy tồn tăng, lô mới và một dòng nhập. Nếu muốn demo tạo danh mục, chạm **Add supply/Thêm vật tư**, nhập tên mới, loại, đơn vị, ngưỡng/tồn ban đầu; BE chặn tên trùng không phân biệt hoa thường. Phân cảnh tạo danh mục là tùy chọn.
4. Nói rõ: **mỗi lần xuất dùng** trừ tồn theo lô cũ trước (FIFO). Lập khẩu phần không tự trừ kho; nhân viên lấy thực tế thì bấm **Record use/Ghi nhận xuất dùng**.

## 2. Khẩu phần theo bữa: nháp → duyệt · HLV trưởng

1. Quản lý **More → Sign out** → đăng nhập HLV Lê Quốc Bảo → thanh dưới **Horses → Vân Tiêu → Stable care and feeding/Chăm sóc chuồng và dinh dưỡng**. Tab **Feeding plan/Khẩu phần** cho thấy plan ACTIVE có bữa và vật tư seed. Nếu muốn thao tác tạo mới, chuyển qua **Bình Minh** (hoặc ngựa chưa có plan ACTIVE) trong **Horses**, mở cùng màn.
2. Cuộn tới **Create feeding plan/Tạo khẩu phần**. Ô **Horse IDs** mặc định là ngựa đang mở; giữ nguyên. Có thể ghi **Plan note/Ghi chú** `Theo dõi khả năng ăn sau vận động`. Chọn bữa **Early morning/Sáng sớm**, chọn `Yến mạch cán`, nhập `2.5` kg, chạm **Add item to meal/Thêm vào bữa**. Chọn bữa **Evening/Tối**, chọn `Cỏ khô Timothy`, nhập số phù hợp đơn vị, chạm thêm. Có thể thêm `Bột điện giải` nếu là supplement.
3. Chạm **Create draft plan/Tạo nháp**. Trên card vừa tạo, chỉ trạng thái **DRAFT/Nháp** và người lập. Chạm **Edit draft/Sửa nháp** nếu muốn đổi lượng; chạm **Approve/Duyệt** → xác nhận. Card chuyển **ACTIVE/Đang áp dụng**, plan ACTIVE cũ của ngựa nếu có sẽ được thay/archived theo BE.
4. Đăng nhập Groom của ngựa vừa lập → **Tasks** để quay khẩu phần theo bữa. Nếu đang dùng Bình Minh mà Groom khác Bùi Văn Dũng, đăng nhập Groom đúng theo hồ sơ. Nói rõ plan được HLV duyệt trước khi Groom làm theo.

## 3. Việc chung, việc riêng và miễn việc · Quản lý, HLV/Vet

1. Quản lý → **More → Care task types/Loại việc**. Quay các loại việc áp cho mọi ngựa (**Apply to all horses/Áp dụng chung**) và loại việc riêng. Nếu cần thêm mới: **Add care task type/Thêm loại việc** → tên `Ngâm chân sau vận động`, chọn loại **individual/riêng** → lưu. Không dùng tên trùng; loại việc đã có dòng checklist bị BE chặn đổi tên, có thể tắt hoạt động thay vì sửa tên.
2. HLV → **Horses → Vân Tiêu/Bình Minh → Stable care and feeding → Care tasks/Việc chăm sóc**. Chọn chip **Gắn việc riêng**, chọn `Ngâm chân sau vận động`, chạm preset **7 days/7 ngày** hoặc nhập **Start date/End date** theo `YYYY-MM-DD`, thêm ghi chú → **Assign care task/Giao việc**. Card mới hiện người tạo và khoảng ngày.
3. Trên cùng tab chạm chip **Miễn việc chung** → chọn việc chung như `Tắm rửa`, preset **3 days/3 ngày**, nhập **Lý do miễn** `Ngựa cần kiêng tắm sau khám` → **Xác nhận miễn việc**. Việc chung đó không còn ở checklist các ngày được miễn; hết thời gian tự áp lại.
4. Vet cũng có thể mở hồ sơ ngựa → **Stable care and feeding → Care tasks** để gắn/miễn việc theo chỉ định y tế. Groom chỉ xem phần việc được giao, không tạo loại việc hoặc duyệt khẩu phần.

## 4. Groom thực hiện checklist, xem chế độ ăn và lịch hẹn

1. Đăng nhập Groom đúng người phụ trách → thanh dưới **Tasks/Việc hôm nay**. Mở card ngựa vừa gắn việc; cho thấy **Checklist progress/Tiến độ**, khẩu phần theo bữa, nhiệm vụ tập và lịch chăm sóc đến hạn. Nếu vừa đổi dữ liệu ở tài khoản khác, vuốt xuống tải lại.
2. Chạm ô hoàn tất của một dòng, ví dụ `Cho ăn sáng`; vòng tiến độ tăng. Chạm dòng đó hoặc nút ghi chú → nhập `Đã ăn hết khẩu phần, uống nước bình thường` → lưu. Chạm **Undo/Hoàn tác** nếu muốn chứng minh có thể sửa tick trong ngày, rồi tick lại để giữ trạng thái.
3. So sánh checklist của ngựa: việc **Gắn riêng** xuất hiện; việc **Miễn chung** không xuất hiện trong ngày miễn. **Khu không có Groom** không tự có checklist của người chăm, vì chưa biết giao ai.
4. Trên **Tasks**, nếu có **Lịch hẹn bác sĩ hôm nay**, Groom chỉ thấy tên ngựa/giờ hẹn để chuẩn bị; đó không phải việc để chạm **Complete care/Hoàn tất chăm sóc**. Lịch chăm sóc Vet giao đúng Groom thì có nút hoàn tất riêng.
5. Quản lý → **Horses → ngựa → Stable care and feeding → Daily checklist/Checklist hằng ngày** → **Sinh lại checklist hôm nay** nếu cần khôi phục sau lỗi sinh checklist. Quay danh sách ngày và dòng đã tick. Sau BE 23/10, nếu gỡ hết việc chưa tick thì checklist vẫn tồn tại với **items rỗng, trạng thái COMPLETED**; dòng đã tick vẫn được giữ để đối soát.

## 5. Groom báo sự cố thường và khẩn · HLV/Vet xử lý

1. Groom → thanh dưới **Incidents/Sự cố** → tìm/chọn Vân Tiêu hoặc ngựa mình quan sát. Nhập **What happened?/Mô tả** `Bỏ ăn một phần bữa sáng, cần theo dõi`; đính ảnh nếu có; chọn **thường** → **Send incident report/Gửi báo cáo**. Nếu muốn chỉ rõ quyền báo hộ, chọn một ngựa Groom không phụ trách trong danh sách và nói người báo với Groom phụ trách đều được thông báo.
2. HLV khu → thanh dưới **Incidents** → mở sự cố thường. Nếu đã xử lý tại chuồng, chạm **Resolve incident/Đóng sự cố**, nhập **Resolution/Kết quả** `Đã kiểm tra, cho ăn lại và theo dõi` → xác nhận. Nếu cần bác sĩ, dùng **Refer to veterinarian/Chuyển bác sĩ** hoặc **Refer urgently/Chuyển khẩn** thay vì đóng.
3. Groom báo một sự cố **khẩn** khác trên ngựa thử, ảnh có thể kèm hoặc không → Vet mở **More → Examination requests**. Khi Vet **khám** hoặc **bỏ qua yêu cầu** kèm lý do, BE tự đóng sự cố với `resolutionSource=EXAM`. HLV không bấm Resolve khi yêu cầu khám còn chờ; BE trả 409 “Sự cố đang chờ bác sĩ khám…”. Nếu Vet hủy buổi khám khiến yêu cầu quay lại chờ, sự cố tự mở lại.
4. Nếu chỉ quay một video Flow 4 và không muốn làm cả ca y tế, nhánh khẩn có thể dừng ở màn yêu cầu khám; xem toàn bộ khám/điều trị ở video Flow 3. Tuy vậy, để chứng minh **tự đóng**, Vet cần thật sự xử lý yêu cầu (khám hoặc bỏ qua), sau đó quay lại màn Incidents.

## 6. Xuất dùng, hủy xuất và đề xuất bổ sung · Groom → Quản lý

1. Groom → **More → Inventory/Vật tư → Stock/Tồn kho**. Chọn `Yến mạch cán` → **Record use/Ghi nhận xuất dùng**; nhập **Quantity to use** `2` kg và **Ghi chú xuất dùng** `Cho Vân Tiêu bữa sáng` → **Confirm usage/Xác nhận**. Quay tồn giảm và **Stock details/Sổ kho** có dòng xuất. Bỏ trống ghi chú thì app/BE chặn. Groom/HLV không có nút xuất thuốc; thuốc như Povidone-Iodine chỉ Vet/Quản lý xuất.
2. Trong **Stock details**, tìm dòng xuất vừa tạo → **Hủy lần xuất này** → nhập lý do `Ghi trùng lần xuất` → **Xác nhận hủy lần xuất**. Quay dòng đảo và số tồn hồi lại; không sửa đè lịch sử. Người xuất tự hủy trong 24 giờ, Quản lý có quyền hủy bất kỳ lúc nào.
3. Trên thẻ `Cỏ khô Timothy`, chạm **Propose restock/Đề xuất bổ sung** → nhập ghi chú nhu cầu `Cần bổ sung khoảng 20 kg cho khu Bắc tuần tới` → **Submit request/Gửi đề xuất**. **Không có ô số lượng đề xuất** theo BE mới; số “20 kg” ở đây là lời giải thích nhu cầu, không là số cấp tự động. Trong tab **Requests/Đề xuất**, Groom thấy PENDING và có thể **Edit pending request/Sửa đề xuất chờ** nếu muốn.
4. Groom đăng xuất → Quản lý → **More → Supplies → Requests** → lọc **PENDING**, mở đề xuất Cỏ khô → **Approve/Duyệt**. Với một đề xuất khác có sẵn, chạm **Reject/Từ chối**, nhập lý do để quay nhánh từ chối; đừng từ chối đề xuất Cỏ khô cần cấp.
5. Đề xuất Cỏ khô đã **APPROVED**: chạm **Confirm issue/Xác nhận cấp** (tên nút mobile) → nhập **Quantity issued/Số thực nhận** ví dụ `18`, **Actual unit price paid** ví dụ `85000` VND → **Save/Lưu**. BE ghi nhận đúng lượng **18**, tạo lô/biến động nhập và cập nhật tồn; không mặc định theo con số 20 trong ghi chú Groom.
6. Với một đề xuất APPROVED khác chưa cấp, Quản lý có **Cancel request/Hủy đề xuất** kèm lý do nếu nhà cung cấp không giao. Người xin được thông báo; chỉ Quản lý hủy ở trạng thái này.

## 7. Tổng quan khu, phụ phí từng ngựa và phí nuôi

1. HLV → **More → Stable/Sơ đồ chuồng** → chọn `Khu Huấn luyện Bắc` → chạm **Care overview/Tổng quan chăm sóc**. Quay từng ngựa: Groom, tiến độ checklist, plan đang áp dụng, số sự cố. Chạm **Diet & Care/Chế độ ăn và chăm sóc** của Vân Tiêu để về chi tiết; tab **Stall layout/Sơ đồ ô** cho vị trí thực tế.
2. Quản lý → **Horses → Vân Tiêu → Care surcharges/Phụ phí** (hoặc **Stable care and feeding → Surcharges/Phụ phí**) → **Create surcharge/Tạo phụ phí**. Nhập **Description** `Chăm sóc hồi phục tăng cường`, **Daily amount** `50000` VND, **Start date** hôm nay, **End date** sau 7 ngày dạng `YYYY-MM-DD` → **Save/Lưu**. Thẻ hiện chờ HLV khu xác nhận áp dụng.
3. HLV khu → cùng hồ sơ/ngựa → **Surcharges** → thẻ mới → **Apply surcharge/Đã áp dụng**. Chủ Vân Tiêu → **Horses → Vân Tiêu → Stable care and feeding → Surcharges** hoặc nút **Care surcharges** để xem chỉ đọc. Khoản đang tính có thể **End today/Kết thúc hôm nay** bởi Quản lý; khoản tương lai chưa bắt đầu có thể xóa. Không xóa khoản đang tính để tránh mất phí lịch sử.
4. Quản lý → **More → Daily fees/Phí nuôi**: xem mức đang áp dụng. Nếu muốn quay sửa số tiền, mở form, nhập mức mới và lý do; dừng ở bước xem trước/hủy nếu không muốn làm báo cáo của video thay đổi. Phí nuôi theo ngày khác phụ phí riêng từng ngựa.

## 8. Báo cáo tiền CLB và tiền chủ ngựa

1. Quản lý → **More → Reports/Báo cáo** → nhập **From/To** bao trùm ngày quay → **Load report/Tải báo cáo**. Quay ba khoản chủ chịu: **Daily boarding fees/Phí nuôi**, **Medical costs/Chi phí y tế**, **Care surcharges/Phụ phí**. Quay thêm **Purchased/Tiền nhập vật tư**, **Used/Giá trị đã dùng**, **Inventory value at period end/Giá trị tồn kho cuối kỳ**; trường cuối là cập nhật BE 23/10.
2. Cuộn **By horse owner/Theo chủ ngựa** tới Nguyễn Hải Đăng. Chỉ ra phụ phí của Vân Tiêu và tổng theo khoảng ngày. Dòng chi phí vật tư xuất/nhập phản ánh lô và các lần hủy, không cộng lại lần xuất đã hủy.
3. Chủ Nguyễn Hải Đăng → **More → Reports/Báo cáo** và **Horses → Vân Tiêu → Costs/Chi phí** để xem phần của mình. Chủ không thấy giá vốn của kho chung hoặc thông tin chủ khác.

**Lời kết:** “HLV định khẩu phần, Groom làm checklist và ghi nhận xuất dùng, Quản lý duyệt hàng và phụ phí. Sổ kho, sự cố, lịch chăm sóc và báo cáo đều giữ người thực hiện, thời điểm và lý do.”

## Nếu demo khác dữ liệu đang thấy

| Hiện tượng | Kiểm tra ngay |
|---|---|
| Không tạo được plan ACTIVE mới | Ngựa đã có plan ACTIVE; chọn ngựa chưa có hoặc tạo nháp rồi duyệt để thay theo BE. |
| Không thấy dòng việc riêng trên Tasks | Kiểm tra ngựa có Groom, khoảng ngày có hôm nay, và tải lại màn; việc miễn chung sẽ biến mất đúng thiết kế. |
| Không thấy nút Record use ở thuốc | Groom/HLV không được xuất MEDICINE; dùng Vet/Quản lý. |
| Đề xuất không có ô số lượng | Đúng thay đổi BE; ghi nhu cầu bằng chữ, số thực nhận nhập lúc Quản lý cấp. |
| Hủy lần xuất không thấy nút | Groom phải là người xuất và còn trong 24 giờ; Quản lý có thể hủy bất kỳ lúc nào. |
| HLV không đóng được sự cố | Nếu yêu cầu khám còn PENDING, để Vet khám/bỏ qua; BE tự đóng sự cố. |
| Báo cáo số tiền không như ví dụ | DB/lô/giá thực tế khác hoặc đã quay thao tác trước; luôn dẫn theo số trên màn, không đọc cố định số của seed web. |

**Nguồn đối chiếu:** `horse-racing-ne/docs/bao-fe-thay-doi-gop-y-demo.md`, các module stable-care/supplies/reports BE, `stable-os-vet-3d-injury-mapping/src/features/stable-care/HorseStableCareScreen.tsx`, `SuppliesScreen.tsx`, `IncidentsScreen.tsx`, `StableManagementScreen.tsx`, `app/groom/tasks.tsx`, `app/manager/reports.tsx`. Kịch bản dựa trên source, chưa xác nhận đã quay thử trên iPhone/DB hiện tại.
