#!/usr/bin/env node
/*: skip */
import parser from "@babel/parser";
import traverseModule from "@babel/traverse";
import * as t from "@babel/types";
import chalk from "chalk";
import { program } from "commander";
import fs from "fs";
import path from "path";

const traverse = traverseModule.default;

const pkgPath = path.resolve(
  path.dirname(new URL(import.meta.url).pathname),
  "package.json"
);

const pkg = JSON.parse(fs.readFileSync(pkgPath, "utf8"));

// CLI setup
program
  .version(pkg.version)
  .description(pkg.description)
  .argument("<file>", "JavaScript file or directory to check")
  .option("-v, --verbose", "Show detailed type information")
  .option("-i, --infer", "Enable type inference when JSDoc not present")
  .action((file, options) => {
    traverseDirectory(file, options);
  });

program.parse(process.argv);

// Traverse directory and process JS files
function traverseDirectory(directory, options) {
  let totalTypeChecks = 0;
  let totalFiles = 0;
  const startTime = Date.now();
  const results = [];

  // single-file support
  try {
    const stats = fs.statSync(directory);
    if (stats.isFile()) {
      const { typeChecksPerformed, skipped } = checkFile(directory, options);
      if (!skipped) totalTypeChecks += typeChecksPerformed;
      totalFiles = 1;
      const timeTaken = ((Date.now() - startTime) / 1000).toFixed(2);
      console.log(
        chalk.green(
          `Success! ${totalTypeChecks} type checks, ${totalFiles} file, ${timeTaken}s`
        )
      );
      return;
    }
  } catch (err) {
    console.log(chalk.red(`Error accessing path: ${directory}`));
    process.exit(1);
  }

  function traverseDir(current) {
    fs.readdirSync(current).forEach((file) => {
      const fullPath = path.join(current, file);
      const stats = fs.statSync(fullPath);

      if (path.basename(fullPath) === "node_modules") return;

      if (stats.isDirectory()) {
        traverseDir(fullPath);
      } else if (stats.isFile() && file.endsWith(".js")) {
        const { typeChecksPerformed, skipped } = checkFile(fullPath, options);
        if (!skipped) {
          results.push({ file: fullPath, typeChecks: typeChecksPerformed });
          totalTypeChecks += typeChecksPerformed;
        }
        totalFiles++;
      }
    });
  }

  traverseDir(directory);
  const endTime = Date.now();
  console.log(
    chalk.green(
      `Success! ${totalTypeChecks} type checks, ${totalFiles} files, ${
        (endTime - startTime) / 1000
      }s`
    )
  );
}

// Check types in a single file
function checkFile(filename, options = {}) {
  if (!fs.existsSync(filename)) {
    console.log(chalk.red(`Error: File "${filename}" not found.`));
    return { typeChecksPerformed: 0, skipped: false };
  }

  const code = fs.readFileSync(filename, "utf8");
  const ast = parser.parse(code, {
    sourceType: "module",
    plugins: ["jsx"],
    attachComments: true,
  });
  const allComments = ast.comments || [];

  if (hasSkipComment(allComments)) {
    console.log(chalk.yellow(`Skipping ${filename} due to skip comment.`));
    return { typeChecksPerformed: 0, skipped: true };
  }

  const skipLoc = getSkipRemainingLocation(code);
  let typeErrors = 0;
  let typeChecksPerformed = 0;
  const variableMap = new Map();

  // Single pass: collect declarations and infer types immediately
  traverse(ast, {
    VariableDeclaration(path) {
      if (skipLoc && path.node.loc.start.line > skipLoc) return;
      path.node.declarations.forEach((decl) => {
        if (!decl.init) return;
        const varName = decl.id.name;
        const typeAnnotation = findJSDocTypeAnnotation(decl, allComments);
        const { expectedType, isComplex } = typeAnnotation
          ? parseTypeAnnotation(typeAnnotation)
          : { expectedType: null, isComplex: false };

        // Infer actual type, resolving identifiers via variableMap
        let actualType;
        if (t.isIdentifier(decl.init)) {
          const entry = variableMap.get(decl.init.name);
          actualType = entry ? entry.actualType : "reference";
        } else {
          actualType = inferType(decl.init, isComplex, expectedType);
        }

        if (options.infer || typeAnnotation) {
          const recordedType = expectedType || actualType;
          variableMap.set(varName, {
            type: recordedType,
            actualType,
            isComplex,
          });
        }

        // If annotated, perform check
        if (typeAnnotation) {
          typeChecksPerformed++;
          if (
            !isComplexTypeMatch(
              expectedType.toLowerCase(),
              actualType,
              decl.init,
              isComplex
            )
          ) {
            const locStr = getLocationInfo(filename, decl);
            console.log(chalk.red(`❌ Type mismatch at ${locStr}:`));
            console.log(
              `  Variable: ${varName}\n  Expected: ${expectedType.toLowerCase()}, Found: ${actualType}\n`
            );
            typeErrors++;
          }
        }
      });
    },
    AssignmentExpression(path) {
      if (skipLoc && path.node.loc.start.line > skipLoc) return;
      if (!t.isIdentifier(path.node.left)) return;
      const varName = path.node.left.name;
      if (!variableMap.has(varName)) return;

      typeChecksPerformed++;
      const info = variableMap.get(varName);
      const expectedType = info.type;
      let actualType;
      if (t.isIdentifier(path.node.right)) {
        const entry = variableMap.get(path.node.right.name);
        actualType = entry ? entry.actualType : "reference";
      } else {
        actualType = inferType(path.node.right, false, expectedType);
      }

      if (expectedType !== actualType) {
        const locStr = getLocationInfo(filename, path.node);
        console.log(chalk.red(`❌ Type mismatch at ${locStr}:`));
        console.log(
          `  Assignment to: ${varName}\n  Expected: ${expectedType}, Found: ${actualType}\n`
        );
        typeErrors++;
      } else {
        // update map
        variableMap.set(varName, { ...info, actualType });
      }
    },
  });

  if (typeErrors > 0) {
    console.log(chalk.red(`Found ${typeErrors} type error(s) in ${filename}`));
    process.exit(1);
  } else {
    console.log(
      chalk.green(
        `Checked ${filename} successfully! (${typeChecksPerformed} type checks performed)`
      )
    );
    if (skipLoc)
      console.log(
        chalk.yellow(`Note: Partially checked due to skip-remaining comment.`)
      );
  }

  return { typeChecksPerformed, skipped: false };
}

