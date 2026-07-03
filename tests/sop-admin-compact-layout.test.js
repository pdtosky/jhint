const fs = require("fs");
const path = require("path");
const assert = require("assert");

const root = path.resolve(__dirname, "..");
const css = fs.readFileSync(path.join(root, "sop", "styles.css"), "utf8");

assert(
  css.includes("#adminView .panel") && css.includes("padding: 10px 12px"),
  "SOP admin panels should use reduced padding so document sections take less vertical space."
);

assert(
  css.includes("#adminView .form-table th") &&
    css.includes("#adminView .form-table td") &&
    css.includes("height: 36px") &&
    css.includes("padding: 5px 7px"),
  "SOP admin form table rows should be compact enough to show more fields on screen."
);

assert(
  css.includes("#adminView input") &&
    css.includes("#adminView select") &&
    css.includes("#adminView textarea") &&
    css.includes("min-height: 34px"),
  "SOP admin input controls should use compact heights."
);

assert(
  css.includes("#adminView .actions") &&
    css.includes("#adminView .management-no-field button") &&
    css.includes("min-height: 34px"),
  "SOP admin action and auto-number buttons should match the compact input sizing."
);

assert(
  /#adminView\s+\.management-no-field\s*\{[^}]*grid-template-columns:\s*minmax\(0,\s*1fr\)/s.test(css) &&
    /#adminView\s+\.management-no-field\s+button\s*\{[^}]*width:\s*100%/s.test(css),
  "SOP admin management-number field should stack safely inside its own table cell without overlapping the Rev column."
);

console.log("sop admin compact layout test passed");
