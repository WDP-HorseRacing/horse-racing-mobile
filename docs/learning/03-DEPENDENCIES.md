# 03 — Dependency analysis

Version dưới đây là khai báo trong package.json hiện tại. Dấu ~ hoặc ^ là khoảng phiên bản semver; pnpm-lock.yaml khóa phiên bản cài cụ thể. Bảng tách thư viện dùng trực tiếp, dùng nền tảng/build và package chưa thấy import trực tiếp trong app/src.

## Runtime dependencies

| Dependency | Version | Purpose | Used in | Why it is needed / trạng thái |
|---|---:|---|---|---|
| expo | ~58.0.23 | Expo runtime/tooling | package scripts, app config | Chạy app native/web và tích hợp native modules |
| react | 19.3.0 | Component model, hooks | app/, src/ | UI và state |
| react-native | 0.88.1 | Native UI/runtime | app/, src/ | View, Text, Pressable, platform APIs |
| expo-router | ~58.0.30 | File-based navigation | app/ và useFocusEffect | Navigation theo file route |
| @expo/vector-icons | ^15.1.0 | Icon set | nhiều screens/components | Biểu tượng UI |
| @react-native-async-storage/async-storage | ^2.2.0 | Key-value local storage | AuthContext, I18n, login, metadata, push, recentHorses | Session/settings/local metadata |
| expo-asset | ~58.0.20 | Resolve/download bundled asset | Injury3DMapper | Đọc GLB và viewer bundle |
| expo-constants | ~58.0.15 | Expo host/config runtime | src/config/api.ts dùng require động | Tìm host IP khi URL cấu hình là localhost |
| expo-document-picker | ~58.0.4 | Chọn file | TrialVideoPicker, file/document workflows | Lấy media/document từ máy |
| expo-file-system | ~58.0.13 | Đọc file, binary upload | media.service, Injury3DMapper | Kích thước/read file và upload task; source dùng nhánh legacy |
| expo-image-picker | ^58.0.10 | Chụp/chọn ảnh | checklist, incident, horse photo | Bằng chứng ảnh và media hồ sơ |
| expo-notifications | ~58.1.8 | Permission, token, foreground handler | app/_layout, AuthContext, push-device.service | Đăng ký push token Android và cấu hình banner |
| expo-status-bar | ~58.0.4 | Status bar | app/_layout.tsx | Đổi kiểu theo theme |
| expo-video | ~58.0.13 | Phát video | app/owner/trial/[id].tsx | Xem video trial |
| react-native-safe-area-context | ~5.11.1 | Safe area | app layout, screens, modal | Tránh tai thỏ/home indicator |
| react-native-screens | ~4.30.1 | Native screen primitives | Expo Router/stack runtime | Hạ tầng navigation; không thấy import trực tiếp |
| react-native-webview | 14.0.1 | Nhúng web canvas | Injury3DMapper | Chạy viewer Three.js trong app native |
| three | 0.186.1 | 3D engine | injury-mapper/viewer-entry.ts | WebGL scene, camera, GLB, raycasting, marker |
| socket.io-client | ^4.8.4 | Realtime websocket client | src/services/realtime.service.ts | Subscribe event performance.metrics |
| react-native-gifted-charts | ^1.4.78 | Biểu đồ | performance, horse profile, chart components | Vẽ line/bar chart |
| react-native-web | ^0.21.4 | React Native web renderer | Expo web target | Runtime cho web; không thấy import app trực tiếp |
| react-dom | 19.3.0 | React DOM renderer | Expo web target | Hạ tầng web; không thấy import app trực tiếp |
| expo-linking | ~58.0.16 | Deep links/linking | Expo Router phụ thuộc | Không thấy import app trực tiếp |
| expo-font | ~58.0.11 | Font loading | app.json plugin | Plugin/platform setup; không thấy import app trực tiếp |
| expo-web-browser | ~58.0.7 | Browser auth/link handoff support | app.json plugin | Cấu hình Expo plugin; không thấy API gọi trực tiếp |
| expo-system-ui | ~58.0.7 | System UI integration | Không thấy source import/plugin trực tiếp | Được khai báo nhưng chưa thấy direct use |
| react-native-svg | 15.16.0 | Vector drawing | Không thấy source import trực tiếp; chart dependency có thể cần | Đã khai báo trực tiếp, có thể được chart dùng gián tiếp |
| react-native-linear-gradient | ^2.8.3 | Gradient views | Không thấy source import trực tiếp | Có vẻ chưa dùng trực tiếp |
| react-native-reanimated | 4.7.1 | Animation runtime | Không thấy source import trực tiếp | Animation thấy trong UI dùng Animated từ react-native core |
| react-native-worklets | 0.13.0 | Worklet runtime | Không thấy source import trực tiếp | Có thể phục vụ peer/runtime của Reanimated |

