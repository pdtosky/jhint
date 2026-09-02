const assert = require("assert");
const fs = require("fs");
const path = require("path");

const root = path.join(__dirname, "..");
const app = fs.readFileSync(path.join(root, "app.js"), "utf8");
const config = fs.readFileSync(path.join(root, "config.js"), "utf8");
const html = fs.readFileSync(path.join(root, "index.html"), "utf8");
const serviceWorker = fs.readFileSync(path.join(root, "sw.js"), "utf8");
const sql = fs.readFileSync(path.join(root, "supabase-push-notifications.sql"), "utf8");
const packageJson = require(path.join(root, "package.json"));

assert(html.includes('id="pushNotificationBtn"'), "production push settings button should exist");
assert(app.includes('new Set(["production", "admin", "sales", "office", "quality", "shipping"])'), "push settings should support chat mentions for every approved employee role");
assert(app.includes('Notification.requestPermission()'), "client should request device notification permission");
assert(app.includes('registration.pushManager.subscribe'), "client should create a Web Push subscription");
assert(app.includes('PUSH_SUBSCRIPTIONS_API_URL'), "client should store subscriptions through the protected API");
assert(app.includes('order.workerUserId = workerUserId'), "new work starts should retain the authenticated production user ID");
assert(config.includes("pushVapidPublicKey"), "public VAPID key should be available to the browser");
assert(serviceWorker.includes('self.addEventListener("push"'), "service worker should receive background pushes");
assert(serviceWorker.includes('self.addEventListener("notificationclick"'), "notification click should reopen the app");
assert(serviceWorker.includes("silent: false"), "work reminders should explicitly request a non-silent notification");
assert(serviceWorker.includes("vibrate: [300, 150, 300, 150, 500]"), "supported devices should use a noticeable vibration pattern");
assert(serviceWorker.includes("requireInteraction: true"), "desktop reminders should remain visible until acknowledged when supported");
assert(serviceWorker.includes("renotify: true"), "replacement reminders should alert the user again");
assert(serviceWorker.includes('type: "JHINT_OPEN_VIEW"'), "notification click should focus the worker input view");
assert(sql.includes("alter table public.push_subscriptions enable row level security"), "subscription table should enable RLS");
assert(sql.includes("revoke all on table public.push_subscriptions from anon, authenticated"), "browser roles must not access subscriptions directly");
assert(sql.includes("role in ('production', 'admin', 'sales', 'office', 'quality', 'shipping')"), "subscription records should allow chat notifications for every approved employee role");
assert.strictEqual(packageJson.dependencies["web-push"], "3.6.7", "web-push dependency should be pinned");

const subscriptionApi = fs.readFileSync(path.join(root, "api", "push-subscriptions.js"), "utf8");
assert(subscriptionApi.includes("currentSubscriptions.length >= 5"), "each production account should have a device limit");
assert(subscriptionApi.includes("role: user.role"), "subscription records should retain the authenticated account role");
assert(subscriptionApi.includes('"fcm.googleapis.com"'), "subscription endpoints should be restricted to known push services");

console.log("push notification client test passed");
