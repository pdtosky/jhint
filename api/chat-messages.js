const {
  COMPANY_CHAT_ROLES,
  getPushServerConfig,
  normalizeApprovedRole,
  readJsonBody,
  sendJson,
  sendWebPush,
  supabaseRequest,
  verifyCompanyChatUser
} = require("../lib/push-server");

const ROLE_LABELS = {
  admin: "관리자",
  production: "생산",
  sales: "영업",
  office: "총무",
  quality: "품질",
  shipping: "출하"
};
const UUID_PATTERN = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;
const USER_PAGE_SIZE = 100;
const MAX_USER_PAGES = 20;
const MESSAGE_PAGE_SIZE = 50;
const MESSAGE_SEARCH_LIMIT = 50;
const GENERAL_MESSAGE_LIMIT = 100;
const ADMIN_MESSAGE_LIMIT = 10000;
const MAX_MENTIONS = 20;
const MAX_MESSAGES_PER_TEN_SECONDS = 5;

function normalizeBody(value) {
  return String(value || "").replace(/\r\n?/g, "\n").trim();
}

function normalizeSearchTerm(value) {
  return String(value || "")
    .normalize("NFKC")
    .replace(/[^\p{L}\p{N}\s@._-]/gu, " ")
    .replace(/\s+/g, " ")
    .trim()
    .slice(0, 60);
}

function getTextLength(value) {
  return Array.from(String(value || "")).length;
}

function getDisplayName(user = {}) {
  const metadata = user.user_metadata || user.raw_user_meta_data || {};
  return String(metadata.display_name || metadata.name || metadata.full_name || user.email?.split("@")[0] || "직원")
    .trim()
    .slice(0, 60);
}

function normalizeDirectoryUser(user = {}) {
  const role = normalizeApprovedRole(user.app_metadata?.jhint_role || user.raw_app_meta_data?.jhint_role);
  if (!user.id || !role || !COMPANY_CHAT_ROLES.has(role)) return null;
  return {
    id: String(user.id),
    displayName: getDisplayName(user),
    role,
    roleLabel: ROLE_LABELS[role] || role
  };
}

async function listApprovedUsers() {
  const users = [];
  for (let page = 1; page <= MAX_USER_PAGES; page += 1) {
    const payload = await supabaseRequest(`/auth/v1/admin/users?page=${page}&per_page=${USER_PAGE_SIZE}`, { method: "GET" });
    const pageUsers = Array.isArray(payload.users) ? payload.users : [];
    users.push(...pageUsers);
    const lastPage = Number(payload.last_page || 0);
    if (pageUsers.length < USER_PAGE_SIZE || (Number.isFinite(lastPage) && lastPage > 0 && lastPage <= page)) break;
  }
  return users
    .map(normalizeDirectoryUser)
    .filter(Boolean)
    .sort((left, right) => left.displayName.localeCompare(right.displayName, "ko"));
}

function parseRequestUrl(request) {
  return new URL(request.url, "https://jhint.local");
}

function sanitizeMessage(row = {}) {
  const deleted = Boolean(row.deleted_at);
  return {
    id: String(row.id || ""),
    senderId: String(row.sender_id || ""),
    senderName: String(row.sender_name || "직원"),
    senderRole: String(row.sender_role || ""),
    body: deleted ? "" : String(row.body || ""),
    mentionedUserIds: Array.isArray(row.mentioned_user_ids) ? row.mentioned_user_ids.map(String) : [],
    notifyAll: Boolean(row.notify_all),
    pinned: Boolean(row.is_pinned) && !deleted,
    createdAt: String(row.created_at || ""),
    deleted,
    deletedAt: String(row.deleted_at || ""),
    deletedByName: String(row.deleted_by_name || "")
  };
}

