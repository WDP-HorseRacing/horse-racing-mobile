# Kịch bản quay mobile — Flow 3: Y tế và xử lý chấn thương

**Mốc đối chiếu:** source BE `horse-racing-ne` nhánh `truong-req-gaps`, `docs/bao-fe-thay-doi-gop-y-demo.md` đến 23/10/2026; source mobile `stable-os-vet-3d-injury-mapping` nhánh `feature/vet-3d-injury-mapping`, đọc 25/10/2026. Source BE quyết định luật nghiệp vụ. **Độ dài gợi ý:** 18–25 phút. Video bao phủ hàng đợi, khám, 3D, khóa tập, tái khám, chăm sóc, chi phí và đóng ca.

## 0. Dữ liệu và vai trò trước khi quay

1. Nếu đã nạp seed thực tế, dùng Groom `bui.van.dung@phuocma.local`, Vet `nguyen.thi.lan@phuocma.local`, HLV `le.quoc.bao@phuocma.local`, Quản lý `tran.quang.minh@phuocma.local`; mật khẩu chung `Password123@`. Chủ ngựa dùng **đúng chủ của ngựa chọn**, không mặc định mọi ngựa thuộc Nguyễn Hải Đăng.
2. Chọn **một ngựa ACTIVE chưa có bệnh án mở và không có lượt PRESENT/READY/ONGOING** để Groom báo sự cố mới; nếu đã quay Flow 1–2, có thể dùng Bình Minh **sau khi lượt tập đã kết thúc**. Seed có **Hồng Vũ** đang `UNDER_OBSERVATION` với yêu cầu khám chờ, và **Hỏa Diệm** có bệnh án OPEN, vết thương/khóa tập để quay phần tái khám. Đừng tạo bệnh án mới trên Hỏa Diệm khi ca cũ còn mở.
3. Chuẩn bị ảnh tình trạng chân trong thư viện iPhone (ảnh có thể bỏ qua), nội dung triệu chứng `Đi khập khiễng chân trước trái sau vận động`, chẩn đoán `Tổn thương phần mềm vùng chân trước trái`, hướng dẫn Groom `Nghỉ tập, chườm lạnh 2 lần/ngày`. Dùng ngày/giờ hẹn **tương lai** dạng `YYYY-MM-DD`/`HH:mm` theo form.
4. Vet có thanh dưới **Medical/Y tế** và **Incidents/Sự cố**; bảng **More** có **Examination requests/Yêu cầu khám**, **Medical cases/Bệnh án**, **Periodic checkups/Khám định kỳ**, **Medical care schedule/Lịch chăm sóc**, **Alerts/Thông báo**, **Supplies/Vật tư**. Đổi người bằng **More → Sign out**. Màn hình phụ dùng mũi tên **←**; vuốt xuống để cập nhật sau khi role khác thao tác.

## 1. Mở video: tổng quan sức khỏe, lịch khám định kỳ · Vet

**Lời dẫn:** “Bác sĩ bắt đầu từ bảng y tế: đàn ngựa cần theo dõi, hàng chờ khám, bệnh án đang điều trị và lịch sắp tới.”

1. Đăng nhập Vet → thanh dưới **Medical/Y tế**. Giữ màn hình ở các thẻ thống kê; chạm bộ lọc sức khỏe và tìm Hồng Vũ/Hỏa Diệm để chỉ hai tình trạng khác nhau. Cuộn tới card hàng đợi yêu cầu, bệnh án đang mở, lịch khám.
2. Chạm **More → Periodic checkups/Khám định kỳ**. Chọn một ngựa ACTIVE đủ điều kiện, chạm **Đặt lịch**; nhập ngày/giờ tương lai → **Xác nhận lịch hẹn**. Nếu một ngựa đã có hẹn, nút **Dời lịch hẹn** yêu cầu lý do. Hẹn định kỳ khác lịch chăm sóc tiêm phòng/tẩy giun.
3. Quay lại **Medical** để thấy lịch mới hoặc mở lại **Periodic checkups**. Không bấm **Khám định kỳ ngay** cho chính ngựa chuẩn bị tạo bệnh án nếu muốn giữ mạch video gọn.

### Cảnh bổ sung F3.3: khám bình thường không mở bệnh án

