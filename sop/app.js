const adminView = document.getElementById("adminView");
const workerView = document.getElementById("workerView");

const emptySop = {
  document: { managementNo: "", rev: "", registeredDate: "", author: "", status: "임시저장", updatedAt: "" },
  basic: { vendor: "", product: "", process: "", equipment: "", establishedDate: "", note: "" },
  workSequence: [{ order: "", name: "", detail: "", check: "" }],
  processConditions: [{ no: "", item: "", standard: "", method: "", record: "", action: "" }],
  bom: [{ no: "", material: "", width: "", note: "" }],
  attachments: { files: [] },
  productionChecklist: [{ no: "", item: "", standard: "", checkMethod: "", record: "" }],
  moldLedger: {
    info: { moldNo: "", moldName: "", location: "", status: "", lastCheckedDate: "", manager: "" },
    history: [{ date: "", type: "", detail: "", manager: "", nextAction: "" }]
  },
  revisionHistory: [{ date: "", author: "", detail: "", rev: "" }]
};

function hydrateSop(sop = {}) {
  const base = structuredClone(emptySop);
  return {
    ...base,
    ...sop,
    document: { ...base.document, ...(sop.document || {}) },
    basic: { ...base.basic, ...(sop.basic || {}) },
    attachments: { ...base.attachments, ...(sop.attachments || {}) },
    moldLedger: {
      info: { ...base.moldLedger.info, ...((sop.moldLedger && sop.moldLedger.info) || {}) },
      history: (sop.moldLedger && sop.moldLedger.history) || base.moldLedger.history
    }
  };
}

let currentSop = hydrateSop(emptySop);
let adminSearchResults = [];
let adminSearchTerm = "";
let adminWorkRecords = [];
let pendingConfirm = null;
let isAdminLoggedIn = Boolean(window.SOP_BRIDGE?.isAdminLoggedIn?.());
const ADMIN_ID = "tape@jhint.net";
const ADMIN_PASSWORD = "jhint2233!!";
const SOP_MANAGEMENT_PREFIX = "JH-PRD-WS";

document.getElementById("adminTab").addEventListener("click", openAdminView);
document.getElementById("workerTab").addEventListener("click", () => showView("worker"));

function showView(view) {
  adminView.hidden = view !== "admin";
  workerView.hidden = view !== "worker";
}

async function openAdminView() {
  if (!isAdminLoggedIn && window.SOP_BRIDGE?.isAdminLoggedIn?.()) {
    isAdminLoggedIn = true;
  }
  if (!isAdminLoggedIn) {
    showToast("생산일정관리에서 관리자 로그인 후 사용할 수 있습니다.", "error");
    return;
  }
  showView("admin");
}

function escapeHtml(value) {
  return String(value || "").replace(/[&<>"']/g, (char) => ({
    "&": "&amp;",
    "<": "&lt;",
    ">": "&gt;",
    '"': "&quot;",
    "'": "&#039;"
  }[char]));
}

function cellInput(path, value = "", placeholder = "") {
  return `<input data-path="${path}" value="${escapeHtml(value)}" placeholder="${escapeHtml(placeholder)}">`;
}

function formatDateTime(value) {
  if (!value) return "";
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return value;
  return new Intl.DateTimeFormat("ko-KR", {
    year: "numeric",
    month: "long",
    day: "numeric",
    hour: "2-digit",
    minute: "2-digit",
    hour12: false
  }).format(date);
}

function todayInputValue() {
  const date = new Date();
  const month = String(date.getMonth() + 1).padStart(2, "0");
  const day = String(date.getDate()).padStart(2, "0");
  return `${date.getFullYear()}-${month}-${day}`;
}

function hasSopDraftContent(sop = currentSop) {
  return Boolean(
    sop?.id ||
    String(sop?.document?.managementNo || "").trim() ||
    String(sop?.basic?.vendor || "").trim() ||
    String(sop?.basic?.product || "").trim() ||
    String(sop?.basic?.process || "").trim()
  );
}

function createNewSopDraft(managementNo = "") {
  const previousAuthor = String(currentSop?.document?.author || "").trim();
  currentSop = hydrateSop(emptySop);
  currentSop.document.managementNo = String(managementNo || "").trim();
  currentSop.document.registeredDate = todayInputValue();
  currentSop.document.author = previousAuthor;
  adminWorkRecords = [];
  adminSearchTerm = "";
}

async function startNewSopDocument({ confirmDiscard = true } = {}) {
  if (confirmDiscard && hasSopDraftContent() && !currentSop.id) {
    const ok = await showConfirmDialog({
      title: "새 작업표준서를 작성할까요?",
      message: "아직 저장하지 않은 입력 내용은 사라집니다. 저장이 필요하면 먼저 임시저장해 주세요.",
      confirmText: "새 문서 작성",
      cancelText: "계속 입력"
    });
    if (!ok) return false;
  }

  const sops = await fetchSopsForManagementNo();
  createNewSopDraft(getNextManagementNo(sops));
  renderAdmin();
  showToast(`새 작업표준서 ${currentSop.document.managementNo} 작성을 시작합니다.`);
  return true;
}

function parseManagementNoSequence(value) {
  const match = String(value || "").trim().match(new RegExp(`^${SOP_MANAGEMENT_PREFIX}-(\\d+)$`, "i"));
  return match ? Number(match[1]) : 0;
}

function getNextManagementNo(sops = []) {
  const maxSequence = sops.reduce((max, sop) => {
    const sequence = parseManagementNoSequence(sop?.document?.managementNo);
    return sequence > max ? sequence : max;
  }, 0);
  return `${SOP_MANAGEMENT_PREFIX}-${String(maxSequence + 1).padStart(3, "0")}`;
}

function isDuplicateManagementNo(managementNo, currentId = "", sops = []) {
  const target = String(managementNo || "").trim().toUpperCase();
  if (!target) return false;
  return sops.some((sop) => (
    String(sop?.id || "") !== String(currentId || "") &&
    String(sop?.document?.managementNo || "").trim().toUpperCase() === target
  ));
}

async function fetchSopsForManagementNo() {
  const res = await fetch("/api/sops?q=");
  const data = await res.json();
  if (!res.ok) throw new Error(data.error || "작업표준서 목록을 불러오지 못했습니다.");
  return data.sops || [];
}

function showToast(message, type = "success") {
  const existing = document.querySelector(".app-toast");
  if (existing) existing.remove();
  document.body.insertAdjacentHTML("beforeend", `<div class="app-toast ${type}">${escapeHtml(message)}</div>`);
  setTimeout(() => {
    const toast = document.querySelector(".app-toast");
    if (toast) toast.remove();
  }, 2600);
}

