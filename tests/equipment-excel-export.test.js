const assert = require("node:assert/strict");
const { createWorkbookBlob, columnName } = require("../xlsx-export.js");

function readStoredZipEntries(bytes) {
  const entries = new Map();
  let offset = 0;
  while (offset + 4 <= bytes.length && bytes.readUInt32LE(offset) === 0x04034b50) {
    const compressionMethod = bytes.readUInt16LE(offset + 8);
    const compressedSize = bytes.readUInt32LE(offset + 18);
    const fileNameLength = bytes.readUInt16LE(offset + 26);
    const extraLength = bytes.readUInt16LE(offset + 28);
    const fileNameStart = offset + 30;
    const dataStart = fileNameStart + fileNameLength + extraLength;
    const fileName = bytes.subarray(fileNameStart, fileNameStart + fileNameLength).toString("utf8");
    assert.equal(compressionMethod, 0, `${fileName} should use the supported stored ZIP method`);
    entries.set(fileName, bytes.subarray(dataStart, dataStart + compressedSize).toString("utf8"));
    offset = dataStart + compressedSize;
  }
  return entries;
}

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
  const entries = readStoredZipEntries(bytes);
  assert(entries.has("[Content_Types].xml"), "xlsx should include Office content types");
  assert(entries.has("xl/worksheets/sheet1.xml"), "xlsx should include a worksheet");
  assert(entries.get("docProps/core.xml").includes("</dc:creator>"), "core properties should have valid closing tags");
  assert(entries.get("docProps/app.xml").includes("<Application>Microsoft Excel</Application>"), "app properties should identify Excel");
  assert(entries.get("xl/workbook.xml").includes("<bookViews>"), "workbook should include a standard workbook view");
  assert(entries.get("xl/styles.xml").includes("<tableStyles"), "styles should include standard table style defaults");
  const worksheetXml = entries.get("xl/worksheets/sheet1.xml");
  assert(worksheetXml.includes("2026년 8월 전체 장비 가동률 현황표"), "xlsx should preserve Korean report titles");
  assert(worksheetXml.includes("AVERAGE(B5:C5)"), "xlsx should include auditable utilization formulas");
  assert(
    worksheetXml.indexOf("<autoFilter") < worksheetXml.indexOf("<mergeCells"),
    "worksheet elements should follow the Excel Open XML schema order"
  );
  assert(bytes.length > 5000, "xlsx should contain a complete workbook package");

  console.log("equipment excel export test passed");
})().catch((error) => {
  console.error(error);
  process.exitCode = 1;
});
