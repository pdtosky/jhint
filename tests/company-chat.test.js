const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");

const root = path.join(__dirname, "..");
const read = (relativePath) => fs.readFileSync(path.join(root, relativePath), "utf8");
const html = read("index.html");
const app = read("app.js");
const chat = read("chat.js");
const chatCss = read("chat.css");
const api = read(path.join("api", "chat-messages.js"));
const pushServer = read(path.join("lib", "push-server.js"));
const sql = read("supabase-company-chat.sql");
const serviceWorker = read("sw.js");

const adminTabIndex = html.indexOf('data-view-target="adminView"');
const chatTabIndex = html.indexOf('data-view-target="chatView"');
assert(adminTabIndex >= 0 && chatTabIndex > adminTabIndex, "the whole-company chat tab should sit next to the administrator tab");
assert(html.includes('id="chatView"'), "the chat view should exist");
assert(html.includes('id="companyChatInput"'), "the chat composer should exist");
assert(html.includes('id="chatUnreadBadge"'), "the chat tab should expose an unread badge");
assert(html.includes('id="companyChatMentionList"'), "the @mention account picker should exist");
assert(html.includes('id="companyChatParticipantCount"'), "the chat should show the approved participant count");
assert(html.includes('id="companyChatParticipantList"'), "the chat should visibly list every approved participant");
assert(html.includes('id="companyChatPinCheckbox"'), "administrators should be able to pin notices");
assert(html.includes('id="companyChatSearchInput"'), "the chat should expose a message search field");
assert(html.includes('id="companyChatSearchClearBtn"'), "search results should return to the full conversation");
assert(html.includes('chat.js?v=20260901-12'), "the chat module should be cache-versioned");
assert(html.includes('chat.css?v=20260901-12'), "the chat stylesheet should be cache-versioned");

for (const role of ["admin", "office", "production", "sales", "quality", "shipping"]) {
  const roleLine = app.match(new RegExp(`${role}: \\[([^\\]]+)\\]`))?.[1] || "";
  assert(roleLine.includes('"chatView"'), `${role} accounts should be allowed into the approved-employee chat`);
}
assert(app.includes('window.JhintCompanyChat?.initialize'), "the main app should initialize the isolated chat module");
assert(app.includes('window.JhintCompanyChat?.setActive(targetId === "chatView")'), "view switching should update chat read state");
assert(app.includes('window.JhintCompanyChat?.syncSession()'), "approved login changes should synchronize the chat session");

assert(chat.includes("const GENERAL_MESSAGE_LIMIT = 100"), "general chat messages should be limited to 100 characters");
assert(chat.includes("const ADMIN_SAFETY_LIMIT = 10000"), "administrator notices should have a large safety ceiling");
assert(chat.includes('body.includes("@전체")'), "administrator whole-company mentions should be recognized");
assert(chat.includes("const mentionedUserIds = resolveMentions(body)"), "selected @mentions should be resolved to stable account IDs");
assert(chat.includes("function renderParticipants()"), "the approved account directory should be rendered as a visible participant roster");
assert(chat.includes("state.users.length"), "the participant roster should display its full account count");
assert(!chat.includes(".slice(0, 8)"), "the @mention picker should not hide approved employees after the first eight");
assert(chat.includes("mentionedUserIds,"), "resolved @mention account IDs should be sent to the server");
assert(chat.includes('`?search=${encodeURIComponent(query)}`'), "message searches should use the protected chat API");
assert(chat.includes('state.searchActive ? state.searchResults : state.messages'), "search results should reuse the safe chat renderer");
assert(chat.includes('pending: true'), "outgoing messages should render optimistically while the server confirms them");
assert(chat.includes('.channel(REALTIME_TOPIC, { config: { private: true } })'), "chat updates should use a private Realtime channel");
assert(chat.includes("client.auth.refreshSession()"), "Realtime should join with a freshly refreshed account token");
assert(chat.includes('container.appendChild(document.createTextNode(part))'), "message bodies should render as text rather than executable HTML");
assert(chat.includes('elements.input.value = draft'), "failed sends should keep the typed message");
assert(chat.includes(".filter((message) => !message.deleted)"), "deleted messages should never render in the conversation");
assert(chat.includes("removeMessage(message.id)"), "a successful administrator deletion should remove the message immediately");
assert(!chat.includes("관리자에 의해 삭제된 메시지입니다."), "deleted-message placeholders should not remain on screen");
assert(!chatCss.includes(".company-chat-bubble.is-deleted"), "deleted-message placeholder styling should be removed");
assert(chatCss.includes(".company-chat-message.is-own"), "own messages should have a distinct chat layout");
assert(chatCss.includes("@media (max-width: 760px)"), "the chat should include a mobile layout");

