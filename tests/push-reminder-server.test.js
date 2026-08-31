const assert = require("assert");
const reminderHandler = require("../api/push-reminders");

const {
  getKstDateParts,
  getUserActiveOrders,
  shouldSendMorningReminder
} = reminderHandler._test;

const kstMorning = getKstDateParts(new Date("2026-08-31T00:00:00.000Z"));
assert.strictEqual(kstMorning.dateKey, "2026-08-31", "00:00 UTC should be 09:00 KST on the same date");
assert.strictEqual(kstMorning.weekday, "Mon", "2026-08-31 should be Monday in Korea");

const waitingOrders = [{ id: "ready-1", status: "ready", workerName: "" }];
assert.strictEqual(
  shouldSendMorningReminder({ orders: waitingOrders, activities: [], workerName: "김생산", dateKey: "2026-08-31" }),
  true,
  "a production worker with no start record should receive the morning reminder when work is waiting"
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
