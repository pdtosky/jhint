const ADMIN_SESSION_KEY = "production-admin-session-v1";
const API_STATE_URL = "/api/state";
const POLL_INTERVAL_MS = 5000;
const APP_CONFIG = window.APP_CONFIG || {};
const BACKEND_MODE = APP_CONFIG.backend || "api";

const TEXT = {
  admin: "\uAD00\uB9AC\uC790",
  startMessage: "\uC791\uC5C5\uC744 \uC2DC\uC791\uD588\uC2B5\uB2C8\uB2E4.",
  endMessage: "\uC791\uC5C5\uC744 \uC885\uB8CC\uD588\uC2B5\uB2C8\uB2E4.",
  registerMessage: "\uBC1C\uC8FC\uC11C\uAC00 \uB4F1\uB85D\uB418\uC5C8\uC2B5\uB2C8\uB2E4.",
  noOrders: "\uB4F1\uB85D\uB41C \uBC1C\uC8FC\uC11C\uAC00 \uC5C6\uC2B5\uB2C8\uB2E4.",
  noTasks: "\uB4F1\uB85D\uB41C \uC791\uC5C5 \uC5C6\uC74C",
  noActivity: "\uC791\uC5C5 \uC774\uB825\uC774 \uC544\uC9C1 \uC5C6\uC2B5\uB2C8\uB2E4.",
  noProgress: "\uC9C4\uD589 \uC911\uC778 \uC0DD\uC0B0 \uB370\uC774\uD130\uAC00 \uC5C6\uC2B5\uB2C8\uB2E4.",
  noFiltered: "\uC870\uAC74\uC5D0 \uB9DE\uB294 \uBC1C\uC8FC\uAC00 \uC5C6\uC2B5\uB2C8\uB2E4.",
  unknownTask: "\uC54C \uC218 \uC5C6\uB294 \uC791\uC5C5",
  unassigned: "\uB2F4\uB2F9 \uC791\uC5C5\uC790 \uBBF8\uC9C0\uC815",
  allOrders: "\uC804\uCCB4 \uBC1C\uC8FC",
  waiting: "\uC791\uC5C5 \uB300\uAE30",
  working: "\uC791\uC5C5 \uC911",
  paused: "\uC791\uC5C5 \uC911\uC9C0",
  urgent: "\uB0A9\uAE30 \uC784\uBC15",
  complete: "\uC791\uC5C5 \uC644\uB8CC",
  productionQty: "\uCD1D\uC0DD\uC0B0\uC218",
  totalHitQty: "\uCD1D\uD0C0\uBC1C\uC218",
  shipped: "\uCD9C\uD558 \uC644\uB8CC",
  notShipped: "\uCD9C\uD558 \uB300\uAE30",
  noWorkTime: "\uC791\uC5C5\uC2DC\uAC04 \uC5C6\uC74C",
  allOrdersList: "\uC804\uCCB4 \uBC1C\uC8FC \uB9AC\uC2A4\uD2B8",
  waitingList: "\uC791\uC5C5 \uB300\uAE30 \uB9AC\uC2A4\uD2B8",
  workingList: "\uC791\uC5C5 \uC911 \uB9AC\uC2A4\uD2B8",
  urgentList: "\uB0A9\uAE30 \uC784\uBC15 \uB9AC\uC2A4\uD2B8",
  listSuffix: "\uB9AC\uC2A4\uD2B8",
  progressSuffix: "\uC9C4\uD589\uB960",
  registeredAll: "\uB4F1\uB85D\uB41C \uC804\uCCB4 \uC791\uC5C5 \uC218",
  beforeStart: "\uC2DC\uC791 \uC804 \uBC1C\uC8FC",
  inProduction: "\uD604\uC7AC \uC0DD\uC0B0 \uC9C4\uD589 \uAC74",
  dueSoon: "3\uC77C \uC774\uB0B4 \uB0A9\uAE30 \uAC74",
  baseDate: "\uAE30\uC900",
  orderDate: "\uBC1C\uC8FC\uC77C",
  dueDate: "\uB0A9\uAE30\uC77C",
  worker: "\uC791\uC5C5\uC790",
  register: "\uBC1C\uC8FC \uB4F1\uB85D",
  start: "\uC791\uC5C5 \uC2DC\uC791",
  end: "\uC791\uC5C5 \uC885\uB8CC",
  workQty: "\uC791\uC5C5\uC218\uB7C9",
  workHitQty: "\uC791\uC5C5\uD0C0\uC218"
};

const seedOrders = [
  {
    id: crypto.randomUUID(),
    orderDate: "2026-04-20",
    company: "\uD55C\uBE5B\uC0B0\uC5C5",
    product: "\uC54C\uB8E8\uBBF8\uB284 \uD504\uB808\uC784",
    quantity: "300",
    paymentRequested: true,
    deliveryType: "\uC9C1\uB0A9",
    dueDate: "2026-04-24",
    status: "ready",
    startTime: "",
    endTime: "",
    elapsedMs: 0,
    pauseReason: "",
    workQty: "",
    workHitQty: "",
    machineName: "",
    workerName: "",
    productionQty: "",
    totalHitQty: "",
    shipped: false,
    shippedDate: "",
    shippingNote: "",
    shippingNoteLocked: false
  },
  {
    id: crypto.randomUUID(),
    orderDate: "2026-04-21",
    company: "\uB300\uC131\uD14C\uD06C",
    product: "\uCEE4\uBC84 \uD50C\uB808\uC774\uD2B8",
    quantity: "120",
    paymentRequested: false,
    deliveryType: "\uBC1C\uC1A1",
    dueDate: "2026-04-28",
    status: "working",
    startTime: "2026-04-22T08:30:00",
    endTime: "",
    elapsedMs: 0,
    pauseReason: "",
    workQty: "",
    workHitQty: "",
    machineName: "1\uD638\uAE30",
    workerName: "\uC774\uBBFC\uC218",
    productionQty: "",
    totalHitQty: "",
    shipped: false,
    shippedDate: "",
    shippingNote: "",
    shippingNoteLocked: false
  }
];

const state = createEmptyState();
let dashboardFilter = "all";
let dashboardTimerId = null;
let isAdminLoggedIn = false;
let isDashboardListOpen = false;
let calendarCursor = new Date(new Date().getFullYear(), new Date().getMonth(), 1);
let adminMonthFilter = toMonthKey(new Date());
let isActivityFeedOpen = false;
let shippingFilter = "all";
let shippingSearchKeyword = "";
let lastStateSnapshot = "";
let syncTimerId = null;
let currentAdminEmail = "";

const adminLoginForm = document.getElementById("adminLoginForm");
const adminPageLoginForm = document.getElementById("adminPageLoginForm");
const adminLoginPanel = document.getElementById("adminLoginPanel");
const adminSessionPanel = document.getElementById("adminSessionPanel");
const adminSessionUser = document.getElementById("adminSessionUser");
const adminLogoutBtn = document.getElementById("adminLogoutBtn");
const resetOrdersBtn = document.getElementById("resetOrdersBtn");
const ordersLockedNotice = document.getElementById("ordersLockedNotice");
const ordersContent = document.getElementById("ordersContent");
const orderForm = document.getElementById("orderForm");
const orderEditPanel = document.getElementById("orderEditPanel");
const orderEditForm = document.getElementById("orderEditForm");
const editOrderIdInput = document.getElementById("editOrderId");
const editDueDateInput = document.getElementById("editDueDate");
const editQuantityInput = document.getElementById("editQuantity");
const editPaymentRequestedInput = document.getElementById("editPaymentRequested");
const editDeliveryTypeInput = document.getElementById("editDeliveryType");
const cancelEditBtn = document.getElementById("cancelEditBtn");
const workerForm = document.getElementById("workerForm");
const ordersTableBody = document.getElementById("ordersTableBody");
const orderSelect = document.getElementById("orderSelect");
const activityFeed = document.getElementById("activityFeed");
const statsGrid = document.getElementById("statsGrid");
const progressBoard = document.getElementById("progressBoard");
const progressTitle = document.getElementById("progressTitle");
const dashboardFilteredList = document.getElementById("dashboardFilteredList");
const dashboardListTitle = document.getElementById("dashboardListTitle");
const calendarTitle = document.getElementById("calendarTitle");
const calendarWeekdays = document.getElementById("calendarWeekdays");
const calendarGrid = document.getElementById("calendarGrid");
const calendarPrevBtn = document.getElementById("calendarPrevBtn");
const calendarNextBtn = document.getElementById("calendarNextBtn");
const todayChip = document.getElementById("todayChip");
const startWorkBtn = document.getElementById("startWorkBtn");
const pauseWorkBtn = document.getElementById("pauseWorkBtn");
const endWorkBtn = document.getElementById("endWorkBtn");
const workQtyInput = document.getElementById("workQty");
const workHitQtyInput = document.getElementById("workHitQty");
const pauseReasonInput = document.getElementById("pauseReason");
const savePauseBtn = document.getElementById("savePauseBtn");
const productionQtyInput = document.getElementById("productionQty");
const totalHitQtyInput = document.getElementById("totalHitQty");
const saveProductionBtn = document.getElementById("saveProductionBtn");
const workerAlert = document.getElementById("workerAlert");
const workerLiveStatus = document.getElementById("workerLiveStatus");
const historyToggleBtn = document.getElementById("historyToggleBtn");
const adminPageLocked = document.getElementById("adminPageLocked");
const adminPageContent = document.getElementById("adminPageContent");
const adminMonthInput = document.getElementById("adminMonthInput");
const equipmentList = document.getElementById("equipmentList");
const moldList = document.getElementById("moldList");
const journalList = document.getElementById("journalList");
const workerEfficiencyList = document.getElementById("workerEfficiencyList");
const shippingSummary = document.getElementById("shippingSummary");
const shippingTableBody = document.getElementById("shippingTableBody");
const shippingFilterAllBtn = document.getElementById("shippingFilterAllBtn");
const shippingFilterPendingBtn = document.getElementById("shippingFilterPendingBtn");
const shippingFilterDoneBtn = document.getElementById("shippingFilterDoneBtn");
const shippingSearchInput = document.getElementById("shippingSearchInput");
const confirmModal = document.getElementById("confirmModal");
const confirmYesBtn = document.getElementById("confirmYesBtn");
const confirmNoBtn = document.getElementById("confirmNoBtn");
const calendarDetailModal = document.getElementById("calendarDetailModal");
const calendarDetailTitle = document.getElementById("calendarDetailTitle");
const calendarDetailBody = document.getElementById("calendarDetailBody");
const calendarDetailCloseBtn = document.getElementById("calendarDetailCloseBtn");
const tabButtons = document.querySelectorAll(".page-tabs .tab-btn[data-view-target]");
const viewPanels = document.querySelectorAll(".view-panel");
let pendingCompletionOrderId = "";
let pendingCompletionWorkerName = "";
let pendingPauseOrderId = "";
let pendingPauseWorkerName = "";
let selectedCalendarDateKey = "";
const supabaseAuthClient = createSupabaseAuthClient();

bindEvents();
initializeApp();
startDashboardClock();

