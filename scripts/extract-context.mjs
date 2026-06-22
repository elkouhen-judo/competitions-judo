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

function flatten(str) {
  return str.replace(/\s+/g, " ").trim();
}

function truncate(str, max = 120) {
  return str.length > max ? `${str.slice(0, max)}…` : str;
}

function exportPrefix(node) {
  const parent = node.parent;
  if (parent && parent.type === "export_statement") {
    const isDefault = parent.children.some((c) => c.type === "default");
    return isDefault ? "export default " : "export ";
  }
  return "";
}

function extractImports(tree, source) {
  const imports = [];

  for (const node of tree.rootNode.children) {
    if (node.type !== "import_statement") continue;

    const sourceNode = node.childForFieldName("source");
    const isTypeOnly = node.children.some((c) => c.type === "type");
    const clause = node.children.find((c) => c.type === "import_clause");
    const names = [];

    if (clause) {
      for (const c of clause.children) {
        if (c.type === "named_imports") {
          for (const spec of c.children) {
            if (spec.type === "import_specifier") names.push(text(source, spec));
          }
        } else if (c.type === "identifier") {
          names.push(`default as ${text(source, c)}`);
        } else if (c.type === "namespace_import") {
          names.push(text(source, c));
        }
      }
    }

    imports.push({
      source: sourceNode ? text(source, sourceNode).slice(1, -1) : "",
      names,
      typeOnly: isTypeOnly,
      line: node.startPosition.row + 1,
    });
  }

  return imports;
}

function extractMembers(source, bodyNode) {
  if (!bodyNode) return [];

  const members = [];
  for (const child of bodyNode.children) {
    if (child.type === "property_signature" || child.type === "method_signature") {
      members.push(truncate(flatten(text(source, child)), 140));
    }
  }
  return members;
}

function collectCalls(source, bodyNode) {
  if (!bodyNode) return [];

  const calls = new Set();
  function walk(node) {
    if (node.type === "call_expression") {
      const fn = node.childForFieldName("function");
      if (fn) calls.add(flatten(text(source, fn)));
    }
    for (const child of node.children) walk(child);
  }
  walk(bodyNode);
  return [...calls].sort();
}

function formatFunctionSignature(source, node) {
  const params = node.childForFieldName("parameters");
  const returnType = node.childForFieldName("return_type");
  const paramsText = params ? flatten(text(source, params)) : "()";
  const returnText = returnType ? flatten(text(source, returnType)) : "";
  return truncate(`${paramsText}${returnText}`, 160);
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
        const entry = {
          kind,
          name: text(source, nameNode),
          line: node.startPosition.row + 1,
          exportPrefix: exportPrefix(node),
        };

        if (kind === "function_declaration") {
          entry.signature = formatFunctionSignature(source, node);
          entry.calls = collectCalls(source, node.childForFieldName("body"));
        }

        if (kind === "interface_declaration") {
          entry.members = extractMembers(source, node.childForFieldName("body"));
        }

        if (kind === "type_alias_declaration") {
          const value = node.childForFieldName("value");
          if (value && value.type === "object_type") {
            entry.members = extractMembers(source, value);
          } else if (value) {
            entry.aliasOf = truncate(flatten(text(source, value)), 140);
          }
        }

        symbols.push(entry);
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
  return {
    imports: extractImports(tree, source),
    symbols,
  };
}

