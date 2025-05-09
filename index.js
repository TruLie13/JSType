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
const startTime = Date.now();

// Maps to hold JSDoc @returns and @param types for the current file
const functionReturnMap = new Map();
const functionParamMap = new Map();

// helper function
function formatElapsedTime(startTime) {
  return ((Date.now() - startTime) / 1000).toFixed(2);
}

// CLI setup
program
  .version(pkg.version)
  .description(pkg.description)
  .argument("<file>", "JavaScript file or directory to check")
  .option("-i, --infer", "Enable type inference when JSDoc not present")
  .option("-f, --full", "Enable full multi-file reporting with JSON error log")
  .action((file, options) => {
    traverseDirectory(file, options);
  });

program.parse(process.argv);

// Traverse directory and process JS files
function traverseDirectory(directory, options) {
  let totalTypeChecks = 0;
  let totalFiles = 0;
  let errorLog = [];

  // single-file support
  try {
    const stats = fs.statSync(directory);
    if (stats.isFile()) {
      const { typeChecksPerformed, skipped, errors } = checkFile(
        directory,
        options
      );
      if (!skipped) {
        totalTypeChecks += typeChecksPerformed;
        if (options.full && errors.length) {
          errorLog.push({ file: directory, errors });
        }
      }
      totalFiles = 1;
      const elapsedTime = formatElapsedTime(startTime);

      if (options.full) {
        writeFullReport(totalTypeChecks, totalFiles, errorLog);
      } else {
        console.log(
          chalk.green(
            `Success! ${totalTypeChecks} type checks, ${totalFiles} file, duration: ${elapsedTime}s`
          )
        );
      }
      return;
    }
  } catch (err) {
    console.log(chalk.red(`Error accessing path: ${directory}`));
    process.exit(1);
  }

  // directory support
  function traverseDir(current) {
    fs.readdirSync(current).forEach((file) => {
      const fullPath = path.join(current, file);
      const stats = fs.statSync(fullPath);

      if (stats.isDirectory()) {
        if (path.basename(fullPath) === "node_modules") return;
        traverseDir(fullPath);
      } else if (stats.isFile() && file.endsWith(".js")) {
        const { typeChecksPerformed, skipped, errors } = checkFile(
          fullPath,
          options
        );
        if (!skipped) {
          totalTypeChecks += typeChecksPerformed;
          if (options.full && errors.length) {
            errorLog.push({ file: fullPath, errors });
          }
        }
        totalFiles++;
      }
    });
  }

  traverseDir(directory);

  if (options.full) {
    writeFullReport(totalTypeChecks, totalFiles, errorLog);
  } else {
    const elapsedTime = formatElapsedTime(startTime);
    console.log(
      chalk.green(
        `Success! ${totalTypeChecks} type checks, ${totalFiles} files, duration: ${elapsedTime}s`
      )
    );
  }
}

// Generate full report
function writeFullReport(totalChecks, totalFiles, errorLog) {
  const totalErrors = errorLog.reduce((sum, f) => sum + f.errors.length, 0);
  const filesWithErrors = errorLog.length;
  const reportPath = path.resolve(process.cwd(), "jstype-errors.json");
  fs.writeFileSync(reportPath, JSON.stringify(errorLog, null, 2));
  const elapsedTime = formatElapsedTime(startTime);

  if (totalErrors > 0) {
    console.log(
      chalk.red(
        `Found ${totalErrors} type error(s) in ${filesWithErrors} files, duration: ${elapsedTime}s — see ${path.basename(
          reportPath
        )} for details`
      )
    );
    process.exit(1);
  } else {
    console.log(
      chalk.green(
        `Success! ${totalChecks} type checks, ${totalFiles} files, duration: ${elapsedTime}s - no errors found.`
      )
    );
  }
}