function showConfirmDialog({ title, message, confirmText = "확인", cancelText = "취소", danger = false }) {
  const existing = document.querySelector(".confirm-modal");
  if (existing) existing.remove();
  document.body.insertAdjacentHTML("beforeend", `<div class="confirm-modal" role="dialog" aria-modal="true">
    <div class="confirm-card">
      <h3>${escapeHtml(title)}</h3>
      <p>${escapeHtml(message)}</p>
      <div class="confirm-actions">
        <button type="button" data-confirm-result="cancel">${escapeHtml(cancelText)}</button>
        <button class="${danger ? "danger" : "primary"}" type="button" data-confirm-result="confirm">${escapeHtml(confirmText)}</button>
      </div>
    </div>
  </div>`);
  return new Promise((resolve) => {
    pendingConfirm = resolve;
  });
}

function showLoginDialog() {
  const existing = document.querySelector(".login-modal");
  if (existing) existing.remove();
  document.body.insertAdjacentHTML("beforeend", `<div class="login-modal" role="dialog" aria-modal="true">
    <form class="login-card">
      <h3>관리자 로그인</h3>
      <p>관리자 입력/수정 화면으로 들어가려면 아이디와 비밀번호를 입력하세요.</p>
      <input id="adminIdInput" type="email" autocomplete="username" placeholder="아이디">
      <input id="adminPasswordInput" type="password" autocomplete="current-password" placeholder="비밀번호">
      <div class="confirm-actions">
        <button type="button" data-login-result="cancel">취소</button>
        <button class="primary" type="submit">로그인</button>
      </div>
    </form>
  </div>`);
  const modal = document.querySelector(".login-modal");
  const form = modal.querySelector("form");
  const idInput = modal.querySelector("#adminIdInput");
  const input = modal.querySelector("#adminPasswordInput");
  setTimeout(() => idInput.focus(), 0);
  return new Promise((resolve) => {
    form.addEventListener("submit", (event) => {
      event.preventDefault();
      if (idInput.value.trim() === ADMIN_ID && input.value === ADMIN_PASSWORD) {
        modal.remove();
        resolve(true);
        return;
      }
      idInput.focus();
      input.value = "";
      showToast("아이디 또는 비밀번호가 맞지 않습니다.", "error");
    });
    modal.querySelector("[data-login-result='cancel']").addEventListener("click", () => {
      modal.remove();
      resolve(false);
    });
  });
}

function renderAdmin() {
  syncRelatedRecordsFromProcessConditions();
  adminView.innerHTML = `
    <div class="panel"><div class="admin-heading"><div><h2>관리자 입력/저장 페이지</h2><p class="role">관리자 전용: 입력, 수정, 임시저장, 배포가 가능합니다.</p></div><div class="actions"><button class="primary" data-action="new-sop">새 작업표준서 등록</button><button data-action="logout">로그아웃</button></div></div></div>
    ${renderAdminSearchSection()}
    ${renderDocumentSection()}
    ${renderBasicSection()}
    ${renderWorkSequenceSection()}
    ${renderProcessConditionSection()}
    ${renderBomSection()}
    ${renderAttachmentSection()}
    ${renderProductionChecklistSection()}
    ${renderMoldLedgerSection()}
    ${renderAdminWorkRecordsSection()}
    ${renderRevisionHistorySection()}
    <div class="panel"><div class="actions"><button class="primary" data-action="save-all">전체 임시저장</button><button class="primary" data-action="publish">배포하기</button><button data-action="preview">미리보기</button><button data-action="print-document">문서 출력</button></div></div>`;
}

function renderAdminSearchSection() {
  const rows = adminSearchResults.length
    ? adminSearchResults.map((sop) => `<tr><td>${escapeHtml(sop.document.managementNo)}</td><td>${escapeHtml(sop.basic.vendor)}</td><td>${escapeHtml(sop.basic.product)}</td><td>${escapeHtml(sop.basic.process)}</td><td>${escapeHtml(sop.document.status)}</td><td><div class="row-actions"><button data-action="load-sop" data-id="${escapeHtml(sop.id)}">불러오기</button><button class="danger" data-action="delete-sop" data-id="${escapeHtml(sop.id)}" data-name="${escapeHtml(sop.basic.product || sop.document.managementNo || "작업표준서")}">삭제</button></div></td></tr>`).join("")
    : `<tr><td colspan="6">저장된 작업표준서를 검색하세요.</td></tr>`;
  return `<section class="panel"><h3>저장된 작업표준서 검색</h3><div class="grid-2 search-controls"><input id="adminSearch" value="${escapeHtml(adminSearchTerm)}" placeholder="제품명, 공정명, 관리번호로 검색"><button class="primary" data-action="admin-search">검색</button></div><table class="search-table"><thead><tr><th>관리번호</th><th>업체명</th><th>제품명</th><th>공정명</th><th>배포상태</th><th>선택</th></tr></thead><tbody>${rows}</tbody></table></section>`;
}

function renderDocumentSection() {
  const editButton = currentSop.id && currentSop.document.status === "배포완료"
    ? `<button data-action="start-edit">수정중으로 변경</button>`
    : "";
  return `<section class="panel"><h3>문서 관리정보</h3><table class="form-table info-table"><tbody>
    <tr><th>관리번호</th><td><div class="management-no-field">${cellInput("document.managementNo", currentSop.document.managementNo, "JH-PRD-WS-001")}<button type="button" data-action="auto-management-no">다음 번호 자동입력</button></div></td><th>Rev</th><td>${cellInput("document.rev", currentSop.document.rev)}</td></tr>
    <tr><th>등록일자</th><td>${cellInput("document.registeredDate", currentSop.document.registeredDate)}</td><th>작성자</th><td>${cellInput("document.author", currentSop.document.author)}</td></tr>
    <tr><th>배포상태</th><td><select data-path="document.status">${["임시저장", "수정중", "배포완료"].map((status) => `<option ${currentSop.document.status === status ? "selected" : ""}>${status}</option>`).join("")}</select></td><th>최종수정일</th><td>${escapeHtml(formatDateTime(currentSop.document.updatedAt))}</td></tr>
  </tbody></table><div class="actions">${editButton}<button data-action="save-all">문서 관리정보 임시저장</button></div></section>`;
}

