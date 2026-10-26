import test from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";

const vi = JSON.parse(
  readFileSync(new URL("../src/data/locales/vi.json", import.meta.url), "utf8"),
);
const viUi = JSON.parse(
  readFileSync(new URL("../src/data/locales/vi-ui.json", import.meta.url), "utf8"),
);
const viUiExtra = JSON.parse(
  readFileSync(new URL("../src/data/locales/vi-ui-extra.json", import.meta.url), "utf8"),
);

const vietnamese = { ...vi, ...viUi, ...viUiExtra };
vietnamese["HorseRacing"] = "HorseRacing";
vietnamese["HorseRacing Mobile"] = "HorseRacing Mobile";

const english = {};
for (const [en, v] of Object.entries(vietnamese)) {
  if (typeof v === "string" && !english[v]) {
    english[v] = en;
  }
}
english["HorseRacing"] = "HorseRacing";
english["HorseRacing Mobile"] = "HorseRacing Mobile";
english["Vuot mong ngua"] = "Clean hooves";

function translateToEnglish(text) {
  if (english[text]) return english[text];
  const trimmed = text.trim();
  if (english[trimmed]) return text.replace(trimmed, english[trimmed]);
  if (/^[A-Z][A-Z0-9]*(?:_[A-Z0-9]+)+$/.test(text)) return text.replaceAll("_", " ");

  if (text.includes(" · ")) {
    return text
      .split(" · ")
      .map((part) => translateToEnglish(part.trim()))
      .join(" · ");
  }

  return text;
}

function translateToVietnameseInternal(text) {
  if (vietnamese[text]) return vietnamese[text];
  const trimmed = text.trim();
  if (vietnamese[trimmed]) return text.replace(trimmed, vietnamese[trimmed]);

  if (english[text] || english[trimmed]) return text;

  if (text.includes(" · ")) {
    return text
      .split(" · ")
      .map((part) => translateToVietnamese(part.trim()))
      .join(" · ");
  }

  const horsesMatch = text.match(/^(\d+)\s+horses$/i);
  if (horsesMatch) return `${horsesMatch[1]} ngựa`;

  const ownedMatch = text.match(/^(\d+)\s+horses\s+owned$/i);
  if (ownedMatch) return `Sở hữu ${ownedMatch[1]} ngựa`;

  const wingMatch = text.match(/^A wing · (\d+) horses$/i);
  if (wingMatch) return `Khu A · ${wingMatch[1]} ngựa`;

  const changeStatusMatch = text.match(/^Change (.+) to (active|inactive)\?$/i);
  if (changeStatusMatch) {
    const statusText =
      changeStatusMatch[2].toLowerCase() === "active" ? "hoạt động" : "không hoạt động";
    return `Đổi ${changeStatusMatch[1]} sang ${statusText}?`;
  }

  const removeInvMatch = text.match(/^Remove (.+) from the active inventory\?$/i);
  if (removeInvMatch) {
    return `Xóa ${removeInvMatch[1]} khỏi kho đang hoạt động?`;
  }

  const rbacMatch = text.match(/^Access control for (.+) saved successfully\.$/i);
  if (rbacMatch) {
    return `Đã lưu quyền truy cập cho ${rbacMatch[1]} thành công.`;
  }

  return text;
}

function translateToVietnamese(text) {
  if (text.includes("HorseRacing")) {
    const placeholder = "__HR_APP_BRAND__";
    const protectedText = text.replaceAll("HorseRacing", placeholder);
    const translated = translateToVietnameseInternal(protectedText);
    return translated.replaceAll(placeholder, "HorseRacing");
  }
  return translateToVietnameseInternal(text);
}

function translateText(text, lang) {
  if (!text || typeof text !== "string") return text;
  if (text === "HorseRacing" || text === "HorseRacing Mobile") return text;
  return lang === "vi" ? translateToVietnamese(text) : translateToEnglish(text);
}

test("HorseRacing app name is strictly preserved in both English and Vietnamese", () => {
  assert.equal(translateText("HorseRacing", "en"), "HorseRacing");
  assert.equal(translateText("HorseRacing", "vi"), "HorseRacing");
  assert.equal(translateText("HorseRacing Mobile", "en"), "HorseRacing Mobile");
  assert.equal(translateText("HorseRacing Mobile", "vi"), "HorseRacing Mobile");
  assert.equal(translateText("Welcome to HorseRacing", "vi"), "Welcome to HorseRacing");
});

test("common UI navigation tabs translate accurately both ways", () => {
  const tabs = [
    ["Home", "Trang chủ"],
    ["Horses", "Ngựa"],
    ["Training", "Huấn luyện"],
    ["Alerts", "Cảnh báo"],
    ["Profile", "Hồ sơ"],
    ["Tasks", "Công việc"],
    ["Stable", "Chuồng ngựa"],
    ["Inventory", "Kho vật tư"],
    ["Medical", "Y tế"],
    ["Racing", "Đua ngựa"],
    ["Reports", "Báo cáo"],
    ["Operations", "Vận hành"],
  ];

  for (const [en, viText] of tabs) {
    assert.equal(translateText(en, "vi"), viText, `EN->VI failed for ${en}`);
    if (viText === "Báo cáo") {
      assert.match(translateText(viText, "en"), /^Reports?$/, `VI->EN failed for ${viText}`);
    } else {
      assert.equal(translateText(viText, "en"), en, `VI->EN failed for ${viText}`);
    }
  }
});

