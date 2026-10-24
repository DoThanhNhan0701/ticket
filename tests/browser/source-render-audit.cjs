// Static inventory, not a claim that hook counts alone demonstrate wasted renders.
const fs = require("node:fs");
const path = require("node:path");
const { parse } = require("@babel/parser");
const root = path.resolve(
  process.argv[2] || "test-results/role-audit-20261024",
);
fs.mkdirSync(root, { recursive: true });
const files = [];
function scan(directory) {
  for (const item of fs.readdirSync(directory, { withFileTypes: true })) {
    const file = path.join(directory, item.name);
    if (item.isDirectory()) scan(file);
    else if (/\.(ts|tsx)$/.test(file) && !file.endsWith(".d.ts"))
      files.push(file);
  }
}
scan("src");
const inventory = files.map((file) => {
  const source = fs.readFileSync(file, "utf8");
  const ast = parse(source, {
    sourceType: "module",
    plugins: ["typescript", "jsx"],
  });
  const hooks = [];
  function visit(node) {
    if (!node || typeof node !== "object") return;
    if (node.type === "CallExpression") {
      const name = node.callee.name || node.callee.property?.name;
      if (
        /^(use[A-Z]|watch$|memo$|createContext$|setInterval$)/.test(name || "")
      )
        hooks.push({
          name,
          line: node.loc.start.line,
          ...(name === "useEffect"
            ? { dependencies: node.arguments[1]?.type || "absent" }
            : {}),
        });
    }
    for (const [key, child] of Object.entries(node)) {
      if (["loc", "start", "end", "comments", "tokens"].includes(key)) continue;
      if (Array.isArray(child)) child.forEach(visit);
      else if (child && typeof child === "object") visit(child);
    }
  }
  visit(ast);
  return {
    file: file.replaceAll("\\", "/"),
    lines: source.split("\n").length,
    hooks,
  };
});
const report = {
  sourceFiles: inventory.length,
  sourceLines: inventory.reduce((n, f) => n + f.lines, 0),
  method:
    "Parse every src TS/TSX file and inventory reactive subscriptions. Manually review hotspots and validate suspected waste with component measurements; hook counts are not defects.",
  inventory,
};
fs.writeFileSync(
  path.join(root, "source-render-inventory.json"),
  JSON.stringify(report, null, 2),
);
console.log(
  JSON.stringify({
    sourceFiles: report.sourceFiles,
    sourceLines: report.sourceLines,
  }),
);
