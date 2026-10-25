# Kịch bản quay mobile — Flow 1: Hồ sơ, lý lịch và xếp chỗ ngựa

**Mốc đối chiếu:** source BE `horse-racing-ne` nhánh `truong-req-gaps`, tài liệu `docs/bao-fe-thay-doi-gop-y-demo.md` cập nhật 23/10/2026; source mobile `stable-os-vet-3d-injury-mapping` nhánh `feature/vet-3d-injury-mapping`, kiểm tra 25/10/2026. Source BE là mốc nghiệp vụ. **Độ dài gợi ý:** 12–18 phút. Video này đi qua F1.1–F1.8.

## 0. Chuẩn bị trước khi bấm quay

1. Mở BE và mobile trỏ cùng một DB. Nếu đã nạp `scripts/seed/realistic-system-data.sql` và tài khoản trong `scripts/seed/SYSTEM-ACCOUNTS.md`, dùng: Quản lý **Trần Quang Minh** `tran.quang.minh@phuocma.local`, HLV khu Bắc **Lê Quốc Bảo** `le.quoc.bao@phuocma.local`, Groom **Bùi Văn Dũng** `bui.van.dung@phuocma.local`, chủ ngựa **Nguyễn Hải Đăng** `nguyen.hai.dang@phuocma.local`; mật khẩu chung `Password123@`. Nếu DB khác, thay bằng người/ngựa tương ứng trên DB đó.
2. Kiểm tra trong **More → Stable** của Quản lý: `Khu Huấn luyện Bắc` còn ô `B05` trống; `B06` đang bảo trì. Chọn một tên ngựa mới chưa dùng, ví dụ **Bình Minh**, và một số chip **15 chữ số chưa có trong DB**, ví dụ `940000000019925`. Chuẩn bị ảnh ngựa trong thư viện iPhone.
3. Dùng **Bình Minh** để tạo/xếp ô; dùng **Vân Tiêu** để trình diễn hồ sơ/phả hệ, **Thiên Hà** để xem kích hoạt lại, **Bích Ngọc** để xem hồ sơ xóa. Không ghi nhận chết/xóa ngựa đang dùng ở video khác. Nếu muốn bấm xác nhận vòng đời thật, dùng một hồ sơ thử riêng rồi nạp lại seed trước các video sau.
4. App: thanh dưới cùng tối đa 5 mục. Mục thứ 5 **More/Thêm** mở bảng các lối tắt và **Sign out/Đăng xuất**. Avatar góc trên phải mở hồ sơ cá nhân. Khi vào màn hình phụ, dùng mũi tên **←** góc trên trái để quay về; thanh dưới có thể ẩn ở màn phụ. Nếu giao diện đang tiếng Anh, chạm nút ngôn ngữ góc trên phải để chuyển sang tiếng Việt; tên nút tiếng Anh được ghi kèm trong kịch bản.

## 1. Mở video — F1.1 Danh sách và lọc ngựa · Quản lý CLB

**Lời dẫn:** “Em bắt đầu từ đàn ngựa. Quản lý tra cứu bằng tên, mã hồ sơ hoặc chip, lọc cả trạng thái sức khỏe, vòng đời và vị trí.”

1. Đăng nhập Quản lý → thanh dưới **Horses/Ngựa**. Dừng một nhịp ở các card để thấy ảnh, Horse ID, khu/ô, sức khỏe và sở trường.
2. Chạm ô tìm kiếm, gõ `Vân Tiêu`; đợi kết quả đổi sau một nhịp debounce, mở card. Quay lại; gõ `940000000010001` để thấy cùng ngựa qua chip. Có thể sao chép Horse ID từ hồ sơ và thử tìm theo ID.
3. Chạm biểu tượng **Filters/Bộ lọc** bên cạnh ô tìm kiếm → lần lượt chọn **Lifecycle**, **Gender**, **Race aptitude**, **Placement**, **Barn**; bấm **Show results/Xem kết quả**. Chọn các chip sức khỏe phía trên danh sách, rồi cuộn tới cuối để thấy tải tiếp tự động. Bấm **Clear all/Xóa lọc** để về đàn đầy đủ.
4. Mở lại Bộ lọc → bật **Include deleted/Bao gồm hồ sơ đã xóa** của Quản lý → **Show results** → tìm `Bích Ngọc`, chỉ ra nhãn hồ sơ đã xóa. Tắt lọc sau cảnh này.

**Kết quả cần quay:** Vân Tiêu hiện từ cả tên và chip; Bích Ngọc chỉ hiện khi Quản lý bật lọc hồ sơ đã xóa. Không có số trang để người dùng phải bấm.

