# Báo cáo migration Expo SDK 58

**Ngày:** 2026-10-26  
**Dự án:** `stable-os-vet-3d-injury-mapping`  
**Nhánh:** `codex/upgrade-expo-sdk-58`  
**Đánh giá:** **READY WITH LIMITATIONS**

## A. Executive Summary

Ứng dụng được nâng từ Expo SDK `57.0.23` lên `58.0.19`, React Native `0.86.3` lên `0.88.0`, React `19.2.3` lên `19.3.0`. Phiên bản package được đồng bộ theo Expo SDK 58 compatibility map bằng `expo install --fix`; không dùng `--force` hoặc `--legacy-peer-deps`.

TypeScript, dependency peer check, 50 automated tests, i18n catalog, web export, Android JavaScript export, iOS native Debug build và runtime QA trên iPhone 17 Simulator đều đã được xác minh. QA sau migration đã đăng nhập các vai trò seed local và chạy phần lớn luồng nghiệp vụ 1–4; các giới hạn còn lại được ghi trong [hướng dẫn QA 4 flow](SIMULATOR_QA_4_FLOW_GUIDE.md). Các chỉnh sửa tương thích SDK giữ nguyên API contract, validation và business rule; các bản sửa QA cập nhật bản dịch, nhãn trợ năng, route xem cảm biến và đồng bộ nút thời gian với các cửa sổ nghiệp vụ hiện hành.

Chưa thể xác minh Android native build vì máy không có Java runtime/Android SDK. E2E đã chạy bằng các vai trò seed trên DB local; video và chuyển Bình Minh sang B05 vẫn chưa được xác minh. Đã hoàn tất tái khám, đánh dấu vết cũ lành và đóng bệnh án bình thường trên Simulator. Push thật, upload media trên thiết bị và production/EAS build cũng chưa kiểm thử. Lint/format toàn repo còn lỗi baseline; kiểm tra catalog tiếng Việt hiện đạt. Lần Expo Doctor cuối bị giới hạn bởi mạng và không tải được hai nguồn metadata từ Expo. Trong lần QA này còn phát hiện trạng thái nút theo cửa sổ thời gian bị cũ khi màn Groom mở qua thời điểm chuyển; đã thêm cập nhật đồng hồ định kỳ ở màn Groom và HLV, rồi xác minh lại điểm danh, sẵn sàng và bắt đầu trên Simulator.

## Migration strategy và kiến trúc

