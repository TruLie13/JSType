#!/usr/bin/env node

import fs from "fs";
import { program } from "commander";
import parser from "@babel/parser";
import traverseModule from "@babel/traverse";
import * as t from "@babel/types";
import chalk from "chalk";

const traverse = traverseModule.default;

// CLI setup
program
  .version("1.0.0")
  .description("JSType: A lightweight type-checker for JavaScript")
  .argument("<file>", "JavaScript file to check")
  .action((file) => {
    checkFile(file);
  });

program.parse(process.argv);

// Function to check types
function checkFile(filename) {
  if (!fs.existsSync(filename)) {
    console.log(chalk.red(`Error: File "${filename}" not found.`));
    return;
  }

  const code = fs.readFileSync(filename, "utf8");
  const ast = parser.parse(code, {
    sourceType: "module",
    plugins: ["jsx"], // Allow JSX parsing (optional)
    // Enable comment parsing
    attachComments: true,
  });

  let typeErrors = 0;

  traverse(ast, {
    VariableDeclaration(path) {
      const { declarations } = path.node;
      declarations.forEach((declaration) => {
        if (!declaration.init) return; // Skip uninitialized variables

        const varName = declaration.id.name;
        console.log("\nChecking variable:", varName);

        // Extract type annotation from inline comments (/*: type */)
        const typeComment = findTypeAnnotation(
          path.node.comments,
          code,
          declaration
        );

        if (typeComment) {
          const expectedType = typeComment.toLowerCase();
          let actualType = "unknown";

          // Determine the actual type using Babel's AST node types
          if (t.isStringLiteral(declaration.init)) {
            actualType = "string";
          } else if (t.isNumericLiteral(declaration.init)) {
            actualType = "number";
          } else if (t.isBooleanLiteral(declaration.init)) {
            actualType = "boolean";
          } else if (t.isNullLiteral(declaration.init)) {
            actualType = "null";
          } else if (t.isObjectExpression(declaration.init)) {
            actualType = "object";
          } else if (t.isArrayExpression(declaration.init)) {
            actualType = "array";
          } else if (
            t.isFunctionExpression(declaration.init) ||
            t.isArrowFunctionExpression(declaration.init)
          ) {
            actualType = "function";
          }

          console.log(
            `🔍 Expected Type: ${expectedType}, Actual Type: ${actualType}`
          );

          // Compare types
          if (expectedType !== actualType) {
            console.log(
              chalk.red(
                `❌ Type mismatch in ${filename}:\n` +
                  `  Variable: ${varName}\n` +
                  `  Expected: ${expectedType}, Found: ${actualType}`
              )
            );
            typeErrors++;
          } else {
            console.log(chalk.green(`✅ ${varName} matches expected type.`));
          }
        } else {
          console.log(
            chalk.gray(`⚠️  No type annotation found for ${varName}.`)
          );
        }
      });
    },
  });

  if (typeErrors > 0) {
    console.log(chalk.red(`Found ${typeErrors} type error(s) in ${filename}`));
    process.exit(1);
  } else {
    console.log(chalk.green(`Checked ${filename} successfully!`));
  }
}

// Function to find type annotations in inline comments like /*: type */
function findTypeAnnotation(comments, code, declaration) {
  // Extract the line of code for this variable declaration
  const lineStart = declaration.loc.start.line;
  const lineEnd = declaration.loc.end.line;
  const lines = code.split("\n").slice(lineStart - 1, lineEnd);
  const line = lines.join("\n");

  // Look for /*: type */ pattern
  const typeAnnotationMatch = line.match(/\/\*\s*:\s*(\w+)\s*\*\//);

  if (typeAnnotationMatch) {
    return typeAnnotationMatch[1];
  }

  return null;
}
