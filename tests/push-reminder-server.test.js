const assert = require("assert");
const fs = require("fs");
const path = require("path");
const reminderHandler = require("../api/push-reminders");
const reminderSource = fs.readFileSync(path.join(__dirname, "..", "api", "push-reminders.js"), "utf8");

const {
  getAdminPendingOrders,
  getKstDateParts,
  getUserActiveOrders,
  shouldSendMorningReminder
} = reminderHandler._test;

const kstMorning = getKstDateParts(new Date("2026-08-31T00:00:00.000Z"));
assert(reminderSource.includes("'admin-test'"), "the protected reminder endpoint should support administrator-only test delivery");
assert(reminderSource.includes('item.role === "admin"'), "test delivery must exclude production subscriptions");
assert(reminderSource.includes(").slice(0, 1);"), "administrator tests should target only the most recently registered device");
assert(reminderSource.includes('kind: "admin-test"'), "test notifications should use a separate non-production kind");
assert.strictEqual(kstMorning.dateKey, "2026-08-31", "00:00 UTC should be 09:00 KST on the same date");
assert.strictEqual(kstMorning.weekday, "Mon", "2026-08-31 should be Monday in Korea");

const waitingOrders = [{ id: "ready-1", status: "ready", workerName: "" }];
assert.strictEqual(
  shouldSendMorningReminder({ orders: waitingOrders, activities: [], workerName: "김생산", dateKey: "2026-08-31" }),
  true,
  "a production worker with no start record should receive the morning reminder when work is waiting"
);

const adminPendingOrders = getAdminPendingOrders({
  orders: [
    { id: "unassigned-ready", status: "ready", workerName: "" },
    { id: "assigned-not-started", status: "paused", workerName: "이생산", workerUserId: "user-2" },
    { id: "assigned-active", status: "ready", workerName: "김생산", workerUserId: "user-1" },
    { id: "active-work", status: "working", workerName: "김생산", workerUserId: "user-1" }
  ],
  activities: [],
  dateKey: "2026-08-31"
});
assert.deepStrictEqual(
  adminPendingOrders.map((order) => order.id),
  ["unassigned-ready", "assigned-not-started"],
  "administrator morning reminders should report unstarted work across production without duplicating active workers"
);

assert.strictEqual(
  shouldSendMorningReminder({
    orders: [{ id: "assigned-other", status: "ready", workerName: "이생산", workerUserId: "user-2" }],
    activities: [],
    workerName: "김생산",
    userId: "user-1",
    dateKey: "2026-08-31"
  }),
  false,
  "work assigned to another production account should not trigger the morning reminder"
);

const startedActivities = [{
  type: "start",
  workerName: "김 생산",
  timestamp: "2026-08-31T00:03:00.000Z"
}];
assert.strictEqual(
  shouldSendMorningReminder({ orders: waitingOrders, activities: startedActivities, workerName: "김생산", dateKey: "2026-08-31" }),
  false,
  "a start activity recorded today should suppress the morning reminder"
);

const activeOrders = [
  { id: "working-1", status: "working", workerName: "김생산" },
  { id: "break-1", status: "break", workerName: "김 생산" },
  { id: "paused-1", status: "paused", workerName: "김생산" },
  { id: "other-1", status: "working", workerName: "이생산" }
];
assert.deepStrictEqual(
  getUserActiveOrders(activeOrders, "김생산", "user-1").map((order) => order.id),
  ["working-1", "break-1"],
  "evening reminders should include working and temporary breaks but exclude work-stopped jobs"
);

const idLinkedOrder = [{ id: "id-linked", status: "working", workerName: "이전이름", workerUserId: "user-1" }];
assert.deepStrictEqual(
  getUserActiveOrders(idLinkedOrder, "새이름", "user-1").map((order) => order.id),
  ["id-linked"],
  "authenticated user ID should remain authoritative after a display-name change"
);
assert.strictEqual(
  shouldSendMorningReminder({ orders: [...waitingOrders, ...activeOrders], activities: [], workerName: "김생산", dateKey: "2026-08-31" }),
  false,
  "an already active job should suppress the morning start reminder"
);

console.log("push reminder server test passed");
