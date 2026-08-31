const {
  readJsonBody,
  sendJson,
  supabaseRequest,
  verifyPushNotificationUser
} = require("../lib/push-server");

function normalizeSubscription(value = {}) {
  const endpoint = String(value.endpoint || "").trim();
  const p256dh = String(value.keys?.p256dh || "").trim();
  const auth = String(value.keys?.auth || "").trim();
  let endpointUrl;
  try {
    endpointUrl = new URL(endpoint);
  } catch (error) {
    endpointUrl = null;
  }
  const hostname = String(endpointUrl?.hostname || "").toLowerCase();
  const allowedHost = [
    "fcm.googleapis.com",
    "push.services.mozilla.com",
    "web.push.apple.com",
    "notify.windows.com"
  ].some((suffix) => hostname === suffix || hostname.endsWith(`.${suffix}`));
  const validKey = (key, min, max) => /^[A-Za-z0-9_-]+$/.test(key) && key.length >= min && key.length <= max;
  if (
    endpointUrl?.protocol !== "https:" ||
    !allowedHost ||
    endpoint.length > 4096 ||
    !validKey(p256dh, 32, 256) ||
    !validKey(auth, 8, 128)
  ) {
    const error = new Error("알림 기기 정보가 올바르지 않습니다.");
    error.status = 400;
    throw error;
  }
  return { endpoint, p256dh, auth };
}

module.exports = async function pushSubscriptionsHandler(request, response) {
  if (!['POST', 'DELETE'].includes(request.method)) {
    response.setHeader("Allow", "POST, DELETE");
    sendJson(response, 405, { message: "지원하지 않는 요청입니다." });
    return;
  }

  try {
    const user = await verifyPushNotificationUser(request);
    if (!user.ok) {
      sendJson(response, user.status, { message: user.message });
      return;
    }

    const body = await readJsonBody(request);
    const subscription = normalizeSubscription(body.subscription || body);
    const encodedEndpoint = encodeURIComponent(subscription.endpoint);

    if (request.method === "DELETE") {
      await supabaseRequest(
        `/rest/v1/push_subscriptions?user_id=eq.${encodeURIComponent(user.userId)}&endpoint=eq.${encodedEndpoint}`,
        { method: "DELETE", headers: { Prefer: "return=minimal" } }
      );
      sendJson(response, 200, { ok: true, enabled: false });
      return;
    }

    const currentSubscriptions = await supabaseRequest(
      `/rest/v1/push_subscriptions?user_id=eq.${encodeURIComponent(user.userId)}&select=endpoint&limit=6`,
      { method: "GET" }
    );
    const alreadyRegistered = currentSubscriptions.some((item) => item.endpoint === subscription.endpoint);
    if (!alreadyRegistered && currentSubscriptions.length >= 5) {
      sendJson(response, 400, { message: "알림 기기는 계정당 최대 5대까지 등록할 수 있습니다." });
      return;
    }

    await supabaseRequest("/rest/v1/push_subscriptions?on_conflict=endpoint", {
      method: "POST",
      headers: { Prefer: "resolution=merge-duplicates,return=minimal" },
      body: JSON.stringify([{
        user_id: user.userId,
        email: user.email,
        display_name: user.displayName,
        role: user.role,
        endpoint: subscription.endpoint,
        p256dh: subscription.p256dh,
        auth: subscription.auth,
        user_agent: String(request.headers["user-agent"] || "").slice(0, 500),
        enabled: true,
        updated_at: new Date().toISOString()
      }])
    });
    sendJson(response, 200, { ok: true, enabled: true });
  } catch (error) {
    sendJson(response, error.status || 500, { message: error.message || "알림 설정을 저장하지 못했습니다." });
  }
};
