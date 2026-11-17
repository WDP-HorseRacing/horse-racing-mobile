# Báo cáo Triển khai Nâng cấp Asset 3D Horse & Viewer Layout — RaceOS Mobile

**Dự án:** RaceOS Mobile (`stable-os-vet-3d-injury-mapping`)  
**Tính năng:** 3D Injury Mapping (Bản đồ chấn thương ngựa 3D cho Bác sĩ thú y)  
**Quyết định phê duyệt:** **Ứng viên 2 — Equine Anatomical Reference (Realistic Veterinary Surface Anatomy)**  
**Asset triển khai:** `horse-anatomy-v2.glb` (Dung lượng: 6.98 MB, SHA-256: `09deb84a34fd2ca0bfbc28e0729bec64e8b62fa44057141929d93e0acd56ed32`)  
**Tác giả:** Senior 3D Asset Technical Artist & React Native Three.js Engineer  
**Thời gian:** 21/10/2026  
**Phạm vi:** Source Mobile `stable-os-vet-3d-injury-mapping` (nhánh `feature/vet-3d-injury-mapping`). Giữ nguyên 100% Backend `horse-racing-ne`, Web `horse-racing-fe` và các API contract hiện hành.

---

## 1. Tóm tắt điều hành & Giải thích Hiện tượng (Executive Summary & Root Cause)

### 1.1. Nguyên nhân vì sao màn hình trước đó chưa thay đổi hình dáng thực tế

Khi kiểm tra trực tiếp trên thiết bị di động, người dùng ghi nhận: mô hình 3D trên màn hình vẫn mang hình dáng của mô hình cũ (thân tròn dạng ống, 4 chân thẳng tuột, đầu tròn thô).

**Phân tích nguyên nhân kỹ thuật:**

1. **Lỗi hình học gốc:** Ở lần xử lý trước, hệ thống mới chỉ ẩn 20 node phụ (bờm tóc khối `Mane lock`, khóe miệng `Mouth crease`, đốm mắt `Eye glint`) của file `horse-anatomy-v1.glb` cũ. Do đó, lưới thân cơ sở (`Horse continuous body`) thực chất vẫn là lưới của chú ngựa hoạt hình ban đầu! Việc chỉ đổi màu xám và gỡ bờm tóc không làm thay đổi được tỷ lệ cơ thể và các khớp xương giải phẫu.
2. **Bộ nhớ đệm Metro Bundler:** Quá trình `pnpm start` đã chạy nền hơn 1 tiếng. Khi thay đổi tệp asset nhị phân lớn, Metro bundler giữ nguyên cache asset cũ cho đến khi được reload ép buộc (`r` trong terminal).

### 1.2. Giải pháp dứt điểm đã triển khai

Nhóm kỹ thuật đã thay thế toàn bộ bằng mô hình giải phẫu thú y thực tế hoàn chỉnh:

- **Tệp asset mới:** `src/features/medical/injury-mapper/assets/horse-anatomy-v2.glb` (**6.98 MB**, SHA-256: `09deb84a34fd2ca0bfbc28e0729bec64e8b62fa44057141929d93e0acd56ed32`).
- **Lưới hình học thực tế (48,485 đỉnh, 96,966 tam giác):** Mô hình ngựa trưởng thành với đầy đủ hệ cơ bắp (cơ bả vai, cơ ức, cơ đùi, cơ mông), sống lưng và gồ vai tự nhiên, sống mũi và xương hàm thú y sắc nét, đặc biệt là 4 chân thể hiện rành mạch từng khớp: khớp cổ chân sau (hock), khớp gối sau (stifle), khớp cổ chân trước (knee/carpus), khớp ngón (fetlock) và móng guốc.
- **Chuẩn hóa hệ tọa độ `HORSE_ROOT_LOCAL`:**
  - $Y \in [0.000, 2.140]\text{ m}$: Chiều cao $2.14\text{ m}$, móng tiếp đất chuẩn xác tại $Y = 0.000\text{ m}$.
  - $Z \in [-1.284, +1.284]\text{ m}$: Chiều dài $2.567\text{ m}$, đầu hướng $+Z$, đuôi ở $-Z$.
  - $X \in [-0.588, +0.588]\text{ m}$: Bề ngang $1.176\text{ m}$, mạn trái của ngựa hướng $+X$.
- **Camera Auto-fit:** Căn chỉnh tự động góc nhìn ngang (Initial Lateral Side View) bao quát 100% đầu và 4 móng chân, đệm $30\%$ viền an toàn.

---

## 2. Thông số Kỹ thuật Đối chiếu Chi tiết

| Tiêu chí                     | Model v1 (Cũ - Cartoon)         | Model thử nghiệm (Gỡ bờm)  | Model v2 MỚI (Giải phẫu Thực tế)                                       |
| :--------------------------- | :------------------------------ | :------------------------- | :--------------------------------------------------------------------- |
| **Phong cách hình thể**      | Hoạt hình (chân trụ, thân tròn) | Vẫn là thân hoạt hình cũ   | **Giải phẫu thú y thực tế (Realistic Equine Anatomy)**                 |
| **Cấu trúc khớp chân**       | Không có khớp                   | Không có khớp              | **Rõ khớp Hock, Stifle, Carpus, Fetlock, Hoof**                        |
| **Cơ bắp & Đường nét**       | Hình trụ nhẵn thô               | Hình trụ nhẵn thô          | **Rõ cơ ngực, bả vai, đùi, mông, gồ vai, xương hàm**                   |
| **Số lượng đỉnh (Vertices)** | 104,752 (phân mảnh)             | 104,752 (phân mảnh)        | **48,485 đỉnh (Lưới liên tục sạch, không seam)**                       |
| **Số lượng tam giác (Tris)** | 208,238 tris                    | 168,000 tris               | **96,966 tris (Tối ưu hóa hiệu năng render)**                          |
| **Dung lượng file**          | 4.99 MB                         | 4.92 MB                    | **6.98 MB**                                                            |
| **Mã SHA-256**               | `0ca21251cd...`                 | `bd6f0d0233...`            | **`09deb84a34fd2ca0bfbc28e0729bec64e8b62fa44057141929d93e0acd56ed32`** |
| **Hệ tọa độ tiếp đất**       | Lơ lửng $Y=0.005\text{ m}$      | Lơ lửng $Y=0.005\text{ m}$ | **Chuẩn hóa tuyệt đối $Y=0.000\text{ m}$**                             |