Các package được gắn plugin trong app.json gồm expo-router, expo-video, expo-image-picker, expo-notifications, expo-asset, expo-status-bar, expo-font và expo-web-browser. Plugin config khác với import API trực tiếp trong source.

## Development dependencies

| Dependency | Version | Purpose | Used in | Why it is needed / trạng thái |
|---|---:|---|---|---|
| typescript | ~6.0.3 | Type checking/compiler | pnpm typecheck, tsconfig | Kiểm tra type và build tooling |
| @types/react | ~19.3.0 | React declarations | TypeScript | Type cho React |
| @types/three | 0.186.0 | Three.js declarations | injury-coordinate.d.mts, viewer | Type cho 3D library |
| esbuild | 0.28.2 | Bundle viewer | scripts/build-injury-mapper.mjs | Tạo bundle browser IIFE từ viewer-entry |
| eslint | ^9.32.0 | Lint | eslint.config.js, scripts | Quy tắc code |
| eslint-config-expo | ~58.0.4 | Expo ESLint rules | eslint.config.js | Quy tắc cho Expo |
| eslint-config-prettier | ^10.1.8 | Tắt rule format trùng Prettier | eslint.config.js | Tránh xung đột lint/format |
| prettier | ^3.9.7 | Format check | .prettierrc, scripts | Định dạng code |

## Bên thứ ba và tài sản

- Three.js MIT: bundle giữ legal comments theo build config.
- `horse-anatomy-v2.glb`: asset third party CC-BY 4.0 theo `src/features/medical/injury-mapper/assets/THIRD_PARTY_ASSETS.md`.
- `horse-anatomy-v1.glb`: asset lịch sử, CC0 1.0; không phải model active theo import hiện tại.
- Backend/API và signed media storage là dịch vụ ngoài repo mobile; host mặc định trong `src/config/api.ts` là `https://api.horse.io.vn/api/v1`.

## Package khai báo nhưng chưa thấy dùng trực tiếp

`react-native-linear-gradient`, `react-native-reanimated`, `expo-system-ui` chưa có import trực tiếp trong app/src. `react-native-svg`, `react-native-worklets`, `expo-linking`, `expo-font`, `expo-web-browser`, `react-native-screens`, `react-native-web`, `react-dom` có thể phục vụ dependency/plugin/platform; không nên gỡ chỉ từ kết quả tìm import. Kiểm tra peer dependencies và native build trước khi kết luận chúng thừa.

## Lý do các thư viện quan trọng

- **Expo + React Native:** một codebase React/TypeScript tạo giao diện native; Expo cung cấp các module camera, file, notification, video, asset.
- **Expo Router:** URL/path phản ánh cấu trúc route, hỗ trợ dynamic route ID và navigation stack.
- **AsyncStorage:** lưu session/settings/metadata nhỏ qua lần mở app; không phải encrypted credential vault.
- **Three.js + WebView:** Three.js đã có WebGL renderer/browser API, còn WebView là vùng chạy browser embedded bên trong React Native. Giao tiếp qua JSON messages.
- **Socket.IO client:** kết nối event live; không thay REST cho phần tạo/lấy dữ liệu chính.
- **Gifted Charts:** component chart có sẵn để vẽ chuỗi metrics; app vẫn phải chuẩn hóa dữ liệu và nhãn.
- **Expo FileSystem:** đọc model dạng base64, kiểm tra file và PUT media trực tiếp tới URL upload ký sẵn.
- **esbuild:** build viewer browser riêng, độc lập với bundle React Native chính.

## Cách xác minh dependency khi phát triển

1. Xem khai báo trong package.json.
2. Tìm import/require trong app/, src/ và scripts/.
3. Kiểm tra app.json plugins và package native peers.
4. Nếu muốn gỡ, làm trong thay đổi riêng rồi chạy typecheck/lint/build/native checks phù hợp. Audit này không gỡ dependency và không chạy checks.