function bindEvents() {
  tabButtons.forEach((button) => {
    button.addEventListener("click", () => {
      const targetId = button.dataset.viewTarget;
      tabButtons.forEach((item) => item.classList.toggle("active", item === button));
      viewPanels.forEach((panel) => panel.classList.toggle("active", panel.id === targetId));
    });
  });

  adminLoginForm.addEventListener("submit", (event) => {
    event.preventDefault();
    handleAdminLogin(adminLoginForm);
  });

  adminPageLoginForm.addEventListener("submit", (event) => {
    event.preventDefault();
    handleAdminLogin(adminPageLoginForm);
  });

  adminLogoutBtn.addEventListener("click", () => {
    handleAdminLogout();
  });

  resetOrdersBtn.addEventListener("click", () => {
    if (!isAdminLoggedIn) return;
    confirmModal.hidden = false;
  });

  confirmNoBtn.addEventListener("click", () => {
    confirmModal.hidden = true;
  });

  calendarDetailCloseBtn.addEventListener("click", () => {
    calendarDetailModal.hidden = true;
  });

  confirmYesBtn.addEventListener("click", () => {
    state.orders = [];
    state.activities = [];
    state.equipmentLogs = [];
    state.moldLogs = [];
    state.productionJournals = [];
    persist();
    resetCompletionInputs();
    resetPauseInputs();
    closeOrderEditPanel();
    confirmModal.hidden = true;
    render();
  });

  calendarPrevBtn.addEventListener("click", () => {
    calendarCursor = new Date(calendarCursor.getFullYear(), calendarCursor.getMonth() - 1, 1);
    renderCalendar();
  });

  calendarNextBtn.addEventListener("click", () => {
    calendarCursor = new Date(calendarCursor.getFullYear(), calendarCursor.getMonth() + 1, 1);
    renderCalendar();
  });

  adminMonthInput.addEventListener("change", () => {
    adminMonthFilter = adminMonthInput.value || toMonthKey(new Date());
    renderAdminPage();
  });

  orderForm.addEventListener("submit", (event) => {
    event.preventDefault();
    if (!isAdminLoggedIn) return;
    const formData = new FormData(orderForm);
    const nextOrder = {
      id: crypto.randomUUID(),
      orderDate: String(formData.get("orderDate") || ""),
      company: String(formData.get("company") || "").trim(),
      product: String(formData.get("product") || "").trim(),
      quantity: String(formData.get("quantity") || "").trim(),
      paymentRequested: Boolean(formData.get("paymentRequested")),
      deliveryType: String(formData.get("deliveryType") || ""),
      dueDate: String(formData.get("dueDate") || ""),
      status: "ready",
      startTime: "",
      endTime: "",
      elapsedMs: 0,
      pauseReason: "",
      workQty: "",
      workHitQty: "",
      machineName: "",
      workerName: "",
      productionQty: "",
      totalHitQty: "",
      shipped: false,
      shippedDate: "",
      shippingNote: "",
      shippingNoteLocked: false
    };

    state.orders.unshift(nextOrder);
    state.activities.unshift({
      id: crypto.randomUUID(),
      type: "register",
      workerName: TEXT.admin,
      orderId: nextOrder.id,
      timestamp: new Date().toISOString(),
      message: TEXT.registerMessage
    });
    persist();
    orderForm.reset();
    render();
  });

  orderEditForm.addEventListener("submit", (event) => {
    event.preventDefault();
    if (!isAdminLoggedIn) return;

    const orderId = String(editOrderIdInput.value || "");
    const order = state.orders.find((item) => item.id === orderId);
    if (!order) return;

    order.dueDate = String(editDueDateInput.value || "");
    order.quantity = String(editQuantityInput.value || "").trim();
    order.paymentRequested = editPaymentRequestedInput.checked;
    order.deliveryType = String(editDeliveryTypeInput.value || "");

    state.activities.unshift({
      id: crypto.randomUUID(),
      type: "register",
      workerName: TEXT.admin,
      orderId: order.id,
      timestamp: new Date().toISOString(),
      message: "\uBC1C\uC8FC \uC815\uBCF4\uAC00 \uC218\uC815\uB418\uC5C8\uC2B5\uB2C8\uB2E4."
    });

    persist();
    closeOrderEditPanel();
    render();
  });

  cancelEditBtn.addEventListener("click", () => {
    closeOrderEditPanel();
  });

  startWorkBtn.addEventListener("click", () => updateWorkState("working"));
  pauseWorkBtn.addEventListener("click", preparePause);
  endWorkBtn.addEventListener("click", prepareCompletion);
  savePauseBtn.addEventListener("click", finalizePause);
  saveProductionBtn.addEventListener("click", finalizeCompletion);

  workerForm.addEventListener("input", () => {
    clearWorkerAlert();
    enableWorkerStartInputs();
  });

  workerForm.addEventListener("change", () => {
    clearWorkerAlert();
    enableWorkerStartInputs();
  });

  historyToggleBtn.addEventListener("click", () => {
    isActivityFeedOpen = !isActivityFeedOpen;
    renderActivities();
  });

  shippingFilterAllBtn.addEventListener("click", () => {
    shippingFilter = "all";
    renderShippingPage();
  });

  shippingFilterPendingBtn.addEventListener("click", () => {
    shippingFilter = "pending";
    renderShippingPage();
  });

  shippingFilterDoneBtn.addEventListener("click", () => {
    shippingFilter = "done";
    renderShippingPage();
  });

  shippingSearchInput.addEventListener("input", () => {
    shippingSearchKeyword = String(shippingSearchInput.value || "").trim().toLowerCase();
    renderShippingPage();
  });
}

function updateWorkState(nextStatus) {
  const formData = new FormData(workerForm);
  const workerName = String(formData.get("workerName") || "").trim();
  const machineName = String(formData.get("machineName") || "").trim();
  const orderId = String(formData.get("orderId") || "");
  if (!workerName || !machineName || !orderId) return;

  if (nextStatus === "working") {
    const hasOtherActiveWork = state.orders.some(
      (item) => item.workerName === workerName && item.status === "working" && item.id !== orderId
    );
    if (hasOtherActiveWork) {
      showWorkerAlert("같은 작업자가 이미 다른 작업을 진행 중입니다.");
      window.alert("같은 작업자가 이미 다른 작업을 진행 중입니다.");
      disableWorkerStartInputs();
      return;
    }

    const hasBusyMachine = state.orders.some(
      (item) => item.machineName === machineName && item.status === "working" && item.id !== orderId
    );
    if (hasBusyMachine) {
      showWorkerAlert("입력한 장비명은 현재 다른 작업에서 사용 중입니다.");
      window.alert("입력한 장비명은 현재 다른 작업에서 사용 중입니다.");
      disableWorkerStartInputs();
      return;
    }
  }

  clearWorkerAlert();
  enableWorkerStartInputs();

  const order = state.orders.find((item) => item.id === orderId);
  if (!order) return;

  const previousStatus = order.status;
  order.status = nextStatus;
  order.workerName = workerName;
  order.machineName = machineName;

  if (nextStatus === "working") {
    order.startTime = new Date().toISOString();
    order.endTime = "";
    if (previousStatus !== "paused") {
      order.elapsedMs = Number(order.elapsedMs || 0);
      if (previousStatus === "ready" || previousStatus === "complete") {
        order.elapsedMs = 0;
        order.workQty = "";
        order.workHitQty = "";
        order.productionQty = "";
        order.totalHitQty = "";
      }
    }
    order.pauseReason = "";
  } else {
    if (!order.startTime) {
      order.startTime = new Date().toISOString();
    }
    order.endTime = new Date().toISOString();
  }

  state.activities.unshift({
    id: crypto.randomUUID(),
    type: nextStatus === "working" ? "start" : "end",
    workerName,
    orderId,
    timestamp: new Date().toISOString(),
    message:
      nextStatus === "working"
        ? previousStatus === "paused"
          ? "\uC791\uC5C5\uC744 \uB2E4\uC2DC \uC2DC\uC791\uD588\uC2B5\uB2C8\uB2E4."
          : TEXT.startMessage
        : TEXT.endMessage
  });

  persist();
  if (nextStatus === "complete") {
    resetCompletionInputs();
  }
  render();
}

function showWorkerAlert(message) {
  workerAlert.textContent = message;
  workerAlert.hidden = false;
}

function clearWorkerAlert() {
  workerAlert.hidden = true;
  workerAlert.textContent = "";
}

function disableWorkerStartInputs() {
  startWorkBtn.disabled = true;
}

function enableWorkerStartInputs() {
  startWorkBtn.disabled = false;
}

function preparePause() {
  const formData = new FormData(workerForm);
  const workerName = String(formData.get("workerName") || "").trim();
  const machineName = String(formData.get("machineName") || "").trim();
  const orderId = String(formData.get("orderId") || "");
  if (!workerName || !machineName || !orderId) return;

  pendingPauseOrderId = orderId;
  pendingPauseWorkerName = workerName;
  workQtyInput.disabled = false;
  workHitQtyInput.disabled = false;
  pauseReasonInput.disabled = false;
  savePauseBtn.disabled = false;
  workQtyInput.focus();
}

function finalizePause() {
  const workQty = String(workQtyInput.value || "").trim();
  const workHitQty = String(workHitQtyInput.value || "").trim();
  const pauseReason = String(pauseReasonInput.value || "").trim();
  if (!pendingPauseOrderId || !pendingPauseWorkerName || !pauseReason) return;

  const order = state.orders.find((item) => item.id === pendingPauseOrderId);
  if (!order) {
    resetPauseInputs();
    return;
  }

  const now = new Date();
  order.elapsedMs = getAccumulatedElapsedMs(order, now.toISOString());
  order.status = "paused";
  order.workerName = pendingPauseWorkerName;
  order.startTime = "";
  order.pauseReason = pauseReason;
  order.workQty = workQty;
  order.workHitQty = workHitQty;
  order.productionQty = addNumericStrings(order.productionQty, workQty);
  order.totalHitQty = addNumericStrings(order.totalHitQty, workHitQty);

  state.activities.unshift({
    id: crypto.randomUUID(),
    type: "pause",
    workerName: pendingPauseWorkerName,
    orderId: pendingPauseOrderId,
    timestamp: now.toISOString(),
    message: `작업을 중지했습니다. / 사유 ${pauseReason}${workQty ? ` / 작업수량 ${workQty}` : ""}`
  });

  persist();
  resetPauseInputs();
  render();
}

function prepareCompletion() {
  const formData = new FormData(workerForm);
  const workerName = String(formData.get("workerName") || "").trim();
  const machineName = String(formData.get("machineName") || "").trim();
  const orderId = String(formData.get("orderId") || "");
  if (!workerName || !machineName || !orderId) return;

  pendingCompletionOrderId = orderId;
  pendingCompletionWorkerName = workerName;
  productionQtyInput.disabled = false;
  totalHitQtyInput.disabled = false;
  saveProductionBtn.disabled = false;
  productionQtyInput.focus();
}

function finalizeCompletion() {
  const productionQty = String(productionQtyInput.value || "").trim();
  const totalHitQty = String(totalHitQtyInput.value || "").trim();
  if (!pendingCompletionOrderId || !pendingCompletionWorkerName || productionQty === "") return;

  const order = state.orders.find((item) => item.id === pendingCompletionOrderId);
  if (!order) {
    resetCompletionInputs();
    return;
  }

  order.status = "complete";
  order.workerName = pendingCompletionWorkerName;
  const finishedAt = new Date().toISOString();
  order.endTime = finishedAt;
  order.productionQty = addNumericStrings(order.productionQty, productionQty);
  order.totalHitQty = addNumericStrings(order.totalHitQty, totalHitQty);
  order.elapsedMs = getAccumulatedElapsedMs(order, finishedAt);
  order.startTime = "";
  order.workQty = "";
  order.workHitQty = "";
  order.pauseReason = "";

  state.activities.unshift({
    id: crypto.randomUUID(),
    type: "end",
    workerName: pendingCompletionWorkerName,
    orderId: pendingCompletionOrderId,
    timestamp: new Date().toISOString(),
    message: `${TEXT.endMessage} / 오늘 작업수량 ${productionQty}${totalHitQty ? ` / 오늘 작업타수 ${totalHitQty}` : ""} / ${TEXT.productionQty} ${order.productionQty}${order.totalHitQty ? ` / ${TEXT.totalHitQty} ${order.totalHitQty}` : ""}`
  });

  persist();
  resetCompletionInputs();
  render();
}

function resetCompletionInputs() {
  pendingCompletionOrderId = "";
  pendingCompletionWorkerName = "";
  productionQtyInput.value = "";
  totalHitQtyInput.value = "";
  productionQtyInput.disabled = true;
  totalHitQtyInput.disabled = true;
  saveProductionBtn.disabled = true;
}

function resetPauseInputs() {
  pendingPauseOrderId = "";
  pendingPauseWorkerName = "";
  workQtyInput.value = "";
  workHitQtyInput.value = "";
  pauseReasonInput.value = "";
  workQtyInput.disabled = true;
  workHitQtyInput.disabled = true;
  pauseReasonInput.disabled = true;
  savePauseBtn.disabled = true;
}

function createEmptyState() {
  return {
    orders: seedOrders.map(normalizeOrderRecord),
    activities: [
      {
        id: crypto.randomUUID(),
        type: "start",
        workerName: "\uC774\uBBFC\uC218",
        orderId: seedOrders[1].id,
        timestamp: "2026-04-22T08:30:00",
        message: TEXT.startMessage
      }
    ]
  };
}

async function initializeApp() {
  await restoreAdminSession();
  await loadRemoteState();
  render();
  startStatePolling();
  bindAdminAuthListener();
}

