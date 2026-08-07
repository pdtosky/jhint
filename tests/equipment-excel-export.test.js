const assert = require("node:assert/strict");
const { createWorkbookBlob, columnName } = require("../xlsx-export.js");

(async () => {
  assert.equal(columnName(1), "A");
  assert.equal(columnName(27), "AA");

  const blob = createWorkbookBlob({
    sheetName: "8월 장비가동률",
    title: "2026년 8월 전체 장비 가동률 현황표",
    subtitle: "근무일 하루 8시간 기준",
    headers: ["일자", "고속1호", "고속2호", "전체"],
    rows: [[
      { value: "2026. 08. 03. 월요일", style: "text" },
      { value: 0.8, type: "number", style: "percentHigh" },
      { value: 0.5, type: "number", style: "percentMedium" },
      { value: 0.65, type: "number", style: "percentMedium", formula: "AVERAGE(B5:C5)" }
    ]],
    footer: [
      { value: "월 가동률", style: "footerText" },
      { value: 0.8, type: "number", style: "footerPercent", formula: "AVERAGE(B5:B5)" },
      { value: 0.5, type: "number", style: "footerPercent", formula: "AVERAGE(C5:C5)" },
      { value: 0.65, type: "number", style: "footerPercent", formula: "AVERAGE(B6:C6)" }
    ],
    columnWidths: [18, 12, 12, 12]
  });

  assert.equal(blob.type, "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet");
  const bytes = Buffer.from(await blob.arrayBuffer());
  assert.equal(bytes.subarray(0, 2).toString("ascii"), "PK", "xlsx should be a real ZIP-based workbook");
  const binaryText = bytes.toString("utf8");
  assert(binaryText.includes("[Content_Types].xml"), "xlsx should include Office content types");
  assert(binaryText.includes("xl/worksheets/sheet1.xml"), "xlsx should include a worksheet");
  assert(binaryText.includes("2026년 8월 전체 장비 가동률 현황표"), "xlsx should preserve Korean report titles");
  assert(binaryText.includes("AVERAGE(B5:C5)"), "xlsx should include auditable utilization formulas");
  assert(bytes.length > 5000, "xlsx should contain a complete workbook package");

  console.log("equipment excel export test passed");
})().catch((error) => {
  console.error(error);
  process.exitCode = 1;
});