async function getReadState(userId) {
  const rows = await supabaseRequest(
    `/rest/v1/company_chat_reads?user_id=eq.${encodeURIComponent(userId)}&select=last_read_at,last_read_message_id&limit=1`,
    { method: "GET" }
  );
  return rows[0] || { last_read_at: "1970-01-01T00:00:00.000Z", last_read_message_id: null };
}

async function getUnreadCount(userId, lastReadAt) {
  const rows = await supabaseRequest(
    `/rest/v1/company_chat_messages?created_at=gt.${encodeURIComponent(lastReadAt)}&sender_id=neq.${encodeURIComponent(userId)}&deleted_at=is.null&select=id&order=created_at.asc&limit=101`,
    { method: "GET" }
  );
  return Math.min(rows.length, 100);
}

async function handleGet(request, response, user) {
  const url = parseRequestUrl(request);
  const searchRequested = url.searchParams.has("search");
  const searchTerm = normalizeSearchTerm(url.searchParams.get("search"));
  if (searchRequested) {
    if (!searchTerm) {
      sendJson(response, 400, { message: "찾을 내용을 입력해 주세요." });
      return;
    }
    const pattern = `*${searchTerm}*`;
    const rows = await supabaseRequest(
      `/rest/v1/company_chat_messages?deleted_at=is.null&body=ilike.${encodeURIComponent(pattern)}&select=id,sender_id,sender_name,sender_role,body,mentioned_user_ids,notify_all,is_pinned,created_at,deleted_at,deleted_by_name&order=created_at.desc&limit=${MESSAGE_SEARCH_LIMIT}`,
      { method: "GET" }
    );
    sendJson(response, 200, {
      messages: rows.map(sanitizeMessage),
      searchQuery: searchTerm,
      searchMode: true
    });
    return;
  }
  const before = String(url.searchParams.get("before") || "").trim();
  const beforeFilter = before ? `&created_at=lt.${encodeURIComponent(before)}` : "";
  const [rows, pinnedRows, readState, users] = await Promise.all([
    supabaseRequest(
      `/rest/v1/company_chat_messages?deleted_at=is.null&select=id,sender_id,sender_name,sender_role,body,mentioned_user_ids,notify_all,is_pinned,created_at,deleted_at,deleted_by_name${beforeFilter}&order=created_at.desc&limit=${MESSAGE_PAGE_SIZE}`,
      { method: "GET" }
    ),
    supabaseRequest(
      "/rest/v1/company_chat_messages?is_pinned=eq.true&deleted_at=is.null&select=id,sender_id,sender_name,sender_role,body,mentioned_user_ids,notify_all,is_pinned,created_at,deleted_at,deleted_by_name&order=created_at.desc&limit=3",
      { method: "GET" }
    ),
    getReadState(user.userId),
    before ? Promise.resolve([]) : listApprovedUsers()
  ]);
  const unreadCount = await getUnreadCount(user.userId, readState.last_read_at);

  sendJson(response, 200, {
    messages: rows.reverse().map(sanitizeMessage),
    pinnedMessages: pinnedRows.map(sanitizeMessage),
    hasMore: rows.length === MESSAGE_PAGE_SIZE,
    unreadCount,
    lastReadAt: readState.last_read_at,
    users,
    currentUser: {
      id: user.userId,
      displayName: user.displayName,
      role: user.role,
      roleLabel: ROLE_LABELS[user.role] || user.role
    }
  });
}

async function assertRateLimit(userId) {
  const since = new Date(Date.now() - 10 * 1000).toISOString();
  const rows = await supabaseRequest(
    `/rest/v1/company_chat_messages?sender_id=eq.${encodeURIComponent(userId)}&created_at=gt.${encodeURIComponent(since)}&select=id&limit=${MAX_MESSAGES_PER_TEN_SECONDS}`,
    { method: "GET" }
  );
  if (rows.length >= MAX_MESSAGES_PER_TEN_SECONDS) {
    const error = new Error("메시지를 너무 빠르게 보내고 있습니다. 잠시 후 다시 시도해 주세요.");
    error.status = 429;
    throw error;
  }
}