async function loadRemoteState() {
  try {
    const remoteState = isSupabaseBackend() ? await fetchSupabaseState() : await fetchApiState();
    applyIncomingState(remoteState);
  } catch {
    applyIncomingState(createEmptyState());
  }
}

function applyIncomingState(nextState) {
  const normalized = normalizeAppState(nextState);
  state.orders = normalized.orders;
  state.activities = normalized.activities;
  lastStateSnapshot = JSON.stringify(normalized);
}

function normalizeAppState(appState) {
  return {
    orders: (appState.orders || []).map(normalizeOrderRecord),
    activities: appState.activities || []
  };
}

function isSupabaseBackend() {
  return BACKEND_MODE === "supabase";
}

function hasSupabaseConfig() {
  return Boolean(APP_CONFIG.supabaseUrl && APP_CONFIG.supabaseAnonKey);
}

function createSupabaseAuthClient() {
  if (!isSupabaseBackend() || !hasSupabaseConfig() || !window.supabase?.createClient) {
    return null;
  }

  return window.supabase.createClient(APP_CONFIG.supabaseUrl, APP_CONFIG.supabaseAnonKey);
}

function getAdminEmailAllowlist() {
  return (APP_CONFIG.adminEmails || []).map((email) => String(email || "").trim().toLowerCase()).filter(Boolean);
}

function isAllowedAdminEmail(email) {
  const normalizedEmail = String(email || "").trim().toLowerCase();
  const allowlist = getAdminEmailAllowlist();
  if (!normalizedEmail) return false;
  if (!allowlist.length) return true;
  return allowlist.includes(normalizedEmail);
}

function setAdminSession(email) {
  currentAdminEmail = String(email || "").trim().toLowerCase();
  isAdminLoggedIn = isAllowedAdminEmail(currentAdminEmail);
}

async function restoreAdminSession() {
  if (!supabaseAuthClient) return;
  const { data } = await supabaseAuthClient.auth.getSession();
  setAdminSession(data?.session?.user?.email || "");
}

function bindAdminAuthListener() {
  if (!supabaseAuthClient) return;
  supabaseAuthClient.auth.onAuthStateChange((_event, session) => {
    setAdminSession(session?.user?.email || "");
    renderAdminSession();
  });
}

async function fetchApiState() {
  const response = await fetch(API_STATE_URL, { cache: "no-store" });
  if (!response.ok) {
    throw new Error("state fetch failed");
  }
  return response.json();
}

function saveApiState(payload) {
  return fetch(API_STATE_URL, {
    method: "PUT",
    headers: {
      "Content-Type": "application/json"
    },
    body: payload
  });
}

function getSupabaseStateUrl() {
  const baseUrl = String(APP_CONFIG.supabaseUrl || "").replace(/\/$/, "");
  const table = APP_CONFIG.supabaseTable || "app_state";
  const rowId = encodeURIComponent(APP_CONFIG.supabaseRowId || "main");
  return `${baseUrl}/rest/v1/${table}?id=eq.${rowId}&select=payload`;
}

function getSupabaseTableUrl() {
  const baseUrl = String(APP_CONFIG.supabaseUrl || "").replace(/\/$/, "");
  const table = APP_CONFIG.supabaseTable || "app_state";
  return `${baseUrl}/rest/v1/${table}`;
}

function getSupabaseHeaders(extra = {}) {
  return {
    apikey: APP_CONFIG.supabaseAnonKey,
    Authorization: `Bearer ${APP_CONFIG.supabaseAnonKey}`,
    "Content-Type": "application/json",
    ...extra
  };
}

async function fetchSupabaseState() {
  if (!hasSupabaseConfig()) {
    throw new Error("missing supabase config");
  }

  const response = await fetch(getSupabaseStateUrl(), {
    headers: getSupabaseHeaders(),
    cache: "no-store"
  });
  if (!response.ok) {
    throw new Error("supabase state fetch failed");
  }

  const rows = await response.json();
  if (!rows.length || !rows[0].payload) {
    return createEmptyState();
  }

  return rows[0].payload;
}

function saveSupabaseState(nextState) {
  if (!hasSupabaseConfig()) {
    return Promise.reject(new Error("missing supabase config"));
  }

  return fetch(getSupabaseTableUrl(), {
    method: "POST",
    headers: getSupabaseHeaders({
      Prefer: "resolution=merge-duplicates,return=representation"
    }),
    body: JSON.stringify([
      {
        id: APP_CONFIG.supabaseRowId || "main",
        payload: nextState
      }
    ])
  }).then((response) => {
    if (!response.ok) {
      throw new Error("supabase save failed");
    }
    return response.json();
  });
}

function normalizeOrderRecord(order) {
  return {
    ...order,
    pauseReason: order.pauseReason || "",
    workQty: order.workQty || "",
    workHitQty: order.workHitQty || "",
    machineName: order.machineName || "",
    workerName: order.workerName || "",
    productionQty: order.productionQty || "",
    totalHitQty: order.totalHitQty || "",
    shipped: Boolean(order.shipped),
    shippedDate: order.shippedDate || "",
    shippingNote: order.shippingNote || "",
    shippingNoteLocked: Boolean(order.shippingNoteLocked),
    elapsedMs: Number(order.elapsedMs || 0)
  };
}

function toNumber(value) {
  const number = Number(value);
  return Number.isFinite(number) ? number : 0;
}

function addNumericStrings(currentValue, addedValue) {
  if (String(addedValue || "").trim() === "") {
    return String(currentValue || "");
  }

  return String(toNumber(currentValue) + toNumber(addedValue));
}

function persist() {
  const payload = JSON.stringify(normalizeAppState(state));
  lastStateSnapshot = payload;
  const request = isSupabaseBackend() ? saveSupabaseState(normalizeAppState(state)) : saveApiState(payload);
  return request.catch(() => {
    window.alert("서버 저장에 실패했습니다. 서버 연결 상태를 확인해 주세요.");
  });
}

function startStatePolling() {
  if (syncTimerId) {
    clearInterval(syncTimerId);
  }

  syncTimerId = setInterval(async () => {
    try {
      const remoteState = normalizeAppState(isSupabaseBackend() ? await fetchSupabaseState() : await fetchApiState());
      const snapshot = JSON.stringify(remoteState);
      if (snapshot === lastStateSnapshot) return;
      applyIncomingState(remoteState);
      render();
    } catch {
      // Keep current UI state if the network is temporarily unavailable.
    }
  }, POLL_INTERVAL_MS);
}

async function handleAdminLogin(formElement) {
  const formData = new FormData(formElement);
  const adminEmail = String(formData.get("adminEmail") || "").trim().toLowerCase();
  const adminPassword = String(formData.get("adminPassword") || "").trim();
  if (!supabaseAuthClient) {
    window.alert("관리자 인증 설정이 아직 연결되지 않았습니다.");
    return;
  }
  if (!adminEmail || !adminPassword) return;

  const { data, error } = await supabaseAuthClient.auth.signInWithPassword({
    email: adminEmail,
    password: adminPassword
  });

  if (error) {
    window.alert("로그인에 실패했습니다. 이메일 또는 비밀번호를 확인해 주세요.");
    return;
  }

  const sessionEmail = data?.user?.email || data?.session?.user?.email || adminEmail;
  if (!isAllowedAdminEmail(sessionEmail)) {
    await supabaseAuthClient.auth.signOut({ scope: "local" });
    window.alert("이 계정은 관리자 권한이 없습니다.");
    return;
  }

  setAdminSession(sessionEmail);
  adminLoginForm.reset();
  adminPageLoginForm.reset();
  renderAdminSession();
}

async function handleAdminLogout() {
  if (supabaseAuthClient) {
    await supabaseAuthClient.auth.signOut({ scope: "local" });
  }
  setAdminSession("");
  renderAdminSession();
}

function render() {
  renderAdminSession();
  todayChip.textContent = `${formatDate(new Date().toISOString().slice(0, 10))} ${TEXT.baseDate}`;
  renderStats();
  renderProgress();
  renderDashboardFilteredList();
  renderCalendar();
  renderOrdersTable();
  renderOrderOptions();
  renderActivities();
  renderWorkerLiveStatus();
  renderShippingPage();
  renderAdminPage();
}

function renderCalendar() {
  const weekdays = ["일", "월", "화", "수", "목", "금", "토"];
  calendarWeekdays.innerHTML = weekdays.map((day) => `<div class="calendar-weekday">${day}</div>`).join("");
  calendarTitle.textContent = `${calendarCursor.getFullYear()}년 ${calendarCursor.getMonth() + 1}월`;

  const firstDay = new Date(calendarCursor.getFullYear(), calendarCursor.getMonth(), 1);
  const startDay = new Date(firstDay);
  startDay.setDate(firstDay.getDate() - firstDay.getDay());
  const todayKey = toDateKey(new Date());

  calendarGrid.innerHTML = Array.from({ length: 42 }, (_, index) => {
    const cellDate = new Date(startDay);
    cellDate.setDate(startDay.getDate() + index);
    const dateKey = toDateKey(cellDate);
    const orders = getSortedOrders(state.orders.filter((order) => order.dueDate === dateKey));
    const isCurrentMonth = cellDate.getMonth() === calendarCursor.getMonth();
    const isToday = dateKey === todayKey;
    const urgent = orders.some((order) => order.status !== "complete" && daysUntil(order.dueDate) <= 3);

    return `
      <div class="calendar-day ${isCurrentMonth ? "" : "muted"} ${isToday ? "today" : ""} ${orders.length ? "has-due" : ""} ${urgent ? "urgent-due" : ""}">
        <div class="calendar-date">${cellDate.getDate()}</div>
        <div class="calendar-items">
          ${orders
            .slice(0, 2)
            .map(
              (order) =>
                `<button type="button" class="calendar-pill ${daysUntil(order.dueDate) <= 3 && order.status !== "complete" ? "urgent" : ""}" data-date-key="${dateKey}">${escapeHtml(order.company)}</button>`
            )
            .join("")}
          ${orders.length > 2 ? `<div class="calendar-pill">+${orders.length - 2}건</div>` : ""}
        </div>
      </div>
    `;
  }).join("");

  calendarGrid.querySelectorAll(".calendar-pill[data-date-key]").forEach((button) => {
    button.addEventListener("click", () => {
      openCalendarDetail(button.dataset.dateKey || "");
    });
  });
}

function openCalendarDetail(dateKey) {
  selectedCalendarDateKey = dateKey;
  renderCalendarDetail();
  calendarDetailModal.hidden = false;
}

function renderCalendarDetail() {
  if (!selectedCalendarDateKey) return;

  const orders = getSortedOrders(state.orders.filter((order) => order.dueDate === selectedCalendarDateKey));
  calendarDetailTitle.textContent = `${formatDate(selectedCalendarDateKey)} 납기 상세`;

  if (!orders.length) {
    calendarDetailBody.innerHTML = `<div class="empty-state">해당 날짜의 납기 데이터가 없습니다.</div>`;
    return;
  }

  calendarDetailBody.innerHTML = orders
    .map((order) => {
      return `
        <article class="feed-item">
          <div class="feed-item-top">
            <strong>${escapeHtml(order.company)}</strong>
            ${statusBadge(order, order.status !== "complete" && daysUntil(order.dueDate) <= 3)}
          </div>
          <div class="detail-lines">
            <p class="detail-line"><strong>제품명</strong> ${escapeHtml(order.product)}</p>
            <p class="detail-line"><strong>상태</strong> ${getOrderStatusText(order)}</p>
            <p class="detail-line"><strong>납기일</strong> ${formatDate(order.dueDate)}</p>
            <p class="detail-line"><strong>장비</strong> ${escapeHtml(order.machineName || "-")}</p>
            <p class="detail-line"><strong>수량</strong> ${escapeHtml(order.quantity || "-")}</p>
            <p class="detail-line"><strong>구분</strong> ${getPaymentLabel(order)} · ${getDeliveryLabel(order)}</p>
            <p class="detail-line"><strong>작업시간</strong> ${getWorkTimeLabel(order).replace(/^작업시간 /, "").replace(/^누적 작업시간 /, "").replace(/^총 작업시간 /, "")}</p>
            <p class="detail-line"><strong>총생산수</strong> ${getProductionQtyLabel(order).replace(`${TEXT.productionQty} `, "")}</p>
            <p class="detail-line"><strong>총타발수</strong> ${getTotalHitQtyLabel(order).replace(`${TEXT.totalHitQty} `, "")}</p>
          </div>
        </article>
      `;
    })
    .join("");
}