1. Vẫn bằng Vet, chọn **một ngựa ACTIVE khác chưa có bệnh án mở** → **Horses → ngựa → Health → Record examination/Ghi buổi khám**; hoặc từ **Periodic checkups** chọn **Khám định kỳ ngay**. Trên form chọn **Normal/Bình thường**, ghi kết quả khám ngắn, rồi **Save examination record → Save**.
2. App mở chi tiết **biên bản khám lẻ**. Quay lại hồ sơ **Health → Medical visits/Lượt khám** để cho thấy lượt này được lưu dù **không có ca điều trị mới**. Nếu dùng nút khám định kỳ, kiểm tra lịch định kỳ tương ứng đã được xử lý. Không dùng chính ngựa dự định gắn vết thương ở cảnh 3.

## 2. Groom báo sự cố, yêu cầu khám vào hàng đợi

1. Vet đăng xuất → Groom đăng nhập → thanh dưới **Incidents/Sự cố**. Ở form **Report an incident/Báo sự cố**, chạm ô tìm ngựa, chọn ngựa đã chuẩn bị. Groom có thể báo hộ ngựa khác trong CLB, không chỉ ngựa mình chăm.
2. Ô **What happened?/Chuyện gì xảy ra?** nhập triệu chứng đã chuẩn bị. Chọn mức **Urgent/Khẩn** nếu muốn demo hàng chờ ưu tiên; chạm **Attach photo/Đính kèm ảnh** và chọn ảnh. Ảnh là tùy chọn, nhưng quay ảnh giúp thấy bác sĩ xem được ảnh từ yêu cầu.
3. Chạm **Send incident report/Gửi báo cáo**. Mở thẻ vừa gửi, chỉ trạng thái và ảnh. Với sự cố khẩn/chuyển bác sĩ, BE tạo yêu cầu khám. Nếu chọn **thường** thì HLV khu xử lý hoặc **Refer to veterinarian/Chuyển bác sĩ**; nên dùng một sự cố thường riêng nếu cần trình diễn cả nhánh HLV.
4. Groom đăng xuất → Vet đăng nhập → **More → Examination requests**; ở tab **Pending/Chờ**, vuốt xuống cập nhật → tìm ngựa vừa báo. Chạm card để bung **Nhấn để xem thao tác xử lý**; chạm ảnh sự cố để mở lớn. Thử thay mức ưu tiên qua **Nâng lên cấp cứu/Bỏ đánh dấu cấp cứu** kèm lý do nếu đã tạo yêu cầu thường; nếu vừa gửi Khẩn thì giữ nguyên.

**Cảnh bổ sung F3.4:** HLV/Quản lý có thể mở **Horses → hồ sơ ngựa → Request examination/Yêu cầu khám** để tự tạo yêu cầu không qua sự cố; chọn một ngựa chưa có yêu cầu chờ, nhập triệu chứng rồi gửi. Vet mở yêu cầu đó, bung thao tác và **Bỏ qua yêu cầu khám → nhập lý do → Xác nhận bỏ qua** nếu xác định chưa cần khám. Dùng yêu cầu phụ này cho nhánh bỏ qua; giữ yêu cầu từ sự cố chính để mở bệnh án ở cảnh 3.

**Lời dẫn:** “Sự cố cần bác sĩ xử lý tự vào hàng đợi khám. Bác sĩ nhìn được ảnh, mức khẩn và người gửi trước khi ghi nhận.”

## 3. Ghi buổi khám và mở bệnh án với điểm chấn thương 3D