## 2. F1.2 Tạo hồ sơ và ảnh · Quản lý CLB

1. Trong **Horses**, chạm **+ Register/+ Đăng ký**. Thử chạm **Save and open profile/Lưu và mở hồ sơ** khi chưa nhập; cho thấy ô bắt buộc được báo lỗi rồi nhập đúng.
2. Nhập **Horse name/Tên** `Bình Minh`; **Gender/Giới tính** chọn đực hoặc cái; **Microchip ID** nhập 15 số đã chuẩn bị. Thử nhập chip của Vân Tiêu `940000000010001`: màn hình báo trùng và có đường mở hồ sơ đang giữ chip; thay lại chip mới. Đừng dùng chip của ngựa đã chuyển nhượng vì BE vẫn giữ tính duy nhất.
3. **Breed/Giống** nhập `Thoroughbred`, **Color/Màu lông** `Bay`, **Date of birth** nhập dạng `YYYY-MM-DD`, ví dụ `2021-03-15`. Ở ô **Sire/Cha**, **Dam/Mẹ**, chọn từ danh sách nếu cặp cha mẹ phù hợp; nếu không, bỏ trống vì hai ô này tùy chọn. Có thể mở Vân Tiêu ở phần 4 để trình diễn phả hệ có sẵn.
4. **Primary owner/Chủ sở hữu chính** tìm và chọn Nguyễn Hải Đăng. **Initial barn/Khu ban đầu** chọn Khu Huấn luyện Bắc. Chạm **Choose photo/Chọn ảnh** → chọn thư viện → ảnh đã chuẩn bị. Chạm **Save and open profile** và chờ tải hồ sơ mới. Nếu cần tạo nhiều ngựa, nút **Save and add another/Lưu và thêm tiếp** đưa về form trống, không cần dùng trong video này.
5. Chỉ vào phần vị trí trên hồ sơ: có khu, đang **chờ xếp ô**. Quản lý chưa chọn ô hay Groom ở bước tạo.

**Lời dẫn:** “Chip và chủ sở hữu là thông tin bắt buộc. Quản lý đưa ngựa vào khu; HLV phụ trách khu sẽ xếp ô và người chăm.”

## 3. F1.6 Dựng khu, xem sức chứa và chuyển khu · Quản lý CLB

1. Bấm **←** về danh sách → thanh dưới **More → Stable/Sơ đồ chuồng**. Chạm chip `Khu Huấn luyện Bắc` và **Stall layout/Sơ đồ ô**: quay ô B01 có Vân Tiêu, B05 còn trống và B06 bảo trì. Cuộn xuống **Awaiting placement → Awaiting stall/Chờ xếp ô** để thấy Bình Minh.
2. Nếu muốn trình diễn quản lý khu từ đầu, chạm chip **+ Add barn/+ Thêm khu**, nhập tên khác khu đang tồn tại, sức chứa và chọn HLV phụ trách rồi lưu. Mở khu đó để thêm ô theo sức chứa. Phân cảnh này tùy chọn vì khu mới không cần dùng cho Bình Minh.
3. Để cho thấy quy tắc đổi khu, Quản lý trở lại **Horses → chọn một ngựa không có lượt PRESENT/READY/ONGOING → Manage barn, stall and Groom/Quản lý khu, ô và Groom**. Ở màn **Assign barn**, chạm khu đích còn chỗ, nhập **Reason for changing barn/Lý do đổi khu** → **Preview and assign/Xem trước và xếp khu** → đọc ảnh hưởng. Chỉ **Confirm/Xác nhận** nếu ngựa đó là hồ sơ thử; nếu không, bấm hủy sau khi quay preview.
4. Nói rõ: khi chuyển khu, ô cũ được trả và ngựa thành **chờ xếp ô** ở khu mới; Groom hiện tại được giữ. BE 23/10 chặn đổi khu khi ngựa đã điểm danh ở buổi tập; chọn ngựa chưa tham gia buổi để demo.

## 4. F1.7 Xếp ô, giao Groom · HLV trưởng khu