function getSortedOrders(orders) {
  return [...orders].sort((left, right) => {
    const paymentGap = Number(Boolean(right.paymentRequested)) - Number(Boolean(left.paymentRequested));
    if (paymentGap !== 0) return paymentGap;

    const leftDue = new Date(left.dueDate).getTime();
    const rightDue = new Date(right.dueDate).getTime();
    if (leftDue !== rightDue) return leftDue - rightDue;

    return new Date(right.orderDate).getTime() - new Date(left.orderDate).getTime();
  });
}

function renderAdminSession() {
  adminLoginPanel.hidden = isAdminLoggedIn;
  adminSessionPanel.hidden = !isAdminLoggedIn;
  adminSessionUser.textContent = currentAdminEmail || "admin";
  ordersLockedNotice.hidden = isAdminLoggedIn;
  ordersContent.hidden = !isAdminLoggedIn;
  Array.from(orderForm.elements).forEach((element) => {
    element.disabled = !isAdminLoggedIn;
  });
  Array.from(orderEditForm.elements).forEach((element) => {
    if (element === cancelEditBtn) return;
    element.disabled = !isAdminLoggedIn;
  });
  if (!isAdminLoggedIn) {
    closeOrderEditPanel();
  }
  adminPageLocked.hidden = isAdminLoggedIn;
  adminPageContent.hidden = !isAdminLoggedIn;
}

function renderAdminPage() {
  adminMonthInput.value = adminMonthFilter;
  renderEquipmentList();
  renderMoldList();
  renderJournalList();
  renderWorkerEfficiency();
}

function renderStats() {
  const cards = [
    { key: "all", label: TEXT.allOrders, value: state.orders.length, hint: TEXT.registeredAll },
    { key: "ready", label: TEXT.waiting, value: state.orders.filter((item) => item.status === "ready").length, hint: TEXT.beforeStart },
    { key: "working", label: TEXT.working, value: state.orders.filter((item) => item.status === "working").length, hint: TEXT.inProduction },
    {
      key: "urgent",
      label: TEXT.urgent,
      value: state.orders.filter((item) => item.status !== "complete" && daysUntil(item.dueDate) <= 3).length,
      hint: TEXT.dueSoon
    }
  ];

  statsGrid.innerHTML = cards
    .map(
      (card) => `
        <button type="button" class="stat-card ${dashboardFilter === card.key ? "active" : ""}" data-filter="${card.key}">
          <span>${card.label}</span>
          <strong>${card.value}</strong>
          <p>${card.hint}</p>
        </button>
      `
    )
    .join("");

  statsGrid.querySelectorAll(".stat-card").forEach((card) => {
    card.addEventListener("click", () => {
      const nextFilter = card.dataset.filter || "all";
      if (dashboardFilter === nextFilter && isDashboardListOpen) {
        isDashboardListOpen = false;
      } else {
        dashboardFilter = nextFilter;
        isDashboardListOpen = true;
      }
      renderStats();
      renderProgress();
      renderDashboardFilteredList();
      if (isDashboardListOpen) {
        dashboardFilteredList.scrollIntoView({ behavior: "smooth", block: "start" });
      }
    });
  });
}

function renderProgress() {
  const filteredOrders = getSortedOrders(getDashboardFilteredOrders());
  progressTitle.textContent = `${getDashboardFilterTitle().replace(TEXT.listSuffix, "")} ${TEXT.progressSuffix}`;

  if (filteredOrders.length === 0) {
    progressBoard.innerHTML = `<div class="empty-state">${TEXT.noProgress}</div>`;
    return;
  }

  progressBoard.innerHTML = filteredOrders
    .map((order) => {
      const percent = getProgressPercent(order);
      const urgent = order.status !== "complete" && daysUntil(order.dueDate) <= 3;
      return `
        <article class="progress-card ${order.status === "paused" ? "paused-card" : ""}">
          <div class="progress-top">
            <div>
              <strong>${escapeHtml(order.product)}</strong>
              <p class="progress-meta">${escapeHtml(order.company)}</p>
            </div>
            ${statusBadge(order, urgent)}
          </div>
          <div class="bar-track">
            <div class="bar-fill" style="width: ${percent}%"></div>
          </div>
          <p class="progress-meta">${TEXT.dueDate} ${formatDate(order.dueDate)}${order.workerName ? ` · ${TEXT.worker} ${escapeHtml(order.workerName)}` : ""}</p>
          <p class="progress-meta">${order.machineName ? `장비 ${escapeHtml(order.machineName)}` : "장비 미지정"}</p>
          <p class="progress-meta">수량 ${escapeHtml(order.quantity || "-")}</p>
          <p class="progress-meta">${getPaymentLabel(order)} · ${getDeliveryLabel(order)}</p>
          ${order.status === "paused" ? `<div class="paused-flag">작업 중지 · ${escapeHtml(order.pauseReason || "사유 미입력")}</div>` : ""}
          <p class="progress-meta">${getWorkTimeLabel(order)}</p>
          <p class="progress-meta">${getProductionQtyLabel(order)}</p>
          <p class="progress-meta">${getTotalHitQtyLabel(order)}</p>
        </article>
      `;
    })
    .join("");
}

function renderDashboardFilteredList() {
  const filteredOrders = getSortedOrders(getDashboardFilteredOrders());
  dashboardListTitle.textContent = getDashboardFilterTitle();

  if (!isDashboardListOpen) {
    dashboardFilteredList.innerHTML = `<div class="empty-state">카드를 누르면 해당 리스트가 표시됩니다.</div>`;
    return;
  }

  if (filteredOrders.length === 0) {
    dashboardFilteredList.innerHTML = `<div class="empty-state">${TEXT.noFiltered}</div>`;
    return;
  }

  dashboardFilteredList.innerHTML = filteredOrders
    .map((order) => {
      const urgent = order.status !== "complete" && daysUntil(order.dueDate) <= 3;
      return `
        <article class="progress-card ${order.status === "paused" ? "paused-card" : ""}">
          <div class="progress-top">
            <div>
              <strong>${escapeHtml(order.product)}</strong>
              <p class="progress-meta">${escapeHtml(order.company)}</p>
            </div>
            ${statusBadge(order, urgent)}
          </div>
          <p class="progress-meta">${TEXT.orderDate} ${formatDate(order.orderDate)} · ${TEXT.dueDate} ${formatDate(order.dueDate)}</p>
          <p class="progress-meta">${order.machineName ? `장비 ${escapeHtml(order.machineName)}` : "장비 미지정"}</p>
          <p class="progress-meta">수량 ${escapeHtml(order.quantity || "-")}</p>
          <p class="progress-meta">${getPaymentLabel(order)} · ${getDeliveryLabel(order)}</p>
          ${order.status === "paused" ? `<div class="paused-flag">작업 중지 · ${escapeHtml(order.pauseReason || "사유 미입력")}</div>` : ""}
          <p class="progress-meta">${order.workerName ? `${TEXT.worker} ${escapeHtml(order.workerName)}` : TEXT.unassigned}</p>
          <p class="progress-meta">${getWorkTimeLabel(order)}</p>
          <p class="progress-meta">${getProductionQtyLabel(order)}</p>
          <p class="progress-meta">${getTotalHitQtyLabel(order)}</p>
        </article>
      `;
    })
    .join("");
}

function renderOrdersTable() {
  if (state.orders.length === 0) {
    ordersTableBody.innerHTML = `<tr><td colspan="9"><div class="empty-state">${TEXT.noOrders}</div></td></tr>`;
    return;
  }

  ordersTableBody.innerHTML = getSortedOrders(state.orders)
    .map((order) => {
      const urgent = order.status !== "complete" && daysUntil(order.dueDate) <= 3;
      return `
        <tr class="${urgent ? "danger-row" : ""}">
          <td>${formatDate(order.orderDate)}</td>
          <td>${escapeHtml(order.company)}</td>
          <td>${escapeHtml(order.product)}</td>
          <td>${escapeHtml(order.quantity || "-")}</td>
          <td>${order.paymentRequested ? "요청" : "-"}</td>
          <td>${escapeHtml(order.deliveryType || "-")}</td>
          <td class="${urgent ? "danger-text" : ""}">${formatDate(order.dueDate)}</td>
          <td>${statusBadge(order, urgent)}</td>
          <td><button type="button" class="tab-btn edit-order-btn" data-order-id="${order.id}">수정</button></td>
        </tr>
      `;
    })
    .join("");

  ordersTableBody.querySelectorAll(".edit-order-btn").forEach((button) => {
    button.addEventListener("click", () => {
      if (!isAdminLoggedIn) return;
      openOrderEditPanel(button.dataset.orderId || "");
    });
  });
}

function renderShippingPage() {
  const orders = getFilteredShippingOrders();

  const shippedCount = orders.filter((order) => order.shipped).length;
  const pendingCount = orders.filter((order) => !order.shipped).length;
  const overdueCount = orders.filter((order) => !order.shipped && daysUntil(order.dueDate) < 0).length;
  const dueTodayCount = orders.filter((order) => !order.shipped && daysUntil(order.dueDate) === 0).length;

  shippingFilterAllBtn.classList.toggle("active", shippingFilter === "all");
  shippingFilterPendingBtn.classList.toggle("active", shippingFilter === "pending");
  shippingFilterDoneBtn.classList.toggle("active", shippingFilter === "done");
  shippingSearchInput.value = shippingSearchKeyword;

  shippingSummary.innerHTML = [
    { label: "전체 출하 대상", value: orders.length, hint: "등록된 전체 발주" },
    { label: "출하 완료", value: shippedCount, hint: "출하 처리된 발주" },
    { label: "출하 대기", value: pendingCount, hint: "아직 출하 전" },
    { label: "오늘 납기", value: dueTodayCount + overdueCount, hint: "오늘 납기 및 경과" }
  ]
    .map(
      (card) => `
        <article class="stat-card">
          <span>${card.label}</span>
          <strong>${card.value}</strong>
          <p>${card.hint}</p>
        </article>
      `
    )
    .join("");

  if (orders.length === 0) {
    shippingTableBody.innerHTML = `<tr><td colspan="9"><div class="empty-state">${TEXT.noOrders}</div></td></tr>`;
    return;
  }

  shippingTableBody.innerHTML = orders
    .map((order) => {
      const shippingState = getShippingStatus(order);
      return `
        <tr class="${shippingState.rowClass}">
          <td>${escapeHtml(order.company)}</td>
          <td>${escapeHtml(order.product)}</td>
          <td class="${shippingState.dueClass}">${formatDate(order.dueDate)}</td>
          <td>${escapeHtml(order.quantity || "-")}</td>
          <td>${statusBadge(order, false)}</td>
          <td><span class="status-badge ${shippingState.badgeClass}">${shippingState.label}</span></td>
          <td>${order.shippedDate ? formatDate(order.shippedDate) : "-"}</td>
          <td>
            <div class="shipping-note-wrap">
              <input type="text" value="${escapeHtml(order.shippingNote || "")}" placeholder="출하 메모 입력" data-note-order-id="${order.id}" />
              <button type="button" class="tab-btn shipping-note-save-btn" data-order-id="${order.id}">메모 저장</button>
            </div>
          </td>
          <td>
            <button type="button" class="tab-btn shipping-action-btn" data-order-id="${order.id}" data-action="${order.shipped ? "locked" : "ship"}" ${order.shipped ? "disabled" : ""}>
              ${order.shipped ? "출하 완료" : "출하 완료"}
            </button>
          </td>
        </tr>
      `;
    })
    .join("");

  orders.forEach((order) => {
    const noteInput = shippingTableBody.querySelector(`input[data-note-order-id="${order.id}"]`);
    const noteButton = shippingTableBody.querySelector(`.shipping-note-save-btn[data-order-id="${order.id}"]`);

    if (noteInput) {
      noteInput.disabled = order.shipped || order.shippingNoteLocked;
    }
    if (noteButton) {
      noteButton.disabled = order.shipped;
      noteButton.textContent = order.shipped ? "출하 완료" : order.shippingNoteLocked ? "메모 수정" : "메모 저장";
    }
  });

  shippingTableBody.querySelectorAll(".shipping-action-btn").forEach((button) => {
    button.addEventListener("click", () => {
      const order = state.orders.find((item) => item.id === (button.dataset.orderId || ""));
      if (!order) return;
      if (order.shipped) return;

      if (button.dataset.action === "ship") {
        order.shipped = true;
        order.shippedDate = new Date().toISOString().slice(0, 10);
        order.shippingNoteLocked = true;
        state.activities.unshift({
          id: crypto.randomUUID(),
          type: "shipping",
          workerName: TEXT.admin,
          orderId: order.id,
          timestamp: new Date().toISOString(),
          message: "출하 완료 처리되었습니다."
        });
      } else {
        order.shipped = false;
        order.shippedDate = "";
        state.activities.unshift({
          id: crypto.randomUUID(),
          type: "shipping",
          workerName: TEXT.admin,
          orderId: order.id,
          timestamp: new Date().toISOString(),
          message: "출하 완료가 취소되었습니다."
        });
      }

      persist();
      renderShippingPage();
    });
  });

  shippingTableBody.querySelectorAll(".shipping-note-save-btn").forEach((button) => {
    button.addEventListener("click", () => {
      const order = state.orders.find((item) => item.id === (button.dataset.orderId || ""));
      if (!order) return;
      if (order.shipped) return;

      const noteInput = shippingTableBody.querySelector(`input[data-note-order-id="${order.id}"]`);
      if (order.shippingNoteLocked) {
        order.shippingNoteLocked = false;
      } else {
        order.shippingNote = String(noteInput?.value || "").trim();
        order.shippingNoteLocked = true;
      }
      persist();
      renderShippingPage();
    });
  });
}