function uniqueValidIds(values = []) {
  return [...new Set((Array.isArray(values) ? values : []).map((value) => String(value || "").trim()))]
    .filter((value) => UUID_PATTERN.test(value));
}

async function updateSubscriptionStatus(subscription, success, error = null) {
  if (success) {
    await supabaseRequest(`/rest/v1/push_subscriptions?id=eq.${encodeURIComponent(subscription.id)}`, {
      method: "PATCH",
      headers: { Prefer: "return=minimal" },
      body: JSON.stringify({ last_success_at: new Date().toISOString(), last_failure_code: null })
    });
    return;
  }

  const statusCode = Number(error?.statusCode || error?.status || 0) || null;
  if ([404, 410].includes(statusCode)) {
    await supabaseRequest(`/rest/v1/push_subscriptions?id=eq.${encodeURIComponent(subscription.id)}`, {
      method: "DELETE",
      headers: { Prefer: "return=minimal" }
    });
    return;
  }
  await supabaseRequest(`/rest/v1/push_subscriptions?id=eq.${encodeURIComponent(subscription.id)}`, {
    method: "PATCH",
    headers: { Prefer: "return=minimal" },
    body: JSON.stringify({ last_failure_at: new Date().toISOString(), last_failure_code: statusCode })
  });
}

async function sendMentionNotifications({ message, recipients }) {
  if (!recipients.length) return { successCount: 0, failureCount: 0 };
  const recipientIds = recipients.map((item) => item.id);
  const inFilter = recipientIds.map(encodeURIComponent).join(",");
  const subscriptions = await supabaseRequest(
    `/rest/v1/push_subscriptions?enabled=eq.true&user_id=in.(${inFilter})&select=id,user_id,endpoint,p256dh,auth`,
    { method: "GET" }
  );
  if (!subscriptions.length) return { successCount: 0, failureCount: 0 };

  const config = await getPushServerConfig();
  const results = await Promise.all(subscriptions.map(async (subscription) => {
    try {
      await sendWebPush(
        {
          endpoint: subscription.endpoint,
          keys: { p256dh: subscription.p256dh, auth: subscription.auth }
        },
        {
          title: message.notify_all ? "전체 공지" : `${message.sender_name}님이 호출했습니다`,
          body: `${message.sender_name}: ${String(message.body).replace(/\s+/g, " ").slice(0, 90)}`,
          tag: `company-chat-${message.id}`,
          kind: "company-chat-mention",
          view: "chatView",
          messageId: message.id,
          url: `/?view=chatView&message=${encodeURIComponent(message.id)}`
        },
        config
      );
      await updateSubscriptionStatus(subscription, true);
      return true;
    } catch (error) {
      await updateSubscriptionStatus(subscription, false, error).catch(() => {});
      return false;
    }
  }));
  const successCount = results.filter(Boolean).length;
  const failureCount = results.length - successCount;
  return { successCount, failureCount };
}