function renderBasicSection() {
  return `<section class="panel"><h3>기본정보 입력</h3><table class="form-table info-table"><tbody>
    <tr><th>업체명</th><td>${cellInput("basic.vendor", currentSop.basic.vendor)}</td><th>제품명</th><td>${cellInput("basic.product", currentSop.basic.product)}</td></tr>
    <tr><th>공정명</th><td>${cellInput("basic.process", currentSop.basic.process)}</td><th>장비명</th><td>${cellInput("basic.equipment", currentSop.basic.equipment)}</td></tr>
    <tr><th>제정일자</th><td>${cellInput("basic.establishedDate", currentSop.basic.establishedDate)}</td><th>비고</th><td>${cellInput("basic.note", currentSop.basic.note)}</td></tr>
  </tbody></table><div class="actions"><button data-action="save-all">기본정보 임시저장</button></div></section>`;
}

function renderEditableRows(name, rows, columns) {
  return rows.map((row, index) => `<tr>${columns.map((col) => `<td data-label="${escapeHtml(col.label || "")}">${cellInput(`${name}.${index}.${col.key}`, row[col.key])}</td>`).join("")}</tr>`).join("");
}

function renderReadonlyRows(rows, columns) {
  return (rows && rows.length ? rows : [{}]).map((row) => `<tr>${columns.map((col) => `<td data-label="${escapeHtml(col.label || "")}">${escapeHtml(row[col.key] || "")}</td>`).join("")}</tr>`).join("");
}

function renderWorkSequenceSection() {
  return `<section class="panel"><h3>작업순서 입력</h3><table class="form-table edit-table"><thead><tr><th>순서</th><th>작업명</th><th>작업내용</th><th>주의/확인</th></tr></thead><tbody>${renderEditableRows("workSequence", currentSop.workSequence, [{ key: "order", label: "순서" }, { key: "name", label: "작업명" }, { key: "detail", label: "작업내용" }, { key: "check", label: "주의/확인" }])}</tbody></table><div class="actions"><button data-action="add-row" data-list="workSequence">+ 작업순서 행 추가</button><button data-action="remove-row" data-list="workSequence">- 작업순서 행 삭제</button><button data-action="save-all">작업순서 임시저장</button></div></section>`;
}

function renderProcessConditionSection() {
  return `<section class="panel"><h3>공정조건 관리항목 입력</h3><table class="form-table edit-table"><thead><tr><th>번호</th><th>관리항목</th><th>관리기준</th><th>방법</th><th>기록</th><th>이상조치방법</th></tr></thead><tbody>${renderEditableRows("processConditions", currentSop.processConditions, [{ key: "no", label: "번호" }, { key: "item", label: "관리항목" }, { key: "standard", label: "관리기준" }, { key: "method", label: "방법" }, { key: "record", label: "기록" }, { key: "action", label: "이상조치방법" }])}</tbody></table><div class="actions"><button data-action="add-row" data-list="processConditions">+ 공정조건 행 추가</button><button data-action="remove-row" data-list="processConditions">- 공정조건 행 삭제</button><button data-action="save-all">공정조건 임시저장</button></div></section>`;
}

function renderBomSection() {
  return `<section class="panel"><h3>BOM 입력</h3><table class="form-table edit-table"><thead><tr><th>No.</th><th>원단명</th><th>재단폭</th><th>비고</th></tr></thead><tbody>${renderEditableRows("bom", currentSop.bom, [{ key: "no", label: "No." }, { key: "material", label: "원단명" }, { key: "width", label: "재단폭" }, { key: "note", label: "비고" }])}</tbody></table><div class="actions"><button data-action="add-row" data-list="bom">+ BOM 행 추가</button><button data-action="remove-row" data-list="bom">- BOM 행 삭제</button><button data-action="save-all">BOM 임시저장</button></div></section>`;
}

function renderAttachmentSection() {
  return `<section class="panel"><h3>첨부자료</h3><div class="attachment-grid"><div class="image-slot">사진/도면 첨부<br>최대 8장</div><div class="image-slot">사진 설명 입력<br>예: 도면, 칼 정면, 칼 측면, 불량 예시</div></div><div class="actions"><button data-action="save-all">첨부자료 임시저장</button></div></section>`;
}

function renderRevisionHistorySection() {
  return `<section class="panel"><h3>수정이력</h3><table class="form-table edit-table"><thead><tr><th>수정일자</th><th>작성자</th><th>수정내용</th><th>Rev</th></tr></thead><tbody>${renderEditableRows("revisionHistory", currentSop.revisionHistory, [{ key: "date", label: "수정일자" }, { key: "author", label: "작성자" }, { key: "detail", label: "수정내용" }, { key: "rev", label: "Rev" }])}</tbody></table><div class="actions"><button data-action="add-row" data-list="revisionHistory">+ 수정이력 행 추가</button><button data-action="remove-row" data-list="revisionHistory">- 수정이력 행 삭제</button><button data-action="save-all">수정이력 임시저장</button></div></section>`;
}

function renderProductionChecklistSection() {
  const columns = [{ key: "no", label: "No." }, { key: "item", label: "체크항목" }, { key: "standard", label: "판정기준" }, { key: "checkMethod", label: "확인방법" }, { key: "record", label: "기록" }];
  return `<section class="panel"><h3>생산체크시트 기준항목</h3><p class="auto-note">공정조건 관리항목을 입력하면 자동으로 반영됩니다.</p><table class="form-table edit-table"><thead><tr>${columns.map((col) => `<th>${escapeHtml(col.label)}</th>`).join("")}</tr></thead><tbody>${renderReadonlyRows(currentSop.productionChecklist || [], columns)}</tbody></table><div class="actions"><button data-action="sync-related">공정조건 기준으로 다시 맞추기</button><button data-action="save-all">생산체크시트 임시저장</button></div></section>`;
}

function renderMoldLedgerSection() {
  const info = currentSop.moldLedger.info;
  const columns = getMoldLedgerColumns();
  return `<section class="panel"><h3>금형관리대장</h3>
    <table class="form-table info-table"><tbody>
      <tr><th>금형번호</th><td>${cellInput("moldLedger.info.moldNo", info.moldNo)}</td><th>금형명</th><td>${cellInput("moldLedger.info.moldName", info.moldName)}</td></tr>
    </tbody></table>
    <p class="auto-note">관리항목에 금형이 포함된 공정조건만 자동으로 반영됩니다.</p>
    <table class="form-table edit-table"><thead><tr>${columns.map((col) => `<th>${escapeHtml(col.label)}</th>`).join("")}</tr></thead><tbody>${renderReadonlyRows(currentSop.moldLedger.history || [], columns)}</tbody></table>
    <div class="actions"><button data-action="sync-related">공정조건 기준으로 다시 맞추기</button><button data-action="save-all">금형관리대장 임시저장</button></div>
  </section>`;
}