assert(api.includes("verifyCompanyChatUser(request)"), "every chat request should revalidate an approved employee account");
assert(api.includes("COMPANY_CHAT_ROLES.has(role)"), "the mention directory should contain all approved employees");
assert(api.includes("page <= MAX_USER_PAGES"), "the approved account directory should fetch every available user page");
assert(api.includes("GENERAL_MESSAGE_LIMIT = 100"), "the server should enforce the general 100-character limit");
assert(api.includes("ADMIN_MESSAGE_LIMIT = 10000"), "the server should enforce the administrator safety ceiling");
assert(api.includes("MAX_MESSAGES_PER_TEN_SECONDS = 5"), "the server should rate-limit accidental message floods");
assert(api.includes("MESSAGE_SEARCH_LIMIT = 50"), "server-side chat search should have a bounded result limit");
assert(api.includes("body=ilike."), "message search should be performed by the protected server API");
assert(api.includes("company_chat_messages?deleted_at=is.null&select="), "normal conversation history should exclude deleted rows at the server");
assert(api.includes("Promise.all(["), "independent chat reads should run concurrently");
assert(api.includes("id !== user.userId"), "the sender should not receive their own mention push");
assert(api.includes("messageBody.includes(`@${target.displayName}`)"), "the server should only notify names visibly mentioned in the message");
assert(api.includes('notifyAll && !messageBody.includes("@전체")'), "an administrator-wide push should require a visible @전체 mention");
assert(api.includes('user.role !== "admin"'), "administrator-only chat actions should be checked on the server");
assert(api.includes('view: "chatView"'), "mention notifications should open the chat view");
assert(pushServer.includes('const COMPANY_CHAT_ROLES = new Set(["production", "admin", "sales", "office", "quality", "shipping"])'), "all approved employee roles should pass chat authorization");
assert(pushServer.includes('const PUSH_NOTIFICATION_ROLES = new Set(["production", "admin", "sales", "office", "quality", "shipping"])'), "all approved employees should be able to register for chat mention notifications");

assert(sql.includes("create table if not exists public.company_chat_messages"), "messages should use a dedicated table");
assert(sql.includes("create table if not exists public.company_chat_reads"), "unread state should use a dedicated table");
assert(sql.includes("char_length(btrim(body)) between 1"), "database constraints should enforce message length");
assert(sql.includes("sender_role in ('production', 'admin', 'sales', 'office', 'quality', 'shipping')"), "the database should accept every approved employee chat sender role");
assert(sql.includes("revoke all on table public.company_chat_messages from public, anon, authenticated"), "browser roles must not access message rows directly");
assert(sql.includes('on realtime.messages'), "private Realtime reception should have an authorization policy");
assert(sql.includes("private.broadcast_company_chat_changes"), "database changes should broadcast from a private trigger function");
assert(sql.includes("private.is_company_chat_member"), "Realtime authorization should verify current administrator-controlled account metadata");
assert(sql.includes("raw_app_meta_data ->> 'jhint_role'"), "Realtime authorization should use administrator-controlled role metadata");
assert(sql.includes("'worker', 'viewer', 'general'"), "Realtime reception should include all legacy approved-role aliases");
assert(sql.includes("where id = (select auth.uid())"), "Realtime role checks should be bound to the connected account");

assert(serviceWorker.includes('messageId: payload.messageId || ""'), "chat push notifications should retain their target message ID");
assert(serviceWorker.includes("jhint-production-app-v20260902-01"), "the service worker should refresh chat assets");

console.log("company chat test passed");