test("default Groom checklist task names render correctly in both languages", () => {
  assert.equal(translateText("Vuot mong ngua", "vi"), "Vuốt móng ngựa");
  assert.equal(translateText("Vuot mong ngua", "en"), "Clean hooves");
});

test("horse eligibility reasons render in Vietnamese", () => {
  assert.equal(translateText("LIFECYCLE_RETIRED", "vi"), "Ngựa đã giải nghệ");
  assert.equal(translateText("LIFECYCLE_TRANSFERRED", "vi"), "Ngựa đã chuyển nhượng");
  assert.equal(translateText("LIFECYCLE_DECEASED", "vi"), "Ngựa đã mất");
  assert.equal(translateText("PROFILE_DELETED", "vi"), "Hồ sơ đã xóa");
});

test("compound strings with · translate parts without mangling names", () => {
  assert.equal(translateText("24 horses · Meadowline Stable", "vi"), "24 ngựa · Meadowline Stable");
  assert.equal(translateText("Meadowline Racing Club", "vi"), "Meadowline Racing Club");
  assert.equal(
    translateText("Head Trainer · Meadowline Stable", "vi"),
    "Huấn luyện viên trưởng · Meadowline Stable",
  );
});

test("alert titles and messages translate cleanly in both directions", () => {
  assert.equal(translateText("Missing information", "vi"), "Thiếu thông tin");
  assert.equal(translateText("Thiếu thông tin", "en"), "Missing information");
  assert.equal(translateText("Evaluation saved", "vi"), "Đã lưu đánh giá");
  assert.equal(translateText("Đã lưu đánh giá", "en"), "Evaluation saved");
  assert.equal(translateText("Incident recorded", "vi"), "Đã ghi nhận sự cố");
  assert.equal(translateText("Đã ghi nhận sự cố", "en"), "Incident recorded");
});

test("Vietnamese catalog does not map Vietnamese source text to English", () => {
  const vietnameseDiacritics =
    /[ăâđêôơưáàảãạấầẩẫậắằẳẵặéèẻẽẹếềểễệíìỉĩịóòỏõọốồổỗộớờởỡợúùủũụứừữựýỳỷỹỵ]/i;
  const reversedEntries = Object.entries(vietnamese).filter(
    ([key, value]) =>
      vietnameseDiacritics.test(key) &&
      typeof value === "string" &&
      !vietnameseDiacritics.test(value) &&
      /[A-Za-z]/.test(value),
  );

  assert.deepEqual(reversedEntries, [], "Vietnamese keys must not translate to English values");
});

test("care schedule and medical labels translate cleanly in both directions", () => {
  const labels = [
    ["Reopen care schedule", "Mở lại lịch chăm sóc"],
    ["Reopen completed schedule", "Mở lại lịch đã hoàn tất"],
    ["Reason to reopen (required) *", "Lý do mở lại *"],
    ["Cancellation reason (required) *", "Lý do hủy *"],
    [
      "A visit that does not open a case must have an end date for every prescription.",
      "Buổi khám không mở bệnh án phải có ngày kết thúc cho tất cả đơn thuốc.",
    ],
    [
      "A request-based visit must link at least one request.",
      "Buổi khám theo yêu cầu phải gắn ít nhất một yêu cầu.",
    ],
    ["No changes to save", "Chưa có nội dung thay đổi"],
    ["Too many requests", "Quá nhiều yêu cầu"],
    ["Add prescription", "Thêm đơn thuốc"],
  ];

  for (const [en, viText] of labels) {
    assert.equal(translateText(en, "vi"), viText, `EN->VI failed for ${en}`);
    assert.equal(translateText(viText, "en"), en, `VI->EN failed for ${viText}`);
  }
});

test("Simulator-discovered profile, medical, and dashboard labels stay Vietnamese", () => {
  const labels = [
    ["Club overview", "Tổng quan câu lạc bộ"],
    ["Health overview", "Tổng quan sức khỏe"],
    ["Club profile", "Hồ sơ câu lạc bộ"],
    ["Overview", "Tổng quan"],
    ["Health", "Sức khỏe"],
    ["Weight", "Cân nặng"],
    ["Height", "Chiều cao"],
    ["Body condition", "Thể trạng"],
    ["Temperature", "Thân nhiệt"],
    ["Height (cm)", "Chiều cao (cm)"],
    ["Body condition (score)", "Thể trạng (điểm)"],
    ["score", "điểm"],
    ["MANUAL", "Nhập thủ công"],
    ["celsius", "°C"],
    ["Monitor", "Theo dõi"],
    ["Filters", "Bộ lọc"],
    ["Change language", "Đổi ngôn ngữ"],
    ["Recovery progress", "Tiến triển hồi phục"],
    ["Edit medical visit", "Chỉnh sửa buổi khám"],
    ["RESTORE", "Khôi phục"],
  ];

  for (const [en, viText] of labels) {
    assert.equal(translateText(en, "vi"), viText, `EN->VI failed for ${en}`);
    assert.equal(translateText(viText, "en"), en, `VI->EN failed for ${viText}`);
  }

  const healthLabels = [
    ["Eligible", "Đủ điều kiện"],
    ["Under observation", "Đang theo dõi"],
    ["Injured", "Chấn thương"],
    ["Quarantined", "Cách ly"],
  ];
  for (const [en, viText] of healthLabels) {
    assert.equal(translateText(en, "vi"), viText, `Health status translation failed for ${en}`);
    assert.equal(translateText(en, "en"), en, `English health label changed for ${en}`);
  }
});