function renderOrderOptions() {
  const selectableOrders = getSortedOrders(
    state.orders.filter((order) => order.status === "ready" || order.status === "paused")
  );

  if (selectableOrders.length === 0) {
    orderSelect.innerHTML = `<option value="">${TEXT.noTasks}</option>`;
    return;
  }

  orderSelect.innerHTML = selectableOrders
    .map((order) => `<option value="${order.id}">${escapeHtml(order.company)} · ${escapeHtml(order.product)}</option>`)
    .join("");
}

function renderActivities() {
  const sortedOrders = getSortedOrders(state.orders);

  historyToggleBtn.textContent = isActivityFeedOpen ? "작업 이력 닫기" : "작업 이력 보기";

  if (!isActivityFeedOpen) {
    activityFeed.innerHTML = `<div class="empty-state">버튼을 누르면 작업 이력이 표시됩니다.</div>`;
    return;
  }

  if (sortedOrders.length === 0) {
    activityFeed.innerHTML = `<div class="empty-state">${TEXT.noActivity}</div>`;
    return;
  }

  const grouped = new Map();

  sortedOrders.forEach((order) => {
    const workerKey = order.workerName || TEXT.admin;
    if (!grouped.has(workerKey)) {
      grouped.set(workerKey, []);
    }
    grouped.get(workerKey).push(order);
  });

  activityFeed.innerHTML = [...grouped.entries()]
    .map(([workerName, orders]) => {
      const items = orders
        .map((order) => {
          const latestActivity = state.activities.find((activity) => activity.orderId === order.id);
          const badgeClass = order.status === "complete" ? "status-complete" : order.status === "working" ? "status-working" : order.status === "paused" ? "status-warning" : "status-ready";
          const badgeText = order.status === "complete" ? TEXT.complete : order.status === "working" ? TEXT.working : order.status === "paused" ? TEXT.paused : TEXT.waiting;
          const orderText = `${order.company} / ${order.product}`;
          const activityMessage = latestActivity ? latestActivity.message : TEXT.registerMessage;
          const activityTime = latestActivity ? formatDateTime(latestActivity.timestamp) : formatDateTime(order.orderDate);
          return `
            <article class="feed-item ${order.status === "paused" ? "paused-card" : ""}">
              <div class="feed-item-top">
                <strong>${escapeHtml(orderText)}</strong>
                <span class="status-badge ${badgeClass}">${badgeText}</span>
              </div>
              <p class="feed-meta">${escapeHtml(activityMessage)} · ${activityTime}</p>
              <p class="feed-meta">납기일 ${formatDate(order.dueDate)} · 장비 ${escapeHtml(order.machineName || "-")} · 수량 ${escapeHtml(order.quantity || "-")} · ${getPaymentLabel(order)} · ${getDeliveryLabel(order)}</p>
              ${order.pauseReason ? `<p class="feed-meta">중지사유 ${escapeHtml(order.pauseReason)}${order.workQty ? ` · 작업수량 ${escapeHtml(order.workQty)}` : ""}</p>` : ""}
            </article>
          `;
        })
        .join("");

      return `
        <section class="activity-group">
          <div class="section-head compact">
            <h3>${escapeHtml(workerName)}</h3>
            <p>작업 건수 ${orders.length}</p>
          </div>
          <div class="activity-feed">
            ${items}
          </div>
        </section>
      `;
    })
    .join("");

}

function populateWorkerFormFromOrder(order) {
  const workerNameInput = workerForm.elements.namedItem("workerName");
  const machineNameInput = workerForm.elements.namedItem("machineName");

  if (workerNameInput) {
    workerNameInput.value = order.workerName || "";
  }
  if (machineNameInput) {
    machineNameInput.value = order.machineName || "";
  }

  let option = orderSelect.querySelector(`option[value="${order.id}"]`);
  if (!option) {
    option = document.createElement("option");
    option.value = order.id;
    option.textContent = `${order.company} · ${order.product}`;
    orderSelect.prepend(option);
  }
  orderSelect.value = order.id;
}

function renderWorkerLiveStatus() {
  const workingOrders = getSortedOrders(state.orders.filter((order) => order.status === "working" || order.status === "paused"));

  if (workingOrders.length === 0) {
    workerLiveStatus.innerHTML = `<div class="empty-state">${TEXT.noWorkTime}</div>`;
    return;
  }

  workerLiveStatus.innerHTML = workingOrders
    .map((order) => {
      return `
        <article class="progress-card">
          <div class="progress-top">
            <div>
              <strong>${escapeHtml(order.product)}</strong>
              <p class="progress-meta">${escapeHtml(order.company)}</p>
            </div>
            <span class="status-badge ${order.status === "paused" ? "status-warning" : "status-working"}">${order.status === "paused" ? TEXT.paused : TEXT.working}</span>
          </div>
          <p class="progress-meta">${order.workerName ? `${TEXT.worker} ${escapeHtml(order.workerName)}` : TEXT.unassigned}</p>
          <p class="progress-meta">${order.machineName ? `장비 ${escapeHtml(order.machineName)}` : "장비 미지정"}</p>
          <p class="progress-meta">${getWorkTimeLabel(order)}</p>
          ${order.pauseReason ? `<p class="progress-meta">중지사유 ${escapeHtml(order.pauseReason)}${order.workQty ? ` · 작업수량 ${escapeHtml(order.workQty)}` : ""}</p>` : ""}
          <div class="feed-actions">
            ${order.status === "working" ? `<button type="button" class="tab-btn live-action-btn" data-order-id="${order.id}" data-action="pause">작업중지</button>` : ""}
            <button type="button" class="tab-btn live-action-btn" data-order-id="${order.id}" data-action="complete">작업종료</button>
          </div>
        </article>
      `;
    })
    .join("");

  workerLiveStatus.querySelectorAll(".live-action-btn").forEach((button) => {
    button.addEventListener("click", () => {
      const order = state.orders.find((item) => item.id === (button.dataset.orderId || ""));
      if (!order) return;
      populateWorkerFormFromOrder(order);

      if (button.dataset.action === "pause") {
        preparePause();
      }
      if (button.dataset.action === "complete") {
        prepareCompletion();
      }
    });
  });
}

function renderEquipmentList() {
  const rows = buildEquipmentSummary();
  if (!rows.length) {
    equipmentList.innerHTML = `<div class="empty-state">작업자 입력 기반 장비 가동 데이터가 없습니다.</div>`;
    return;
  }

  equipmentList.innerHTML = rows
    .map((item) => {
      return `
        <article class="progress-card">
          <div class="progress-top">
            <strong>${escapeHtml(item.name)}</strong>
            <span class="status-badge ${item.percent >= 85 ? "status-working" : item.percent >= 60 ? "status-ready" : "status-warning"}">${item.percent}%</span>
          </div>
          <p class="progress-meta">총 작업시간 ${formatElapsedMs(item.actualMs)} · 기준시간 ${formatElapsedMs(item.plannedMs)}</p>
          <p class="progress-meta">작업건수 ${item.jobCount} · 작업자 ${item.workerCount}</p>
          <div class="bar-track"><div class="bar-fill" style="width:${Math.min(item.percent, 100)}%"></div></div>
        </article>
      `;
    })
    .join("");
}

function renderMoldList() {
  const rows = buildMoldSummary();
  if (!rows.length) {
    moldList.innerHTML = `<div class="empty-state">작업자 입력 기반 타수 데이터가 없습니다.</div>`;
    return;
  }

  moldList.innerHTML = rows
    .map((item) => {
      return `
        <article class="progress-card">
          <div class="progress-top">
            <strong>${escapeHtml(item.name)}</strong>
            <span class="status-badge ${item.percent >= 90 ? "status-warning" : "status-working"}">${item.percent}%</span>
          </div>
          <p class="progress-meta">누적 타수 ${item.currentShots.toLocaleString()} · 목표 추정 ${item.targetShots.toLocaleString()}타</p>
          <p class="progress-meta">완료수량 ${item.completedQty.toLocaleString()} · 진행수량 ${item.inProgressQty.toLocaleString()}</p>
          <div class="bar-track"><div class="bar-fill" style="width:${Math.min(item.percent, 100)}%"></div></div>
        </article>
      `;
    })
    .join("");
}

function renderJournalList() {
  const rows = buildProductionJournal();
  if (!rows.length) {
    journalList.innerHTML = `<div class="empty-state">작업자 입력 기반 생산일지가 없습니다.</div>`;
    return;
  }

  journalList.innerHTML = rows
    .map((item) => {
      return `
        <article class="feed-item">
          <div class="feed-item-top">
            <strong>${formatDate(item.date)}</strong>
            <span class="status-badge status-ready">${item.statusText}</span>
          </div>
          <p class="feed-meta">${escapeHtml(item.orderText)} · 작업자 ${escapeHtml(item.workerName)} · 장비 ${escapeHtml(item.machineName || "-")}</p>
          <p class="feed-meta">생산수량 ${Number(item.qty || 0).toLocaleString()} · 작업시간 ${formatElapsedMs(item.elapsedMs || 0)}</p>
          <p class="feed-meta">${escapeHtml(item.note)}</p>
        </article>
      `;
    })
    .join("");
}

function renderWorkerEfficiency() {
  const workerMap = new Map();

  getAdminMonthOrders().forEach((order) => {
    if (!order.workerName) return;
    if (!workerMap.has(order.workerName)) {
      workerMap.set(order.workerName, {
        workerName: order.workerName,
        totalQty: 0,
        totalMs: 0,
        pausedCount: 0,
        completeCount: 0
      });
    }

    const worker = workerMap.get(order.workerName);
    worker.totalQty += Number(order.productionQty || 0);
    worker.totalMs += Number(order.elapsedMs || 0);
    if (order.pauseReason) worker.pausedCount += 1;
    if (order.status === "complete") worker.completeCount += 1;
  });

  const rows = [...workerMap.values()];
  if (!rows.length) {
    workerEfficiencyList.innerHTML = `<div class="empty-state">집계할 작업자 데이터가 없습니다.</div>`;
    return;
  }

  workerEfficiencyList.innerHTML = rows
    .sort((a, b) => b.totalQty - a.totalQty)
    .map((item) => {
      const hours = item.totalMs / (1000 * 60 * 60);
      const efficiency = hours > 0 ? (item.totalQty / hours).toFixed(1) : "0.0";
      return `
        <article class="progress-card">
          <div class="progress-top">
            <strong>${escapeHtml(item.workerName)}</strong>
            <span class="status-badge status-working">효율 ${efficiency}</span>
          </div>
          <p class="progress-meta">누적 생산수 ${item.totalQty.toLocaleString()} · 누적 작업시간 ${formatElapsedMs(item.totalMs)}</p>
          <p class="progress-meta">완료건 ${item.completeCount} · 중지이력 ${item.pausedCount} · 시간당 생산 ${efficiency}</p>
        </article>
      `;
    })
    .join("");
}

