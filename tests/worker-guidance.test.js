const assert = require("assert");
const fs = require("fs");
const path = require("path");

const root = path.resolve(__dirname, "..");
const html = fs.readFileSync(path.join(root, "index.html"), "utf8");
const css = fs.readFileSync(path.join(root, "style.css"), "utf8");
const visibleText = html.replace(/<[^>]+>/g, "");

const stopGuide = "\uc791\uc5c5\uc911\uc9c0\ub294 \ud558\ub8e8 \uc791\uc5c5\ub7c9\uc744 \ub2e4 \ucc44\uc6b0\uc9c0 \ubabb\ud558\uace0 \ub2e4\uc74c\ub0a0\ub85c \ub118\uae38 \ub54c";
const pauseGuide = "\uc77c\uc2dc\uc815\uc9c0\ub294 \uc26c\ub294\uc2dc\uac04, \uc810\uc2ec\uc2dc\uac04, \uc7a0\uc2dc \uc790\ub9ac\ub97c \ube44\uc6b8 \ub54c";
const quantityGuide = "\uc791\uc5c5\uc218\ub7c9\uc740 \uc791\uc5c5\ud0c0\uc218\uc640 \uce90\ube57\uc218\ub97c \ubc18\uc601\ud55c \uc218\ub7c9";
const hitGuide = "\uc791\uc5c5\ud0c0\uc218\ub294 \ud0c0\ubc1c\uc218\uc785\ub2c8\ub2e4";

assert(
  html.includes("workerHelpGuide") &&
    visibleText.includes(stopGuide) &&
    visibleText.includes(pauseGuide),
  "Worker page should explain when to use work stop and temporary pause."
);

assert(
  html.includes("workerQuantityGuide") &&
    visibleText.includes(quantityGuide) &&
    visibleText.includes(hitGuide),
  "Worker page should explain work quantity and hit count in plain language."
);

assert(
  css.includes(".worker-help-guide") &&
    css.includes(".worker-guide-card") &&
    css.includes(".worker-guide-example"),
  "Worker guidance should have dedicated styling for readable helper cards."
);

console.log("worker guidance test passed");