// Check types in a single file
function checkFile(filename, options = {}) {
  // reset maps for this file
  functionReturnMap.clear();
  functionParamMap.clear();

  if (!fs.existsSync(filename)) {
    console.log(chalk.red(`Error: File "${filename}" not found.`));
    return { typeChecksPerformed: 0, skipped: false, errors: [] };
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
    return { typeChecksPerformed: 0, skipped: true, errors: [] };
  }

  const skipLoc = getSkipRemainingLocation(code);
  let typeErrors = 0;
  let typeChecksPerformed = 0;
  const variableMap = new Map();
  const errors = [];

  // 1️⃣ Pre‑scan: collect @returns and @param on functions
  traverse(ast, {
    FunctionDeclaration(path) {
      const leading = path.node.leadingComments || [];
      // @returns
      for (const c of leading) {
        const m = c.value.match(/@returns?\s*{\s*([^}]+)\s*}/);
        if (m) {
          functionReturnMap.set(path.node.id.name, m[1].trim().toLowerCase());
          break;
        }
      }
      // @param
      const params = [];
      const regex = /@param\s*{\s*([^}]+)\s*}\s*(\w+)/g;
      for (const c of leading) {
        let m;
        while ((m = regex.exec(c.value))) {
          params.push({ name: m[2], type: m[1].trim().toLowerCase() });
        }
      }
      if (params.length) {
        functionParamMap.set(path.node.id.name, params);
      }
    },
    VariableDeclarator(path) {
      // also capture @param on function expressions/arrow functions
      const init = path.node.init;
      if (
        t.isIdentifier(path.node.id) &&
        (t.isFunctionExpression(init) || t.isArrowFunctionExpression(init))
      ) {
        const name = path.node.id.name;
        const leading = init.leadingComments || [];
        const params = [];
        const regex = /@param\s*{\s*([^}]+)\s*}\s*(\w+)/g;
        let m;
        for (const c of leading) {
          while ((m = regex.exec(c.value))) {
            params.push({ name: m[2], type: m[1].trim().toLowerCase() });
          }
        }
        if (params.length) {
          functionParamMap.set(name, params);
        }
      }
    },
  });

  // 2️⃣ Main pass: variables, assignments, and call argument checks
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

        if (typeAnnotation) {
          typeChecksPerformed++;
          const match = isComplexTypeMatch(
            expectedType.toLowerCase(),
            actualType,
            decl.init,
            isComplex
          );
          if (!match) {
            const locStr = getLocationInfo(filename, decl);
            if (!options.full) {
              console.log(chalk.red(`❌ Type mismatch at ${locStr}:`));
              console.log(
                `  Variable: ${varName}\n  Expected: ${expectedType.toLowerCase()}, Found: ${actualType}\n`
              );
            }
            errors.push({
              loc: locStr,
              variable: varName,
              expected: expectedType.toLowerCase(),
              found: actualType,
            });
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
        if (!options.full) {
          console.log(chalk.red(`❌ Type mismatch at ${locStr}:`));
          console.log(
            `  Assignment to: ${varName}\n  Expected: ${expectedType}, Found: ${actualType}\n`
          );
        }
        errors.push({
          loc: locStr,
          variable: varName,
          expected: expectedType,
          found: actualType,
        });
        typeErrors++;
      } else {
        variableMap.set(varName, { ...info, actualType });
      }
    },

    CallExpression(path) {
      const callee = path.node.callee;
      if (!t.isIdentifier(callee)) return;
      const params = functionParamMap.get(callee.name);
      if (!params) return;

      path.node.arguments.forEach((argNode, i) => {
        const expected = params[i]?.type;
        if (!expected) return;
        const actual = inferType(argNode, false, expected);
        if (actual !== expected) {
          const loc = getLocationInfo(filename, argNode);
          console.log(chalk.red(`❌ Param mismatch at ${loc}:`));
          console.log(
            `  Function: ${callee.name}\n` +
              `  Param: ${params[i].name}\n` +
              `  Expected: ${expected}, Found: ${actual}\n`
          );
          typeErrors++;
        }
      });
      typeChecksPerformed += params.length;
    },
  });

  if (typeErrors > 0) {
    if (!options.full) {
      console.log(
        chalk.red(`Found ${typeErrors} type error(s) in ${filename}`)
      );
      process.exit(1);
    }
  } else {
    if (!options.full) {
      console.log(
        chalk.green(
          `Checked ${filename} successfully! (${typeChecksPerformed} type checks performed)`
        )
      );
      if (skipLoc) {
        console.log(
          chalk.yellow(`Note: Partially checked due to skip-remaining comment.`)
        );
      }
    }
  }

  return { typeChecksPerformed, skipped: false, errors };
}

// Helper functions (unchanged)

function hasSkipComment(comments) {
  return comments.some((c) => c.value.trim() === ": skip");
}

function getSkipRemainingLocation(code) {
  const lines = code.split("\n");
  for (let i = 0; i < lines.length; i++) {
    if (lines[i].includes("/*: skip-remaining */")) return i + 1;
  }
  return null;
}

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

function parseTypeAnnotation(typeAnnotation) {
  return {
    expectedType: typeAnnotation.toLowerCase(),
    isComplex: /[\[\]<>|&]/.test(typeAnnotation),
  };
}

function inferType(node, isComplex, expectedType) {
  // Handle annotated function returns
  if (t.isCallExpression(node)) {
    const callee = node.callee;
    if (t.isIdentifier(callee)) {
      const ret = functionReturnMap.get(callee.name);
      if (ret) return ret;
    }
  }
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
  if (expectedType.includes("|"))
    return expectedType.split("|").includes(actualType);
  return false;
}

function checkArrayType(node, expectedType) {
  return expectedType;
}

function getLocationInfo(filename, node) {
  const rel = path.relative(process.cwd(), filename);
  return `${rel}:${node.loc.start.line}:${node.loc.start.column + 1}`;
}
