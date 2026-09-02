const webPush = require("web-push");

const DEFAULT_SUPABASE_URL = "https://fftdjnjnvusgrbbfbwcw.supabase.co";

function getSupabaseUrl() {
  return String(process.env.SUPABASE_URL || process.env.NEXT_PUBLIC_SUPABASE_URL || DEFAULT_SUPABASE_URL).replace(/\/$/, "");
}

function getServiceRoleKey() {
  return String(process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.SUPABASE_SECRET_KEY || "").trim();
}

function sendJson(response, statusCode, payload) {
  response.statusCode = statusCode;
  response.setHeader("Content-Type", "application/json; charset=utf-8");
  response.setHeader("Cache-Control", "no-store");
  response.end(JSON.stringify(payload));
}

function readJsonBody(request, maxBytes = 64 * 1024) {
  return new Promise((resolve, reject) => {
    let raw = "";
    request.on("data", (chunk) => {
      raw += chunk;
      if (raw.length > maxBytes) {
        const error = new Error("요청 내용이 너무 큽니다.");
        error.status = 413;
        reject(error);
      }
    });
    request.on("end", () => {
      if (!raw) return resolve({});
      try {
        resolve(JSON.parse(raw));
      } catch (error) {
        const parseError = new Error("요청 형식이 올바르지 않습니다.");
        parseError.status = 400;
        reject(parseError);
      }
    });
    request.on("error", reject);
  });
}

function getBearerToken(request) {
  const match = String(request.headers.authorization || "").match(/^Bearer\s+(.+)$/i);
  return match ? match[1].trim() : "";
}

async function supabaseRequest(path, options = {}) {
  const serviceRoleKey = getServiceRoleKey();
  if (!serviceRoleKey) {
    const error = new Error("Supabase 서버 비밀키가 설정되지 않았습니다.");
    error.status = 500;
    throw error;
  }

  const response = await fetch(`${getSupabaseUrl()}${path}`, {
    ...options,
    headers: {
      apikey: serviceRoleKey,
      Authorization: `Bearer ${serviceRoleKey}`,
      "Content-Type": "application/json",
      ...(options.headers || {})
    }
  });
  const payload = await response.json().catch(() => ({}));
  if (!response.ok) {
    const error = new Error(payload.message || payload.msg || payload.error || `Supabase 요청 실패 (${response.status})`);
    error.status = response.status;
    error.payload = payload;
    throw error;
  }
  return payload;
}

const APPROVED_ACCOUNT_ROLES = new Set(["production", "admin", "sales", "office", "quality", "shipping"]);
const COMPANY_CHAT_ROLES = new Set(["production", "admin", "sales", "office", "quality", "shipping"]);
const PUSH_NOTIFICATION_ROLES = new Set(["production", "admin", "sales", "office", "quality", "shipping"]);
const LEGACY_ROLE_ALIASES = {
  worker: "production",
  viewer: "shipping",
  general: "office"
};

function normalizeApprovedRole(value) {
  const rawRole = String(value || "").trim().toLowerCase();
  const role = LEGACY_ROLE_ALIASES[rawRole] || rawRole;
  return APPROVED_ACCOUNT_ROLES.has(role) ? role : "";
}

function hasPasswordAuthentication(token) {
  try {
    const payloadPart = String(token || "").split(".")[1] || "";
    const normalized = payloadPart.replace(/-/g, "+").replace(/_/g, "/");
    const padded = normalized.padEnd(Math.ceil(normalized.length / 4) * 4, "=");
    const payload = JSON.parse(Buffer.from(padded, "base64").toString("utf8"));
    return Array.isArray(payload.amr) && payload.amr.some((item) => String(item?.method || "") === "password");
  } catch (error) {
    return false;
  }
}

async function verifyApprovedUser(request, allowedRoles = APPROVED_ACCOUNT_ROLES, deniedMessage = "관리자가 승인한 계정만 사용할 수 있습니다.") {
  const token = getBearerToken(request);
  if (!token) {
    return { ok: false, status: 401, message: "로그인 정보가 없습니다." };
  }

  const serviceRoleKey = getServiceRoleKey();
  const response = await fetch(`${getSupabaseUrl()}/auth/v1/user`, {
    headers: {
      apikey: serviceRoleKey,
      Authorization: `Bearer ${token}`
    }
  });
  const user = await response.json().catch(() => ({}));
  if (!response.ok || !user.id) {
    return { ok: false, status: 401, message: "로그인 세션을 확인할 수 없습니다." };
  }

  if (!hasPasswordAuthentication(token)) {
    return { ok: false, status: 403, message: "비밀번호로 로그인한 승인 계정만 사용할 수 있습니다." };
  }

  const role = normalizeApprovedRole(user.app_metadata?.jhint_role);
  if (!role || !allowedRoles.has(role)) {
    return { ok: false, status: 403, message: deniedMessage };
  }
  const registeredDisplayName = String(
    user.user_metadata?.display_name || user.user_metadata?.name || user.user_metadata?.full_name || ""
  ).trim();
  const displayName = registeredDisplayName || String(user.email || "").split("@")[0] || "직원";

  return {
    ok: true,
    userId: user.id,
    email: String(user.email || "").trim().toLowerCase(),
    displayName,
    role
  };
}

async function verifyPushNotificationUser(request) {
  return verifyApprovedUser(
    request,
    PUSH_NOTIFICATION_ROLES,
    "승인된 직원 계정만 알림을 설정할 수 있습니다."
  );
}

async function verifyCompanyChatUser(request) {
  return verifyApprovedUser(
    request,
    COMPANY_CHAT_ROLES,
    "전체대화방은 승인된 직원 계정만 사용할 수 있습니다."
  );
}

async function getPushServerConfig() {
  const config = await supabaseRequest("/rest/v1/rpc/get_jhint_push_server_config", {
    method: "POST",
    body: "{}"
  });
  const normalized = {
    publicKey: String(config.publicKey || config.public_key || "").trim(),
    privateKey: String(config.privateKey || config.private_key || "").trim(),
    subject: String(config.subject || "mailto:tape@jhint.net").trim(),
    cronSecret: String(config.cronSecret || config.cron_secret || "").trim()
  };
  if (!normalized.publicKey || !normalized.privateKey || !normalized.cronSecret) {
    const error = new Error("푸시 알림 서버 비밀값이 준비되지 않았습니다.");
    error.status = 503;
    throw error;
  }
  return normalized;
}

function configureWebPush(config) {
  webPush.setVapidDetails(config.subject, config.publicKey, config.privateKey);
}

async function sendWebPush(subscription, payload, config) {
  configureWebPush(config);
  return webPush.sendNotification(subscription, JSON.stringify(payload), {
    TTL: 60 * 60,
    urgency: "high"
  });
}

module.exports = {
  APPROVED_ACCOUNT_ROLES,
  COMPANY_CHAT_ROLES,
  getBearerToken,
  getPushServerConfig,
  getServiceRoleKey,
  getSupabaseUrl,
  readJsonBody,
  sendJson,
  sendWebPush,
  supabaseRequest,
  normalizeApprovedRole,
  verifyApprovedUser,
  verifyCompanyChatUser,
  verifyPushNotificationUser
};