1. Quản lý chạm **More → Sign out**, đăng nhập Lê Quốc Bảo. Thanh dưới **More → Stable**; chọn `Khu Huấn luyện Bắc`, cuộn tới **Awaiting placement → Awaiting stall**, chạm **Assign stall/Xếp ô** ở Bình Minh.
2. Màn **Stall and Groom** hiện vị trí hiện tại. Chạm **Available stall/Ô còn trống** chọn B05; ở **Groom · horse count across club**, chọn Groom còn khả dụng (có thể chọn Bùi Văn Dũng nếu khối lượng phù hợp). Chạm **Confirm stall and Groom/Xác nhận ô và Groom** → hộp xác nhận → **Confirm**.
3. Quay lại Stable → ô B05 hiện Bình Minh và Groom; trong **Chờ giao Groom** không còn Bình Minh. Nếu muốn minh họa xếp riêng, màn này có **Save stall only/Lưu ô**, sau đó vào mục **Chờ giao Groom → Giao Groom → Save Groom only/Lưu Groom**; khi quay chính, dùng thao tác gộp để ngắn hơn.
4. Nêu luật mới: BE từ chối giao/đổi Groom nếu ngựa có lượt **Có mặt, Sẵn sàng, Đang tập**, kể cả giao lần đầu. Khu khác của HLV chỉ xem, không được xếp hộ.
5. Đăng xuất → Groom Bùi Văn Dũng → **Tasks/Việc hôm nay** hoặc **Stable**. Tải lại màn, tìm Bình Minh; nếu Groom mới được giao khác Bùi Văn Dũng, đăng nhập đúng Groom đó. Quay thông báo giao ngựa và checklist hôm nay khi dữ liệu được sinh.

## 5. F1.3 Chi tiết, phả hệ, tab nghiệp vụ · Quản lý và chủ ngựa

1. Đăng xuất → Quản lý → **Horses → Vân Tiêu**. Ở tab **Overview/Tổng quan**, chỉ vào chip, giống, giới tính, chủ, khu/ô, Groom, sức khỏe và **Pedigree information/Phả hệ**. Chạm tên cha hoặc mẹ trong cây để mở hồ sơ tổ tiên; bấm **←** quay lại.
2. Vuốt ngang dãy tab hồ sơ: **Health/Sức khỏe**, **Performance/Thành tích**, **Racing/Thi đấu**, **Costs/Chi phí**, **Timeline/Nhật ký** (tab nào có quyền mới hiện). Mở mỗi tab vài giây. Timeline chỉ có dữ liệu nếu API audit BE hoạt động trên process hiện tại; đừng khẳng định có dữ liệu nếu màn báo lỗi.
3. Đăng nhập Nguyễn Hải Đăng → **Horses/Ngựa của tôi → Vân Tiêu**. Mở tab **Training/Huấn luyện**, **Health**, **Performance**, **Racing**, **Costs** để cho thấy chủ chỉ xem dữ liệu được phép. Không giả định chủ xem được thông tin của ngựa không thuộc mình.

## 6. F1.4 Sửa hồ sơ và chuyển chủ · Quản lý, HLV

1. Quản lý → **Horses → Bình Minh → Edit horse profile/Sửa hồ sơ**. Sửa một trường không ảnh hưởng luồng sau, ví dụ màu lông hoặc ghi chú, đổi ảnh nếu cần → chạm nút lưu cuối form → quay lại hồ sơ kiểm tra giá trị mới.
2. HLV → **Horses → Bình Minh → Overview** → **Race aptitude/Sở trường** chọn sở trường phù hợp → **Save race aptitude/Lưu sở trường**. Đây là quyền HLV; Quản lý không nhập thay qua nút HLV.
3. Quản lý → **Horses → một hồ sơ thử riêng → Ownership history/Lịch sử chủ sở hữu**. Xem **Current owner/Chủ hiện tại** và **Ownership periods/Các kỳ sở hữu**. Ở **Internal ownership transfer**, chọn **New owner/Chủ mới** là một chủ khác, nhập **Transfer reason or contract number/Lý do hoặc số hợp đồng** → **Confirm ownership transfer/Xác nhận chuyển chủ**. Cho thấy kỳ sở hữu cũ đóng và kỳ mới mở. Nếu không muốn đổi chủ thật, dừng ở form và nói quy tắc.
4. Nêu luật BE: chuyển chủ nội bộ có lịch sử và lý do; không đổi `ownerId` trực tiếp để thay thế nghiệp vụ; ngựa đã điểm danh buổi tập có thể bị BE chặn chuyển chủ. Thông báo sở hữu gửi cho chủ mới.

## 7. F1.5 Chỉ số cơ thể · Bác sĩ hoặc người có quyền