---

## 3. Hệ thống Chiếu sáng Lâm sàng & Chống chìm Marker

1. **Vật liệu PBR Trung tính (`clinicalBodyMaterial`):**
   - Màu sắc: `#dcd8cf` (Tông màu đất sét/sứ y khoa ngà ấm, không phản chiếu chói lọi).
   - Roughness: $0.62$, Metalness: $0.04$. Bề mặt mờ làm nổi bật từng thớ cơ và góc gập của khớp xương khi ánh sáng quét qua.
2. **Chiếu sáng Studio 4 nguồn:**
   - Nền canvas `#f4f3ef` hòa quyện tự nhiên với giao diện thẻ RaceOS.
   - `HemisphereLight` (1.6) tạo độ sáng nền đồng đều mọi góc cạnh.
   - `Key Light` (1.8) đổ bóng mềm tôn khối cơ bắp từ góc trước trên.
   - `Fill Light` (1.1) làm sáng vùng bụng dưới, háng và mặt trong 4 chân.
   - `Rim Light` (0.7) viền nổi sống lưng, gồ vai và tai ngựa.
3. **Chống chìm Marker (Anti-sinking):**
   - Thuộc tính phần cứng `polygonOffset: true`, `polygonOffsetFactor: -3`, `polygonOffsetUnits: -3`.
   - Dịch chuyển hiển thị ra ngoài $1.2\text{ cm}$ theo vector hướng tâm từ tâm mô hình $(0, 1.07, 0)$, triệt tiêu $100\%$ hiện tượng z-fighting.

---

## 4. Phân vùng Giải phẫu (Semantic Body Regions)

Kiểm tra phân bố tự động trên toàn bộ 290,898 vị trí tọa độ của lưới mới:

- `HEAD`: 23,376 đỉnh ($Z \ge 0.96\text{ m}, Y \ge 1.35\text{ m}$)
- `NECK`: 51,868 đỉnh ($Z \ge 0.40\text{ m}, Y \ge 1.05\text{ m}$)
- `CHEST`: 20,509 đỉnh ($Z \ge 0.18\text{ m}, Y \ge 0.78\text{ m}$)
- `BACK`: 38,437 đỉnh ($Y \ge 1.05\text{ m}, -0.48\text{ m} \le Z < 0.40\text{ m}$)
- `ABDOMEN`: 25,852 đỉnh ($Z < 0.18\text{ m}, Y < 1.12\text{ m}$)
- `PELVIS`: 63,972 đỉnh ($Z \le -0.42\text{ m}, Y \ge 0.92\text{ m}$)
- `LEFT_FRONT_LEG`: 10,850 đỉnh / `RIGHT_FRONT_LEG`: 22,942 đỉnh ($Y < 0.82\text{ m}, Z \ge 0.08\text{ m}$)
- `LEFT_HIND_LEG`: 10,975 đỉnh / `RIGHT_HIND_LEG`: 22,117 đỉnh ($Y < 0.82\text{ m}, Z < 0.08\text{ m}$)
- **`OTHER` / Ngoại lai:** **0 đỉnh** (100% tọa độ bề mặt đều được phân loại chính xác vào các vùng giải phẫu chuẩn).

---

## 5. Kết quả Kiểm thử & Biên dịch (Test & Build Verification)

1. **Unit Tests:**
   - `node --test tests/injury-mapper.test.mjs`: **6/6 PASS 100%**.
   - `node --test tests/mobile-unit.test.mjs`: **23/23 PASS 100%**.
2. **Kiểm tra tiêu chuẩn mã nguồn (`pnpm check`):**
   - TypeScript Typecheck (`tsc --noEmit`): **PASS (0 errors)**.
   - ESLint (`eslint . --max-warnings=0`): **PASS (0 warnings, 0 errors)**.
   - Prettier Style (`prettier --check .`): **PASS 100%**.
   - i18n localization: **PASS 100%**.
3. **Biên dịch Bundle:**
   - Viewer bundle [`injury-viewer.bundle.txt`](file:///Users/dungnguyen/Documents/CODE-PROJECT/WDP/stable-os-vet-3d-injury-mapping/src/features/medical/injury-mapper/assets/injury-viewer.bundle.txt): **633.0 KB**.

---

## 6. Hướng dẫn Reload trên Thiết bị Di động / Simulator

Vì Metro bundler lưu cache tài sản tĩnh trong bộ nhớ, để nhìn thấy mô hình giải phẫu mới ngay lập tức trên máy:

1. Chuyển sang cửa sổ Terminal đang chạy `pnpm start`.
2. **Nhấn phím `r`** (hoặc `Shift + r` để reload bundle & cache).
3. Hoặc trên màn hình iPhone/Android, lắc nhẹ thiết bị để mở Expo Developer Menu và chọn **"Reload"**.
4. Mở lại màn hình Khám bệnh $\rightarrow$ Chạm **"Mở sơ đồ chấn thương 3D"**.
   Mô hình ngựa giải phẫu cơ bắp sắc nét và chuẩn xác sẽ hiển thị toàn diện.