// Detect skip directive
function hasSkipComment(comments) {
  return comments.some((c) => c.value.trim() === ": skip");
}

// Find skip-remaining location
function getSkipRemainingLocation(code) {
  const lines = code.split("\n");
  for (let i = 0; i < lines.length; i++) {
    if (lines[i].includes("/*: skip-remaining */")) return i + 1;
  }
  return null;
}

// Locate JSDoc @type just above the declaration
function findJSDocTypeAnnotation(node, allComments) {
  const leading = node.leadingComments || [];
  const lineStart = node.loc.start.line;
  const preceding = allComments.filter(
    (c) =>
      c.type === "CommentBlock" &&
      c.loc.end.line === lineStart - 1 &&
      c.value.trim().startsWith("*")
  );
  const candidates = [...leading, ...preceding];
  for (const c of candidates) {
    const match = c.value.match(/@type\s*{\s*([\w\[\]<>|&]+)\s*}/);
    if (match) return match[1];
  }
  return null;
}

// Parse type annotation
function parseTypeAnnotation(typeAnnotation) {
  return {
    expectedType: typeAnnotation.toLowerCase(),
    isComplex: /[\[\]<>|&]/.test(typeAnnotation),
  };
}

// Infer actual type
function inferType(node, isComplex, expectedType) {
  if (t.isStringLiteral(node)) return "string";
  if (t.isNumericLiteral(node)) return "number";
  if (t.isBooleanLiteral(node)) return "boolean";
  if (t.isNullLiteral(node)) return "null";
  if (t.isObjectExpression(node)) return "object";
  if (t.isArrayExpression(node))
    return isComplex ? checkArrayType(node, expectedType) : "array";
  if (t.isFunctionExpression(node) || t.isArrowFunctionExpression(node))
    return "function";
  if (t.isIdentifier(node)) return "reference";
  if (t.isUnaryExpression(node) && node.operator === "void") return "undefined";
  return "unknown";
}

// Match complex types
function isComplexTypeMatch(expectedType, actualType, node, isComplex) {
  if (!isComplex) return expectedType === actualType;
  if (expectedType.endsWith("[]")) {
    if (actualType !== "array") return false;
    if (!node.elements || node.elements.length === 0) return true;
    const first = node.elements[0];
    const elemType = t.isStringLiteral(first)
      ? "string"
      : t.isNumericLiteral(first)
      ? "number"
      : t.isBooleanLiteral(first)
      ? "boolean"
      : "unknown";
    return expectedType.slice(0, -2) === elemType;
  }
  if (expectedType.includes("|")) {
    return expectedType.split("|").includes(actualType);
  }
  return false;
}

// Return expected array type
function checkArrayType(node, expectedType) {
  return expectedType;
}

// Format location string
function getLocationInfo(filename, node) {
  const rel = path.relative(process.cwd(), filename);
  return `${rel}:${node.loc.start.line}:${node.loc.start.column + 1}`;
}