async function handlePost(request, response, user) {
  const body = await readJsonBody(request, 32 * 1024);
  const messageBody = normalizeBody(body.body);
  const messageLength = getTextLength(messageBody);
  const maxLength = user.role === "admin" ? ADMIN_MESSAGE_LIMIT : GENERAL_MESSAGE_LIMIT;
  const clientMessageId = String(body.clientMessageId || "").trim();
  const mentionedUserIds = uniqueValidIds(body.mentionedUserIds).slice(0, MAX_MENTIONS);
  const notifyAll = Boolean(body.notifyAll);
  const pinned = Boolean(body.pinned);

  if (!messageBody) {
    sendJson(response, 400, { message: "메시지를 입력해 주세요." });
    return;
  }
  if (messageLength > maxLength) {
    sendJson(response, 400, { message: user.role === "admin" ? "관리자 공지는 10,000자 이내로 입력해 주세요." : "일반 메시지는 100자 이내로 입력해 주세요." });
    return;
  }
  if (!UUID_PATTERN.test(clientMessageId)) {
    sendJson(response, 400, { message: "메시지 식별자가 올바르지 않습니다." });
    return;
  }
  if ((notifyAll || pinned) && user.role !== "admin") {
    sendJson(response, 403, { message: "전체 알림과 공지 고정은 관리자만 사용할 수 있습니다." });
    return;
  }
  if (notifyAll && !messageBody.includes("@전체")) {
    sendJson(response, 400, { message: "전체 알림을 보내려면 본문에 @전체를 입력해 주세요." });
    return;
  }

  const [, directory] = await Promise.all([
    assertRateLimit(user.userId),
    listApprovedUsers()
  ]);
  const approvedById = new Map(directory.map((item) => [item.id, item]));
  const validMentionIds = mentionedUserIds.filter((id) => {
    const target = approvedById.get(id);
    return target && id !== user.userId && messageBody.includes(`@${target.displayName}`);
  });

  const insertedRows = await supabaseRequest("/rest/v1/company_chat_messages", {
    method: "POST",
    headers: { Prefer: "return=representation" },
    body: JSON.stringify([{
      client_message_id: clientMessageId,
      sender_id: user.userId,
      sender_name: user.displayName,
      sender_role: user.role,
      body: messageBody,
      mentioned_user_ids: validMentionIds,
      notify_all: notifyAll,
      is_pinned: false
    }])
  });
  let inserted = insertedRows[0];
  if (pinned && inserted?.id) {
    await supabaseRequest(`/rest/v1/company_chat_messages?is_pinned=eq.true&id=neq.${encodeURIComponent(inserted.id)}`, {
      method: "PATCH",
      headers: { Prefer: "return=minimal" },
      body: JSON.stringify({ is_pinned: false })
    });
    const pinnedRows = await supabaseRequest(`/rest/v1/company_chat_messages?id=eq.${encodeURIComponent(inserted.id)}`, {
      method: "PATCH",
      headers: { Prefer: "return=representation" },
      body: JSON.stringify({ is_pinned: true })
    });
    inserted = pinnedRows[0] || inserted;
  }
  const recipientIds = notifyAll
    ? directory.map((item) => item.id).filter((id) => id !== user.userId)
    : validMentionIds;
  const recipients = recipientIds.map((id) => approvedById.get(id)).filter(Boolean);
  const notification = await sendMentionNotifications({ message: inserted, recipients }).catch((error) => ({
    successCount: 0,
    failureCount: recipients.length,
    error: String(error.message || error)
  }));

  sendJson(response, 201, { message: sanitizeMessage(inserted), notification });
}

async function markRead(response, user, messageId) {
  if (!UUID_PATTERN.test(messageId)) {
    sendJson(response, 400, { message: "읽음 처리할 메시지를 찾을 수 없습니다." });
    return;
  }
  const rows = await supabaseRequest(
    `/rest/v1/company_chat_messages?id=eq.${encodeURIComponent(messageId)}&select=id,created_at&limit=1`,
    { method: "GET" }
  );
  if (!rows[0]) {
    sendJson(response, 404, { message: "읽음 처리할 메시지를 찾을 수 없습니다." });
    return;
  }
  await supabaseRequest("/rest/v1/company_chat_reads?on_conflict=user_id", {
    method: "POST",
    headers: { Prefer: "resolution=merge-duplicates,return=minimal" },
    body: JSON.stringify([{
      user_id: user.userId,
      last_read_message_id: rows[0].id,
      last_read_at: rows[0].created_at,
      updated_at: new Date().toISOString()
    }])
  });
  sendJson(response, 200, { ok: true, lastReadAt: rows[0].created_at });
}