1. Đăng nhập Vet Nguyễn Thị Lan (hoặc Quản lý nếu quyền hồ sơ cho phép) → **Horses → Bình Minh → Overview/Health → Body measurements/Chỉ số cơ thể**.
2. Chạm các ô **Weight/Cân nặng**, **Height/Chiều cao**, **Body condition/Thể trạng**, **Temperature/Thân nhiệt**; nhập một hoặc vài số hợp lệ, ví dụ `450` kg, `160` cm, `5`, `37.8` °C → chạm nút lưu. Chỉ biểu đồ/điểm mới và ngày giờ ghi nhận.
3. Đổi chip loại chỉ số trên biểu đồ để xem xu hướng. Nếu muốn minh họa cảnh báo, nhập số đo bất thường trên hồ sơ thử, xác nhận **Confirm abnormal readings/Xác nhận số đo bất thường** rồi lưu; sốt/sụt cân gửi cảnh báo, không tự sinh yêu cầu khám.
4. Form không có ngày đo: BE lấy giờ khi lưu. Nếu ghi sai, người có quyền chạm bản ghi → **Delete/Xóa**, nhập lý do rồi nhập lại; không sửa ngày đo lùi.

## 8. F1.8 Vòng đời, xóa và khôi phục · Quản lý CLB

1. Quản lý → **Horses → Thiên Hà** (đã chuyển nhượng) → **Lifecycle, delete or restore/Vòng đời, xóa hoặc khôi phục**. Chọn **ACTIVE/Kích hoạt lại**; chọn **chủ mới** bắt buộc, nhập lý do → **Preview consequences/Xem trước hệ quả**. Đọc: trở về chờ xếp khu, sức khỏe **QUARANTINED/Cách ly**. Không xác nhận nếu còn cần Thiên Hà ở trạng thái cũ.
2. Mở **Lão Mã** (đã giải nghệ) → cùng màn → xem trước kích hoạt lại. Khác với ngựa chuyển nhượng: sức khỏe hiện tại được giữ. Mở một hồ sơ thử ACTIVE → xem trước **RETIRED/Giải nghệ** hoặc **TRANSFERRED/Chuyển nhượng ra ngoài** để cho thấy lớp tập, khu/ô/Groom và phí có thể bị ảnh hưởng.
3. Với ngựa có bệnh án đang mở như Hỏa Diệm, chọn **DECEASED/Ghi nhận mất** → xem preview và lý do BE chặn nếu còn ca y tế cần chốt. Không nhập ngày mất; BE lấy ngày CLB lúc xác nhận. Đường đóng ca và ghi nhận mất cùng lúc được demo ở Flow 3.
4. **Horses → Filters → Include deleted → Bích Ngọc → Lifecycle, delete or restore → RESTORE/Khôi phục → Preview consequences**. Nếu muốn hoàn tất F1.8 thật, nhập lý do rồi xác nhận khôi phục; quay lại danh sách để thấy hồ sơ có lại. Muốn trình diễn xóa, chỉ dùng hồ sơ thử mới chưa có nghiệp vụ phát sinh: chọn **DELETE/Xóa**, xem preview rồi xác nhận. Hồ sơ đã có lịch sử không xóa được.

**Lời kết gợi ý:** “Từ định danh chip và phả hệ, hồ sơ đi qua phân khu, ô, Groom, chỉ số sức khỏe, quyền sở hữu và vòng đời. Mọi bước có quyền vai trò, xem trước tác động và lịch sử để đối soát.”

## Nếu thao tác không giống dự kiến

| Hiện tượng | Kiểm tra ngay |
|---|---|
| Không thấy nút xếp ô | Đang dùng Quản lý thay HLV khu; vào bằng HLV khu qua **More → Stable**. |
| B05 không còn trống | Dữ liệu đã đổi sau lần tập dượt; chọn ô trống khác hoặc nạp lại seed. |
| Đổi Groom trả 409 | Ngựa đang **PRESENT/READY/ONGOING**; kết thúc lượt tập rồi làm lại. |
| Chip báo trùng | Chọn chip 15 chữ số chưa từng dùng; hồ sơ chuyển nhượng/xóa vẫn giữ chip. |
| Không thấy Bình Minh ở Groom | Xem lại Groom thực tế đã chọn, tải lại **Tasks**; checklist chỉ có sau khi đã giao Groom. |
| Không thấy Bích Ngọc | Bật **Include deleted** bằng Quản lý; dữ liệu seed có thể chưa được nạp. |

**Nguồn đối chiếu:** `horse-racing-ne/docs/bao-fe-thay-doi-gop-y-demo.md`, source `horse-racing-ne/src/modules/horses`, `stable-os-vet-3d-injury-mapping/app/[role]/horses.tsx`, `app/[role]/horse/[id].tsx`, `app/[role]/horse/[id]/placement.tsx`, `src/features/stable-care/StableManagementScreen.tsx`. Đây là kịch bản dựa trên source, chưa xác nhận đã chạy trực tiếp trên iPhone/DB hiện tại.