function extractHTML(ctx) {
  const { source } = ctx;

  const classes = new Set();
  const ids = new Set();
  const events = new Set();
  const directives = new Set();
  const boundAttrs = new Set();
  const interpolations = new Set();

  for (const match of source.matchAll(/(?<!:)\bclass\s*=\s*["']([^"']+)["']/g)) {
    match[1].split(/\s+/).forEach((c) => c && classes.add(c));
  }

  for (const match of source.matchAll(/\bid\s*=\s*["']([^"']+)["']/g)) {
    ids.add(match[1]);
  }

  for (const match of source.matchAll(/@([a-zA-Z.]+)\s*=\s*"([^"]*)"/g)) {
    events.add(`${match[1]} → ${flatten(match[2])}`);
  }

  for (const match of source.matchAll(/\bv-(if|else-if|show|model|for)\s*=\s*"([^"]*)"/g)) {
    directives.add(`v-${match[1]} → ${flatten(match[2])}`);
  }

  for (const match of source.matchAll(/[\s"]:([a-zA-Z-]+)="([^"]*)"/g)) {
    boundAttrs.add(`:${match[1]} → ${flatten(match[2])}`);
  }

  for (const match of source.matchAll(/\{\{([^}]*)\}\}/g)) {
    interpolations.add(flatten(match[1]));
  }

  return {
    classes: [...classes],
    ids: [...ids],
    events: [...events],
    directives: [...directives],
    boundAttrs: [...boundAttrs],
    interpolations: [...interpolations],
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

function resolveLocalImport(fromFile, importSource) {
  if (!importSource.startsWith(".")) return null;

  const baseDir = path.dirname(path.join(ROOT, fromFile));
  const resolved = path.resolve(baseDir, importSource);
  const candidates = [
    resolved,
    `${resolved}.ts`,
    `${resolved}.tsx`,
    path.join(resolved, "index.ts"),
    path.join(resolved, "index.tsx"),
  ];

  for (const candidate of candidates) {
    if (fs.existsSync(candidate) && fs.statSync(candidate).isFile()) {
      return rel(candidate);
    }
  }
  return null;
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
        ...extractTS(ctx),
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
    if (!item.symbols.length && !item.imports.length) continue;

    console.log(`### ${item.file}`);

    if (item.imports.length) {
      console.log("- imports:");
      for (const imp of item.imports) {
        const prefix = imp.typeOnly ? "type " : "";
        const names = imp.names.length ? imp.names.join(", ") : "(side-effect)";
        console.log(`  - ${prefix}${names} from "${imp.source}"`);
      }
    }

    for (const s of item.symbols) {
      if (s.kind === "angular_component") {
        console.log(
          `- component: ${s.name} line ${s.line}` +
            (s.templateUrl ? ` template=${s.templateUrl}` : "") +
            (s.styleUrls?.length ? ` styles=${s.styleUrls.join(",")}` : "")
        );
        continue;
      }

      let line = `- ${s.exportPrefix}${s.kind}: ${s.name} line ${s.line}`;
      if (s.signature !== undefined) line += ` ${s.signature}`;
      console.log(line);

      if (s.calls?.length) {
        console.log(`  - calls: ${truncate(s.calls.join(", "), 220)}`);
      }
      if (s.members?.length) {
        for (const member of s.members) console.log(`  - ${member}`);
      }
      if (s.aliasOf) {
        console.log(`  - = ${s.aliasOf}`);
      }
    }
    console.log("");
  }

  console.log("## HTML Templates\n");
  for (const item of html) {
    console.log(`### ${item.file}`);
    if (item.classes.length) console.log(`- classes: ${item.classes.join(", ")}`);
    if (item.ids.length) console.log(`- ids: ${item.ids.join(", ")}`);
    if (item.events.length) console.log(`- events: ${item.events.join(", ")}`);
    if (item.directives.length) console.log(`- directives: ${item.directives.join(", ")}`);
    if (item.boundAttrs.length) console.log(`- bound attrs: ${item.boundAttrs.join(", ")}`);
    if (item.interpolations.length)
      console.log(`- interpolations: ${item.interpolations.join(", ")}`);
    console.log("");
  }

  console.log("## CSS Selectors\n");
  for (const item of css) {
    if (!item.selectors.length) continue;

    console.log(`### ${item.file}`);
    console.log(`- selectors: ${item.selectors.join(", ")}`);
    console.log("");
  }

  console.log("## Reverse Dependencies (files that import this file)\n");
  const reverseDeps = new Map();
  for (const item of ts) {
    for (const imp of item.imports) {
      const target = resolveLocalImport(item.file, imp.source);
      if (!target) continue;
      if (!reverseDeps.has(target)) reverseDeps.set(target, new Set());
      reverseDeps.get(target).add(item.file);
    }
  }
  for (const [file, importers] of [...reverseDeps.entries()].sort(([a], [b]) =>
    a.localeCompare(b)
  )) {
    console.log(`### ${file}`);
    console.log(`- imported by: ${[...importers].sort().join(", ")}`);
    console.log("");
  }
}

main();
