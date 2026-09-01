const {
  getBearerToken,
  getPushServerConfig,
  sendJson,
  sendWebPush,
  supabaseRequest
} = require("../lib/push-server");

const ACTIVE_STATUSES = new Set(["working", "break"]);
const WAITING_STATUSES = new Set(["ready", "paused"]);
const PUSH_NOTIFICATION_ROLES = new Set(["production", "admin"]);

function getKstDateParts(date = new Date()) {
  const parts = new Intl.DateTimeFormat("en-CA", {
    timeZone: "Asia/Seoul",
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
    weekday: "short"
  }).formatToParts(date).reduce((result, part) => {
    result[part.type] = part.value;
    return result;
  }, {});
  return {
    dateKey: `${parts.year}-${parts.month}-${parts.day}`,
    weekday: parts.weekday
  };
}

function getKstDateKey(value) {
  const date = new Date(value || "");
  if (!Number.isFinite(date.getTime())) return "";
  return getKstDateParts(date).dateKey;
}

function normalizeWorkerName(value) {
  return String(value || "").normalize("NFKC").trim().toLowerCase().replace(/\s+/g, "");
}

function getDisplayName(user = {}) {
  const registeredName = String(
    user.user_metadata?.display_name || user.user_metadata?.name || user.user_metadata?.full_name || ""
  ).trim();
  const role = String(user.app_metadata?.jhint_role || "").trim().toLowerCase();
  return registeredName || (role === "admin" ? "관리자" : "");
}

function isUserWorkRecord(record, userId, workerName) {
  const recordUserId = String(record?.workerUserId || record?.worker_user_id || "").trim();
  if (recordUserId) return recordUserId === String(userId || "").trim();
  return normalizeWorkerName(record?.workerName) === normalizeWorkerName(workerName);
}

function getUserActiveOrders(orders, workerName, userId = "") {
  const workerKey = normalizeWorkerName(workerName);
  return (Array.isArray(orders) ? orders : []).filter(
    (order) => ACTIVE_STATUSES.has(order.status) && workerKey && isUserWorkRecord(order, userId, workerName)
  );
}

function shouldSendMorningReminder({ orders = [], activities = [], workerName = "", userId = "", dateKey = "" } = {}) {
  const workerKey = normalizeWorkerName(workerName);
  const hasWaitingWork = orders.some((order) => {
    if (!WAITING_STATUSES.has(order.status)) return false;
    const assignedUserId = String(order.workerUserId || order.worker_user_id || "").trim();
    const assignedName = normalizeWorkerName(order.workerName);
    if (!assignedUserId && !assignedName) return true;
    return isUserWorkRecord(order, userId, workerName);
  });
  const hasActiveWork = getUserActiveOrders(orders, workerName, userId).length > 0;
  const startedToday = activities.some(
    (activity) => activity.type === "start" &&
      isUserWorkRecord(activity, userId, workerName) &&
      getKstDateKey(activity.timestamp) === dateKey
  );
  return Boolean(workerKey && hasWaitingWork && !hasActiveWork && !startedToday);
}

function resolveWorkerIdentity(record = {}, workerDirectory = {}) {
  const byId = workerDirectory.byId || {};
  const uniqueIdByName = workerDirectory.uniqueIdByName || {};
  let userId = String(record.workerUserId || record.worker_user_id || "").trim();
  const recordedName = String(record.workerName || "").trim();
  const normalizedName = normalizeWorkerName(recordedName);
  if (!userId && normalizedName && uniqueIdByName[normalizedName]) userId = uniqueIdByName[normalizedName];
  const name = String((userId && byId[userId]) || recordedName || "").trim();
  const nameKey = normalizeWorkerName(name);
  return {
    userId,
    name,
    key: userId ? `id:${userId}` : (nameKey ? `name:${nameKey}` : "")
  };
}

function isSameResolvedWorker(left, right, workerDirectory) {
  const leftIdentity = resolveWorkerIdentity(left, workerDirectory);
  const rightIdentity = resolveWorkerIdentity(right, workerDirectory);
  return Boolean(leftIdentity.key && rightIdentity.key && leftIdentity.key === rightIdentity.key);
}

