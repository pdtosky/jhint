(function (root, factory) {
  const api = factory();
  if (typeof module === "object" && module.exports) module.exports = api;
  if (root) root.SOP_XLSX_IMPORTER = api;
})(typeof globalThis !== "undefined" ? globalThis : this, function () {
  "use strict";

  const REQUIRED_SHEETS = ["기본정보", "작업순서", "공정조건", "BOM", "수정이력"];

  function decodeXml(value) {
    return String(value || "")
      .replace(/&#(\d+);/g, (_, code) => String.fromCodePoint(Number(code)))
      .replace(/&#x([0-9a-f]+);/gi, (_, code) => String.fromCodePoint(parseInt(code, 16)))
      .replace(/&lt;/g, "<")
      .replace(/&gt;/g, ">")
      .replace(/&quot;/g, '"')
      .replace(/&apos;/g, "'")
      .replace(/&amp;/g, "&");
  }

  function getAttribute(tag, name) {
    const match = String(tag || "").match(new RegExp(`(?:^|\\s)${name}=(?:"([^"]*)"|'([^']*)')`));
    return decodeXml(match ? (match[1] ?? match[2] ?? "") : "");
  }

  function columnIndex(reference) {
    const letters = String(reference || "").match(/^[A-Z]+/i)?.[0]?.toUpperCase() || "A";
    return [...letters].reduce((value, char) => value * 26 + char.charCodeAt(0) - 64, 0) - 1;
  }

  function readTextNodes(xml) {
    return [...String(xml || "").matchAll(/<(?:[\w-]+:)?t\b[^>]*>([\s\S]*?)<\/(?:[\w-]+:)?t>/gi)]
      .map((match) => decodeXml(match[1]))
      .join("");
  }

  function parseSharedStrings(xml) {
    return [...String(xml || "").matchAll(/<(?:[\w-]+:)?si\b[^>]*>([\s\S]*?)<\/(?:[\w-]+:)?si>/gi)]
      .map((match) => readTextNodes(match[1]));
  }

  function parseWorksheetXml(xml, sharedStrings = []) {
    const rows = [];
    const rowMatches = [...String(xml || "").matchAll(/<(?:[\w-]+:)?row\b[^>]*>([\s\S]*?)<\/(?:[\w-]+:)?row>/gi)];
    rowMatches.forEach((rowMatch) => {
      const row = [];
      let sequentialColumn = 0;
      const cells = [...rowMatch[1].matchAll(/<(?:[\w-]+:)?c\b([^>]*)>([\s\S]*?)<\/(?:[\w-]+:)?c>/gi)];
      cells.forEach((cellMatch) => {
        const attributes = cellMatch[1];
        const body = cellMatch[2];
        const reference = getAttribute(attributes, "r");
        const index = reference ? columnIndex(reference) : sequentialColumn;
        sequentialColumn = index + 1;
        const type = getAttribute(attributes, "t");
        const rawValue = body.match(/<(?:[\w-]+:)?v\b[^>]*>([\s\S]*?)<\/(?:[\w-]+:)?v>/i)?.[1] ?? "";
        let value = "";
        if (type === "s") value = sharedStrings[Number(rawValue)] ?? "";
        else if (type === "inlineStr") value = readTextNodes(body);
        else if (type === "str") value = decodeXml(rawValue);
        else if (type === "b") value = rawValue === "1";
        else if (rawValue !== "" && Number.isFinite(Number(rawValue))) value = Number(rawValue);
        else value = decodeXml(rawValue);
        row[index] = value;
      });
      rows.push(row);
    });
    return rows;
  }

  function normalizePath(path) {
    const parts = [];
    String(path || "").replace(/\\/g, "/").split("/").forEach((part) => {
      if (!part || part === ".") return;
      if (part === "..") parts.pop();
      else parts.push(part);
    });
    return parts.join("/");
  }

  async function inflateRaw(bytes) {
    if (typeof DecompressionStream !== "function") {
      throw new Error("이 브라우저에서는 압축된 엑셀 파일을 읽을 수 없습니다. 최신 Chrome 또는 Edge에서 다시 시도해 주세요.");
    }
    const stream = new Blob([bytes]).stream().pipeThrough(new DecompressionStream("deflate-raw"));
    return new Uint8Array(await new Response(stream).arrayBuffer());
  }

  function findEndOfCentralDirectory(view) {
    const minimum = Math.max(0, view.byteLength - 65557);
    for (let offset = view.byteLength - 22; offset >= minimum; offset -= 1) {
      if (view.getUint32(offset, true) === 0x06054b50) return offset;
    }
    throw new Error("올바른 XLSX 파일이 아닙니다.");
  }

  async function unzip(arrayBuffer) {
    const bytes = new Uint8Array(arrayBuffer);
    const view = new DataView(arrayBuffer);
    const decoder = new TextDecoder("utf-8");
    const eocd = findEndOfCentralDirectory(view);
    const totalEntries = view.getUint16(eocd + 10, true);
    let offset = view.getUint32(eocd + 16, true);
    const files = new Map();

    for (let entry = 0; entry < totalEntries; entry += 1) {
      if (view.getUint32(offset, true) !== 0x02014b50) throw new Error("엑셀 압축 목록이 손상되었습니다.");
      const method = view.getUint16(offset + 10, true);
      const compressedSize = view.getUint32(offset + 20, true);
      const fileNameLength = view.getUint16(offset + 28, true);
      const extraLength = view.getUint16(offset + 30, true);
      const commentLength = view.getUint16(offset + 32, true);
      const localOffset = view.getUint32(offset + 42, true);
      const fileName = normalizePath(decoder.decode(bytes.subarray(offset + 46, offset + 46 + fileNameLength)));
      if (view.getUint32(localOffset, true) !== 0x04034b50) throw new Error("엑셀 내부 파일이 손상되었습니다.");
      const localNameLength = view.getUint16(localOffset + 26, true);
      const localExtraLength = view.getUint16(localOffset + 28, true);
      const dataStart = localOffset + 30 + localNameLength + localExtraLength;
      const compressed = bytes.slice(dataStart, dataStart + compressedSize);
      let content;
      if (method === 0) content = compressed;
      else if (method === 8) content = await inflateRaw(compressed);
      else throw new Error(`지원하지 않는 엑셀 압축 방식입니다. (${method})`);
      files.set(fileName, content);
      offset += 46 + fileNameLength + extraLength + commentLength;
    }
    return files;
  }

  function xmlText(files, path) {
    const bytes = files.get(normalizePath(path));
    return bytes ? new TextDecoder("utf-8").decode(bytes) : "";
  }

  function parseWorkbookSheets(workbookXml, relationshipsXml) {
    const relationships = new Map();
    [...relationshipsXml.matchAll(/<Relationship\b([^>]*)\/?>(?:<\/Relationship>)?/gi)].forEach((match) => {
      relationships.set(getAttribute(match[1], "Id"), getAttribute(match[1], "Target"));
    });
    return [...workbookXml.matchAll(/<(?:[\w-]+:)?sheet\b([^>]*)\/?>(?:<\/(?:[\w-]+:)?sheet>)?/gi)].map((match) => {
      const target = relationships.get(getAttribute(match[1], "r:id")) || "";
      return {
        name: getAttribute(match[1], "name"),
        path: normalizePath(target.startsWith("/") ? target : `xl/${target}`),
      };
    });
  }

  async function readWorkbook(fileOrBuffer) {
    const arrayBuffer = fileOrBuffer instanceof ArrayBuffer
      ? fileOrBuffer
      : await fileOrBuffer.arrayBuffer();
    const files = await unzip(arrayBuffer);
    const workbookXml = xmlText(files, "xl/workbook.xml");
    const relationshipsXml = xmlText(files, "xl/_rels/workbook.xml.rels");
    if (!workbookXml || !relationshipsXml) throw new Error("엑셀 통합문서 정보를 찾을 수 없습니다.");
    const sharedStrings = parseSharedStrings(xmlText(files, "xl/sharedStrings.xml"));
    const sheets = {};
    parseWorkbookSheets(workbookXml, relationshipsXml).forEach(({ name, path }) => {
      const sheetXml = xmlText(files, path);
      if (sheetXml) sheets[name] = parseWorksheetXml(sheetXml, sharedStrings);
    });
    return sheets;
  }

  function normalizeHeader(value) {
    return String(value ?? "").replace(/\*/g, "").replace(/\s+/g, "").replace(/[.]/g, "").toLowerCase();
  }

  function isBlank(value) {
    return value === null || value === undefined || String(value).trim() === "";
  }

  function trimValue(value) {
    return isBlank(value) ? "" : String(value).trim();
  }

  function excelDate(value) {
    if (isBlank(value)) return "";
    if (typeof value === "number" && value > 1000) {
      const date = new Date(Date.UTC(1899, 11, 30) + Math.round(value) * 86400000);
      return date.toISOString().slice(0, 10);
    }
    const text = trimValue(value).replace(/[.]/g, "-").replace(/\s+/g, "");
    const match = text.match(/^(\d{4})-(\d{1,2})-(\d{1,2})$/);
    return match ? `${match[1]}-${match[2].padStart(2, "0")}-${match[3].padStart(2, "0")}` : text;
  }

  function findTable(rows, expectedHeaders) {
    const normalizedExpected = expectedHeaders.map(normalizeHeader);
    const headerIndex = rows.findIndex((row) => {
      const normalizedRow = (row || []).map(normalizeHeader);
      return normalizedExpected.every((header) => normalizedRow.includes(header));
    });
    if (headerIndex < 0) throw new Error(`필수 열을 찾을 수 없습니다: ${expectedHeaders.join(", ")}`);
    const header = (rows[headerIndex] || []).map(normalizeHeader);
    const indexes = normalizedExpected.map((name) => header.indexOf(name));
    const data = [];
    for (let index = headerIndex + 1; index < rows.length; index += 1) {
      const row = rows[index] || [];
      const selected = indexes.map((column) => row[column]);
      if (selected.every(isBlank)) continue;
      data.push(selected);
    }
    return data;
  }

  function requireValue(value, label) {
    const result = trimValue(value);
    if (!result) throw new Error(`${label} 항목이 비어 있습니다.`);
    return result;
  }

  function buildSopFromSheets(sheets, options = {}) {
    const missing = REQUIRED_SHEETS.filter((name) => !Array.isArray(sheets[name]));
    if (missing.length) throw new Error(`필수 시트가 없습니다: ${missing.join(", ")}`);

    const basicRow = findTable(sheets["기본정보"], ["업체명", "제품명", "공정명", "장비명", "제정일자", "작성자", "Rev", "비고"])[0] || [];
    const workRows = findTable(sheets["작업순서"], ["순서", "작업명", "작업내용", "주의/확인"]);
    const processRows = findTable(sheets["공정조건"], ["번호", "관리항목", "관리기준", "방법", "기록", "이상조치방법"]);
    const bomRows = findTable(sheets.BOM, ["No", "원단명", "재단폭", "비고"]);
    const revisionRows = findTable(sheets["수정이력"], ["수정일자", "작성자", "수정내용", "Rev"]);

    const basic = {
      vendor: requireValue(basicRow[0], "업체명"),
      product: requireValue(basicRow[1], "제품명"),
      process: requireValue(basicRow[2], "공정명"),
      equipment: trimValue(basicRow[3]),
      establishedDate: excelDate(basicRow[4]),
      note: trimValue(basicRow[7]),
    };
    const author = requireValue(basicRow[5], "작성자");
    const warnings = [];
    if (!workRows.length) warnings.push("작업순서가 없습니다.");
    if (!processRows.length) warnings.push("공정조건이 없습니다.");
    warnings.push("엑셀 안의 사진과 도면은 자동 등록되지 않으므로 첨부자료에서 별도로 추가해 주세요.");

    const sop = {
      document: {
        managementNo: "",
        rev: trimValue(basicRow[6]) || "0",
        registeredDate: options.today || new Date().toISOString().slice(0, 10),
        author,
        status: "임시저장",
        updatedAt: "",
      },
      basic,
      workSequence: workRows.map((row) => ({ order: trimValue(row[0]), name: trimValue(row[1]), detail: trimValue(row[2]), check: trimValue(row[3]) })),
      processConditions: processRows.map((row) => ({ no: trimValue(row[0]), item: trimValue(row[1]), standard: trimValue(row[2]), method: trimValue(row[3]), record: trimValue(row[4]), action: trimValue(row[5]) })),
      bom: bomRows.map((row) => ({ no: trimValue(row[0]), material: trimValue(row[1]), width: trimValue(row[2]), note: trimValue(row[3]) })),
      attachments: { files: [] },
      productionChecklist: [],
      moldLedger: { info: {}, history: [] },
      revisionHistory: revisionRows.map((row) => ({ date: excelDate(row[0]), author: trimValue(row[1]), detail: trimValue(row[2]), rev: trimValue(row[3]) })),
    };

    return {
      sop,
      warnings,
      counts: {
        workSequence: sop.workSequence.length,
        processConditions: sop.processConditions.length,
        bom: sop.bom.length,
        revisionHistory: sop.revisionHistory.length,
      },
    };
  }

  async function parseSopWorkbook(file, options = {}) {
    return buildSopFromSheets(await readWorkbook(file), options);
  }

  return { buildSopFromSheets, excelDate, parseSopWorkbook, parseWorksheetXml, readWorkbook };
});
