const fs = require("fs");
const path = require("path");
const assert = require("assert");

const root = path.resolve(__dirname, "..");
const app = fs.readFileSync(path.join(root, "sop", "app.js"), "utf8");
const css = fs.readFileSync(path.join(root, "sop", "styles.css"), "utf8");

assert(
  app.includes("worker-checklist-cards"),
  "SOP worker checklist should render compact checklist cards instead of a wide table."
);

assert(
  app.includes("worker-checklist-card") && app.includes("data-checklist-no"),
  "Each checklist card should carry row metadata so save logic does not depend on table columns."
);

assert(
  !app.includes('querySelectorAll(".worker-checklist-form tbody tr")'),
  "Worker checklist save logic should not read mobile checklist data from table rows."
);

assert(
  css.includes(".worker-checklist-cards") &&
    css.includes(".worker-check-status-row") &&
    css.includes("grid-template-columns: repeat(3, minmax(0, 1fr))"),
  "SOP stylesheet should include compact card and three-check horizontal row styles."
);