function getAdminPendingOrders({ orders = [], activities = [], dateKey = "", workerDirectory = {} } = {}) {
  const sourceOrders = Array.isArray(orders) ? orders : [];
  const sourceActivities = Array.isArray(activities) ? activities : [];
  return sourceOrders.filter((order) => {
    if (!WAITING_STATUSES.has(order.status)) return false;
    const assignedWorker = resolveWorkerIdentity(order, workerDirectory);
    if (!assignedWorker.key) return true;

    const assignedWorkerIsActive = sourceOrders.some(
      (candidate) => ACTIVE_STATUSES.has(candidate.status) && isSameResolvedWorker(candidate, order, workerDirectory)
    );
    const assignedWorkerStartedToday = sourceActivities.some(
      (activity) => activity.type === "start" &&
        isSameResolvedWorker(activity, order, workerDirectory) &&
        getKstDateKey(activity.timestamp) === dateKey
    );
    return !assignedWorkerIsActive && !assignedWorkerStartedToday;
  });
}

function buildWorkerDirectory(users = []) {
  const byId = {};
  const idsByName = new Map();
  for (const user of Array.isArray(users) ? users : []) {
    if (String(user.app_metadata?.jhint_role || "").trim().toLowerCase() !== "production") continue;
    const userId = String(user.id || "").trim();
    const displayName = getDisplayName(user);
    if (!userId || !displayName) continue;
    byId[userId] = displayName;
    const nameKey = normalizeWorkerName(displayName);
    if (!idsByName.has(nameKey)) idsByName.set(nameKey, []);
    idsByName.get(nameKey).push(userId);
  }
  const uniqueIdByName = {};
  for (const [nameKey, userIds] of idsByName.entries()) {
    if (userIds.length === 1) uniqueIdByName[nameKey] = userIds[0];
  }
  return { byId, uniqueIdByName };
}

function buildAdminReminderMessage(kind, orders = [], workerDirectory = {}) {
  const relevantStatuses = kind === "evening" ? ACTIVE_STATUSES : WAITING_STATUSES;
  const grouped = new Map();
  let unassignedCount = 0;

  for (const order of Array.isArray(orders) ? orders : []) {
    if (!relevantStatuses.has(order.status)) continue;
    const worker = resolveWorkerIdentity(order, workerDirectory);
    if (!worker.key) {
      unassignedCount += 1;
      continue;
    }

    const current = grouped.get(worker.key) || { name: worker.name, total: 0, working: 0, break: 0 };
    current.total += 1;
    if (order.status === "working") current.working += 1;
    if (order.status === "break") current.break += 1;
    grouped.set(worker.key, current);
  }

  const workers = [...grouped.values()].sort((left, right) => left.name.localeCompare(right.name, "ko"));
  const visibleWorkers = workers.slice(0, 6);
  const workerText = visibleWorkers.map((worker) => {
    if (kind === "morning") return `${worker.name} ${worker.total}건`;
    const statuses = [];
    if (worker.working) statuses.push(`작업 중 ${worker.working}건`);
    if (worker.break) statuses.push(`일시정지 ${worker.break}건`);
    return `${worker.name}(${statuses.join(", ")})`;
  });
  if (workers.length > visibleWorkers.length) workerText.push(`외 ${workers.length - visibleWorkers.length}명`);
  if (unassignedCount) workerText.push(`미배정 ${unassignedCount}건`);

  const title = kind === "morning"
    ? (workers.length ? `작업 시작 미확인 ${workers.length}명` : `미배정 생산 작업 ${unassignedCount}건`)
    : (workers.length ? `작업 종료 미처리 ${workers.length}명` : `작업 종료 미처리 ${unassignedCount}건`);
  return {
    title,
    body: workerText.join(" / ") || "생산 현황을 확인해 주세요.",
    workerCount: workers.length,
    unassignedCount,
    workers
  };
}

async function listReminderUsers() {
  const payload = await supabaseRequest("/auth/v1/admin/users?page=1&per_page=100", { method: "GET" });
  return (Array.isArray(payload.users) ? payload.users : []).filter(
    (user) => PUSH_NOTIFICATION_ROLES.has(String(user.app_metadata?.jhint_role || "").trim().toLowerCase()) && getDisplayName(user)
  );
}

async function loadState() {
  const rows = await supabaseRequest("/rest/v1/app_state?id=eq.main&select=payload", { method: "GET" });
  return rows?.[0]?.payload || { orders: [], activities: [] };
}

async function listSubscriptions() {
  const rows = await supabaseRequest(
    "/rest/v1/push_subscriptions?enabled=eq.true&role=in.(production,admin)&select=id,user_id,role,endpoint,p256dh,auth,updated_at&order=updated_at.desc",
    { method: "GET" }
  );
  return Array.isArray(rows) ? rows : [];
}

async function reserveDelivery(userId, kind, dateKey, detail) {
  const claimed = await supabaseRequest("/rest/v1/rpc/claim_jhint_push_delivery", {
    method: "POST",
    body: JSON.stringify({
      p_user_id: userId,
      p_kind: kind,
      p_delivery_date: dateKey,
      p_detail: detail
    })
  });
  return claimed === true;
}

