import { readdir, readFile } from "node:fs/promises";
import path from "node:path";
import { fileURLToPath } from "node:url";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const projectRoot = path.resolve(__dirname, "..");

const excludedDirectories = new Set([
  ".git",
  "_asset-cache",
  "dist",
  "node_modules"
]);

const sourceExtensions = new Set([".js", ".html"]);
const nativeDialogPattern = /(?<![.\w$])(?:alert|confirm|prompt)\s*\(|window\.(?:alert|confirm|prompt)\s*\(/g;

function assert(condition, message) {
  if (!condition) {
    throw new Error(message);
  }
}

function relative(filePath) {
  return path.relative(projectRoot, filePath).replace(/\\/g, "/");
}

async function collectFiles(directory) {
  const entries = await readdir(directory, { withFileTypes: true });
  const files = [];

  for (const entry of entries) {
    const fullPath = path.join(directory, entry.name);

    if (entry.isDirectory()) {
      if (excludedDirectories.has(entry.name)) {
        continue;
      }

      files.push(...await collectFiles(fullPath));
      continue;
    }

    if (sourceExtensions.has(path.extname(entry.name).toLowerCase())) {
      files.push(fullPath);
    }
  }

  return files;
}

function findNativeDialogCalls(filePath, contents) {
  if (relative(filePath) === "site-shell.js") {
    return [];
  }

  const findings = [];
  const lines = contents.split(/\r?\n/);

  lines.forEach((line, index) => {
    nativeDialogPattern.lastIndex = 0;
    if (nativeDialogPattern.test(line)) {
      findings.push(`${relative(filePath)}:${index + 1}: ${line.trim()}`);
    }
  });

  return findings;
}

async function main() {
  const files = await collectFiles(projectRoot);
  const sourceByPath = new Map();

  for (const file of files) {
    sourceByPath.set(file, await readFile(file, "utf8"));
  }

  const nativeDialogs = [];
  for (const [file, contents] of sourceByPath.entries()) {
    nativeDialogs.push(...findNativeDialogCalls(file, contents));
  }

  assert(
    nativeDialogs.length === 0,
    `Native browser dialogs are still present:\n${nativeDialogs.join("\n")}`
  );

  const siteShell = sourceByPath.get(path.join(projectRoot, "site-shell.js")) || "";
  const siteShellCss = await readFile(path.join(projectRoot, "site-shell.css"), "utf8");

  assert(siteShell.includes("window.AutoFixToast"), "Global AutoFixToast API is missing.");
  assert(siteShell.includes("window.AutoFixDialog"), "Global AutoFixDialog API is missing.");
  assert(siteShell.includes("window.alert ="), "Legacy alert fallback override is missing.");
  assert(siteShellCss.includes(".autofix-toast-root"), "Toast CSS root class is missing.");
  assert(siteShellCss.includes(".autofix-dialog"), "Dialog CSS class is missing.");

  console.log("Phase 10 smoke test passed.");
  console.log(`Checked ${files.length} source files.`);
  console.log("Native browser alerts are replaced with AutoFix toast/dialog UX.");
  console.log("Run npm run build for the full Vite syntax/bundle check.");
}

main().catch((error) => {
  console.error(`Phase 10 smoke test failed: ${error.message}`);
  process.exit(1);
});