function renderAdminWorkRecordsSection() {
  const rows = adminWorkRecords.length
    ? adminWorkRecords.map((record) => `<tr><td>${escapeHtml(record.workDate)}</td><td>${escapeHtml(record.workerName)}</td><td>${escapeHtml(countChecklistChecks(record))} / ${escapeHtml((record.checklist || []).length * 3)}</td><td>${escapeHtml(record.moldUse.moldNo)}</td><td>${escapeHtml(record.moldUse.dailyShots)}</td><td>${escapeHtml(record.moldUse.totalShots)}</td><td>${escapeHtml(record.moldUse.note)}</td></tr>`).join("")
    : `<tr><td colspan="7">저장된 작업자 체크/금형사용 기록이 없습니다.</td></tr>`;
  return `<section class="panel"><h3>작업자 기록 확인</h3><p class="auto-note">작업자가 작업일마다 저장한 생산체크시트와 금형 사용 기록입니다.</p><table class="form-table edit-table"><thead><tr><th>작업일자</th><th>작업자</th><th>체크 OK</th><th>금형번호</th><th>금일 타발수</th><th>누적 타발수</th><th>특이사항</th></tr></thead><tbody>${rows}</tbody></table><div class="actions"><button data-action="refresh-records">작업자 기록 새로고침</button></div></section>`;
}

function countChecklistChecks(record) {
  return (record.checklist || []).reduce((count, item) => {
    const checks = item.checks || {};
    return count + ["first", "middle", "final"].filter((key) => checks[key] === "check").length;
  }, 0);
}

function getMoldLedgerColumns() {
  return [{ key: "type", label: "구분" }, { key: "detail", label: "내용" }, { key: "nextAction", label: "다음조치" }];
}

function setByPath(path, value) {
  const parts = path.split(".");
  let target = currentSop;
  while (parts.length > 1) target = target[parts.shift()];
  target[parts[0]] = value;
}

function syncInputs() {
  document.querySelectorAll("#adminView [data-path]").forEach((input) => setByPath(input.dataset.path, input.value));
}

function hasProcessConditionValue(row) {
  return ["no", "item", "standard", "method", "record", "action"].some((key) => String(row[key] || "").trim());
}

function syncRelatedRecordsFromProcessConditions(target = currentSop) {
  const conditions = (target.processConditions || []).filter(hasProcessConditionValue);
  target.productionChecklist = conditions.map((row, index) => ({
    no: row.no || String(index + 1),
    item: row.item || "",
    standard: row.standard || "",
    checkMethod: row.method || "",
    record: row.record || ""
  }));
  if (!target.productionChecklist.length) target.productionChecklist = [blankRow("productionChecklist")];

  const moldRows = conditions.filter((row) => String(row.item || "").includes("금형"));
  target.moldLedger.history = moldRows.map((row) => ({
    type: row.item || "금형관리",
    detail: [row.standard, row.method, row.record].filter(Boolean).join(" / "),
    nextAction: row.action || ""
  }));
  if (!target.moldLedger.history.length) target.moldLedger.history = [blankRow("moldLedger.history")];
}

function getByPath(path) {
  return path.split(".").reduce((target, part) => target && target[part], currentSop);
}

function blankRow(list) {
  const map = {
    workSequence: { order: "", name: "", detail: "", check: "" },
    processConditions: { no: "", item: "", standard: "", method: "", record: "", action: "" },
    bom: { no: "", material: "", width: "", note: "" },
    productionChecklist: { no: "", item: "", standard: "", checkMethod: "", record: "" },
    "moldLedger.history": { type: "", detail: "", nextAction: "" },
    revisionHistory: { date: "", author: "", detail: "", rev: "" }
  };
  return { ...map[list] };
}

function printValue(value) {
  return escapeHtml(value || "");
}

function printRows(rows, columns, className = "") {
  const bodyRows = (rows && rows.length ? rows : [{}]).map((row) => `<tr>${columns.map((column) => `<td>${printValue(row[column.key])}</td>`).join("")}</tr>`).join("");
  return `<table class="print-table ${className}"><thead><tr>${columns.map((column) => `<th>${escapeHtml(column.label)}</th>`).join("")}</tr></thead><tbody>${bodyRows}</tbody></table>`;
}

function renderPrintDocument(sop) {
  sop = hydrateSop(sop);
  syncRelatedRecordsFromProcessConditions(sop);
  const attachments = (sop.attachments && sop.attachments.files) || [];
  const printedAt = formatDateTime(new Date().toISOString());
  return `<section class="print-document">
    <h1>작업표준서</h1>
    <table class="print-table print-info">
      <tbody>
        <tr><th>관리번호</th><td>${printValue(sop.document.managementNo)}</td><th>Rev</th><td>${printValue(sop.document.rev)}</td></tr>
        <tr><th>등록일자</th><td>${printValue(sop.document.registeredDate)}</td><th>작성자</th><td>${printValue(sop.document.author)}</td></tr>
        <tr><th>배포상태</th><td>${printValue(sop.document.status)}</td><th>최종수정일</th><td>${printValue(formatDateTime(sop.document.updatedAt))}</td></tr>
        <tr><th>업체명</th><td>${printValue(sop.basic.vendor)}</td><th>제품명</th><td>${printValue(sop.basic.product)}</td></tr>
        <tr><th>공정명</th><td>${printValue(sop.basic.process)}</td><th>장비명</th><td>${printValue(sop.basic.equipment)}</td></tr>
        <tr><th>제정일자</th><td>${printValue(sop.basic.establishedDate)}</td><th>출력일시</th><td>${printValue(printedAt)}</td></tr>
        <tr><th>비고</th><td colspan="3">${printValue(sop.basic.note)}</td></tr>
      </tbody>
    </table>

    <h2>작업순서</h2>
    ${printRows(sop.workSequence, [{ key: "order", label: "순서" }, { key: "name", label: "작업명" }, { key: "detail", label: "작업내용" }, { key: "check", label: "주의/확인" }], "print-work-table")}

    <h2>공정조건 관리항목</h2>
    ${printRows(sop.processConditions, [{ key: "no", label: "번호" }, { key: "item", label: "관리항목" }, { key: "standard", label: "관리기준" }, { key: "method", label: "방법" }, { key: "record", label: "기록" }, { key: "action", label: "이상조치방법" }], "print-condition-table")}

    <h2>BOM</h2>
    ${printRows(sop.bom, [{ key: "no", label: "No." }, { key: "material", label: "원단명" }, { key: "width", label: "재단폭" }, { key: "note", label: "비고" }], "print-bom-table")}

    <h2>첨부자료</h2>
    <div class="print-attachments">${attachments.length ? attachments.map((file) => `<figure><img src="${escapeHtml(file.dataUrl)}" alt="${escapeHtml(file.description || file.name || "첨부사진")}"><figcaption>${printValue(file.description || file.name || "첨부사진")}</figcaption></figure>`).join("") : `<p>등록된 첨부자료가 없습니다.</p>`}</div>

    <h2>생산체크시트 기준항목</h2>
    ${printRows(sop.productionChecklist, [{ key: "no", label: "No." }, { key: "item", label: "체크항목" }, { key: "standard", label: "판정기준" }, { key: "checkMethod", label: "확인방법" }, { key: "record", label: "기록" }], "print-checklist-table")}

    <h2>금형관리대장</h2>
    <table class="print-table print-info">
      <tbody>
        <tr><th>금형번호</th><td>${printValue(sop.moldLedger.info.moldNo)}</td><th>금형명</th><td>${printValue(sop.moldLedger.info.moldName)}</td></tr>
      </tbody>
    </table>
    ${printRows(sop.moldLedger.history, getMoldLedgerColumns(), "print-mold-table")}

    <h2>수정이력</h2>
    ${printRows(sop.revisionHistory, [{ key: "date", label: "수정일자" }, { key: "author", label: "작성자" }, { key: "detail", label: "수정내용" }, { key: "rev", label: "Rev" }])}
  </section>`;
}

