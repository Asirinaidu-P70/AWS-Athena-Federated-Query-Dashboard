const fs = require("node:fs");
const path = require("node:path");

const sourcePath = path.join(__dirname, "..", "frontend", "index.html");
const outputPath = path.join(__dirname, "..", "frontend", "dist", "index.html");

let html = fs.readFileSync(sourcePath, "utf8");
for (const [source, output] of [
  ['href="styles.css"', 'href="styles.min.css"'],
  ['src="app.js"', 'src="app.min.js"'],
]) {
  if (!html.includes(source)) {
    throw new Error(`Expected ${source} in ${sourcePath}`);
  }
  html = html.replace(source, output);
}

html = html.replace(/[ \t]+$/gm, "");
fs.writeFileSync(outputPath, html);
