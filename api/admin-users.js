const DEFAULT_SUPABASE_URL = "https://fftdjnjnvusgrbbfbwcw.supabase.co";
const DEFAULT_ADMIN_EMAIL = "tape@jhint.net";
const ADMIN_ROLES = new Set(["admin", "sales", "worker", "viewer"]);

function sendJson(response, statusCode, payload) {
  response.statusCode = statusCode;
  response.setHeader("Content-Type", "application/json; charset=utf-8");
  response.end(JSON.stringify(payload));
}

function getSupabaseUrl() {
  return String(process.env.SUPABASE_URL || process.env.NEXT_PUBLIC_SUPABASE_URL || DEFAULT_SUPABASE_URL).replace(/\/$/, "");
}

function getServiceRoleKey() {
  return String(process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.SUPABASE_SECRET_KEY || "").trim();
}

function getAdminEmails() {
  const raw = process.env.ADMIN_EMAILS || process.env.JHINT_ADMIN_EMAILS || DEFAULT_ADMIN_EMAIL;
  return String(raw)
    .split(/[,\s]+/)
    .map((email) => email.trim().toLowerCase())
    .filter(Boolean);
}

function normalizeRole(value, fallback = "viewer") {
  const role = String(value || "").trim().toLowerCase();
  return ADMIN_ROLES.has(role) ? role : fallback;
}

function parseDisplayName(value) {
  return String(value || "").trim().slice(0, 60);
}

function readRequestBody(request) {
  return new Promise((resolve, reject) => {
    let body = "";
    request.on("data", (chunk) => {
      body += chunk;
      if (body.length > 1024 * 32) {
        reject(new Error("요청 내용이 너무 큽니다."));
      }
    });
    request.on("end", () => {
      if (!body) {
        resolve({});
        return;
      }
      try {
        resolve(JSON.parse(body));
      } catch (error) {
        reject(new Error("요청 형식이 올바르지 않습니다."));
      }
    });
    request.on("error", reject);
  });
}

function getBearerToken(request) {
  const authHeader = request.headers.authorization || "";
  const match = String(authHeader).match(/^Bearer\s+(.+)$/i);
  return match ? match[1].trim() : "";
}

async function verifyAdminRequest(request, supabaseUrl, serviceRoleKey) {
  const token = getBearerToken(request);
  if (!token) {
    return { ok: false, status: 401, message: "관리자 로그인 토큰이 없습니다." };
  }

  const userResponse = await fetch(`${supabaseUrl}/auth/v1/user`, {
    headers: {
      apikey: serviceRoleKey,
      Authorization: `Bearer ${token}`
    }
  });

  const userPayload = await userResponse.json().catch(() => ({}));
  const email = String(userPayload.email || "").toLowerCase();
  if (!userResponse.ok || !email) {
    return { ok: false, status: 401, message: "관리자 로그인 세션을 확인할 수 없습니다." };
  }

  const role = normalizeRole(userPayload.app_metadata?.jhint_role, "");
  if (!getAdminEmails().includes(email) && role !== "admin") {
    return { ok: false, status: 403, message: "이 계정은 관리자 권한이 없습니다." };
  }

  return { ok: true, email, userId: userPayload.id || "" };
}