function printCurrentSop() {
  syncInputs();
  syncRelatedRecordsFromProcessConditions();
  const existing = document.getElementById("printArea");
  if (existing) existing.remove();
  document.body.insertAdjacentHTML("beforeend", `<div id="printArea">
    <div class="print-preview-actions">
      <div><strong>문서 출력 미리보기</strong><span>내용이나 사진이 많으면 여러 페이지로 나뉘어 출력됩니다.</span></div>
      <div>
        <button type="button" data-action="close-print-preview">닫기</button>
        <button class="primary" type="button" data-action="print-now">인쇄 실행</button>
      </div>
    </div>
    ${renderPrintDocument(currentSop)}
  </div>`);
  document.body.classList.add("print-preview-open");
  showToast("문서 출력 미리보기를 열었습니다.");
}

function renderAttachmentSection() {
  const files = currentSop.attachments.files || [];
  const items = files.length
    ? files.map((file, index) => `<div class="attachment-item">
        <button class="thumb-button" type="button" data-action="open-image" data-image-src="${escapeHtml(file.dataUrl)}" data-image-title="${escapeHtml(file.description || file.name || "첨부사진")}"><img src="${escapeHtml(file.dataUrl)}" alt="${escapeHtml(file.description || file.name || "첨부사진")}"></button>
        <input data-path="attachments.files.${index}.description" value="${escapeHtml(file.description)}" placeholder="사진 설명 예: 도면, 칼 정면, 불량 예시">
        <div class="attachment-meta"><span>${escapeHtml(file.name || "사진")}</span><button type="button" data-action="remove-attachment" data-index="${index}">삭제</button></div>
      </div>`).join("")
    : `<div class="empty-attachments">아직 첨부된 사진이 없습니다.</div>`;
  return `<section class="panel"><h3>첨부자료</h3>
    <div class="attachment-toolbar">
      <label class="file-button">사진 선택<input id="attachmentInput" type="file" accept="image/*" multiple></label>
      <span>최대 8장까지 저장됩니다.</span>
    </div>
    <div class="attachment-list">${items}</div>
    <div class="actions"><button data-action="save-all">첨부자료 임시저장</button></div>
  </section>`;
}

function readImageAsDataUrl(file) {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => resolve(reader.result);
    reader.onerror = reject;
    reader.readAsDataURL(file);
  });
}

function loadImage(dataUrl) {
  return new Promise((resolve, reject) => {
    const image = new Image();
    image.onload = () => resolve(image);
    image.onerror = reject;
    image.src = dataUrl;
  });
}

async function compressImageFile(file) {
  const dataUrl = await readImageAsDataUrl(file);
  const image = await loadImage(dataUrl);
  const maxSide = 1400;
  const scale = Math.min(1, maxSide / Math.max(image.width, image.height));
  const canvas = document.createElement("canvas");
  canvas.width = Math.max(1, Math.round(image.width * scale));
  canvas.height = Math.max(1, Math.round(image.height * scale));
  const context = canvas.getContext("2d");
  context.drawImage(image, 0, 0, canvas.width, canvas.height);
  return {
    name: file.name,
    description: "",
    dataUrl: canvas.toDataURL("image/jpeg", 0.78)
  };
}

async function addAttachmentFiles(fileList) {
  const selectedFiles = Array.from(fileList || []).filter((file) => file.type.startsWith("image/"));
  const currentFiles = currentSop.attachments.files || [];
  const remainingSlots = 8 - currentFiles.length;
  if (remainingSlots <= 0) {
    showToast("첨부자료는 최대 8장까지 등록할 수 있습니다.", "error");
    return;
  }
  const filesToAdd = selectedFiles.slice(0, remainingSlots);
  const compressed = [];
  for (const file of filesToAdd) {
    compressed.push(await compressImageFile(file));
  }
  currentSop.attachments.files = currentFiles.concat(compressed);
  if (selectedFiles.length > remainingSlots) showToast("최대 8장까지만 추가했습니다.", "error");
  renderAdmin();
}

function openImageModal(src, title) {
  if (!src) return;
  const existing = document.querySelector(".image-modal");
  if (existing) existing.remove();
  document.body.insertAdjacentHTML("beforeend", `<div class="image-modal" role="dialog" aria-modal="true">
    <div class="image-modal-content">
      <button class="modal-close" type="button" data-action="close-image">닫기</button>
      <img src="${escapeHtml(src)}" alt="${escapeHtml(title || "첨부사진")}">
      <p>${escapeHtml(title || "")}</p>
    </div>
  </div>`);
}

adminView.addEventListener("change", async (event) => {
  if (event.target.id === "attachmentInput") {
    syncInputs();
    syncRelatedRecordsFromProcessConditions();
    await addAttachmentFiles(event.target.files);
    return;
  }
  if (event.target.dataset.path && event.target.dataset.path.startsWith("processConditions.")) {
    syncInputs();
    syncRelatedRecordsFromProcessConditions();
    renderAdmin();
  }
});