function buildEquipmentSummary() {
  const equipmentMap = new Map();

  getAdminMonthOrders().forEach((order) => {
    const name = order.machineName || "미지정 장비";
    if (!equipmentMap.has(name)) {
      equipmentMap.set(name, { name, actualMs: 0, jobCount: 0, workerSet: new Set() });
    }
    const row = equipmentMap.get(name);
    row.actualMs += Number(order.elapsedMs || 0);
    if (Number(order.elapsedMs || 0) > 0 || order.status === "working" || order.status === "paused" || order.status === "complete") {
      row.jobCount += 1;
    }
    if (order.workerName) {
      row.workerSet.add(order.workerName);
    }
  });

  return [...equipmentMap.values()]
    .filter((item) => item.jobCount > 0)
    .map((item) => {
      const plannedMs = item.jobCount * 8 * 60 * 60 * 1000;
      const percent = plannedMs > 0 ? Math.round((item.actualMs / plannedMs) * 100) : 0;
      return {
        name: item.name,
        actualMs: item.actualMs,
        plannedMs,
        percent: Math.min(percent, 100),
        jobCount: item.jobCount,
        workerCount: item.workerSet.size
      };
    });
}

function buildMoldSummary() {
  return getSortedOrders(state.orders).map((order) => {
    const completedQty = Number(order.totalHitQty || 0);
    const inProgressQty = order.status === "working" ? Number(order.workHitQty || 0) : 0;
    const currentShots = completedQty;
    const targetShots = 100000;
    const percent = targetShots > 0 ? Math.round((currentShots / targetShots) * 100) : 0;

    return {
      name: `${order.product}`,
      currentShots,
      targetShots,
      completedQty,
      inProgressQty,
      percent: Math.min(percent, 100)
    };
  });
}

function buildProductionJournal() {
  return getSortedOrders(getAdminMonthOrders())
    .filter((order) => order.workerName || order.productionQty || order.totalHitQty || order.workQty || order.workHitQty || order.pauseReason)
    .map((order) => ({
      date: (order.endTime || order.startTime || order.orderDate || "").slice(0, 10),
      workerName: order.workerName || TEXT.admin,
      machineName: order.machineName || "",
      qty: Number(order.productionQty || 0),
      hitQty: Number(order.totalHitQty || 0),
      elapsedMs: Number(order.elapsedMs || 0),
      statusText: order.status === "complete" ? TEXT.complete : order.status === "paused" ? TEXT.paused : order.status === "working" ? TEXT.working : TEXT.waiting,
      orderText: `${order.company} / ${order.product}`,
      note: order.pauseReason
        ? `중지사유: ${order.pauseReason}`
        : order.status === "complete"
          ? "작업이 완료되었습니다."
          : order.status === "working"
            ? "작업 진행 중입니다."
            : "작업 대기 상태입니다."
    }));
}

function openOrderEditPanel(orderId) {
  const order = state.orders.find((item) => item.id === orderId);
  if (!order) return;

  editOrderIdInput.value = order.id;
  editDueDateInput.value = order.dueDate;
  editQuantityInput.value = order.quantity || "";
  editPaymentRequestedInput.checked = Boolean(order.paymentRequested);
  editDeliveryTypeInput.value = order.deliveryType || "\uC9C1\uB0A9";
  orderEditPanel.hidden = false;
}

function closeOrderEditPanel() {
  orderEditPanel.hidden = true;
  orderEditForm.reset();
}

function getPaymentLabel(order) {
  return order.paymentRequested ? "지급요청" : "지급요청 없음";
}

function getDeliveryLabel(order) {
  return order.deliveryType ? `구분 ${escapeHtml(order.deliveryType)}` : "구분 없음";
}

function getProgressPercent(order) {
  const targetQty = Number(order.quantity || 0);
  const completedQty = Number(order.productionQty || 0);

  if (order.status === "complete") {
    return 100;
  }

  if (targetQty > 0 && completedQty > 0) {
    const qtyPercent = Math.round((completedQty / targetQty) * 100);
    return Math.max(order.status === "working" ? 10 : 5, Math.min(qtyPercent, 99));
  }

  if (order.status === "working") {
    return 25;
  }
  if (order.status === "paused") {
    return 20;
  }
  return 5;
}

function getShippingStatus(order) {
  if (order.shipped) {
    const dueTime = new Date(order.dueDate).getTime();
    const shippedTime = new Date(order.shippedDate || order.dueDate).getTime();
    if (shippedTime > dueTime) {
      return { label: "지연 출하", badgeClass: "status-warning", rowClass: "", dueClass: "" };
    }
    return { label: "출하 완료", badgeClass: "status-complete", rowClass: "", dueClass: "" };
  }

  if (daysUntil(order.dueDate) < 0) {
    return { label: "납기 경과", badgeClass: "status-warning", rowClass: "danger-row", dueClass: "danger-text" };
  }
  if (daysUntil(order.dueDate) === 0) {
    return { label: "오늘 출하 확인", badgeClass: "status-warning", rowClass: "danger-row", dueClass: "danger-text" };
  }
  return { label: "출하 대기", badgeClass: "status-ready", rowClass: "", dueClass: "" };
}

function getFilteredShippingOrders() {
  return getSortedOrders(state.orders).filter((order) => {
    const matchesFilter =
      shippingFilter === "done" ? order.shipped : shippingFilter === "pending" ? !order.shipped : true;

    const keyword = shippingSearchKeyword.trim();
    const matchesKeyword =
      !keyword ||
      order.company.toLowerCase().includes(keyword) ||
      order.product.toLowerCase().includes(keyword);

    return matchesFilter && matchesKeyword;
  });
}

function getDashboardFilteredOrders() {
  if (dashboardFilter === "ready") {
    return state.orders.filter((item) => item.status === "ready");
  }
  if (dashboardFilter === "working") {
    return state.orders.filter((item) => item.status === "working");
  }
  if (dashboardFilter === "urgent") {
    return state.orders.filter((item) => item.status !== "complete" && daysUntil(item.dueDate) <= 3);
  }
  return state.orders;
}

function getDashboardFilterTitle() {
  if (dashboardFilter === "ready") return TEXT.waitingList;
  if (dashboardFilter === "working") return TEXT.workingList;
  if (dashboardFilter === "urgent") return TEXT.urgentList;
  return TEXT.allOrdersList;
}

function statusBadge(order, urgent) {
  if (urgent) {
    return `<span class="status-badge status-warning">${TEXT.urgent}</span>`;
  }
  if (order.status === "working") {
    return `<span class="status-badge status-working">${TEXT.working}</span>`;
  }
  if (order.status === "paused") {
    return `<span class="status-badge status-warning">${TEXT.paused}</span>`;
  }
  if (order.status === "complete") {
    return `<span class="status-badge status-complete">${TEXT.complete}</span>`;
  }
  return `<span class="status-badge status-ready">${TEXT.waiting}</span>`;
}

function getOrderStatusText(order) {
  if (order.status === "working") return TEXT.working;
  if (order.status === "paused") return TEXT.paused;
  if (order.status === "complete") return TEXT.complete;
  return TEXT.waiting;
}

function getWorkTimeLabel(order) {
  if (order.status === "working" && order.startTime) {
    return `작업시간 ${formatElapsedMs(getAccumulatedElapsedMs(order, new Date().toISOString()))}`;
  }
  if (order.status === "paused") {
    return `누적 작업시간 ${formatElapsedMs(order.elapsedMs || 0)}`;
  }
  if (order.status === "complete") {
    return `총 작업시간 ${formatElapsedMs(order.elapsedMs || 0)}`;
  }
  if (order.startTime) {
    return `시작시간 ${formatDateTime(order.startTime)}`;
  }
  return "작업시간 없음";
}

function getProductionQtyLabel(order) {
  if (order.productionQty !== undefined && order.productionQty !== null && order.productionQty !== "") {
    return `${TEXT.productionQty} ${escapeHtml(order.productionQty)}`;
  }
  return `${TEXT.productionQty} -`;
}

function getTotalHitQtyLabel(order) {
  if (order.totalHitQty !== undefined && order.totalHitQty !== null && order.totalHitQty !== "") {
    return `${TEXT.totalHitQty} ${escapeHtml(order.totalHitQty)}`;
  }
  return `${TEXT.totalHitQty} -`;
}

function formatElapsed(startIso, endIso) {
  const start = new Date(startIso);
  const end = new Date(endIso);
  const diffMs = Math.max(0, end - start);
  return formatElapsedMs(diffMs);
}

function formatElapsedMs(diffMs) {
  const totalSeconds = Math.floor(diffMs / 1000);
  const hours = Math.floor(totalSeconds / 3600);
  const minutes = Math.floor((totalSeconds % 3600) / 60);
  const seconds = totalSeconds % 60;
  return `${String(hours).padStart(2, "0")}:${String(minutes).padStart(2, "0")}:${String(seconds).padStart(2, "0")}`;
}

function getAccumulatedElapsedMs(order, endIso) {
  const base = Number(order.elapsedMs || 0);
  if (!order.startTime) return base;
  const start = new Date(order.startTime).getTime();
  const end = new Date(endIso).getTime();
  return base + Math.max(0, end - start);
}

function startDashboardClock() {
  if (dashboardTimerId) {
    clearInterval(dashboardTimerId);
  }
  dashboardTimerId = setInterval(() => {
    const hasWorkingOrder = state.orders.some((order) => order.status === "working" && order.startTime);
    if (!hasWorkingOrder) return;
    renderProgress();
    renderDashboardFilteredList();
    renderWorkerLiveStatus();
    if (!calendarDetailModal.hidden && selectedCalendarDateKey) {
      renderCalendarDetail();
    }
  }, 1000);
}

function daysUntil(dateString) {
  const today = new Date();
  today.setHours(0, 0, 0, 0);
  const target = new Date(dateString);
  target.setHours(0, 0, 0, 0);
  return Math.ceil((target - today) / (1000 * 60 * 60 * 24));
}

function toDateKey(value) {
  const date = new Date(value);
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, "0");
  const day = String(date.getDate()).padStart(2, "0");
  return `${year}-${month}-${day}`;
}

function toMonthKey(value) {
  const date = new Date(value);
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, "0");
  return `${year}-${month}`;
}

function getAdminMonthOrders() {
  return state.orders.filter((order) => {
    const baseDate = order.endTime || order.startTime || order.orderDate;
    if (!baseDate) return false;
    return toMonthKey(baseDate) === adminMonthFilter;
  });
}

function formatDate(dateString) {
  return new Intl.DateTimeFormat("ko-KR", {
    year: "numeric",
    month: "2-digit",
    day: "2-digit"
  }).format(new Date(dateString));
}

function formatDateTime(dateString) {
  return new Intl.DateTimeFormat("ko-KR", {
    month: "2-digit",
    day: "2-digit",
    hour: "2-digit",
    minute: "2-digit"
  }).format(new Date(dateString));
}

function escapeHtml(value) {
  return String(value)
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;")
    .replaceAll("'", "&#39;");
}

function handlePersistError() {
  window.alert("서버 저장에 실패했습니다. 서버 연결 상태를 확인해 주세요.");
}

function getCleanWorkTimeValue(order) {
  return getWorkTimeLabel(order)
    .replace(/^작업시간 /, "")
    .replace(/^누적 작업시간 /, "")
    .replace(/^총 작업시간 /, "")
    .replace(/^시작시간 /, "");
}

async function handleAdminLogin(formElement) {
  const formData = new FormData(formElement);
  const adminEmail = String(formData.get("adminEmail") || "").trim().toLowerCase();
  const adminPassword = String(formData.get("adminPassword") || "").trim();
  if (!supabaseAuthClient) {
    window.alert("관리자 인증 설정이 아직 연결되지 않았습니다.");
    return;
  }
  if (!adminEmail || !adminPassword) return;

  const { data, error } = await supabaseAuthClient.auth.signInWithPassword({
    email: adminEmail,
    password: adminPassword
  });

  if (error) {
    window.alert("로그인에 실패했습니다. 이메일 또는 비밀번호를 확인해 주세요.");
    return;
  }

  const sessionEmail = data?.user?.email || data?.session?.user?.email || adminEmail;
  if (!isAllowedAdminEmail(sessionEmail)) {
    await supabaseAuthClient.auth.signOut({ scope: "local" });
    window.alert("이 계정은 관리자 권한이 없습니다.");
    return;
  }

  setAdminSession(sessionEmail);
  adminLoginForm.reset();
  adminPageLoginForm.reset();
  renderAdminSession();
}