async function callSupabaseAdmin(path, options, supabaseUrl, serviceRoleKey) {
  const response = await fetch(`${supabaseUrl}${path}`, {
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
    const message = payload.msg || payload.message || payload.error_description || payload.error || "Supabase 계정 관리 요청에 실패했습니다.";
    const error = new Error(message);
    error.status = response.status;
    throw error;
  }
  return payload;
}

async function listUsers(supabaseUrl, serviceRoleKey) {
  const payload = await callSupabaseAdmin("/auth/v1/admin/users?page=1&per_page=100", { method: "GET" }, supabaseUrl, serviceRoleKey);
  return Array.isArray(payload.users) ? payload.users : [];
}

async function createUser(request, supabaseUrl, serviceRoleKey) {
  const body = await readRequestBody(request);
  const email = String(body.email || "").trim().toLowerCase();
  const password = String(body.password || "").trim();
  const displayName = parseDisplayName(body.displayName);
  const role = normalizeRole(body.role);

  if (!email || !password) {
    const error = new Error("이메일과 비밀번호를 입력해 주세요.");
    error.status = 400;
    throw error;
  }

  if (password.length < 8) {
    const error = new Error("비밀번호는 8자 이상이어야 합니다.");
    error.status = 400;
    throw error;
  }

  return callSupabaseAdmin(
    "/auth/v1/admin/users",
    {
      method: "POST",
      body: JSON.stringify({
        email,
        password,
        email_confirm: true,
        app_metadata: {
          jhint_role: role
        },
        user_metadata: {
          display_name: displayName,
          name: displayName
        }
      })
    },
    supabaseUrl,
    serviceRoleKey
  );
}

async function updateUser(request, supabaseUrl, serviceRoleKey) {
  const body = await readRequestBody(request);
  const userId = String(body.id || "").trim();
  const role = normalizeRole(body.role, "");
  const displayName = parseDisplayName(body.displayName);

  if (!userId) {
    const error = new Error("수정할 계정 ID가 없습니다.");
    error.status = 400;
    throw error;
  }

  if (!role) {
    const error = new Error("계정 권한을 선택해 주세요.");
    error.status = 400;
    throw error;
  }

  const users = await listUsers(supabaseUrl, serviceRoleKey);
  const currentUser = users.find((user) => user.id === userId) || {};
  const currentAppMetadata = currentUser.app_metadata || currentUser.raw_app_meta_data || {};
  const currentUserMetadata = currentUser.user_metadata || currentUser.raw_user_meta_data || {};

  return callSupabaseAdmin(
    `/auth/v1/admin/users/${encodeURIComponent(userId)}`,
    {
      method: "PATCH",
      body: JSON.stringify({
        app_metadata: {
          ...currentAppMetadata,
          jhint_role: role
        },
        user_metadata: {
          ...currentUserMetadata,
          display_name: displayName,
          name: displayName
        }
      })
    },
    supabaseUrl,
    serviceRoleKey
  );
}

async function deleteUser(request, adminUserId, supabaseUrl, serviceRoleKey) {
  const url = new URL(request.url, "https://jhint.local");
  const userId = String(url.searchParams.get("id") || "").trim();
  if (!userId) {
    const error = new Error("삭제할 계정 ID가 없습니다.");
    error.status = 400;
    throw error;
  }

  if (userId === adminUserId) {
    const error = new Error("현재 로그인 중인 본인 계정은 삭제할 수 없습니다.");
    error.status = 400;
    throw error;
  }

  return callSupabaseAdmin(`/auth/v1/admin/users/${encodeURIComponent(userId)}`, { method: "DELETE" }, supabaseUrl, serviceRoleKey);
}

module.exports = async function adminUsersHandler(request, response) {
  if (!["GET", "POST", "PATCH", "DELETE"].includes(request.method)) {
    response.setHeader("Allow", "GET, POST, PATCH, DELETE");
    sendJson(response, 405, { message: "지원하지 않는 요청입니다." });
    return;
  }

  const supabaseUrl = getSupabaseUrl();
  const serviceRoleKey = getServiceRoleKey();
  if (!serviceRoleKey) {
    sendJson(response, 500, {
      message: "SUPABASE_SERVICE_ROLE_KEY 또는 SUPABASE_SECRET_KEY 환경변수가 설정되지 않았습니다. Vercel 환경변수에 Supabase Secret key를 추가한 뒤 다시 배포해 주세요."
    });
    return;
  }

  try {
    const admin = await verifyAdminRequest(request, supabaseUrl, serviceRoleKey);
    if (!admin.ok) {
      sendJson(response, admin.status, { message: admin.message });
      return;
    }

    if (request.method === "GET") {
      const users = await listUsers(supabaseUrl, serviceRoleKey);
      sendJson(response, 200, { users });
      return;
    }

    if (request.method === "POST") {
      const user = await createUser(request, supabaseUrl, serviceRoleKey);
      sendJson(response, 201, { user });
      return;
    }

    if (request.method === "PATCH") {
      const user = await updateUser(request, supabaseUrl, serviceRoleKey);
      sendJson(response, 200, { user });
      return;
    }

    await deleteUser(request, admin.userId, supabaseUrl, serviceRoleKey);
    sendJson(response, 200, { ok: true });
  } catch (error) {
    sendJson(response, error.status || 500, { message: error.message || "계정 관리 요청에 실패했습니다." });
  }
};