adminView.addEventListener("click", async (event) => {
  const button = event.target.closest("button");
  if (!button) return;
  syncInputs();
  if (button.dataset.action === "remove-attachment") {
    currentSop.attachments.files.splice(Number(button.dataset.index), 1);
    renderAdmin();
    return;
  }
  if (button.dataset.action === "open-image") {
    openImageModal(button.dataset.imageSrc, button.dataset.imageTitle);
    return;
  }
  if (button.dataset.action === "logout") {
    isAdminLoggedIn = false;
    currentSop = structuredClone(emptySop);
    showView("worker");
    showToast("로그아웃되었습니다.");
    return;
  }
  if (button.dataset.action === "admin-search") {
    await searchAdmin();
    return;
  }
  if (button.dataset.action === "new-sop") {
    try {
      await startNewSopDocument();
    } catch (error) {
      showToast(error.message || "새 작업표준서를 준비하지 못했습니다.", "error");
    }
    return;
  }
  if (button.dataset.action === "load-sop") {
    await loadAdminSop(button.dataset.id);
    return;
  }
  if (button.dataset.action === "delete-sop") {
    await deleteAdminSop(button.dataset.id, button.dataset.name);
    return;
  }
  if (button.dataset.action === "refresh-records") {
    await refreshAdminWorkRecords();
    renderAdmin();
    showToast("작업자 기록을 불러왔습니다.");
    return;
  }
  if (button.dataset.action === "start-edit") {
    currentSop.document.status = "수정중";
    renderAdmin();
    showToast("수정중 상태로 변경했습니다. 수정 후 저장하거나 다시 배포하세요.");
    return;
  }
  if (button.dataset.action === "auto-management-no") {
    try {
      const sops = await fetchSopsForManagementNo();
      const nextManagementNo = getNextManagementNo(sops);
      if (currentSop.id) {
        createNewSopDraft(nextManagementNo);
        showToast(`기존 문서는 유지하고 새 작업표준서 ${nextManagementNo} 작성을 시작합니다.`);
      } else {
        currentSop.document.managementNo = nextManagementNo;
        showToast(`관리번호 ${nextManagementNo}로 입력했습니다.`);
      }
      renderAdmin();
    } catch (error) {
      showToast(error.message || "관리번호 자동입력에 실패했습니다.", "error");
    }
    return;
  }
  if (button.dataset.action === "add-row") getByPath(button.dataset.list).push(blankRow(button.dataset.list));
  if (button.dataset.action === "remove-row") {
    const list = getByPath(button.dataset.list);
    if (list.length > 1) list.pop();
  }
  if (button.dataset.action === "sync-related" || button.dataset.list === "processConditions") {
    syncRelatedRecordsFromProcessConditions();
  }
  if (button.dataset.action === "publish") currentSop.document.status = "배포완료";
  if (button.dataset.action === "preview") {
    syncRelatedRecordsFromProcessConditions();
    showView("worker");
    renderWorker([currentSop]);
    return;
  }
  if (button.dataset.action === "print-document") {
    printCurrentSop();
    return;
  }
  if (button.dataset.action === "save-all" || button.dataset.action === "publish") {
    syncRelatedRecordsFromProcessConditions();
    try {
      const sops = await fetchSopsForManagementNo();
      const persistedRecord = currentSop.id
        ? sops.find((sop) => String(sop?.id || "") === String(currentSop.id))
        : null;
      const managementNoChanged = persistedRecord &&
        String(persistedRecord?.document?.managementNo || "").trim().toUpperCase() !==
        String(currentSop.document.managementNo || "").trim().toUpperCase();

      if (managementNoChanged) {
        currentSop = hydrateSop({ ...currentSop, id: "", createdAt: "" });
      }

      if (isDuplicateManagementNo(currentSop.document.managementNo, currentSop.id, sops)) {
        showToast("이미 사용 중인 관리번호입니다. 다음 번호 자동입력을 눌러 새 번호를 사용해 주세요.", "error");
        return;
      }
    } catch (error) {
      showToast(error.message || "관리번호 중복 확인에 실패했습니다.", "error");
      return;
    }
    const res = await fetch("/api/sops", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify(currentSop) });
    const data = await res.json();
    if (!res.ok) return showToast(data.error, "error");
    currentSop = hydrateSop(data.sop);
    adminSearchTerm = currentSop.basic.product || currentSop.basic.process || currentSop.document.managementNo || "";
    await refreshAdminSearch();
    await refreshAdminWorkRecords();
    showToast("저장되었습니다.");
  }
  renderAdmin();
});

renderAdmin();

async function searchAdmin() {
  adminSearchTerm = document.getElementById("adminSearch").value.trim();
  await refreshAdminSearch();
  renderAdmin();
}

async function refreshAdminSearch() {
  const res = await fetch(`/api/sops?q=${encodeURIComponent(adminSearchTerm)}`);
  const data = await res.json();
  adminSearchResults = data.sops || [];
}

async function loadAdminSop(id) {
  const res = await fetch(`/api/sops/${encodeURIComponent(id)}`);
  const data = await res.json();
  if (!res.ok) return showToast(data.error, "error");
  currentSop = hydrateSop(data.sop);
  adminSearchTerm = currentSop.basic.product || currentSop.basic.process || currentSop.document.managementNo || "";
  await refreshAdminSearch();
  await refreshAdminWorkRecords();
  renderAdmin();
  showToast("불러왔습니다.");
}

async function refreshAdminWorkRecords() {
  if (!currentSop.id) {
    adminWorkRecords = [];
    return;
  }
  const res = await fetch(`/api/work-records?sopId=${encodeURIComponent(currentSop.id)}`);
  const data = await res.json();
  adminWorkRecords = data.records || [];
}

async function deleteAdminSop(id, name) {
  const ok = await showConfirmDialog({
    title: "작업표준서를 삭제할까요?",
    message: `${name || "선택한 작업표준서"}를 삭제하면 작업자 화면에서도 더 이상 보이지 않습니다. 이 작업은 되돌릴 수 없습니다.`,
    confirmText: "삭제",
    cancelText: "취소",
    danger: true
  });
  if (!ok) return;
  const res = await fetch(`/api/sops/${encodeURIComponent(id)}`, { method: "DELETE" });
  const data = await res.json();
  if (!res.ok) return showToast(data.error, "error");
  if (currentSop.id === id) currentSop = structuredClone(emptySop);
  await refreshAdminSearch();
  renderAdmin();
  showToast("삭제되었습니다.");
}

async function searchWorker() {
  const q = document.getElementById("workerSearch").value;
  const res = await fetch(`/api/worker/sops?q=${encodeURIComponent(q)}`);
  const data = await res.json();
  renderWorker(data.sops);
}