1. Trong card yêu cầu → **Bắt đầu ghi nhận khám**. Kiểm tra tiêu đề **Record examination/Ghi nhận khám**, tên ngựa và yêu cầu đã chọn ở đầu form. **Ngày giờ khám do server ghi lúc bấm lưu**; form không nhập `examDate`.
2. Phần **Clinical vital signs/Chỉ số lâm sàng**: nhập thân nhiệt/cân nặng nếu có số đo thật hoặc số phù hợp với lời kể. Nếu vượt khoảng tham chiếu, chạm **Confirm abnormal readings/Xác nhận số bất thường**. Việc nhập sốt/sụt cân phát cảnh báo theo BE, **không tự tạo yêu cầu khám**.
3. Phần **Clinical findings & conclusion/Kết luận**: chọn **Issue/Có vấn đề** (Normal chỉ lưu khám lẻ, không mở bệnh án). **Diagnosis and findings** nhập quan sát; **Initial case diagnosis** nhập chẩn đoán ca điều trị bắt buộc. Phần **Resulting health status** chọn `INJURED/Chấn thương` nếu phù hợp và nhập **Reason for health status change/Lý do đổi sức khỏe**.
4. Mở **Injury documentation/Chấn thương** → **Open 3D injury map/Mở bản đồ 3D**. Chờ ngựa 3D tải; xoay/zoom, chạm vùng chân trước trái trên **mô hình** để đặt ghim. Bên dưới chọn **Body region/Vùng cơ thể**, **Injury type/Loại chấn thương**, **Recovery status/Tình trạng hồi phục** là `ACUTE` và ghi chú → **Confirm injury marker/Xác nhận điểm chấn thương** → **Close 3D injury map/Đóng bản đồ**. Mỗi vết có tọa độ X/Y/Z thật và mã injury riêng; không nhập 3 tọa độ tay.
5. Phần **Treatment & prescriptions/Điều trị**: nhập **Care instructions** cho Groom; nếu kê thuốc, điền đủ thuốc, liều, tần suất, ngày bắt đầu; nếu không dùng thuốc, để toàn bộ ô thuốc trống. Ở **Follow-up appointment**, chọn nhanh **+3 days** hoặc ngày/giờ tương lai.
6. Chạm nút cuối **Save examination record/Lưu kết quả khám** → hộp xác nhận → **Save/Lưu**. App đưa tới **Chi tiết bệnh án** mới. Quay chẩn đoán, lượt khám đầu, điểm chấn thương và lịch tái khám. BE không nhận `injuries` kiểu cũ hay `examDate`; mobile gửi `newInjuries` và thời điểm do server tự ghi.

**Nếu cần demo khám không mở bệnh án:** dùng một ngựa/yêu cầu khác → chọn **Normal/Bình thường** → lưu, app mở chi tiết **lượt khám lẻ**. Đừng chọn Normal cho ngựa vừa gắn điểm chấn thương.

## 4. Khóa tập và thông tin đến HLV/Groom

1. Vet → bấm **←** tới hồ sơ hoặc thanh dưới **Horses → ngựa vừa khám → Health/Sức khỏe** → **Lock training/Khóa huấn luyện**. Nhập lý do `Nghỉ tập đến khi tái khám chấn thương chân`, ngày giờ gỡ dự kiến tương lai → lưu và xác nhận.
2. Vet mở lại **Health** để thấy khóa đang hiệu lực. Nếu ngựa đang có lượt ONGOING/PRESENT/READY, BE có thể chặn đặt khóa hoặc yêu cầu xử lý lượt; chọn ngựa không còn ở sân tập như mục chuẩn bị.
3. Đăng xuất → HLV khu → **Horses → cùng ngựa → Health/Training**; chỉ trạng thái sức khỏe, khóa và lượt sắp tới `CANCELLED_BY_LOCK/Hủy do khóa tập` kèm lý do nếu ngựa có lịch. **More → Alerts** để thấy thông báo. Groom phụ trách mở **Tasks** và thông báo để thấy hướng dẫn chăm sóc; Groom không mở chi tiết đơn thuốc/chi phí.
4. Chuyển về Vet trước khi làm tiếp. Nếu cần demo gỡ khóa thủ công, màn khóa của Vet có hành động release; nên giữ khóa đến phần đóng ca để minh họa quyết định **RELEASE/KEEP**.

### Cảnh bổ sung F3.7: đổi sức khỏe ngoài buổi khám

Vet → **Horses → một ngựa thử khác → Health → Update health status/Cập nhật sức khỏe**. Chọn trạng thái mới, nhập **Reason for this change/Lý do**, chạm **Save health status**; cuộn xuống **Health status history/Lịch sử sức khỏe** để thấy trước/sau, người và thời điểm. Đây là thao tác độc lập với biên bản khám. Đổi sang ELIGIBLE không tự gỡ một lệnh khóa tập: khóa phải được Vet xử lý riêng.

## 5. Bệnh án, tái khám, từng vết và chi phí từng lượt · Vet