async function finishDelivery(userId, kind, dateKey, status, detail) {
  await supabaseRequest(
    `/rest/v1/push_delivery_log?user_id=eq.${encodeURIComponent(userId)}&kind=eq.${encodeURIComponent(kind)}&delivery_date=eq.${dateKey}`,
    {
      method: "PATCH",
      headers: { Prefer: "return=minimal" },
      body: JSON.stringify({
        status,
        detail,
        sent_at: status === "success" ? new Date().toISOString() : null,
        updated_at: new Date().toISOString()
      })
    }
  );
}

async function disableSubscription(id, statusCode) {
  await supabaseRequest(`/rest/v1/push_subscriptions?id=eq.${encodeURIComponent(id)}`, {
    method: "PATCH",
    headers: { Prefer: "return=minimal" },
    body: JSON.stringify({
      enabled: false,
      last_failure_at: new Date().toISOString(),
      last_failure_code: Number(statusCode || 0),
      updated_at: new Date().toISOString()
    })
  });
}

async function sendToUser({ user, subscriptions, kind, dateKey, orders, workerDirectory = {}, config }) {
  const displayName = getDisplayName(user);
  const role = String(user.app_metadata?.jhint_role || "").trim().toLowerCase();
  const isAdmin = role === "admin";
  const isMorning = kind === "morning";
  const adminMessage = isAdmin ? buildAdminReminderMessage(kind, orders, workerDirectory) : null;
  const title = isAdmin ? adminMessage.title : (isMorning ? "작업 시작 확인" : "작업 종료 확인");
  const body = isAdmin
    ? adminMessage.body
    : (isMorning
      ? `${displayName}님, 오늘 작업 시작이 확인되지 않았습니다. 작업자 입력에서 작업을 시작해 주세요.`
      : `${displayName}님, 작업 중인 항목이 ${orders.length}건 남아 있습니다. 작업 완료 또는 작업중지 처리를 해 주세요.`);
  const targetView = isAdmin ? "dashboardView" : "workerView";
  const detail = {
    displayName,
    role,
    orderIds: orders.map((order) => order.id).filter(Boolean),
    subscriptionCount: subscriptions.length,
    ...(adminMessage ? {
      workerCount: adminMessage.workerCount,
      unassignedCount: adminMessage.unassignedCount,
      workers: adminMessage.workers.map((worker) => ({
        name: worker.name,
        total: worker.total,
        working: worker.working,
        break: worker.break
      }))
    } : {})
  };

  if (!(await reserveDelivery(user.id, kind, dateKey, detail))) return { skipped: true };

  let successCount = 0;
  const failures = [];
  for (const subscriptionRow of subscriptions) {
    try {
      await sendWebPush(
        {
          endpoint: subscriptionRow.endpoint,
          keys: { p256dh: subscriptionRow.p256dh, auth: subscriptionRow.auth }
        },
        {
          title,
          body,
          tag: `jhint-${role}-${kind}-${dateKey}`,
          icon: "/app-icon.png",
          badge: "/app-icon.png",
          url: `/?view=${targetView}`,
          view: targetView,
          kind
        },
        config
      );
      successCount += 1;
    } catch (error) {
      const statusCode = Number(error.statusCode || error.status || 0);
      failures.push({ id: subscriptionRow.id, statusCode, message: String(error.message || "push failed").slice(0, 240) });
      if (statusCode === 404 || statusCode === 410) await disableSubscription(subscriptionRow.id, statusCode);
    }
  }

  const status = successCount > 0 ? "success" : "failed";
  await finishDelivery(user.id, kind, dateKey, status, { ...detail, successCount, failures });
  return { successCount, failureCount: failures.length };
}

async function sendAdminTestNotification({ user, subscriptions, config }) {
  let successCount = 0;
  const failures = [];
  for (const subscriptionRow of subscriptions) {
    try {
      await sendWebPush(
        {
          endpoint: subscriptionRow.endpoint,
          keys: { p256dh: subscriptionRow.p256dh, auth: subscriptionRow.auth }
        },
        {
          title: "관리자 알림 소리 테스트",
          body: "생산일정 관리의 알림 소리와 진동을 확인해 주세요.",
          tag: `jhint-admin-test-${Date.now()}`,
          icon: "/app-icon.png",
          badge: "/app-icon.png",
          url: "/?view=dashboardView",
          view: "dashboardView",
          kind: "admin-test"
        },
        config
      );
      successCount += 1;
      await supabaseRequest(`/rest/v1/push_subscriptions?id=eq.${encodeURIComponent(subscriptionRow.id)}`, {
        method: "PATCH",
        headers: { Prefer: "return=minimal" },
        body: JSON.stringify({ last_success_at: new Date().toISOString(), updated_at: new Date().toISOString() })
      });
    } catch (error) {
      const statusCode = Number(error.statusCode || error.status || 0);
      failures.push({ id: subscriptionRow.id, statusCode, message: String(error.message || "push failed").slice(0, 240) });
      if (statusCode === 404 || statusCode === 410) await disableSubscription(subscriptionRow.id, statusCode);
    }
  }
  return { successCount, failureCount: failures.length };
}