function renderCalendar() {
  const weekdays = ["일", "월", "화", "수", "목", "금", "토"];
  calendarWeekdays.innerHTML = weekdays.map((day) => `<div class="calendar-weekday">${day}</div>`).join("");
  calendarTitle.textContent = `${calendarCursor.getFullYear()}년 ${calendarCursor.getMonth() + 1}월`;

  const firstDay = new Date(calendarCursor.getFullYear(), calendarCursor.getMonth(), 1);
  const startDay = new Date(firstDay);
  startDay.setDate(firstDay.getDate() - firstDay.getDay());
  const todayKey = toDateKey(new Date());

  calendarGrid.innerHTML = Array.from({ length: 42 }, (_, index) => {
    const cellDate = new Date(startDay);
    cellDate.setDate(startDay.getDate() + index);
    const dateKey = toDateKey(cellDate);
    const orders = getSortedOrders(state.orders.filter((order) => order.dueDate === dateKey));
    const isCurrentMonth = cellDate.getMonth() === calendarCursor.getMonth();
    const isToday = dateKey === todayKey;
    const urgent = orders.some((order) => order.status !== "complete" && daysUntil(order.dueDate) <= 3);

    return `
      <div class="calendar-day ${isCurrentMonth ? "" : "muted"} ${isToday ? "today" : ""} ${orders.length ? "has-due" : ""} ${urgent ? "urgent-due" : ""}">
        <div class="calendar-date">${cellDate.getDate()}</div>
        <div class="calendar-items">
          ${orders
            .slice(0, 2)
            .map(
              (order) =>
                `<button type="button" class="calendar-pill ${daysUntil(order.dueDate) <= 3 && order.status !== "complete" ? "urgent" : ""}" data-date-key="${dateKey}">${escapeHtml(order.company)}</button>`
            )
            .join("")}
          ${orders.length > 2 ? `<div class="calendar-pill">+${orders.length - 2}건</div>` : ""}
        </div>
      </div>
    `;
  }).join("");

  calendarGrid.querySelectorAll(".calendar-pill[data-date-key]").forEach((button) => {
    button.addEventListener("click", () => {
      openCalendarDetail(button.dataset.dateKey || "");
    });
  });
}

function renderCalendarDetail() {
  if (!selectedCalendarDateKey) return;

  const orders = getSortedOrders(state.orders.filter((order) => order.dueDate === selectedCalendarDateKey));
  calendarDetailTitle.textContent = `${formatDate(selectedCalendarDateKey)} 납기 상세`;

  if (!orders.length) {
    calendarDetailBody.innerHTML = `<div class="empty-state">해당 날짜의 납기 데이터가 없습니다.</div>`;
    return;
  }

  calendarDetailBody.innerHTML = orders
    .map((order) => {
      return `
        <article class="feed-item">
          <div class="feed-item-top">
            <strong>${escapeHtml(order.company)}</strong>
            ${statusBadge(order, order.status !== "complete" && daysUntil(order.dueDate) <= 3)}
          </div>
          <div class="detail-lines">
            <p class="detail-line"><strong>제품명</strong> ${escapeHtml(order.product)}</p>
            <p class="detail-line"><strong>상태</strong> ${getOrderStatusText(order)}</p>
            <p class="detail-line"><strong>납기일</strong> ${formatDate(order.dueDate)}</p>
            <p class="detail-line"><strong>장비</strong> ${escapeHtml(order.machineName || "-")}</p>
            <p class="detail-line"><strong>수량</strong> ${escapeHtml(order.quantity || "-")}</p>
            <p class="detail-line"><strong>구분</strong> ${getPaymentLabel(order)} · ${getDeliveryLabel(order)}</p>
            <p class="detail-line"><strong>작업시간</strong> ${getCleanWorkTimeValue(order)}</p>
            <p class="detail-line"><strong>총생산수</strong> ${getProductionQtyLabel(order).replace(`${TEXT.productionQty} `, "")}</p>
            <p class="detail-line"><strong>총타발수</strong> ${getTotalHitQtyLabel(order).replace(`${TEXT.totalHitQty} `, "")}</p>
          </div>
        </article>
      `;
    })
    .join("");
}

function renderProgress() {
  const filteredOrders = getSortedOrders(getDashboardFilteredOrders());
  progressTitle.textContent = `${getDashboardFilterTitle().replace(TEXT.listSuffix, "")} ${TEXT.progressSuffix}`;

  if (filteredOrders.length === 0) {
    progressBoard.innerHTML = `<div class="empty-state">${TEXT.noProgress}</div>`;
    return;
  }

  progressBoard.innerHTML = filteredOrders
    .map((order) => {
      const percent = getProgressPercent(order);
      const urgent = order.status !== "complete" && daysUntil(order.dueDate) <= 3;
      return `
        <article class="progress-card ${order.status === "paused" ? "paused-card" : ""}">
          <div class="progress-top">
            <div>
              <strong>${escapeHtml(order.product)}</strong>
              <p class="progress-meta">${escapeHtml(order.company)}</p>
            </div>
            ${statusBadge(order, urgent)}
          </div>
          <div class="bar-track">
            <div class="bar-fill" style="width: ${percent}%"></div>
          </div>
          <p class="progress-meta">${TEXT.dueDate} ${formatDate(order.dueDate)}${order.workerName ? ` · ${TEXT.worker} ${escapeHtml(order.workerName)}` : ""}</p>
          <p class="progress-meta">${order.machineName ? `장비 ${escapeHtml(order.machineName)}` : "장비 미지정"}</p>
          <p class="progress-meta">수량 ${escapeHtml(order.quantity || "-")}</p>
          <p class="progress-meta">${getPaymentLabel(order)} · ${getDeliveryLabel(order)}</p>
          ${order.status === "paused" ? `<div class="paused-flag">작업 중지 · ${escapeHtml(order.pauseReason || "사유 미입력")}</div>` : ""}
          <p class="progress-meta">${getWorkTimeLabel(order)}</p>
          <p class="progress-meta">${getProductionQtyLabel(order)}</p>
          <p class="progress-meta">${getTotalHitQtyLabel(order)}</p>
        </article>
      `;
    })
    .join("");
}

function renderDashboardFilteredList() {
  const filteredOrders = getSortedOrders(getDashboardFilteredOrders());
  dashboardListTitle.textContent = getDashboardFilterTitle();

  if (!isDashboardListOpen) {
    dashboardFilteredList.innerHTML = `<div class="empty-state">카드를 누르면 해당 리스트가 표시됩니다.</div>`;
    return;
  }

  if (filteredOrders.length === 0) {
    dashboardFilteredList.innerHTML = `<div class="empty-state">${TEXT.noFiltered}</div>`;
    return;
  }

  dashboardFilteredList.innerHTML = filteredOrders
    .map((order) => {
      const urgent = order.status !== "complete" && daysUntil(order.dueDate) <= 3;
      return `
        <article class="progress-card ${order.status === "paused" ? "paused-card" : ""}">
          <div class="progress-top">
            <div>
              <strong>${escapeHtml(order.product)}</strong>
              <p class="progress-meta">${escapeHtml(order.company)}</p>
            </div>
            ${statusBadge(order, urgent)}
          </div>
          <p class="progress-meta">${TEXT.orderDate} ${formatDate(order.orderDate)} · ${TEXT.dueDate} ${formatDate(order.dueDate)}</p>
          <p class="progress-meta">${order.machineName ? `장비 ${escapeHtml(order.machineName)}` : "장비 미지정"}</p>
          <p class="progress-meta">수량 ${escapeHtml(order.quantity || "-")}</p>
          <p class="progress-meta">${getPaymentLabel(order)} · ${getDeliveryLabel(order)}</p>
          ${order.status === "paused" ? `<div class="paused-flag">작업 중지 · ${escapeHtml(order.pauseReason || "사유 미입력")}</div>` : ""}
          <p class="progress-meta">${order.workerName ? `${TEXT.worker} ${escapeHtml(order.workerName)}` : TEXT.unassigned}</p>
          <p class="progress-meta">${getWorkTimeLabel(order)}</p>
          <p class="progress-meta">${getProductionQtyLabel(order)}</p>
          <p class="progress-meta">${getTotalHitQtyLabel(order)}</p>
        </article>
      `;
    })
    .join("");
}

function renderOrdersTable() {
  if (state.orders.length === 0) {
    ordersTableBody.innerHTML = `<tr><td colspan="9"><div class="empty-state">${TEXT.noOrders}</div></td></tr>`;
    return;
  }

  ordersTableBody.innerHTML = getSortedOrders(state.orders)
    .map((order) => {
      const urgent = order.status !== "complete" && daysUntil(order.dueDate) <= 3;
      return `
        <tr class="${urgent ? "danger-row" : ""}">
          <td>${formatDate(order.orderDate)}</td>
          <td>${escapeHtml(order.company)}</td>
          <td>${escapeHtml(order.product)}</td>
          <td>${escapeHtml(order.quantity || "-")}</td>
          <td>${order.paymentRequested ? "요청" : "-"}</td>
          <td>${escapeHtml(order.deliveryType || "-")}</td>
          <td class="${urgent ? "danger-text" : ""}">${formatDate(order.dueDate)}</td>
          <td>${statusBadge(order, urgent)}</td>
          <td><button type="button" class="tab-btn edit-order-btn" data-order-id="${order.id}">수정</button></td>
        </tr>
      `;
    })
    .join("");

  ordersTableBody.querySelectorAll(".edit-order-btn").forEach((button) => {
    button.addEventListener("click", () => {
      if (!isAdminLoggedIn) return;
      openOrderEditPanel(button.dataset.orderId || "");
    });
  });
}

function renderShippingPage() {
  const orders = getFilteredShippingOrders();

  const shippedCount = orders.filter((order) => order.shipped).length;
  const pendingCount = orders.filter((order) => !order.shipped).length;
  const overdueCount = orders.filter((order) => !order.shipped && daysUntil(order.dueDate) < 0).length;
  const dueTodayCount = orders.filter((order) => !order.shipped && daysUntil(order.dueDate) === 0).length;

  shippingFilterAllBtn.classList.toggle("active", shippingFilter === "all");
  shippingFilterPendingBtn.classList.toggle("active", shippingFilter === "pending");
  shippingFilterDoneBtn.classList.toggle("active", shippingFilter === "done");
  shippingSearchInput.value = shippingSearchKeyword;

  shippingSummary.innerHTML = [
    { label: "전체 출하 대상", value: orders.length, hint: "등록된 전체 발주" },
    { label: "출하 완료", value: shippedCount, hint: "출하 처리된 발주" },
    { label: "출하 대기", value: pendingCount, hint: "아직 출하 전" },
    { label: "오늘 확인", value: dueTodayCount + overdueCount, hint: "오늘 납기 및 경과" }
  ]
    .map(
      (card) => `
        <article class="stat-card">
          <span>${card.label}</span>
          <strong>${card.value}</strong>
          <p>${card.hint}</p>
        </article>
      `
    )
    .join("");

  if (orders.length === 0) {
    shippingTableBody.innerHTML = `<tr><td colspan="9"><div class="empty-state">${TEXT.noOrders}</div></td></tr>`;
    return;
  }

  shippingTableBody.innerHTML = orders
    .map((order) => {
      const shippingState = getShippingStatus(order);
      return `
        <tr class="${shippingState.rowClass}">
          <td>${escapeHtml(order.company)}</td>
          <td>${escapeHtml(order.product)}</td>
          <td class="${shippingState.dueClass}">${formatDate(order.dueDate)}</td>
          <td>${escapeHtml(order.quantity || "-")}</td>
          <td>${statusBadge(order, false)}</td>
          <td><span class="status-badge ${shippingState.badgeClass}">${shippingState.label}</span></td>
          <td>${order.shippedDate ? formatDate(order.shippedDate) : "-"}</td>
          <td>
            <div class="shipping-note-wrap">
              <input type="text" value="${escapeHtml(order.shippingNote || "")}" placeholder="출하 메모 입력" data-note-order-id="${order.id}" />
              <button type="button" class="tab-btn shipping-note-save-btn" data-order-id="${order.id}">메모 저장</button>
            </div>
          </td>
          <td>
            <button type="button" class="tab-btn shipping-action-btn" data-order-id="${order.id}" data-action="${order.shipped ? "locked" : "ship"}" ${order.shipped ? "disabled" : ""}>
              출하 완료
            </button>
          </td>
        </tr>
      `;
    })
    .join("");

  orders.forEach((order) => {
    const noteInput = shippingTableBody.querySelector(`input[data-note-order-id="${order.id}"]`);
    const noteButton = shippingTableBody.querySelector(`.shipping-note-save-btn[data-order-id="${order.id}"]`);

    if (noteInput) {
      noteInput.disabled = order.shipped || order.shippingNoteLocked;
    }
    if (noteButton) {
      noteButton.disabled = order.shipped;
      noteButton.textContent = order.shipped ? "출하 완료" : order.shippingNoteLocked ? "메모 수정" : "메모 저장";
    }
  });

  shippingTableBody.querySelectorAll(".shipping-action-btn").forEach((button) => {
    button.addEventListener("click", () => {
      const order = state.orders.find((item) => item.id === (button.dataset.orderId || ""));
      if (!order || order.shipped) return;

      order.shipped = true;
      order.shippedDate = new Date().toISOString().slice(0, 10);
      order.shippingNoteLocked = true;
      state.activities.unshift({
        id: crypto.randomUUID(),
        type: "shipping",
        workerName: TEXT.admin,
        orderId: order.id,
        timestamp: new Date().toISOString(),
        message: "출하 완료 처리되었습니다."
      });

      persist().catch(handlePersistError);
      renderShippingPage();
    });
  });

  shippingTableBody.querySelectorAll(".shipping-note-save-btn").forEach((button) => {
    button.addEventListener("click", () => {
      const order = state.orders.find((item) => item.id === (button.dataset.orderId || ""));
      if (!order || order.shipped) return;

      const noteInput = shippingTableBody.querySelector(`input[data-note-order-id="${order.id}"]`);
      if (order.shippingNoteLocked) {
        order.shippingNoteLocked = false;
      } else {
        order.shippingNote = String(noteInput?.value || "").trim();
        order.shippingNoteLocked = true;
      }
      persist().catch(handlePersistError);
      renderShippingPage();
    });
  });
}

