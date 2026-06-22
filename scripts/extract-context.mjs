#!/usr/bin/env node

import fs from "node:fs";
import path from "node:path";
import Parser from "tree-sitter";
import TypeScript from "tree-sitter-typescript";
import HTML from "tree-sitter-html";
import CSS from "tree-sitter-css";

const ROOT = process.cwd();
const SRC_DIRS = ["assets", "api", "core"].map((dir) => path.join(ROOT, dir));

const parser = new Parser();

const exts = {
  ".ts": TypeScript.typescript,
  ".tsx": TypeScript.tsx,
  ".html": HTML,
  ".css": CSS,
};

function walk(dir, files = []) {
  if (!fs.existsSync(dir)) return files;

  for (const entry of fs.readdirSync(dir, { withFileTypes: true })) {
    if (
      entry.name === "node_modules" ||
      entry.name === "dist" ||
      entry.name === ".git"
    ) {
      continue;
    }

    const fullPath = path.join(dir, entry.name);

    if (entry.isDirectory()) {
      walk(fullPath, files);
    } else if (exts[path.extname(entry.name)]) {
      files.push(fullPath);
    }
  }

  return files;
}

function rel(file) {
  return path.relative(ROOT, file);
}

function parse(file) {
  const source = fs.readFileSync(file, "utf8");
  const lang = exts[path.extname(file)];

  parser.setLanguage(lang);

  return {
    file,
    source,
    tree: parser.parse(source, undefined, { bufferSize: source.length * 2 }),
  };
}

function text(source, node) {
  return source.slice(node.startIndex, node.endIndex);
}

function extractTS(ctx) {
  const { source, tree } = ctx;
  const symbols = [];

  function visit(node) {
    const kind = node.type;

    if (
      kind === "class_declaration" ||
      kind === "interface_declaration" ||
      kind === "type_alias_declaration" ||
      kind === "function_declaration" ||
      kind === "enum_declaration"
    ) {
      const nameNode = node.childForFieldName("name");

      if (nameNode) {
        symbols.push({
          kind,
          name: text(source, nameNode),
          line: node.startPosition.row + 1,
        });
      }
    }

    // Angular-style @Component metadata
    if (kind === "decorator") {
      const raw = text(source, node);
      if (raw.includes("@Component")) {
        const selector = raw.match(/selector\s*:\s*['"`]([^'"`]+)['"`]/)?.[1];
        const templateUrl = raw.match(/templateUrl\s*:\s*['"`]([^'"`]+)['"`]/)?.[1];
        const styleUrls = [...raw.matchAll(/['"`]([^'"`]+\.css)['"`]/g)].map(
          (m) => m[1]
        );

        symbols.push({
          kind: "angular_component",
          name: selector ?? "unknown-selector",
          templateUrl,
          styleUrls,
          line: node.startPosition.row + 1,
        });
      }
    }

    for (const child of node.children) visit(child);
  }

  visit(tree.rootNode);
  return symbols;
}

function extractHTML(ctx) {
  const { source } = ctx;

  const classes = new Set();
  const ids = new Set();
  const bindings = new Set();

  for (const match of source.matchAll(/class\s*=\s*["']([^"']+)["']/g)) {
    match[1].split(/\s+/).forEach((c) => c && classes.add(c));
  }

  for (const match of source.matchAll(/id\s*=\s*["']([^"']+)["']/g)) {
    ids.add(match[1]);
  }

  for (const match of source.matchAll(/(\*ngIf|\*ngFor|\[[^\]]+\]|\([^)]+\))/g)) {
    bindings.add(match[1]);
  }

  return {
    classes: [...classes],
    ids: [...ids],
    bindings: [...bindings],
  };
}

function extractCSS(ctx) {
  const { source } = ctx;

  const selectors = new Set();

  for (const match of source.matchAll(/([.#][a-zA-Z0-9_-]+)\s*[{,]/g)) {
    selectors.add(match[1]);
  }

  return [...selectors];
}

function main() {
  const files = SRC_DIRS.flatMap((dir) => walk(dir));

  const ts = [];
  const html = [];
  const css = [];

  for (const file of files) {
    const ctx = parse(file);
    const ext = path.extname(file);

    if (ext === ".ts" || ext === ".tsx") {
      ts.push({
        file: rel(file),
        symbols: extractTS(ctx),
      });
    }

    if (ext === ".html") {
      html.push({
        file: rel(file),
        ...extractHTML(ctx),
      });
    }

    if (ext === ".css") {
      css.push({
        file: rel(file),
        selectors: extractCSS(ctx),
      });
    }
  }

  console.log("# Copilot Context\n");

  console.log("## TypeScript Symbols\n");
  for (const item of ts) {
    if (!item.symbols.length) continue;

    console.log(`### ${item.file}`);
    for (const s of item.symbols) {
      if (s.kind === "angular_component") {
        console.log(
          `- component: ${s.name} line ${s.line}` +
            (s.templateUrl ? ` template=${s.templateUrl}` : "") +
            (s.styleUrls?.length ? ` styles=${s.styleUrls.join(",")}` : "")
        );
      } else {
        console.log(`- ${s.kind}: ${s.name} line ${s.line}`);
      }
    }
    console.log("");
  }

  console.log("## HTML Templates\n");
  for (const item of html) {
    console.log(`### ${item.file}`);
    if (item.classes.length) console.log(`- classes: ${item.classes.join(", ")}`);
    if (item.ids.length) console.log(`- ids: ${item.ids.join(", ")}`);
    if (item.bindings.length) console.log(`- bindings: ${item.bindings.join(", ")}`);
    console.log("");
  }

  console.log("## CSS Selectors\n");
  for (const item of css) {
    if (!item.selectors.length) continue;

    console.log(`### ${item.file}`);
    console.log(`- selectors: ${item.selectors.join(", ")}`);
    console.log("");
  }
}

main();