1. Vet → **More → Medical cases/Bệnh án**, lọc OPEN và chọn ca vừa tạo hoặc **Hỏa Diệm** có sẵn. Nếu danh sách ca đóng chưa hiện nhưng ca OPEN vẫn hiện, xem ghi chú ở cuối file về BE process và route `GET /medical-cases`.
2. Trong **Chi tiết bệnh án**, cuộn các lượt khám để thấy chẩn đoán, vết thương và **Chi phí lần khám**. **Lưu ý đúng mobile hiện tại:** form **Record examination** chưa có ô chi phí ban đầu; BE lưu mặc định `0` nếu không gửi. Để minh họa phí thật, trên **lượt vừa do tài khoản Vet này ghi**, chạm **Sửa chi phí** → nhập ví dụ `350000` VND và lý do `Ghi nhận chi phí vật tư và thăm khám` → **Lưu chi phí**. BE chỉ cho **bác sĩ đã ghi chính lượt đó** sửa phí/hủy lượt; lượt seed Hỏa Diệm do hai Vet khác nhau ghi. Tổng bệnh án cộng từ từng lượt; **không nhập khoản tổng lúc đóng ca**.
3. Chạm **Ghi buổi tái khám/Follow-up examination** trên ca OPEN. Nhập diễn tiến; mở **Injury documentation → Open 3D injury map**, chọn **điểm chấn thương cũ** rồi **Update in this follow-up/Cập nhật ở lần tái khám**, đổi Recovery status từ `ACUTE` sang `RECOVERING`. Lưu **Save follow-up/Lưu tái khám**. Quay lịch sử hai lần trên cùng `injuryId`.
4. Nếu muốn đóng ca bình thường ngay trong video, thêm một **buổi tái khám nữa** hoặc cập nhật ở buổi sau để toàn bộ vết của ca thành `HEALED/Đã lành`; sau khi lưu, quay lại bệnh án. Vết đã lành không sửa ngược thành chưa lành; tái phát phải tạo vết mới.
5. Nếu phát hiện lượt khám nhập sai, trong bệnh án có **Hủy buổi khám** kèm lý do, rồi **Ghi buổi khám thay thế**. Chỉ quay hộp preview trên dữ liệu demo nếu còn cần lượt đó để đóng ca. BE có thể tự mở lại sự cố/yêu cầu nếu lượt đã hủy là lượt xử lý yêu cầu đó.

**Lưu ý khi dùng Hỏa Diệm seed:** vết cũ có tọa độ trong BE nhưng không có metadata phiên bản mô hình lưu trên chính thiết bị; mobile có thể hiện vết ở **danh sách lịch sử** mà không vẽ ghim lên 3D để tránh đặt sai vùng. Muốn quay ghim chắc chắn, dùng vết **mới tạo trên iPhone trong cảnh 3** và tái khám vết đó trên cùng thiết bị.

## 6. Lịch chăm sóc định kỳ và mở lại lịch hoàn tất · Vet/Groom

1. Vet → **More → Medical care schedule/Lịch chăm sóc** → **Tạo lịch chăm sóc mới**. Tìm ngựa; chọn loại **Tiêm phòng**, **Tẩy giun** hoặc **Chăm sóc móng**; ngày/giờ tương lai; người thực hiện; ghi chú → **Lưu**. Tiêm phòng/tẩy giun giao Vet hoặc chưa phân công; chăm sóc móng có thể giao Vet hoặc Groom.
2. Mở lịch vừa tạo → **Dời ngày / Phân công lại**, nhập lý do khi đổi ngày hoặc người → lưu. Nếu chọn lịch đến hạn phù hợp và đã làm, chạm **Đánh dấu hoàn tất** → xác nhận. Groom có thể hoàn tất lịch **được giao cho mình** trong **Tasks/Việc hôm nay** khi đến hạn.
3. Mở một lịch **VACCINATION/DEWORMING/FARRIER** đã COMPLETED → **Mở lại lịch đã hoàn tất** → nhập **Lý do mở lại** `Đánh dấu hoàn tất nhầm, chưa thực hiện` → **Xác nhận mở lại**. Trạng thái về SCHEDULED. Không thử thao tác này trên lịch khám định kỳ/tái khám: BE không cho mở lại theo route này.
4. Mở một lịch SCHEDULED khác → **Hủy lịch** nhập lý do để cho thấy việc hủy có dấu vết; không hủy lịch cần dùng ở phân cảnh sau.

## 7. Xem trước đóng bệnh án, quyết định khóa, đính chính kết luận · Vet

