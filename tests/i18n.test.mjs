import test from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";

const vi = JSON.parse(
  readFileSync(new URL("../src/data/locales/vi.json", import.meta.url), "utf8"),
);
const viUi = JSON.parse(
  readFileSync(new URL("../src/data/locales/vi-ui.json", import.meta.url), "utf8"),
);

const vietnamese = { ...vi, ...viUi };
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

function translateToEnglish(text) {
  if (english[text]) return english[text];
  const trimmed = text.trim();
  if (english[trimmed]) return text.replace(trimmed, english[trimmed]);

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
