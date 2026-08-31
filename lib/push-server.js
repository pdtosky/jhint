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

async function verifyProductionUser(request) {
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

  const role = String(user.app_metadata?.jhint_role || "").trim().toLowerCase();
  if (role !== "production") {
    return { ok: false, status: 403, message: "생산 계정만 작업 알림을 설정할 수 있습니다." };
  }

  const displayName = String(
    user.user_metadata?.display_name || user.user_metadata?.name || user.user_metadata?.full_name || ""
  ).trim();
  if (!displayName) {
    return { ok: false, status: 400, message: "계정에 작업자 이름이 등록되어 있지 않습니다." };
  }

  return {
    ok: true,
    userId: user.id,
    email: String(user.email || "").trim().toLowerCase(),
    displayName,
    role
  };
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
  getBearerToken,
  getPushServerConfig,
  getServiceRoleKey,
  getSupabaseUrl,
  readJsonBody,
  sendJson,
  sendWebPush,
  supabaseRequest,
  verifyProductionUser
};