module.exports = async function pushRemindersHandler(request, response) {
  if (!['GET', 'POST'].includes(request.method)) {
    response.setHeader("Allow", "GET, POST");
    sendJson(response, 405, { message: "지원하지 않는 요청입니다." });
    return;
  }

  try {
    const url = new URL(request.url, "https://jhint.vercel.app");
    const kind = String(url.searchParams.get("kind") || "").trim().toLowerCase();
    if (!['morning', 'evening', 'admin-test'].includes(kind)) {
      sendJson(response, 400, { message: "알림 종류가 올바르지 않습니다." });
      return;
    }

    const config = await getPushServerConfig();
    if (getBearerToken(request) !== config.cronSecret) {
      sendJson(response, 401, { message: "예약 실행 인증에 실패했습니다." });
      return;
    }

    if (kind === "admin-test") {
      const [reminderUsers, allSubscriptions] = await Promise.all([
        listReminderUsers(),
        listSubscriptions()
      ]);
      const administrators = reminderUsers.filter(
        (user) => String(user.app_metadata?.jhint_role || "").trim().toLowerCase() === "admin"
      );
      const results = [];
      for (const user of administrators) {
        const subscriptions = allSubscriptions.filter(
          (item) => item.user_id === user.id && item.role === "admin"
        ).slice(0, 1);
        if (!subscriptions.length) continue;
        results.push(await sendAdminTestNotification({ user, subscriptions, config }));
      }
      sendJson(response, 200, {
        ok: true,
        kind,
        checkedAdmins: administrators.length,
        successCount: results.reduce((sum, item) => sum + item.successCount, 0),
        failureCount: results.reduce((sum, item) => sum + item.failureCount, 0),
        results
      });
      return;
    }

    const { dateKey, weekday } = getKstDateParts();
    if (weekday === "Sat" || weekday === "Sun") {
      sendJson(response, 200, { ok: true, skipped: "weekend", dateKey, kind });
      return;
    }

    const [state, reminderUsers, allSubscriptions] = await Promise.all([
      loadState(),
      listReminderUsers(),
      listSubscriptions()
    ]);
    const orders = Array.isArray(state.orders) ? state.orders : [];
    const activities = Array.isArray(state.activities) ? state.activities : [];
    const workerDirectory = buildWorkerDirectory(reminderUsers);
    const results = [];

    for (const user of reminderUsers) {
      const displayName = getDisplayName(user);
      const role = String(user.app_metadata?.jhint_role || "").trim().toLowerCase();
      const isAdmin = role === "admin";
      const subscriptions = allSubscriptions.filter((item) => item.user_id === user.id);
      if (!subscriptions.length) continue;

      const activeOrders = isAdmin
        ? orders.filter((order) => ACTIVE_STATUSES.has(order.status))
        : getUserActiveOrders(orders, displayName, user.id);
      const pendingOrders = isAdmin
        ? getAdminPendingOrders({ orders, activities, dateKey, workerDirectory })
        : [];
      if (kind === "evening" && !activeOrders.length) continue;
      if (kind === "morning" && isAdmin && !pendingOrders.length) continue;
      if (kind === "morning" && !isAdmin && !shouldSendMorningReminder({
        orders,
        activities,
        workerName: displayName,
        userId: user.id,
        dateKey
      })) continue;

      const result = await sendToUser({
        user,
        subscriptions,
        kind,
        dateKey,
        orders: kind === "evening" ? activeOrders : pendingOrders,
        workerDirectory,
        config
      });
      results.push({ userId: user.id, displayName, ...result });
    }

    sendJson(response, 200, { ok: true, kind, dateKey, checkedUsers: reminderUsers.length, results });
  } catch (error) {
    sendJson(response, error.status || 500, { message: error.message || "작업 알림 발송에 실패했습니다." });
  }
};

module.exports._test = {
  buildAdminReminderMessage,
  buildWorkerDirectory,
  getAdminPendingOrders,
  getKstDateKey,
  getKstDateParts,
  getUserActiveOrders,
  isUserWorkRecord,
  normalizeWorkerName,
  shouldSendMorningReminder
};