async function deleteMessage(response, user, messageId) {
  if (user.role !== "admin") {
    sendJson(response, 403, { message: "메시지 삭제는 관리자만 할 수 있습니다." });
    return;
  }
  if (!UUID_PATTERN.test(messageId)) {
    sendJson(response, 400, { message: "삭제할 메시지를 찾을 수 없습니다." });
    return;
  }
  const rows = await supabaseRequest(`/rest/v1/company_chat_messages?id=eq.${encodeURIComponent(messageId)}&deleted_at=is.null`, {
    method: "PATCH",
    headers: { Prefer: "return=representation" },
    body: JSON.stringify({
      deleted_at: new Date().toISOString(),
      deleted_by_id: user.userId,
      deleted_by_name: user.displayName,
      is_pinned: false
    })
  });
  if (!rows[0]) {
    sendJson(response, 404, { message: "이미 삭제됐거나 존재하지 않는 메시지입니다." });
    return;
  }
  sendJson(response, 200, { message: sanitizeMessage(rows[0]) });
}

async function setPinned(response, user, messageId, pinned) {
  if (user.role !== "admin") {
    sendJson(response, 403, { message: "공지 고정은 관리자만 할 수 있습니다." });
    return;
  }
  if (!UUID_PATTERN.test(messageId)) {
    sendJson(response, 400, { message: "고정할 메시지를 찾을 수 없습니다." });
    return;
  }
  const candidates = await supabaseRequest(
    `/rest/v1/company_chat_messages?id=eq.${encodeURIComponent(messageId)}&deleted_at=is.null&sender_role=eq.admin&select=id&limit=1`,
    { method: "GET" }
  );
  if (!candidates[0]) {
    sendJson(response, 404, { message: "관리자 공지만 고정할 수 있습니다." });
    return;
  }
  if (pinned) {
    await supabaseRequest("/rest/v1/company_chat_messages?is_pinned=eq.true", {
      method: "PATCH",
      headers: { Prefer: "return=minimal" },
      body: JSON.stringify({ is_pinned: false })
    });
  }
  const rows = await supabaseRequest(`/rest/v1/company_chat_messages?id=eq.${encodeURIComponent(messageId)}&deleted_at=is.null&sender_role=eq.admin`, {
    method: "PATCH",
    headers: { Prefer: "return=representation" },
    body: JSON.stringify({ is_pinned: Boolean(pinned) })
  });
  if (!rows[0]) {
    sendJson(response, 404, { message: "고정 상태를 변경할 수 없습니다." });
    return;
  }
  sendJson(response, 200, { message: sanitizeMessage(rows[0]) });
}

async function handlePatch(request, response, user) {
  const body = await readJsonBody(request);
  const action = String(body.action || "").trim();
  const messageId = String(body.messageId || "").trim();
  if (action === "read") {
    await markRead(response, user, messageId);
    return;
  }
  if (action === "delete") {
    await deleteMessage(response, user, messageId);
    return;
  }
  if (action === "pin") {
    await setPinned(response, user, messageId, Boolean(body.pinned));
    return;
  }
  sendJson(response, 400, { message: "지원하지 않는 대화방 작업입니다." });
}

module.exports = async function chatMessagesHandler(request, response) {
  if (!['GET', 'POST', 'PATCH'].includes(request.method)) {
    response.setHeader("Allow", "GET, POST, PATCH");
    sendJson(response, 405, { message: "지원하지 않는 요청입니다." });
    return;
  }

  try {
    const user = await verifyCompanyChatUser(request);
    if (!user.ok) {
      sendJson(response, user.status, { message: user.message });
      return;
    }
    if (request.method === "GET") {
      await handleGet(request, response, user);
      return;
    }
    if (request.method === "POST") {
      await handlePost(request, response, user);
      return;
    }
    await handlePatch(request, response, user);
  } catch (error) {
    const isDuplicate = String(error.message || "").includes("company_chat_messages_client_message_id_key");
    sendJson(response, isDuplicate ? 409 : (error.status || 500), {
      message: isDuplicate ? "이미 전송된 메시지입니다." : (error.message || "전체대화방 요청을 처리하지 못했습니다.")
    });
  }
};