- Baseline chỉ cách target một SDK, vì vậy dùng lộ trình nâng cấp trực tiếp theo [Expo SDK Upgrade Walkthrough](https://docs.expo.dev/workflow/upgrading-expo-sdk-walkthrough/), sau đó đồng bộ package theo SDK 58 thay vì nâng tất cả thư viện lên phiên bản mới nhất.
- Package manager chính thức của repo là pnpm (`pnpm@11.15.1`, `pnpm-lock.yaml`). `package-lock.json` cũ gây cảnh báo nhiều lockfile và có thể làm CLI chọn nhầm package manager; file này đã được bỏ để chỉ còn một lockfile có thẩm quyền.
- Dự án dùng Continuous Native Generation (CNG): baseline không có `android/` hoặc `ios/`. `expo prebuild` sinh iOS project tạm để build trên simulator; thư mục sinh ra đã được dọn sau khi kiểm thử, không có native customization có sẵn bị ghi đè.
- SDK 58 matrix xác định RN `0.88`, React `19.3`, Node tối thiểu `22.13`, iOS deployment target `16.4+`, Xcode `26.4+`, Android compile SDK `37`/target SDK `36`. Môi trường có Node `24.11.1`, Xcode `26.5`; không có Java/Android SDK. Tham khảo [SDK 58 release notes](https://expo.dev/changelog/sdk-58) và [SDK 58 version matrix](https://docs.expo.dev/versions/v58.0.0/).

## B. Dependency Changes

| Package                          |                                     Before |      After | Lý do                                                                        | Trạng thái |
| -------------------------------- | -----------------------------------------: | ---------: | ---------------------------------------------------------------------------- | ---------- |
| `expo`                           |                                 `~57.0.23` | `~58.0.19` | SDK đích                                                                     | PASS       |
| `react`                          |                                   `19.2.3` |   `19.3.0` | Phiên bản React của SDK 58                                                   | PASS       |
| `react-dom`                      |                                   `19.2.3` |   `19.3.0` | Đồng bộ React Native Web                                                     | PASS       |
| `react-native`                   |                                   `0.86.3` |   `0.88.0` | Phiên bản RN của SDK 58                                                      | PASS       |
| `expo-asset`                     |                                 `~57.0.20` | `~58.0.18` | SDK 58 bundled module                                                        | PASS       |
| `expo-constants`                 |                                 `~57.0.18` | `~58.0.13` | SDK 58 bundled module                                                        | PASS       |
| `expo-document-picker`           |                                  `~57.0.2` |  `~58.0.4` | SDK 58 bundled module                                                        | PASS       |
| `expo-file-system`               |                                  `~57.0.7` | `~58.0.11` | SDK 58 bundled module; vẫn giữ import `expo-file-system/legacy` đang dùng    | PASS       |
| `expo-font`                      |                    Chưa khai báo trực tiếp | `~58.0.10` | Bổ sung Expo peer dependency cho `@expo/vector-icons` theo kiểm tra cấu hình | PASS       |
| `expo-image-picker`              |                                 `^58.0.10` | `^58.0.10` | Giữ nguyên; phiên bản này khớp SDK 58                                        | PASS       |
| `expo-linking`                   |                                 `~57.0.10` | `~58.0.14` | SDK 58 bundled module                                                        | PASS       |
| `expo-notifications`             |                                 `~57.0.23` |  `~58.1.6` | SDK 58 bundled module                                                        | PASS       |
| `expo-router`                    |                                 `~57.0.21` | `~58.0.26` | Router tương ứng SDK 58                                                      | PASS       |
| `expo-status-bar`                |                                  `~57.0.1` |  `~58.0.4` | SDK 58 bundled module                                                        | PASS       |
| `expo-system-ui`                 |                                  `~57.0.4` |  `~58.0.6` | SDK 58 bundled module                                                        | PASS       |
| `expo-video`                     |                                  `~57.0.4` | `~58.0.12` | SDK 58 bundled module                                                        | PASS       |
| `expo-web-browser`               |                                  `~57.0.3` |  `~58.0.6` | SDK 58 bundled module                                                        | PASS       |
| `react-native-reanimated`        |  Không khai báo trực tiếp; peer cũ `4.6.0` |    `4.7.1` | SDK 58 compatibility map và RN 0.88 yêu cầu bản Reanimated tương thích       | PASS       |
| `react-native-worklets`          | Không khai báo trực tiếp; peer cũ `0.12.2` |   `0.13.0` | Peer của Reanimated 4.7.1                                                    | PASS       |
| `react-native-safe-area-context` |                                   `~5.7.0` |  `~5.10.1` | SDK 58 bundled module                                                        | PASS       |
| `react-native-screens`           |                                  `~4.26.0` |  `~4.30.0` | SDK 58 bundled module                                                        | PASS       |
| `react-native-svg`               |                                 `^15.15.5` |  `15.16.0` | Phiên bản SDK 58 yêu cầu                                                     | PASS       |
| `react-native-web`               |                                  `~0.21.0` |  `^0.21.4` | React Native Web tương ứng SDK 58                                            | PASS       |
| `react-native-webview`           |                                  `13.16.1` |   `14.0.1` | Bản trong SDK 58 compatibility map; xử lý lỗi khai báo type ở source         | PASS       |
| `@types/react`                   |                                  `~19.2.2` |  `~19.3.0` | Khớp React 19.3 / RN 0.88 strict types                                       | PASS       |
| `eslint-config-expo`             |                                  `~57.0.2` |  `~58.0.4` | Đồng bộ cấu hình lint Expo SDK                                               | PASS       |

`pnpm exec expo install --check --pnpm` báo dependencies up to date; do mạng bị tắt, CLI dùng `expo/bundledNativeModules.json` local map. `pnpm peers check` không còn peer dependency conflict. `react-native-reanimated`/`worklets` được khai báo trực tiếp để khóa đúng cặp phiên bản, tránh phụ thuộc vào optional peer resolution.

## C. Source Changes

| File                                                                          | Thay đổi                                                                                                                                                                                                                                                                                      |
| ----------------------------------------------------------------------------- | --------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `package.json`                                                                | Nâng Expo/RN/React và các package tương thích; thêm `expo-font`, Reanimated, Worklets; script `android`/`ios` được Expo prebuild chuyển sang `expo run:android`/`expo run:ios` để tạo native dev build.                                                                                       |
| `pnpm-lock.yaml`                                                              | Cập nhật graph theo package.json, giữ pnpm làm package manager duy nhất.                                                                                                                                                                                                                      |
| `package-lock.json`                                                           | Xóa lockfile npm trùng lặp; Expo Doctor cảnh báo nhiều lockfile, repo đã khai báo pnpm làm package manager.                                                                                                                                                                                   |
| `app.json`                                                                    | Đổi `userInterfaceStyle` từ `auto` sang giá trị schema SDK 58 `automatic`; bỏ `newArchEnabled` vì SDK 58 config schema không còn nhận trường này; đồng bộ config plugins cho asset, status bar, web browser và font.                                                                          |
| `app/groom/stable.tsx`                                                        | Dùng `ScrollViewInstance` cho ref theo RN 0.88 strict TypeScript API.                                                                                                                                                                                                                         |
| `app/groom/training.tsx`, `app/trainer/plan/[id]/session/[sessionId].tsx`     | Cập nhật đồng hồ mỗi 15 giây để nút điểm danh/sẵn sàng mở đúng lúc; chỉ bật nút bắt đầu trong cửa sổ 15 phút. Backend vẫn xác thực cửa sổ thời gian và điều kiện.                                                                                                                             |
| `src/features/stable-care/StableManagementScreen.tsx`                         | Cập nhật kiểu `ScrollView` ref; chuyển bốn `onRequestClose` về callback `void`, giữ nguyên guard không đóng modal khi thao tác đang lưu.                                                                                                                                                      |
| `src/features/medical/injury-mapper/Injury3DMapper.tsx`                       | Khai báo rõ generic `WebViewProps` cho ref và component do type inference của WebView 14.0.1 kết hợp RN strict types suy ra props sai. Không dùng `any` hoặc `ts-ignore`. Tham khảo upstream [WebView issue #3970](https://github.com/react-native-webview/react-native-webview/issues/3970). |
| `src/services/push-device.service.ts`                                         | Dùng named export `AndroidImportance` theo API type SDK 58; giá trị notification channel vẫn là `DEFAULT`.                                                                                                                                                                                    |
| `src/data/locales/vi-ui-extra.json`, `src/components/ui/BottomSheetModal.tsx` | Dịch các chuỗi thiếu tiếng Việt và nhãn VoiceOver; giữ nguyên nhãn hiển thị tiếng Việt khi đã chọn ngôn ngữ VI.                                                                                                                                                                               |
| `tests/i18n.test.mjs`                                                         | Bổ sung assertion cho nhãn ownership/training/y tế được phát hiện trong QA, bao gồm placeholder giải trình kết luận.                                                                                                                                                                          |

Các thay đổi tương thích SDK không sửa backend, base URL, request/response contract hoặc auth rules. Những thay đổi QA chỉ thêm bản dịch, nhãn trợ năng, cập nhật trạng thái thời gian của nút và route chỉ đọc cảm biến; không đổi business rules. Đã chạy toàn bộ test suite và cập nhật một bài kiểm tra i18n.

## D. Test Results

| Module                       | Loại kiểm thử                                      | Kết quả         | Bằng chứng                                                                                                                                                                                                      | Ghi chú                                                                                                                                                                                              |
| ---------------------------- | -------------------------------------------------- | --------------- | --------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | ---------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| TypeScript                   | `pnpm typecheck`                                   | PASS            | `tsc --noEmit` exit 0 sau migration                                                                                                                                                                             | RN 0.88 strict type errors đã xử lý.                                                                                                                                                                 |
| Unit/API/navigation          | `pnpm test`                                        | PASS            | 50/50 tests, 0 failed                                                                                                                                                                                           | Gồm API/OpenAPI contract, auth/token refresh, timeout/error mapping, i18n, injury mapper, business validation và navigation utilities.                                                               |
| Dependency graph             | `pnpm peers check`                                 | PASS            | “No peer dependency issues found”                                                                                                                                                                               | Không dùng peer bypass.                                                                                                                                                                              |
| Expo package map             | `expo install --check --pnpm`                      | PASS            | “Dependencies are up to date”                                                                                                                                                                                   | Dùng local Expo map vì mạng tắt.                                                                                                                                                                     |
| Expo Doctor                  | `pnpm dlx expo-doctor@latest`                      | BLOCKED         | Checkpoint trước build native đạt 20/20; lần chạy cuối sau dọn iOS folder đạt 18/20                                                                                                                             | Hai check cuối yêu cầu `exp.host`/React Native Directory từ mạng; fetch thất bại do `ENOTFOUND exp.host`/unexpected server response. Các check còn lại pass.                                         |
| Expo config / CNG            | Doctor và `expo prebuild`                          | PASS            | CNG sinh iOS project; CocoaPods và Xcode build hoàn tất                                                                                                                                                         | Tạo tạm `ios/` để build, sau đó dọn lại vì source ban đầu dùng CNG.                                                                                                                                  |
| Metro / iOS bundle           | `expo export --platform ios`                       | PASS            | Expo Router entry bundle thành công, 1.525 modules                                                                                                                                                              | Một lần đầu app nhận nhầm Metro SDK 57 đang chạy sẵn (JS 0.86.3/native 0.88.0); đã xác định đúng process cũ, dừng process đó, clear cache và nạp lại bundle SDK 58. Không phải lỗi source migration. |
| iOS native                   | `expo run:ios` trên iPhone 17 Simulator / iOS 26.5 | PASS            | `Build Succeeded`, 0 errors, cài app và mở màn hình đăng nhập                                                                                                                                                   | Có hai cảnh báo linker/codegen không chặn build: `CoreModule` internal trong generated provider và duplicate `-lc++`.                                                                                |
| iOS runtime smoke            | Mở app sau khi nạp Metro SDK 58                    | PASS            | Màn hình đăng nhập HorseRacing hiển thị, không còn red screen                                                                                                                                                   | Chỉ xác minh startup/login UI; không gửi thông tin đăng nhập.                                                                                                                                        |
| Android JavaScript bundle    | `pnpm exec expo export --platform android`         | PASS            | 1.518 modules, 47 assets, Hermes bundle 5 MB                                                                                                                                                                    | Đây không phải native Gradle build.                                                                                                                                                                  |
| Web export / route discovery | `pnpm export:web`                                  | PASS            | 73 static routes đã export                                                                                                                                                                                      | Web-only warning của notifications API; không áp dụng cho native iOS/Android.                                                                                                                        |
| ESLint                       | `pnpm lint`                                        | FAIL — baseline | 26 errors, 9 warnings, trùng số lượng trước migration                                                                                                                                                           | Tập trung vào conditional hooks, setState trong effect, đọc ref trong render và purity. Lỗi mới về AndroidImportance đã được sửa; file đó lint riêng pass.                                           |
| Format toàn repo             | `pnpm format:check`                                | FAIL — baseline | 55 files, cùng số lượng trước migration                                                                                                                                                                         | Các file chính sửa được kiểm tra Prettier riêng đều pass; không chạy format toàn repo để tránh thay đổi hàng loạt ngoài migration.                                                                   |
| Vietnamese translations      | `pnpm check:i18n`                                  | PASS            | “All mobile UI text uses the localization boundary and locale catalog.”                                                                                                                                         | Các nhãn phát hiện trong QA Simulator đã được bổ sung; test i18n bao gồm nhãn quyền sở hữu, buổi tập, thể trạng và lý do đính chính.                                                                 |
| Android native               | Gradle/device build                                | NOT VERIFIED    | `java -version` không tìm được Java; `adb`/`sdkmanager` vắng mặt; `ANDROID_HOME`/`ANDROID_SDK_ROOT` chưa đặt                                                                                                    | Chỉ Android JS export đã xác minh.                                                                                                                                                                   |
| iOS business E2E             | Các luồng authenticated trên API/DB local          | PARTIAL         | iPhone 17 Simulator: hồ sơ/tìm kiếm/đo sức khỏe/khôi phục/chuyển chủ; lịch, điểm danh, sẵn sàng, bắt đầu, cảm biến tự động/vọt nhịp tim và kết quả; khám/ghim 3D/chi phí/tái khám/đóng ca; chăm sóc/kho/phụ phí | Video buổi chạy và xếp Bình Minh vào B05 chưa xác minh. Các nút cảm biến live được thử sau khi sửa layout; chỉ ghi dữ liệu DB local.                                                                 |
| EAS/production build         | Release signing/profiles                           | NOT VERIFIED    | Baseline không có `eas.json`; chưa chạy EAS/Release build                                                                                                                                                       | iOS Debug simulator build không thay thế production verification.                                                                                                                                    |

## E. Platform Verification

### iOS

- Dùng Xcode `26.5`, CocoaPods `1.17.0`; iOS 26.5 iPhone 17 Simulator.
- `expo prebuild` tạo project CNG, CocoaPods install thành công, native Debug build thành công và app được cài lên simulator.
- App tải bundle mới và render màn hình đăng nhập; sau đó đăng nhập các tài khoản seed local để chạy partial-to-full QA theo vai trò. Bằng chứng từng flow và nội dung chưa xác minh nằm trong [hướng dẫn QA 4 flow](SIMULATOR_QA_4_FLOW_GUIDE.md).
- Không xác minh App Store/Release archive, signing, push delivery thật, camera/photo picker hoặc luồng upload/download trên thiết bị vật lý.

### Android

- `expo export --platform android` thành công, xác minh Metro resolution, Hermes bundle và asset pipeline của nền tảng Android.
- Không có Java runtime, Android SDK, `adb` hoặc `sdkmanager`, vì vậy Gradle build và emulator/device launch là **NOT VERIFIED**.

### Metro / development build / production readiness

- Metro iOS bundle 1.525 modules và Android export 1.518 modules thành công. Expo Router static web export tạo 73 routes.
- iOS native development build được kiểm tra trên simulator. Dự án không khai báo `expo-dev-client`; lệnh `expo run:ios` tạo/mở app native trong CNG.
- Không có EAS production profile trong baseline; production readiness chưa thể kết luận từ Debug build hoặc static JS export.

## F. Regression Analysis

### Feature inventory đã scan

| Nhóm                       | Routes / tính năng được tìm thấy                                                                                                                                                  |
| -------------------------- | --------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Khởi động và truy cập      | Splash/home, login, OIDC callback, flow, profile, not-found, role gate và deep-link scheme `horseracing`.                                                                         |
| Vai trò                    | Vet, groom, manager, owner, trainer; các màn hình dùng chung theo `[role]`.                                                                                                       |
| Ngựa và chuồng trại        | Horse list/detail, measurements, ownership, placement, pedigree, lifecycle, barn/stall management, stable care, incidents, inventory/supplies, daily fees, surcharges và reports. |
| Y tế                       | Medical workspace, cases, visits/edit, checkups, requests, costs, exam, injury lock và 3D injury mapper/WebView.                                                                  |
| Huấn luyện và đua          | Training plans/classes/sessions, participants/evaluations/trial results, video picker, live, race registration và racing screens.                                                 |
| Tác vụ, thông báo, dữ liệu | Alerts, groom tasks/report, billing, realtime, media upload/download, notifications và các service/API tương ứng.                                                                 |
| Native APIs                | Expo Notifications, Document Picker, Image Picker, FileSystem legacy API, Expo Video, WebView/3D assets, AsyncStorage, native gradient/SVG và linking.                            |

Source scan ghi nhận 73 static routes trong web export và 19 service modules dưới `src/services`. API layer dùng bearer token, refresh/retry, timeout/error mapping; API contract tests xác nhận endpoint, method, DTO/payload và response schema. Notification foreground handler đang đặt rõ `shouldShowBanner/list`, `sound=false`, `badge=false`, nên thay đổi default của SDK không làm đổi behavior đã cấu hình.

### Kết quả hồi quy

- Đã xác minh compile TypeScript, unit/API/navigation suite, iOS native compile/startup, Metro bundle iOS, Android JS export và web route export.
- Không phát hiện thay đổi hành vi API hoặc business logic. Không sửa backend.
- Lỗi runtime RN version mismatch ở lần mở đầu đến từ process Metro Expo 57 còn chạy trên port 8081. Process đó phục vụ JS 0.86.3 cho app native 0.88.0. Sau khi dừng process cũ, mở Metro SDK 58 và reload, màn hình đăng nhập render đúng.
- QA Simulator đã xác minh đăng nhập local, các thao tác ownership/lifecycle, huấn luyện/cảm biến/kết quả, bệnh án/ghim 3D/chi phí và chăm sóc/kho/phụ phí. Nút thời gian trên màn Groom từng còn disabled sau khi vào cửa sổ 15 phút; sau khi thêm đồng hồ cập nhật 15 giây, mở lại route và xác minh trạng thái sẵn sàng/bắt đầu đã hoạt động. Hai nút cảm biến live xếp dọc, không tràn ngang; đã gửi vọt nhịp tim `248 bpm / 16,8 m/s`, chạy 5 điểm tự động, dừng giả lập và hoàn tất lượt QA. Ca Anh Anh đã có lần tái khám thứ ba; cập nhật vết chân trước trái sang đã lành, chọn sức khỏe đủ điều kiện, preview xác nhận không còn vết chưa lành/yêu cầu chờ và bệnh án đóng lúc `09:44 26/10/2026`, tổng phí giữ `350.000 VND`. Nhãn dashboard live, chỉ số thể trạng và placeholder lý do đính chính cũng đã được thêm vào catalog/test. Chưa xác minh register, token refresh thực với server, push thật, upload video, Android native hoặc xếp ô B05. Những mục này tiếp tục được đánh dấu NOT VERIFIED thay vì PASS.
- Không có critical migration regression còn biết. Lint/format/i18n thất bại đã có trong baseline; không được coi là lỗi mới do migration.

## G. Performance Analysis

- Không có baseline đo thời gian cold start, memory, FPS, scroll latency hoặc network request count; các chỉ số này chưa được đo trước/sau.
- Android Hermes export có kích thước JS khoảng 5 MB; iOS bundle thành công qua 1.525 modules trong lần export cuối. Đây là số liệu bundle, không phải phép đo startup/performance.
- Web export sau nâng cấp dùng chunking khác baseline, vì vậy thời gian export/bundle trước và sau không được dùng để tuyên bố tăng tốc.
- Không quan sát thấy lỗi render/performance trên màn hình đăng nhập; chưa đo các màn hình nặng như danh sách dài hoặc 3D viewer.

## H. Final Assessment

### READY WITH LIMITATIONS

SDK 58 đã được cài đúng; dependency map/peer check, TypeScript, automated tests, web/Android JS export và iOS native Debug build/startup đều có bằng chứng PASS. Source thay đổi nhỏ, giữ nguyên business logic và route structure.

Không đánh dấu READY vì Android native build chưa có toolchain, các nhánh đăng ký/token refresh chưa được kiểm tra, EAS production build chưa được kiểm tra, và lần cuối Expo Doctor không thể hoàn tất hai check cần mạng. Lint và format toàn repo vẫn có baseline failures; catalog i18n hiện đạt.

## I. Remaining Actions

| Vấn đề                             | Mức độ / nguyên nhân                                                                 | Tái hiện / hành động                                                                                             | Ảnh hưởng release                                   |
| ---------------------------------- | ------------------------------------------------------------------------------------ | ---------------------------------------------------------------------------------------------------------------- | --------------------------------------------------- |
| Android native build chưa xác minh | Cao — máy không có JDK/Android SDK                                                   | Cài JDK và Android SDK tương thích SDK 58, cấu hình `ANDROID_HOME`, rồi chạy `pnpm android` trên emulator/device | Chưa thể phát hành Android an toàn                  |
| E2E còn một phần chưa xác minh     | Trung bình — local Simulator chưa chạy upload video hoặc xếp Bình Minh vào B05       | Chạy các nhánh còn lại trên môi trường QA non-production; kiểm tra thêm xử lý lỗi backend và media upload        | Cần hoàn tất trước release                          |
| EAS/production build chưa xác minh | Cao — không có `eas.json`/release profile ở baseline                                 | Thiết lập/kiểm tra profile và secret môi trường đúng quy trình dự án, chạy build release cho iOS/Android         | Chưa chứng minh khả năng release                    |
| Expo Doctor remote checks          | Trung bình — môi trường không resolve được `exp.host`                                | Chạy `pnpm dlx expo-doctor@latest` lại trong mạng có truy cập Expo API; dependency local và peer check hiện pass | Cần xác nhận trước khi chốt CI/release              |
| ESLint baseline                    | Trung bình — 26 errors/9 warnings trước và sau migration                             | `pnpm lint`; lên kế hoạch sửa riêng các hook/ref/purity findings hiện hữu                                        | `pnpm check` tiếp tục fail nếu lint là release gate |
| Formatting baseline                | Thấp — 55 file trước và sau migration                                                | `pnpm format:check`; xử lý formatting repo theo task riêng, tránh bulk rewrite trong migration này               | CI có thể fail nếu format là gate                   |
| Bản dịch tiếng Việt thiếu          | Đã xử lý các chuỗi phát hiện trong QA                                                | `pnpm check:i18n` đạt; tiếp tục ghi nhận chuỗi mới nếu phát hiện ở các màn chưa mở                               | Không còn lỗi catalog đã biết trong phạm vi đã quét |
| Native iOS warnings                | Thấp — generated provider báo `CoreModule` internal, linker bỏ qua duplicate `-lc++` | Theo dõi ở lần Xcode upgrade; hiện build có 0 errors và app khởi động được                                       | Chưa chặn Debug build; cần theo dõi khi archive     |

## Tài liệu tham khảo

- [Expo SDK upgrade walkthrough](https://docs.expo.dev/workflow/upgrading-expo-sdk-walkthrough/)
- [Expo SDK 58 release notes](https://expo.dev/changelog/sdk-58)
- [Expo SDK 58 compatibility matrix](https://docs.expo.dev/versions/v58.0.0/)
- [Expo SDK 58 Reanimated guide](https://docs.expo.dev/versions/v58.0.0/sdk/reanimated/)
- [React Native strict TypeScript API](https://reactnative.dev/docs/strict-typescript-api)
- [React Native WebView upstream TypeScript issue](https://github.com/react-native-webview/react-native-webview/issues/3970)