function renderActivities() {
  const sortedOrders = getSortedOrders(state.orders);

  historyToggleBtn.textContent = isActivityFeedOpen ? "작업 이력 닫기" : "작업 이력 보기";

  if (!isActivityFeedOpen) {
    activityFeed.innerHTML = `<div class="empty-state">버튼을 누르면 작업 이력이 표시됩니다.</div>`;
    return;
  }

  if (sortedOrders.length === 0) {
    activityFeed.innerHTML = `<div class="empty-state">${TEXT.noActivity}</div>`;
    return;
  }

  const grouped = new Map();

  sortedOrders.forEach((order) => {
    const workerKey = order.workerName || TEXT.admin;
    if (!grouped.has(workerKey)) {
      grouped.set(workerKey, []);
    }
    grouped.get(workerKey).push(order);
  });

  activityFeed.innerHTML = [...grouped.entries()]
    .map(([workerName, orders]) => {
      const items = orders
        .map((order) => {
          const latestActivity = state.activities.find((activity) => activity.orderId === order.id);
          const badgeClass = order.status === "complete" ? "status-complete" : order.status === "working" ? "status-working" : order.status === "paused" ? "status-warning" : "status-ready";
          const badgeText = order.status === "complete" ? TEXT.complete : order.status === "working" ? TEXT.working : order.status === "paused" ? TEXT.paused : TEXT.waiting;
          const orderText = `${order.company} / ${order.product}`;
          const activityMessage = latestActivity ? latestActivity.message : TEXT.registerMessage;
          const activityTime = latestActivity ? formatDateTime(latestActivity.timestamp) : formatDateTime(order.orderDate);
          return `
            <article class="feed-item ${order.status === "paused" ? "paused-card" : ""}">
              <div class="feed-item-top">
                <strong>${escapeHtml(orderText)}</strong>
                <span class="status-badge ${badgeClass}">${badgeText}</span>
              </div>
              <p class="feed-meta">${escapeHtml(activityMessage)} · ${activityTime}</p>
              <p class="feed-meta">납기일 ${formatDate(order.dueDate)} · 장비 ${escapeHtml(order.machineName || "-")} · 수량 ${escapeHtml(order.quantity || "-")} · ${getPaymentLabel(order)} · ${getDeliveryLabel(order)}</p>
              ${order.pauseReason ? `<p class="feed-meta">중지사유 ${escapeHtml(order.pauseReason)}${order.workQty ? ` · 작업수량 ${escapeHtml(order.workQty)}` : ""}</p>` : ""}
            </article>
          `;
        })
        .join("");

      return `
        <section class="activity-group">
          <div class="section-head compact">
            <h3>${escapeHtml(workerName)}</h3>
            <p>작업 건수 ${orders.length}</p>
          </div>
          <div class="activity-feed">
            ${items}
          </div>
        </section>
      `;
    })
    .join("");
}

function renderWorkerLiveStatus() {
  const workingOrders = getSortedOrders(state.orders.filter((order) => order.status === "working" || order.status === "paused"));

  if (workingOrders.length === 0) {
    workerLiveStatus.innerHTML = `<div class="empty-state">${TEXT.noWorkTime}</div>`;
    return;
  }

  workerLiveStatus.innerHTML = workingOrders
    .map((order) => {
      return `
        <article class="progress-card">
          <div class="progress-top">
            <div>
              <strong>${escapeHtml(order.product)}</strong>
              <p class="progress-meta">${escapeHtml(order.company)}</p>
            </div>
            <span class="status-badge ${order.status === "paused" ? "status-warning" : "status-working"}">${order.status === "paused" ? TEXT.paused : TEXT.working}</span>
          </div>
          <p class="progress-meta">${order.workerName ? `${TEXT.worker} ${escapeHtml(order.workerName)}` : TEXT.unassigned}</p>
          <p class="progress-meta">${order.machineName ? `장비 ${escapeHtml(order.machineName)}` : "장비 미지정"}</p>
          <p class="progress-meta">${getWorkTimeLabel(order)}</p>
          ${order.pauseReason ? `<p class="progress-meta">중지사유 ${escapeHtml(order.pauseReason)}${order.workQty ? ` · 작업수량 ${escapeHtml(order.workQty)}` : ""}</p>` : ""}
          <div class="feed-actions">
            ${order.status === "working" ? `<button type="button" class="tab-btn live-action-btn" data-order-id="${order.id}" data-action="pause">작업중지</button>` : ""}
            <button type="button" class="tab-btn live-action-btn" data-order-id="${order.id}" data-action="complete">작업종료</button>
          </div>
        </article>
      `;
    })
    .join("");

  workerLiveStatus.querySelectorAll(".live-action-btn").forEach((button) => {
    button.addEventListener("click", () => {
      const order = state.orders.find((item) => item.id === (button.dataset.orderId || ""));
      if (!order) return;
      populateWorkerFormFromOrder(order);

      if (button.dataset.action === "pause") {
        preparePause();
      }
      if (button.dataset.action === "complete") {
        prepareCompletion();
      }
    });
  });
}

function renderEquipmentList() {
  const rows = buildEquipmentSummary();
  if (!rows.length) {
    equipmentList.innerHTML = `<div class="empty-state">작업자 입력 기반 장비 가동 데이터가 없습니다.</div>`;
    return;
  }

  equipmentList.innerHTML = rows
    .map((item) => {
      return `
        <article class="progress-card">
          <div class="progress-top">
            <strong>${escapeHtml(item.name)}</strong>
            <span class="status-badge ${item.percent >= 85 ? "status-working" : item.percent >= 60 ? "status-ready" : "status-warning"}">${item.percent}%</span>
          </div>
          <p class="progress-meta">총 작업시간 ${formatElapsedMs(item.actualMs)} · 기준시간 ${formatElapsedMs(item.plannedMs)}</p>
          <p class="progress-meta">작업건수 ${item.jobCount} · 작업자 ${item.workerCount}</p>
          <div class="bar-track"><div class="bar-fill" style="width:${Math.min(item.percent, 100)}%"></div></div>
        </article>
      `;
    })
    .join("");
}

function renderMoldList() {
  const rows = buildMoldSummary();
  if (!rows.length) {
    moldList.innerHTML = `<div class="empty-state">작업자 입력 기반 타수 데이터가 없습니다.</div>`;
    return;
  }

  moldList.innerHTML = rows
    .map((item) => {
      return `
        <article class="progress-card">
          <div class="progress-top">
            <strong>${escapeHtml(item.name)}</strong>
            <span class="status-badge ${item.percent >= 90 ? "status-warning" : "status-working"}">${item.percent}%</span>
          </div>
          <p class="progress-meta">현재 타수 ${item.currentShots.toLocaleString()} · 목표 추정 ${item.targetShots.toLocaleString()}타</p>
          <p class="progress-meta">완료수량 ${item.completedQty.toLocaleString()} · 진행수량 ${item.inProgressQty.toLocaleString()}</p>
          <div class="bar-track"><div class="bar-fill" style="width:${Math.min(item.percent, 100)}%"></div></div>
        </article>
      `;
    })
    .join("");
}

function renderJournalList() {
  const rows = buildProductionJournal();
  if (!rows.length) {
    journalList.innerHTML = `<div class="empty-state">작업자 입력 기반 생산일지가 없습니다.</div>`;
    return;
  }

  journalList.innerHTML = rows
    .map((item) => {
      return `
        <article class="feed-item">
          <div class="feed-item-top">
            <strong>${formatDate(item.date)}</strong>
            <span class="status-badge status-ready">${item.statusText}</span>
          </div>
          <p class="feed-meta">${escapeHtml(item.orderText)} · 작업자 ${escapeHtml(item.workerName)} · 장비 ${escapeHtml(item.machineName || "-")}</p>
          <p class="feed-meta">생산수량 ${Number(item.qty || 0).toLocaleString()} · 작업시간 ${formatElapsedMs(item.elapsedMs || 0)}</p>
          <p class="feed-meta">${escapeHtml(item.note)}</p>
        </article>
      `;
    })
    .join("");
}

function renderWorkerEfficiency() {
  const workerMap = new Map();

  getAdminMonthOrders().forEach((order) => {
    if (!order.workerName) return;
    if (!workerMap.has(order.workerName)) {
      workerMap.set(order.workerName, {
        workerName: order.workerName,
        totalQty: 0,
        totalMs: 0,
        pausedCount: 0,
        completeCount: 0
      });
    }

    const worker = workerMap.get(order.workerName);
    worker.totalQty += Number(order.productionQty || 0);
    worker.totalMs += Number(order.elapsedMs || 0);
    if (order.pauseReason) worker.pausedCount += 1;
    if (order.status === "complete") worker.completeCount += 1;
  });

  const rows = [...workerMap.values()];
  if (!rows.length) {
    workerEfficiencyList.innerHTML = `<div class="empty-state">집계할 작업자 데이터가 없습니다.</div>`;
    return;
  }

  workerEfficiencyList.innerHTML = rows
    .sort((a, b) => b.totalQty - a.totalQty)
    .map((item) => {
      const hours = item.totalMs / (1000 * 60 * 60);
      const efficiency = hours > 0 ? (item.totalQty / hours).toFixed(1) : "0.0";
      return `
        <article class="progress-card">
          <div class="progress-top">
            <strong>${escapeHtml(item.workerName)}</strong>
            <span class="status-badge status-working">효율 ${efficiency}</span>
          </div>
          <p class="progress-meta">누적 생산수 ${item.totalQty.toLocaleString()} · 누적 작업시간 ${formatElapsedMs(item.totalMs)}</p>
          <p class="progress-meta">완료건 ${item.completeCount} · 중지이력 ${item.pausedCount} · 시간당 생산 ${efficiency}</p>
        </article>
      `;
    })
    .join("");
}

function getPaymentLabel(order) {
  return order.paymentRequested ? "지급요청" : "지급요청 없음";
}

function getDeliveryLabel(order) {
  return order.deliveryType ? `구분 ${escapeHtml(order.deliveryType)}` : "구분 없음";
}

function getWorkTimeLabel(order) {
  if (order.status === "working" && order.startTime) {
    return `작업시간 ${formatElapsedMs(getAccumulatedElapsedMs(order, new Date().toISOString()))}`;
  }
  if (order.status === "paused") {
    return `누적 작업시간 ${formatElapsedMs(order.elapsedMs || 0)}`;
  }
  if (order.status === "complete") {
    return `총 작업시간 ${formatElapsedMs(order.elapsedMs || 0)}`;
  }
  if (order.startTime) {
    return `시작시간 ${formatDateTime(order.startTime)}`;
  }
  return "작업시간 없음";
}
