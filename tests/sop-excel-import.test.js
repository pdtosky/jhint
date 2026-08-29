const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");
const importer = require("../sop/xlsx-import.js");

const sheets = {
  기본정보: [
    ["기본정보"],
    ["업체명*", "제품명*", "공정명*", "장비명", "제정일자", "작성자*", "Rev", "비고"],
    ["스타리온", "NX5e PHEV PU SLAB", "타발", "고속프레스 5조 라인", "2026-03-09", "이종규", "0", "원단 상태 확인"],
  ],
  작업순서: [
    ["작업순서"],
    ["순서*", "작업명*", "작업내용*", "주의/확인"],
    [1, "합지", "원단 합지", "울음 확인"],
    [2, "타발", "피딩 20 타발", "피딩 확인"],
  ],
  공정조건: [
    ["공정조건"],
    ["번호*", "관리항목*", "관리기준*", "방법", "기록", "이상조치방법*"],
    [1, "이송거리", 20, "작업표준서", "생산체크시트", "관리자 보고"],
  ],
  BOM: [
    ["BOM"],
    ["No.*", "원단명*", "재단폭", "비고"],
    [1, "NITTO 5610", 110, ""],
  ],
  수정이력: [
    ["수정이력"],
    ["수정일자", "작성자*", "수정내용*", "Rev"],
    ["2026.03.09", "이종규", "최초제정", 0],
  ],
};

const parsed = importer.buildSopFromSheets(sheets, { today: "2026-08-29" });
assert.equal(parsed.sop.basic.vendor, "스타리온");
assert.equal(parsed.sop.basic.product, "NX5e PHEV PU SLAB");
assert.equal(parsed.sop.basic.establishedDate, "2026-03-09");
assert.equal(parsed.sop.document.managementNo, "", "the browser must allocate a fresh management number");
assert.equal(parsed.sop.document.status, "임시저장", "Excel imports must never publish automatically");
assert.equal(parsed.sop.workSequence.length, 2);
assert.equal(parsed.sop.processConditions[0].standard, "20");
assert.equal(parsed.sop.bom[0].width, "110");
assert.equal(parsed.sop.revisionHistory[0].date, "2026-03-09");
assert(parsed.warnings.some((warning) => warning.includes("사진")), "attachment limitation should be explicit");

assert.throws(
  () => importer.buildSopFromSheets({ ...sheets, 기본정보: [["업체명*", "제품명*", "공정명*", "장비명", "제정일자", "작성자*", "Rev", "비고"], ["", "제품", "공정", "", "", "작성자", "0", ""]] }),
  /업체명 항목이 비어/,
  "required basic fields should block import"
);

const sopIndex = fs.readFileSync(path.join(__dirname, "../sop/index.html"), "utf8");
const sopApp = fs.readFileSync(path.join(__dirname, "../sop/app.js"), "utf8");
const serviceWorker = fs.readFileSync(path.join(__dirname, "../sw.js"), "utf8");
assert(sopIndex.includes('src="xlsx-import.js"'), "the XLSX importer must load before the SOP app");
assert(sopApp.includes('data-action="select-excel-import"'), "the admin page should expose an Excel import button");
assert(sopApp.includes("getNextManagementNo(sops)"), "imports should receive the next available management number");
assert(sopApp.includes("내용 확인 후 임시저장 등록"), "imports should require an explicit save after preview");
assert(serviceWorker.includes('"/sop/xlsx-import.js"'), "the importer should work in the installed PWA cache");

console.log("sop-excel-import.test.js passed");