function renderWorker(sops = []) {
  workerView.innerHTML = `<div class="panel"><h2>작업자 조회 전용 페이지</h2><p class="role">작업자 전용: 배포완료된 표준서만 조회할 수 있습니다.</p><input id="workerSearch" placeholder="제품명, 공정명, 관리번호로 검색"><div class="actions"><button id="workerSearchButton" class="primary">검색</button></div></div><div id="workerResults">${sops.length ? sops.map(renderWorkerSop).join("") : `<div class="panel">조회할 작업표준서가 없습니다.</div>`}</div>`;
  document.getElementById("workerSearchButton").addEventListener("click", searchWorker);
}

function renderWorkerSop(sop) {
  sop = hydrateSop(sop);
  syncRelatedRecordsFromProcessConditions(sop);
  return `<article class="worker-card">
    <h3>${escapeHtml(sop.basic.product || "제품명 없음")} / ${escapeHtml(sop.basic.process || "공정명 없음")}</h3>
    ${renderKv("업체명", sop.basic.vendor)}
    ${renderKv("관리번호", sop.document.managementNo)}
    ${renderKv("Rev", sop.document.rev)}
    ${renderKv("배포상태", sop.document.status)}
    <h3 class="worker-section-title section-attachment">첨부자료</h3>
    ${renderKv("사진/도면", "크게 보기")}
    <h3 class="worker-section-title section-work">작업순서</h3>
    ${sop.workSequence.map((row) => renderKv(row.order || "-", `${row.name || ""} ${row.detail || ""} ${row.check || ""}`)).join("")}
    <h3 class="worker-section-title section-condition">공정조건</h3>
    ${sop.processConditions.map((row) => renderKv(row.item || "-", `${row.standard || ""} / ${row.method || ""} / ${row.record || ""} / ${row.action || ""}`)).join("")}
    <h3 class="worker-section-title section-bom">BOM</h3>
    ${sop.bom.map((row) => renderKv(row.no || "-", `${row.material || ""} / ${row.width || ""} / ${row.note || ""}`)).join("")}
  </article>`;
}

function renderKv(label, value) {
  return `<div class="kv"><strong>${escapeHtml(label)}</strong><span>${escapeHtml(value)}</span></div>`;
}

function renderWorkerAttachments(sop) {
  const files = (sop.attachments && sop.attachments.files) || [];
  if (!files.length) return `<div class="kv"><strong>사진/도면</strong><span>등록된 사진이 없습니다.</span></div>`;
  return `<div class="worker-attachments">${files.map((file) => `<button class="worker-thumb" type="button" data-action="open-image" data-image-src="${escapeHtml(file.dataUrl)}" data-image-title="${escapeHtml(file.description || file.name || "첨부사진")}">
    <img src="${escapeHtml(file.dataUrl)}" alt="${escapeHtml(file.description || file.name || "첨부사진")}">
    <span>${escapeHtml(file.description || file.name || "첨부사진")}</span>
  </button>`).join("")}</div>`;
}

function renderWorkerTable(rows, columns, className = "") {
  const safeRows = rows && rows.length ? rows : [{}];
  return `<div class="worker-table-wrap"><table class="worker-table ${className}">
    <thead><tr>${columns.map((column) => `<th>${escapeHtml(column.label)}</th>`).join("")}</tr></thead>
    <tbody>${safeRows.map((row) => `<tr>${columns.map((column) => `<td data-label="${escapeHtml(column.label)}">${escapeHtml(row[column.key] || "")}</td>`).join("")}</tr>`).join("")}</tbody>
  </table></div>`;
}

function renderWorkerChecklistForm(sop) {
  const rows = sop.productionChecklist && sop.productionChecklist.length ? sop.productionChecklist : [];
  if (!rows.length) return `<p class="worker-empty">체크할 생산체크시트 항목이 없습니다.</p>`;
  return `<p class="auto-note">참고: 초물/중물/종물은 누를 때마다 ✓, X, 빈칸 순서로 바뀝니다.</p>
  <div class="worker-checklist-form worker-checklist-cards">
    ${rows.map((row, index) => {
      const no = row.no || String(index + 1);
      return `<article class="worker-checklist-card"
        data-checklist-index="${index}"
        data-checklist-no="${escapeHtml(no)}"
        data-checklist-item="${escapeHtml(row.item || "")}"
        data-checklist-standard="${escapeHtml(row.standard || "")}"
        data-checklist-method="${escapeHtml(row.checkMethod || "")}">
        <div class="worker-checklist-head">
          <span class="worker-checklist-no">No. ${escapeHtml(no)}</span>
          <strong>${escapeHtml(row.item || "체크항목")}</strong>
        </div>
        <div class="worker-checklist-meta">
          <p><b>판정</b><span>${escapeHtml(row.standard || "-")}</span></p>
          <p><b>방법</b><span>${escapeHtml(row.checkMethod || "-")}</span></p>
        </div>
        <div class="worker-check-status-row">
          <label><span>초물</span>${renderCycleCheck(`checklist.${index}.checks.first`)}</label>
          <label><span>중물</span>${renderCycleCheck(`checklist.${index}.checks.middle`)}</label>
          <label><span>종물</span>${renderCycleCheck(`checklist.${index}.checks.final`)}</label>
        </div>
        <label class="worker-check-note"><span>참고</span><input data-record-path="checklist.${index}.note" placeholder="참고 입력"></label>
      </article>`;
    }).join("")}
  </div>`;
}

function renderCycleCheck(path) {
  return `<button type="button" class="cycle-check" data-action="cycle-check" data-record-path="${path}" value="" aria-label="체크 상태 변경"></button>`;
}

function renderWorkerRecordForm(sop) {
  const moldInfo = sop.moldLedger.info || {};
  return `<section class="worker-record-form" data-sop-id="${escapeHtml(sop.id || "")}">
    <h3 class="worker-section-title section-daily">오늘 작업 체크</h3>
    <div class="record-grid">
      <label>작업일자<input data-record-path="workDate" type="date" value="${todayInputValue()}"></label>
      <label>작업자명<input data-record-path="workerName" placeholder="이름 입력"></label>
    </div>
    <h3 class="worker-section-title section-checklist">생산체크시트</h3>
    ${renderWorkerChecklistForm(sop)}
    ${renderWorkerMoldSection(sop, moldInfo)}
    <div class="actions"><button class="primary" data-action="save-work-record">작업 체크 저장</button></div>
  </section>`;
}