1. Trở lại **More → Medical cases → ca đã có tất cả vết HEALED**. Cuộn cuối đến **Đóng bệnh án điều trị**. Hộp **Kiểm tra trước khi đóng** cho số yêu cầu đang chờ, sức khỏe, số vết chưa lành và lệnh khóa đang hiệu lực. Nếu còn vết chưa lành, nút đóng bị khóa; chạm **Ghi tái khám để cập nhật lành thương** trước.
2. Nhập **Kết luận điều trị cuối cùng**, ví dụ `Đã hồi phục, tái đánh giá sau 7 ngày`. Nếu có khóa từ ca này **hoặc ca trước**, chọn **RELEASE/Gỡ** để hết khóa hoặc **KEEP/Giữ** và nhập ngày giờ dự kiến gỡ mới. Đây là thay đổi BE ngày 23/10; không bỏ qua khóa của ca trước.
3. Chọn **Ngựa còn sống** → **Xác nhận đóng bệnh án** → hộp cuối **Đóng bệnh án**. Tổng phí bằng tổng lượt khám đã ghi/điều chỉnh, không tạo phí mới lúc đóng.
4. Trên bệnh án **CLOSED/Đã đóng**, chạm **Đính chính kết luận cuối** → sửa nội dung, nhập lý do giải trình → **Lưu đính chính**. Ca vẫn CLOSED, audit lưu dấu. Nếu hỏi về ngựa mất, hộp đóng có lựa chọn **Ghi nhận ngựa mất**; BE ghi ngày CLB hiện tại và đóng ca cùng một giao dịch. Chỉ xác nhận nhánh đó trên ngựa thử riêng.

## 8. Sự cố tự đóng, quyền xem và báo cáo

1. Vet mở **Incidents/Sự cố** hoặc Groom mở lại báo cáo ở phần 2: khi bác sĩ **đã khám** yêu cầu xuất phát từ sự cố, sự cố thành **RESOLVED/Đã xử lý** với nguồn xử lý y tế. HLV **không cần** đóng tay; nếu bác sĩ **bỏ qua yêu cầu khám** kèm lý do, BE cũng tự đóng. Nếu hủy lượt khám làm yêu cầu quay về chờ, sự cố tự mở lại.
2. Chủ của ngựa vừa khám → **Horses → hồ sơ → Health/Costs**, hoặc **More → Reports**: xem phần sức khỏe/kết luận/chi phí đúng quyền sở hữu. Chi phí buổi khám phát sinh theo **chủ sở hữu tại ngày khám**; nếu đã đổi chủ, chủ mới không thấy tiền của chủ cũ.
3. Quản lý → **More → Medical overview/Y tế → Medical cost report/Báo cáo chi phí y tế**; chọn khoảng ngày bao trùm buổi khám. Có thể vào **More → Reports/Báo cáo** để thấy chi phí y tế trong tổng phí chủ ngựa.

**Lời kết:** “Sự cố đi vào hàng chờ bác sĩ; buổi khám tạo bệnh án và ghim 3D; khóa tập và hướng dẫn chăm sóc đến đúng người; các lần tái khám, chi phí, kết luận và lịch chăm sóc có thể theo dõi và đính chính có lý do.”

## Nếu không thấy đúng trạng thái

| Hiện tượng | Kiểm tra ngay |
|---|---|
| Không có ảnh trong yêu cầu | Mở đúng yêu cầu gắn với sự cố mới; ảnh là tùy chọn; kiểm tra upload đã xong trước khi gửi. |
| Bản đồ 3D không tải | Đợi tài nguyên `.glb` tải trong màn; đóng/mở lại bản đồ. App không lưu ghim mới nếu chưa có tọa độ thật trên mô hình. |
| Nút lưu khám báo thiếu | Với **Issue** phải nhập initial diagnosis; chấn thương mới phải xác nhận vùng, loại, mức hồi phục và điểm 3D; đổi health cần lý do. |
| Không có ô chi phí ở form khám | Đúng mobile hiện tại: vào **Chi tiết bệnh án → lượt khám → Sửa chi phí** sau khi lưu; nhập số VND và lý do. |
| Không đóng được ca | Xem preview: vết chưa HEALED, yêu cầu/khóa còn mở; chọn quyết định khóa và cập nhật vết bằng tái khám. |
| Không thấy ca CLOSED trong danh sách | Working tree BE có `GET /medical-cases`; nếu server đang chạy binary cũ, khởi động lại BE bản mới. Mobile có fallback chỉ lấy ca mở từ dashboard. |

**Nguồn đối chiếu:** `horse-racing-ne/docs/bao-fe-thay-doi-gop-y-demo.md`, module medical BE, `stable-os-vet-3d-injury-mapping/src/features/medical/MedicalWorkspaceScreen.tsx`, `app/[role]/medical/requests.tsx`, `app/[role]/medical/visit.tsx`, `src/features/medical/injury-mapper/Injury3DMapper.tsx`, `app/[role]/medical/cases/[id].tsx`, `app/[role]/medical/care.tsx`. Kịch bản dựa trên source, chưa xác nhận đã quay thử trên iPhone/DB hiện tại.