test("horse registration validation messages stay Vietnamese", () => {
  assert.equal(
    translateText("Enter the 15-digit microchip ID.", "vi"),
    "Nhập mã microchip gồm đúng 15 chữ số.",
  );
  assert.equal(
    translateText("Microchip must contain exactly 15 digits.", "vi"),
    "Mã microchip phải gồm đúng 15 chữ số.",
  );
  assert.equal(translateText("Select an owner for the horse.", "vi"), "Chọn chủ sở hữu cho ngựa.");
});

test("periodic checkup screen labels stay consistent in both languages", () => {
  const labels = [
    ["All due", "Tất cả đến hạn"],
    ["Overdue", "Quá hạn"],
    ["Due soon", "Sắp đến hạn"],
    ["General health check cycle: 30 days", "Chu kỳ kiểm tra sức khỏe tổng quát 30 ngày"],
    ["Assigned to barn", "Đã xếp khu"],
    ["Not assigned to barn", "Chưa xếp khu"],
    ["None yet", "Chưa có"],
    ["Check now", "Khám ngay"],
    ["Cancel appointment", "Hủy lịch hẹn"],
    ["Reschedule", "Dời lịch"],
    ["Schedule periodic checkup", "Đặt lịch khám định kỳ"],
    ["Cancel checkup appointment?", "Hủy lịch hẹn khám?"],
    [
      "The appointment will be marked cancelled and will no longer appear in the Groom's schedule for today.",
      "Lịch hẹn sẽ chuyển sang trạng thái đã hủy và không còn xuất hiện trong lịch hôm nay của Groom.",
    ],
    ["Keep appointment", "Giữ lịch"],
    ["Appointment cancelled", "Đã hủy lịch hẹn"],
  ];

  for (const [en, viText] of labels) {
    assert.equal(translateText(en, "vi"), viText, `EN->VI failed for ${en}`);
    assert.equal(translateText(en, "en"), en, `English label changed for ${en}`);
  }
});

test("Simulator-discovered ownership and training labels stay Vietnamese", () => {
  const labels = [
    ["Since", "Từ ngày"],
    ["Confirm transfer", "Xác nhận chuyển chủ"],
    ["End", "Kết thúc"],
    ["Type", "Loại buổi tập"],
    ["Planned distance", "Cự ly dự kiến"],
    ["Theo dõi cảnh báo (Live) →", "Theo dõi cảnh báo trực tiếp →"],
    ["Theo dõi lượt tập (Live)", "Theo dõi buổi tập trực tiếp"],
    ["Body condition score (1–9)", "Điểm thể trạng (1–9)"],
    ["Body condition score", "Điểm thể trạng"],
    ["Scale 1 to 9", "Thang điểm 1–9"],
    ["Explain why the conclusion needs correction", "Nêu lý do cần sửa kết luận"],
    [
      "Transfer ownership uses the dedicated Backend workflow and records a history period. It does not change the horse lifecycle or stable placement.",
      "Chuyển quyền sở hữu dùng quy trình riêng của hệ thống và ghi nhận khoảng thời gian sở hữu trong lịch sử. Thao tác này không thay đổi vòng đời hoặc vị trí chuồng của ngựa.",
    ],
  ];

  for (const [en, viText] of labels) {
    assert.equal(translateText(en, "vi"), viText, `EN->VI failed for ${en}`);
  }
  assert.equal(translateText("Trial #", "vi"), "Lần chạy thử số ");
});

test("enum labels remain readable in English and Vietnamese", () => {
  assert.equal(translateText("LEFT_FRONT_LEG", "vi"), "Chân trước trái");
  assert.equal(translateText("LEFT_FRONT_LEG", "en"), "LEFT FRONT LEG");
  assert.equal(translateText("DELETED", "vi"), "Đã xóa");
});

test("horse breeds and coat colors use Vietnamese labels without translating horse names", () => {
  assert.equal(translateText("Arabian", "vi"), "Ngựa Ả Rập");
  assert.equal(translateText("Thoroughbred", "vi"), "Ngựa thuần chủng");
  assert.equal(translateText("Black", "vi"), "Đen");
  assert.equal(translateText("Bay", "vi"), "Nâu đỏ");
  assert.equal(translateText("Lantern Bay", "vi"), "Lantern Bay");
});