function renderWorkerMoldSection(sop, moldInfo) {
  return `<div class="worker-mold-record">
    <h3 class="worker-section-title section-mold">금형관리대장 / 금형 사용 기록</h3>
    ${renderKv("금형번호", moldInfo.moldNo)}
    ${renderKv("금형명", moldInfo.moldName)}
    ${renderWorkerTable(sop.moldLedger.history, getMoldLedgerColumns(), "worker-mold-table")}
    <p class="auto-note">작업일마다 금일 타발수를 입력하면 위 금형번호 기준으로 누적 타발수가 자동 계산됩니다.</p>
    <div class="record-grid">
      <input type="hidden" data-record-path="moldUse.moldNo" value="${escapeHtml(moldInfo.moldNo || "")}">
      <label>금일 타발수<input data-record-path="moldUse.dailyShots" type="number" min="0" inputmode="numeric" placeholder="예: 3000"></label>
      <label>누적 타발수<input data-record-path="moldUse.totalShotsPreview" value="저장 후 자동 계산" readonly></label>
      <label class="record-wide">특이사항<input data-record-path="moldUse.note" placeholder="작업 후 특이사항"></label>
    </div>
  </div>`;
}

function renderWorkerSop(sop) {
  sop = hydrateSop(sop);
  syncRelatedRecordsFromProcessConditions(sop);
  return `<article class="worker-card">
    <h3>${escapeHtml(sop.basic.product || "제품명 없음")} / ${escapeHtml(sop.basic.process || "공정명 없음")}</h3>
    ${renderKv("업체명", sop.basic.vendor)}
    ${renderKv("관리번호", sop.document.managementNo)}
    ${renderKv("Rev", sop.document.rev)}
    ${renderKv("배포상태", sop.document.status)}
    <h3 class="worker-section-title section-attachment">첨부자료</h3>
    ${renderWorkerAttachments(sop)}
    <h3 class="worker-section-title section-work">작업순서</h3>
    ${renderWorkerTable(sop.workSequence, [{ key: "order", label: "순서" }, { key: "name", label: "작업명" }, { key: "detail", label: "작업내용" }, { key: "check", label: "주의/확인" }], "worker-work-table")}
    <h3 class="worker-section-title section-condition">공정조건</h3>
    ${renderWorkerTable(sop.processConditions, [{ key: "no", label: "번호" }, { key: "item", label: "관리항목" }, { key: "standard", label: "관리기준" }, { key: "method", label: "방법" }, { key: "record", label: "기록" }, { key: "action", label: "이상조치방법" }], "worker-condition-table")}
    <h3 class="worker-section-title section-bom">BOM</h3>
    ${renderWorkerTable(sop.bom, [{ key: "no", label: "No." }, { key: "material", label: "원단명" }, { key: "width", label: "재단폭" }, { key: "note", label: "비고" }], "worker-bom-table")}
    <h3 class="worker-section-title section-checklist">생산체크시트 기준항목</h3>
    ${renderWorkerTable(sop.productionChecklist, [{ key: "no", label: "No." }, { key: "item", label: "체크항목" }, { key: "standard", label: "판정기준" }, { key: "checkMethod", label: "확인방법" }, { key: "record", label: "기록" }], "worker-checklist-table")}
    ${renderWorkerRecordForm(sop)}
  </article>`;
}

workerView.addEventListener("click", (event) => {
  const button = event.target.closest("button");
  if (!button) return;
  if (button.dataset.action === "open-image") openImageModal(button.dataset.imageSrc, button.dataset.imageTitle);
  if (button.dataset.action === "cycle-check") {
    cycleChecklistButton(button);
    return;
  }
  if (button.dataset.action === "save-work-record") saveWorkerRecord(button);
});

function cycleChecklistButton(button) {
  const next = button.value === "" ? "check" : button.value === "check" ? "x" : "";
  button.value = next;
  button.textContent = next === "check" ? "✓" : next === "x" ? "X" : "";
  button.classList.toggle("is-check", next === "check");
  button.classList.toggle("is-x", next === "x");
}

function setNestedValue(target, path, value) {
  const parts = path.split(".");
  let cursor = target;
  while (parts.length > 1) {
    const part = parts.shift();
    const nextPart = parts[0];
    if (!cursor[part]) cursor[part] = /^\d+$/.test(nextPart) ? [] : {};
    cursor = cursor[part];
  }
  cursor[parts[0]] = value;
}

async function saveWorkerRecord(button) {
  const card = button.closest(".worker-card");
  const form = button.closest(".worker-record-form");
  const sopId = form.dataset.sopId;
  const checklistRows = Array.from(form.querySelectorAll(".worker-checklist-card"));
  const record = { sopId, checklist: [], moldUse: {} };
  form.querySelectorAll("[data-record-path]").forEach((input) => setNestedValue(record, input.dataset.recordPath, input.value));
  checklistRows.forEach((row, index) => {
    record.checklist[index] = {
      ...(record.checklist[index] || {}),
      no: row.dataset.checklistNo || String(index + 1),
      item: row.dataset.checklistItem || "",
      standard: row.dataset.checklistStandard || "",
      checkMethod: row.dataset.checklistMethod || ""
    };
  });
  if (record.moldUse) delete record.moldUse.totalShotsPreview;
  const res = await fetch("/api/work-records", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify(record) });
  const data = await res.json();
  if (!res.ok) return showToast(data.error, "error");
  const total = data.record.moldUse.totalShots || 0;
  const totalPreview = form.querySelector('[data-record-path="moldUse.totalShotsPreview"]');
  if (totalPreview) totalPreview.value = `${total.toLocaleString()}타`;
  showToast(`작업 체크가 저장되었습니다. 누적 타발수: ${total.toLocaleString()}타`);
  card.insertAdjacentHTML("beforeend", `<div class="worker-save-result">저장완료: ${escapeHtml(data.record.workDate)} / 누적 타발수 ${escapeHtml(total.toLocaleString())}타</div>`);
}

document.addEventListener("click", (event) => {
  const printNow = event.target.closest("[data-action='print-now']");
  if (printNow) {
    window.print();
    return;
  }
  const closePrintPreview = event.target.closest("[data-action='close-print-preview']");
  if (closePrintPreview) {
    const printArea = document.getElementById("printArea");
    if (printArea) printArea.remove();
    document.body.classList.remove("print-preview-open");
    return;
  }
  const confirmButton = event.target.closest("[data-confirm-result]");
  if (confirmButton && pendingConfirm) {
    const resolve = pendingConfirm;
    pendingConfirm = null;
    const modal = document.querySelector(".confirm-modal");
    if (modal) modal.remove();
    resolve(confirmButton.dataset.confirmResult === "confirm");
    return;
  }
  const close = event.target.closest("[data-action='close-image']");
  const backdrop = event.target.classList && event.target.classList.contains("image-modal");
  if (close || backdrop) {
    const modal = document.querySelector(".image-modal");
    if (modal) modal.remove();
  }
});

renderWorker();
showView("worker");
