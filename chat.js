(function createCompanyChatModule() {
  "use strict";

  const CHAT_API_URL = "/api/chat-messages";
  const GENERAL_MESSAGE_LIMIT = 100;
  const ADMIN_SAFETY_LIMIT = 10000;
  const REALTIME_TOPIC = "company-chat";
  const state = {
    initialized: false,
    active: false,
    loading: false,
    loadingOlder: false,
    searching: false,
    sending: false,
    hasMore: false,
    messages: [],
    searchResults: [],
    searchQuery: "",
    searchActive: false,
    pinnedMessages: [],
    users: [],
    currentUser: null,
    unreadCount: 0,
    selectedMentions: new Map(),
    realtimeChannel: null,
    realtimeRefreshTimer: null,
    sessionSignature: "",
    pendingMessageId: ""
  };
  let options = {};
  let elements = {};

  function textLength(value) {
    return Array.from(String(value || "")).length;
  }

  function truncateText(value, limit) {
    return Array.from(String(value || "")).slice(0, limit).join("");
  }

  function createCompatibleId() {
    if (window.crypto?.randomUUID) return window.crypto.randomUUID();
    const bytes = new Uint8Array(16);
    window.crypto.getRandomValues(bytes);
    bytes[6] = (bytes[6] & 0x0f) | 0x40;
    bytes[8] = (bytes[8] & 0x3f) | 0x80;
    const hex = Array.from(bytes, (value) => value.toString(16).padStart(2, "0"));
    return `${hex.slice(0, 4).join("")}-${hex.slice(4, 6).join("")}-${hex.slice(6, 8).join("")}-${hex.slice(8, 10).join("")}-${hex.slice(10).join("")}`;
  }

  function getAccount() {
    return typeof options.getAccount === "function" ? options.getAccount() || {} : {};
  }

  function isAdministrator() {
    return String(state.currentUser?.role || getAccount().role || "") === "admin";
  }

  async function getAccessToken() {
    if (typeof options.getAccessToken !== "function") throw new Error("로그인 정보를 확인할 수 없습니다.");
    return options.getAccessToken();
  }

  async function requestChat(method, body = null, query = "") {
    const token = await getAccessToken();
    const response = await fetch(`${CHAT_API_URL}${query}`, {
      method,
      headers: {
        Authorization: `Bearer ${token}`,
        "Content-Type": "application/json"
      },
      body: body ? JSON.stringify(body) : null,
      cache: "no-store"
    });
    const payload = await response.json().catch(() => ({}));
    if (!response.ok) {
      const error = new Error(payload.message || "전체대화방 요청에 실패했습니다.");
      error.status = response.status;
      if ([401, 403].includes(response.status)) lockChatAccess();
      throw error;
    }
    return payload;
  }

  function lockChatAccess() {
    state.messages = [];
    state.pinnedMessages = [];
    state.users = [];
    state.currentUser = null;
    state.selectedMentions.clear();
    state.searchResults = [];
    state.searchQuery = "";
    state.searchActive = false;
    setUnreadCount(0);
    renderMessages();
    renderPinnedMessages();
    renderParticipants();
    setStatus("승인된 로그인 계정을 다시 확인해 주세요.", "error");
    void disconnectRealtime();
  }

  function cacheElements() {
    elements = {
      view: document.getElementById("chatView"),
      form: document.getElementById("companyChatForm"),
      input: document.getElementById("companyChatInput"),
      counter: document.getElementById("companyChatCounter"),
      sendButton: document.getElementById("companyChatSendBtn"),
      loadOlderButton: document.getElementById("companyChatLoadOlderBtn"),
      messageList: document.getElementById("companyChatMessages"),
      pinnedWrap: document.getElementById("companyChatPinnedWrap"),
      pinnedMessage: document.getElementById("companyChatPinnedMessage"),
      participantCount: document.getElementById("companyChatParticipantCount"),
      participantList: document.getElementById("companyChatParticipantList"),
      status: document.getElementById("companyChatStatus"),
      searchForm: document.getElementById("companyChatSearchForm"),
      searchInput: document.getElementById("companyChatSearchInput"),
      searchButton: document.getElementById("companyChatSearchBtn"),
      searchClearButton: document.getElementById("companyChatSearchClearBtn"),
      searchStatus: document.getElementById("companyChatSearchStatus"),
      mentionList: document.getElementById("companyChatMentionList"),
      pinOption: document.getElementById("companyChatPinOption"),
      pinCheckbox: document.getElementById("companyChatPinCheckbox"),
      unreadBadge: document.getElementById("chatUnreadBadge")
    };
  }

  function bindEvents() {
    elements.form?.addEventListener("submit", (event) => {
      event.preventDefault();
      void sendMessage();
    });
    elements.input?.addEventListener("input", handleInput);
    elements.input?.addEventListener("keydown", (event) => {
      if (event.key === "Escape") hideMentionList();
      if (event.key === "Enter" && !event.shiftKey && !elements.mentionList?.querySelector(".is-active")) {
        event.preventDefault();
        void sendMessage();
      }
    });
    elements.loadOlderButton?.addEventListener("click", () => void loadOlderMessages());
    elements.searchForm?.addEventListener("submit", (event) => {
      event.preventDefault();
      void searchMessages();
    });
    elements.searchClearButton?.addEventListener("click", clearSearch);
    document.addEventListener("click", (event) => {
      if (!elements.mentionList?.contains(event.target) && event.target !== elements.input) hideMentionList();
    });
    document.addEventListener("visibilitychange", () => {
      if (document.visibilityState === "visible" && state.sessionSignature) void refreshLatestMessages({ preserveScroll: true });
    });
  }

  function setStatus(message, tone = "info") {
    if (!elements.status) return;
    elements.status.textContent = message;
    elements.status.dataset.tone = tone;
  }

  function showAlert(message) {
    if (typeof options.showAlert === "function") options.showAlert(message);
  }

  function setUnreadCount(value) {
    state.unreadCount = Math.max(0, Number(value || 0));
    if (!elements.unreadBadge) return;
    elements.unreadBadge.hidden = state.unreadCount <= 0;
    elements.unreadBadge.textContent = state.unreadCount >= 100 ? "99+" : String(state.unreadCount);
    elements.unreadBadge.setAttribute("aria-label", `읽지 않은 전체대화방 메시지 ${state.unreadCount}개`);
  }

  function updateComposer() {
    if (!elements.input) return;
    const admin = isAdministrator();
    const length = textLength(elements.input.value);
    if (!admin && length > GENERAL_MESSAGE_LIMIT) {
      elements.input.value = truncateText(elements.input.value, GENERAL_MESSAGE_LIMIT);
    } else if (admin && length > ADMIN_SAFETY_LIMIT) {
      elements.input.value = truncateText(elements.input.value, ADMIN_SAFETY_LIMIT);
    }
    const nextLength = textLength(elements.input.value);
    if (elements.counter) {
      elements.counter.textContent = admin ? `${nextLength.toLocaleString()}자` : `${nextLength}/${GENERAL_MESSAGE_LIMIT}`;
      elements.counter.dataset.limitReached = String(!admin && nextLength >= GENERAL_MESSAGE_LIMIT);
    }
    if (elements.pinOption) elements.pinOption.hidden = !admin;
    if (elements.sendButton) elements.sendButton.disabled = state.sending || !elements.input.value.trim();
    elements.input.rows = admin && nextLength > 100 ? 5 : 3;
  }

  function findMentionQuery(value) {
    const cursor = elements.input?.selectionStart ?? String(value).length;
    const beforeCursor = String(value).slice(0, cursor);
    const match = beforeCursor.match(/(?:^|\s)@([^@\s]*)$/u);
    if (!match) return null;
    return {
      query: match[1],
      start: cursor - match[1].length - 1,
      end: cursor
    };
  }

  function handleInput() {
    updateComposer();
    const mention = findMentionQuery(elements.input?.value || "");
    if (!mention) {
      hideMentionList();
      return;
    }
    renderMentionSuggestions(mention);
  }

  function hideMentionList() {
    if (!elements.mentionList) return;
    elements.mentionList.hidden = true;
    elements.mentionList.innerHTML = "";
  }

  function renderMentionSuggestions(mention) {
    if (!elements.mentionList) return;
    const query = String(mention.query || "").toLocaleLowerCase("ko");
    const suggestions = state.users
      .filter((user) => user.id !== state.currentUser?.id)
      .filter((user) => `${user.displayName} ${user.roleLabel}`.toLocaleLowerCase("ko").includes(query));
    const includeAll = isAdministrator() && "전체".includes(query);
    if (!suggestions.length && !includeAll) {
      hideMentionList();
      return;
    }
    elements.mentionList.innerHTML = "";
    if (includeAll) {
      elements.mentionList.appendChild(createMentionButton({ id: "all", displayName: "전체", roleLabel: "관리자 전용" }, mention));
    }
    suggestions.forEach((user) => elements.mentionList.appendChild(createMentionButton(user, mention)));
    elements.mentionList.hidden = false;
  }

  function createMentionButton(user, mention) {
    const button = document.createElement("button");
    button.type = "button";
    button.className = "company-chat-mention-option";
    const name = document.createElement("strong");
    name.textContent = `@${user.displayName}`;
    const role = document.createElement("span");
    role.textContent = user.roleLabel;
    button.append(name, role);
    button.addEventListener("click", () => selectMention(user, mention));
    return button;
  }

  function selectMention(user, mention) {
    const input = elements.input;
    if (!input) return;
    const replacement = `@${user.displayName} `;
    input.value = `${input.value.slice(0, mention.start)}${replacement}${input.value.slice(mention.end)}`;
    const cursor = mention.start + replacement.length;
    input.setSelectionRange(cursor, cursor);
    if (user.id !== "all") state.selectedMentions.set(user.id, user.displayName);
    hideMentionList();
    updateComposer();
    input.focus();
  }

  function insertMention(user) {
    const input = elements.input;
    if (!input || !user?.id || user.id === state.currentUser?.id) return;
    const prefix = input.value && !/\s$/u.test(input.value) ? " " : "";
    input.value = `${input.value}${prefix}@${user.displayName} `;
    state.selectedMentions.set(user.id, user.displayName);
    updateComposer();
    input.focus();
    input.setSelectionRange(input.value.length, input.value.length);
  }

  function renderParticipants() {
    if (elements.participantCount) {
      elements.participantCount.textContent = state.users.length
        ? `참여 직원 ${state.users.length}명`
        : "참여 직원 확인 중";
    }
    if (!elements.participantList) return;
    elements.participantList.innerHTML = "";
    if (!state.users.length) {
      const empty = document.createElement("span");
      empty.className = "company-chat-participant-empty";
      empty.textContent = "등록 계정을 불러오고 있습니다.";
      elements.participantList.appendChild(empty);
      return;
    }
    const orderedUsers = [...state.users].sort((left, right) => {
      if (left.id === state.currentUser?.id) return -1;
      if (right.id === state.currentUser?.id) return 1;
      return left.displayName.localeCompare(right.displayName, "ko");
    });
    orderedUsers.forEach((user) => {
      const isCurrentUser = user.id === state.currentUser?.id;
      const item = document.createElement(isCurrentUser ? "span" : "button");
      if (!isCurrentUser) item.type = "button";
      item.className = `company-chat-participant${isCurrentUser ? " is-current" : ""}`;
      const name = document.createElement("strong");
      name.textContent = user.displayName;
      const role = document.createElement("span");
      role.textContent = `${user.roleLabel}${isCurrentUser ? " · 나" : ""}`;
      item.append(name, role);
      if (!isCurrentUser) item.addEventListener("click", () => insertMention(user));
      elements.participantList.appendChild(item);
    });
  }

  function resolveMentions(body) {
    const selected = [...state.selectedMentions.entries()]
      .filter(([, name]) => body.includes(`@${name}`))
      .map(([id]) => id);
    const nameCounts = new Map();
    state.users.forEach((user) => nameCounts.set(user.displayName, (nameCounts.get(user.displayName) || 0) + 1));
    state.users.forEach((user) => {
      if (user.id === state.currentUser?.id) return;
      if (nameCounts.get(user.displayName) === 1 && body.includes(`@${user.displayName}`)) selected.push(user.id);
    });
    return [...new Set(selected)].slice(0, 20);
  }

  function upsertMessage(message) {
    const index = state.messages.findIndex((item) => item.id === message.id);
    if (index >= 0) state.messages[index] = message;
    else state.messages.push(message);
    state.messages.sort((left, right) => String(left.createdAt).localeCompare(String(right.createdAt)));
  }

  function removeMessage(messageId) {
    state.messages = state.messages.filter((item) => item.id !== messageId);
  }

  async function sendMessage() {
    if (state.sending || !elements.input) return;
    const body = elements.input.value.trim();
    if (!body) return;
    const maxLength = isAdministrator() ? ADMIN_SAFETY_LIMIT : GENERAL_MESSAGE_LIMIT;
    if (textLength(body) > maxLength) {
      showAlert(isAdministrator() ? "관리자 공지는 10,000자 이내로 입력해 주세요." : "일반 메시지는 100자 이내로 입력해 주세요.");
      return;
    }

    state.sending = true;
    updateComposer();
    const draft = elements.input.value;
    const notifyAll = isAdministrator() && body.includes("@전체");
    const mentionedUserIds = resolveMentions(body);
    const clientMessageId = createCompatibleId();
    const pendingId = `pending:${clientMessageId}`;
    upsertMessage({
      id: pendingId,
      senderId: state.currentUser?.id || "",
      senderName: state.currentUser?.displayName || getAccount().displayName || "나",
      senderRole: state.currentUser?.role || getAccount().role || "",
      body,
      mentionedUserIds,
      notifyAll,
      pinned: false,
      createdAt: new Date().toISOString(),
      deleted: false,
      pending: true
    });
    renderMessages({ scrollToBottom: true });
    try {
      const payload = await requestChat("POST", {
        clientMessageId,
        body,
        mentionedUserIds,
        notifyAll,
        pinned: isAdministrator() && Boolean(elements.pinCheckbox?.checked)
      });
      removeMessage(pendingId);
      if (payload.message) upsertMessage(payload.message);
      elements.input.value = "";
      if (elements.pinCheckbox) elements.pinCheckbox.checked = false;
      state.selectedMentions.clear();
      renderMessages({ scrollToBottom: true });
      renderPinnedMessages();
      await markLatestRead();
    } catch (error) {
      removeMessage(pendingId);
      renderMessages({ scrollToBottom: true });
      elements.input.value = draft;
      showAlert(error.message || "메시지를 전송하지 못했습니다.");
      setStatus("전송에 실패했습니다. 입력 내용은 유지했습니다.", "error");
    } finally {
      state.sending = false;
      updateComposer();
      elements.input.focus();
    }
  }

  function formatMessageTime(value) {
    const date = new Date(value);
    if (Number.isNaN(date.getTime())) return "";
    return new Intl.DateTimeFormat("ko-KR", {
      month: "numeric",
      day: "numeric",
      hour: "2-digit",
      minute: "2-digit",
      hour12: false
    }).format(date);
  }

  function appendHighlightedBody(container, message) {
    const markers = [];
    if (message.notifyAll) markers.push("@전체");
    message.mentionedUserIds.forEach((id) => {
      const user = state.users.find((item) => item.id === id);
      if (user?.displayName) markers.push(`@${user.displayName}`);
    });
    const uniqueMarkers = [...new Set(markers)].sort((left, right) => right.length - left.length);
    if (!uniqueMarkers.length) {
      container.textContent = message.body;
      return;
    }
    const pattern = new RegExp(`(${uniqueMarkers.map((item) => item.replace(/[.*+?^${}()|[\]\\]/g, "\\$&")).join("|")})`, "g");
    message.body.split(pattern).forEach((part) => {
      if (!part) return;
      if (uniqueMarkers.includes(part)) {
        const mention = document.createElement("mark");
        mention.className = "company-chat-mention-mark";
        mention.textContent = part;
        container.appendChild(mention);
      } else {
        container.appendChild(document.createTextNode(part));
      }
    });
  }

  function createMessageElement(message) {
    const own = message.senderId && message.senderId === state.currentUser?.id;
    const article = document.createElement("article");
    article.className = `company-chat-message${own ? " is-own" : ""}${message.pinned ? " is-pinned" : ""}${message.pending ? " is-pending" : ""}`;
    article.dataset.messageId = message.id;

    const header = document.createElement("div");
    header.className = "company-chat-message-head";
    const sender = document.createElement("strong");
    sender.textContent = own ? "나" : message.senderName;
    const meta = document.createElement("span");
    meta.textContent = message.pending
      ? "전송 중"
      : `${message.senderRole === "admin" ? "관리자 · " : ""}${formatMessageTime(message.createdAt)}`;
    header.append(sender, meta);

    const bubble = document.createElement("div");
    bubble.className = "company-chat-bubble";
    appendHighlightedBody(bubble, message);
    article.append(header, bubble);

    if (isAdministrator() && !message.deleted && !message.pending) {
      const actions = document.createElement("div");
      actions.className = "company-chat-message-actions";
      if (message.senderRole === "admin") {
        const pin = document.createElement("button");
        pin.type = "button";
        pin.textContent = message.pinned ? "고정 해제" : "공지 고정";
        pin.addEventListener("click", () => void togglePinned(message));
        actions.appendChild(pin);
      }
      const remove = document.createElement("button");
      remove.type = "button";
      remove.className = "danger";
      remove.textContent = "삭제";
      remove.addEventListener("click", () => void deleteMessage(message));
      actions.appendChild(remove);
      article.appendChild(actions);
    }
    return article;
  }

  function renderMessages({ scrollToBottom = false, preserveScroll = false } = {}) {
    if (!elements.messageList) return;
    const previousHeight = elements.messageList.scrollHeight;
    const previousTop = elements.messageList.scrollTop;
    const visibleMessages = (state.searchActive ? state.searchResults : state.messages)
      .filter((message) => !message.deleted);
    elements.messageList.innerHTML = "";
    if (!visibleMessages.length && !state.loading) {
      const empty = document.createElement("div");
      empty.className = "company-chat-empty";
      empty.textContent = state.searchActive
        ? `“${state.searchQuery}” 검색 결과가 없습니다.`
        : "아직 등록된 메시지가 없습니다. 첫 업무 메시지를 남겨보세요.";
      elements.messageList.appendChild(empty);
    } else {
      visibleMessages.forEach((message) => elements.messageList.appendChild(createMessageElement(message)));
    }
    if (preserveScroll) elements.messageList.scrollTop = elements.messageList.scrollHeight - previousHeight + previousTop;
    if (scrollToBottom) elements.messageList.scrollTop = elements.messageList.scrollHeight;
    if (elements.loadOlderButton) elements.loadOlderButton.hidden = state.searchActive || !state.hasMore;
    if (!state.searchActive && state.pendingMessageId) scrollToMessage(state.pendingMessageId);
  }

  function setSearchStatus(message = "") {
    if (elements.searchStatus) elements.searchStatus.textContent = message;
  }

  function clearSearch() {
    state.searchActive = false;
    state.searchResults = [];
    state.searchQuery = "";
    if (elements.searchInput) elements.searchInput.value = "";
    if (elements.searchClearButton) elements.searchClearButton.hidden = true;
    setSearchStatus("");
    renderMessages();
  }

  async function searchMessages() {
    if (state.searching || !state.sessionSignature) return;
    const query = String(elements.searchInput?.value || "").replace(/\s+/g, " ").trim();
    if (!query) {
      clearSearch();
      return;
    }
    state.searching = true;
    if (elements.searchButton) elements.searchButton.disabled = true;
    setSearchStatus("대화 내용을 찾는 중입니다.");
    try {
      const payload = await requestChat("GET", null, `?search=${encodeURIComponent(query)}`);
      state.searchResults = Array.isArray(payload.messages) ? payload.messages : [];
      state.searchQuery = String(payload.searchQuery || query);
      state.searchActive = true;
      if (elements.searchClearButton) elements.searchClearButton.hidden = false;
      setSearchStatus(`${state.searchResults.length}개의 메시지를 찾았습니다.`);
      renderMessages();
    } catch (error) {
      setSearchStatus(error.message || "대화 내용을 찾지 못했습니다.");
    } finally {
      state.searching = false;
      if (elements.searchButton) elements.searchButton.disabled = false;
    }
  }

  function renderPinnedMessages() {
    if (!elements.pinnedWrap || !elements.pinnedMessage) return;
    const message = state.pinnedMessages.find((item) => !item.deleted) || state.messages.slice().reverse().find((item) => item.pinned && !item.deleted);
    elements.pinnedWrap.hidden = !message;
    elements.pinnedMessage.innerHTML = "";
    if (!message) return;
    const head = document.createElement("strong");
    head.textContent = `${message.senderName} · ${formatMessageTime(message.createdAt)}`;
    const body = document.createElement("p");
    appendHighlightedBody(body, message);
    elements.pinnedMessage.append(head, body);
  }

  async function loadInitialMessages() {
    if (state.loading || !state.sessionSignature) return;
    state.loading = true;
    setStatus("대화 내용을 불러오는 중입니다.");
    try {
      const payload = await requestChat("GET");
      state.messages = Array.isArray(payload.messages) ? payload.messages : [];
      state.pinnedMessages = Array.isArray(payload.pinnedMessages) ? payload.pinnedMessages : [];
      state.users = Array.isArray(payload.users) ? payload.users : state.users;
      state.currentUser = payload.currentUser || state.currentUser;
      state.hasMore = Boolean(payload.hasMore);
      setUnreadCount(payload.unreadCount);
      renderMessages({ scrollToBottom: true });
      renderPinnedMessages();
      renderParticipants();
      updateComposer();
      setStatus("승인된 전 직원이 참여하는 회사 대화방입니다.", "success");
      if (state.active) await markLatestRead();
    } catch (error) {
      setStatus(error.message || "대화 내용을 불러오지 못했습니다.", "error");
    } finally {
      state.loading = false;
    }
  }

  async function loadOlderMessages() {
    if (state.searchActive || state.loadingOlder || !state.hasMore || !state.messages.length) return;
    state.loadingOlder = true;
    if (elements.loadOlderButton) elements.loadOlderButton.disabled = true;
    try {
      const before = state.messages[0].createdAt;
      const payload = await requestChat("GET", null, `?before=${encodeURIComponent(before)}`);
      const older = Array.isArray(payload.messages) ? payload.messages : [];
      const knownIds = new Set(state.messages.map((item) => item.id));
      state.messages = [...older.filter((item) => !knownIds.has(item.id)), ...state.messages];
      state.hasMore = Boolean(payload.hasMore);
      renderMessages({ preserveScroll: true });
    } catch (error) {
      showAlert(error.message || "이전 메시지를 불러오지 못했습니다.");
    } finally {
      state.loadingOlder = false;
      if (elements.loadOlderButton) elements.loadOlderButton.disabled = false;
    }
  }

  async function refreshLatestMessages({ preserveScroll = false } = {}) {
    if (!state.sessionSignature || state.loading) return;
    try {
      const payload = await requestChat("GET");
      state.messages = Array.isArray(payload.messages) ? payload.messages : state.messages;
      state.pinnedMessages = Array.isArray(payload.pinnedMessages) ? payload.pinnedMessages : state.pinnedMessages;
      if (Array.isArray(payload.users) && payload.users.length) state.users = payload.users;
      state.currentUser = payload.currentUser || state.currentUser;
      state.hasMore = Boolean(payload.hasMore);
      setUnreadCount(payload.unreadCount);
      const nearBottom = elements.messageList
        ? elements.messageList.scrollHeight - elements.messageList.scrollTop - elements.messageList.clientHeight < 100
        : true;
      renderMessages({ scrollToBottom: state.active && nearBottom, preserveScroll: preserveScroll && !nearBottom });
      renderPinnedMessages();
      renderParticipants();
      if (state.active) await markLatestRead();
    } catch (error) {
      setStatus("실시간 연결을 다시 확인하고 있습니다.", "warning");
    }
  }

  function scheduleRealtimeRefresh() {
    clearTimeout(state.realtimeRefreshTimer);
    state.realtimeRefreshTimer = setTimeout(() => void refreshLatestMessages(), 120);
  }

  async function connectRealtime() {
    const client = options.supabaseClient;
    if (!client || !state.sessionSignature) return;
    await disconnectRealtime();
    try {
      const refreshed = await client.auth.refreshSession().catch(() => ({ data: null }));
      const token = refreshed?.data?.session?.access_token || await getAccessToken();
      await client.realtime.setAuth(token);
      state.realtimeChannel = client
        .channel(REALTIME_TOPIC, { config: { private: true } })
        .on("broadcast", { event: "INSERT" }, scheduleRealtimeRefresh)
        .on("broadcast", { event: "UPDATE" }, scheduleRealtimeRefresh)
        .on("broadcast", { event: "DELETE" }, scheduleRealtimeRefresh)
        .subscribe((status) => {
          if (status === "SUBSCRIBED") setStatus("실시간 대화 연결됨", "success");
          if (["CHANNEL_ERROR", "TIMED_OUT"].includes(status)) setStatus("실시간 연결을 다시 시도하고 있습니다.", "warning");
        });
    } catch (error) {
      setStatus("실시간 연결을 시작하지 못했습니다. 새로고침으로 메시지를 확인할 수 있습니다.", "warning");
    }
  }

  async function disconnectRealtime() {
    clearTimeout(state.realtimeRefreshTimer);
    if (!state.realtimeChannel || !options.supabaseClient) return;
    const channel = state.realtimeChannel;
    state.realtimeChannel = null;
    await options.supabaseClient.removeChannel(channel).catch(() => {});
  }

  async function markLatestRead() {
    if (!state.active || !state.messages.length) return;
    const latest = state.messages[state.messages.length - 1];
    try {
      await requestChat("PATCH", { action: "read", messageId: latest.id });
      setUnreadCount(0);
    } catch (error) {
      // A later refresh will retry without interrupting message reading.
    }
  }

  async function deleteMessage(message) {
    const confirmed = window.confirm("이 메시지를 관리자 권한으로 삭제하시겠습니까?");
    if (!confirmed) return;
    try {
      await requestChat("PATCH", { action: "delete", messageId: message.id });
      removeMessage(message.id);
      state.searchResults = state.searchResults.filter((item) => item.id !== message.id);
      state.pinnedMessages = state.pinnedMessages.filter((item) => item.id !== message.id);
      renderMessages();
      renderPinnedMessages();
    } catch (error) {
      showAlert(error.message || "메시지를 삭제하지 못했습니다.");
    }
  }

  async function togglePinned(message) {
    try {
      await requestChat("PATCH", { action: "pin", messageId: message.id, pinned: !message.pinned });
      await refreshLatestMessages({ preserveScroll: true });
    } catch (error) {
      showAlert(error.message || "공지 고정 상태를 변경하지 못했습니다.");
    }
  }

  function scrollToMessage(messageId) {
    if (!messageId || !elements.messageList) return;
    const target = [...elements.messageList.querySelectorAll("[data-message-id]")]
      .find((item) => item.dataset.messageId === messageId);
    if (!target) return;
    target.scrollIntoView({ block: "center", behavior: "smooth" });
    target.classList.add("is-targeted");
    setTimeout(() => target.classList.remove("is-targeted"), 2200);
    state.pendingMessageId = "";
    const url = new URL(window.location.href);
    url.searchParams.delete("message");
    window.history.replaceState(null, "", `${url.pathname}${url.search}${url.hash}`);
  }

  function openMessage(messageId = "") {
    state.pendingMessageId = String(messageId || "");
    if (typeof options.switchView === "function") options.switchView("chatView");
    if (state.messages.length) scrollToMessage(state.pendingMessageId);
  }

  function setActive(active) {
    state.active = Boolean(active);
    if (state.active) {
      if (!state.messages.length) void loadInitialMessages();
      else void markLatestRead();
      setTimeout(() => elements.input?.focus(), 0);
    }
  }

  async function syncSession() {
    const account = getAccount();
    const signature = account.email && account.role ? `${account.email}|${account.role}` : "";
    if (signature === state.sessionSignature) return;
    state.sessionSignature = signature;
    state.messages = [];
    state.pinnedMessages = [];
    state.users = [];
    state.currentUser = null;
    state.searchResults = [];
    state.searchQuery = "";
    state.searchActive = false;
    state.selectedMentions.clear();
    setUnreadCount(0);
    renderMessages();
    renderPinnedMessages();
    renderParticipants();
    if (!signature) {
      await disconnectRealtime();
      setStatus("로그인 후 전체대화방을 사용할 수 있습니다.");
      return;
    }
    await loadInitialMessages();
    await connectRealtime();
  }

  function initialize(nextOptions = {}) {
    if (state.initialized) return;
    state.initialized = true;
    options = nextOptions;
    cacheElements();
    bindEvents();
    updateComposer();
    const url = new URL(window.location.href);
    state.pendingMessageId = String(url.searchParams.get("message") || "");
    void syncSession();
  }

  window.JhintCompanyChat = {
    initialize,
    openMessage,
    setActive,
    syncSession
  };
})();
