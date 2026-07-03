const assert = require("node:assert/strict");
const fs = require("node:fs");
const vm = require("node:vm");

function extractFunction(source, functionName) {
  const marker = `function ${functionName}`;
  const start = source.indexOf(marker);
  if (start < 0) {
    throw new Error(`${functionName} was not found in app.js`);
  }

  const parameterEnd = source.indexOf(")", start);
  const braceStart = source.indexOf("{", parameterEnd);
  let depth = 0;
  for (let index = braceStart; index < source.length; index += 1) {
    if (source[index] === "{") depth += 1;
    if (source[index] === "}") depth -= 1;
    if (depth === 0) {
      return source.slice(start, index + 1);
    }
  }

  throw new Error(`${functionName} could not be extracted`);
}

const source = fs.readFileSync("app.js", "utf8");
const styleCss = fs.readFileSync("style.css", "utf8");
const packageJson = fs.readFileSync("package.json", "utf8");

const context = {};
vm.runInNewContext(
  `${extractFunction(source, "getRequisitionPrintFit")}\nresult = getRequisitionPrintFit;`,
  context
);

const getRequisitionPrintFit = context.result;

const normalFit = getRequisitionPrintFit({ items: [{ name: "A" }], note: "short" });
assert.equal(normalFit.className, "print-density-normal");
assert.equal(normalFit.scale, "1");

const compactFit = getRequisitionPrintFit({
  items: Array.from({ length: 10 }, (_, index) => ({ name: `item-${index}` })),
  note: "short"
});
assert.equal(compactFit.className, "print-density-compact");
assert.equal(compactFit.scale, "0.78");

const denseFit = getRequisitionPrintFit({
  items: Array.from({ length: 16 }, (_, index) => ({ name: `item-${index}` })),
  note: "긴 특이사항 ".repeat(30)
});
assert.equal(denseFit.className, "print-density-dense");
assert.equal(denseFit.scale, "0.62");

assert(source.includes("${escapeHtml(printFit.className)}"), "print document should include the computed density class");
assert(source.includes("--print-scale: ${escapeHtml(printFit.scale)}"), "print document should set a computed scale variable");
assert(styleCss.includes("transform: scale(var(--print-scale, 1));"), "print CSS should shrink the document by scale");
assert(styleCss.includes(".print-density-compact"), "print CSS should include compact density rules");
assert(styleCss.includes(".print-density-dense"), "print CSS should include dense density rules");
assert(
  packageJson.includes("tests/requisition-print-scale.test.js"),
  "npm test should include requisition print scaling regression test"
);

console.log("requisition print scale test passed");
