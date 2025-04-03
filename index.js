#!/usr/bin/env node
/*: skip */
import fs from "fs";
import path from "path";
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
  .option("-v, --verbose", "Show detailed type information")
  .action((file, options) => {
    traverseDirectory(file, options);
  });

program.parse(process.argv);

// Function to traverse the directory and process each JS file
function traverseDirectory(directory, options) {
  let totalTypeChecks = 0;
  let totalFiles = 0;
  const startTime = Date.now();
  const results = [];

  function traverse(currentDirectory) {
    fs.readdirSync(currentDirectory).forEach((file) => {
      const fullPath = path.join(currentDirectory, file);
      const stats = fs.statSync(fullPath);

      // Skip 'node_modules' directory
      if (path.basename(fullPath) === "node_modules") {
        return; // Skip the node_modules directory
      }

      if (stats.isDirectory()) {
        traverse(fullPath); // Recursively traverse subdirectories
      } else if (stats.isFile() && file.endsWith(".js")) {
        const { typeChecksPerformed, skipped } = checkFile(fullPath, options); // Process JavaScript file
        if (!skipped) {
          results.push({ file: fullPath, typeChecks: typeChecksPerformed });
          totalTypeChecks += typeChecksPerformed;
          totalFiles -= 1;
        }
        totalFiles++;
      }
    });
  }

  traverse(directory);

  const endTime = Date.now();
  const timeTaken = (endTime - startTime) / 1000; // in seconds
  console.log(
    chalk.green(
      `Success! ${totalTypeChecks} type checks, ${totalFiles} files, ${timeTaken}s`
    )
  );
}

// Function to check types
function checkFile(filename, options = {}) {
  if (!fs.existsSync(filename)) {
    console.log(chalk.red(`Error: File "${filename}" not found.`));
    return { typeChecksPerformed: 0, skipped: false };
  }

  const code = fs.readFileSync(filename, "utf8");
  const ast = parser.parse(code, {
    sourceType: "module",
    plugins: ["jsx"], // Allow JSX parsing (optional)
    // Enable comment parsing
    attachComments: true,
  });

  // Check for /*: skip */ comment at the beginning of the file
  if (hasSkipComment(ast.comments)) {
    console.log(chalk.yellow(`Skipping ${filename} due to skip comment.`));
    return { typeChecksPerformed: 0, skipped: true };
  }

  // Check for /*: skip-remaining */ comment and get its location if it exists
  const skipRemainingLocation = getSkipRemainingLocation(code);

  let typeErrors = 0;
  let typeChecksPerformed = 0;
  let skipRemaining = false; // Flag to skip remaining checks

  const visitor = {
    VariableDeclaration(path) {
      // Check if we should skip this node based on its location
      if (
        skipRemainingLocation &&
        path.node.loc.start.line > skipRemainingLocation
      ) {
        return; // Skip if after the skip-remaining comment
      }

      const { declarations } = path.node;
      declarations.forEach((declaration) => {
        if (!declaration.init) return; // Skip uninitialized variables

        const varName = declaration.id.name;
        let expectedType, actualType, typeValue;
        let isComplex = false;

        // Extract type annotation from inline comments (/*: type */)
        const typeAnnotation = findTypeAnnotation(
          path.node.comments,
          code,
          declaration
        );

        if (typeAnnotation) {
          typeChecksPerformed++;
          ({ expectedType, isComplex } = parseTypeAnnotation(typeAnnotation));
          actualType = "unknown";
          typeValue = null;

          // Determine the actual type using Babel's AST node types
          if (t.isStringLiteral(declaration.init)) {
            actualType = "string";
            typeValue = declaration.init.value;
          } else if (t.isNumericLiteral(declaration.init)) {
            actualType = "number";
            typeValue = declaration.init.value;
          } else if (t.isBooleanLiteral(declaration.init)) {
            actualType = "boolean";
            typeValue = declaration.init.value;
          } else if (t.isNullLiteral(declaration.init)) {
            actualType = "null";
          } else if (t.isObjectExpression(declaration.init)) {
            actualType = "object";
          } else if (t.isArrayExpression(declaration.init)) {
            actualType = isComplex
              ? checkArrayType(declaration.init, expectedType)
              : "array";
          } else if (
            t.isFunctionExpression(declaration.init) ||
            t.isArrowFunctionExpression(declaration.init)
          ) {
            actualType = "function";
          } else if (t.isIdentifier(declaration.init)) {
            // Handle variable references - type inference would be more complex
            actualType = "reference";
            typeValue = declaration.init.name;
          } else if (
            t.isUnaryExpression(declaration.init) &&
            declaration.init.operator === "void"
          ) {
            actualType = "undefined";
          }

          // Compare types
          if (
            !isComplexTypeMatch(
              expectedType,
              actualType,
              declaration.init,
              isComplex
            )
          ) {
            const errorLocation = getLocationInfo(filename, declaration);
            console.log(chalk.red(`❌ Type mismatch at ${errorLocation}:`));
            console.log(
              `  Variable: ${varName}\n` +
                `  Expected: ${expectedType}, Found: ${actualType}` +
                (typeValue !== null ? ` (${typeValue})` : "") +
                `\n`
            );
            typeErrors++;
          }
        }
      });
    },
    AssignmentExpression(path) {
      // Check if we should skip this node based on its location
      if (
        skipRemainingLocation &&
        path.node.loc.start.line > skipRemainingLocation
      ) {
        return; // Skip if after the skip-remaining comment
      }

      // Check type for assignments like: x = value; (where x has a type annotation)
      if (t.isIdentifier(path.node.left)) {
        const varName = path.node.left.name;
        let expectedType, actualType;
        let isComplex = false;
        // Extract comment from the assignment
        const assignmentComment = findTypeAnnotationInAssignment(
          code,
          path.node
        );

        if (assignmentComment) {
          typeChecksPerformed++;
          ({ expectedType, isComplex } =
            parseTypeAnnotation(assignmentComment));
          actualType = "unknown";

          // Determine the actual type
          if (t.isStringLiteral(path.node.right)) {
            actualType = "string";
          } else if (t.isNumericLiteral(path.node.right)) {
            actualType = "number";
          } else if (t.isBooleanLiteral(path.node.right)) {
            actualType = "boolean";
          } else if (t.isNullLiteral(path.node.right)) {
            actualType = "null";
          } else if (t.isObjectExpression(path.node.right)) {
            actualType = "object";
          } else if (t.isArrayExpression(path.node.right)) {
            actualType = isComplex
              ? checkArrayType(path.node.right, expectedType)
              : "array";
          } else if (
            t.isFunctionExpression(path.node.right) ||
            t.isArrowFunctionExpression(path.node.right)
          ) {
            actualType = "function";
          }

          // Compare types
          if (
            !isComplexTypeMatch(
              expectedType,
              actualType,
              path.node.right,
              isComplex
            )
          ) {
            const errorLocation = getLocationInfo(filename, path.node);
            console.log(chalk.red(`❌ Type mismatch at ${errorLocation}:`));
            console.log(
              `  Assignment to: ${varName}\n` +
                `  Expected: ${expectedType}, Found: ${actualType} \n`
            );
            typeErrors++;
          }
        }
      }
    },
  };

  traverse(ast, visitor);

  if (typeErrors > 0) {
    console.log(chalk.red(`Found ${typeErrors} type error(s) in ${filename}`));
    process.exit(1);
  } else if (!hasSkipComment(ast.comments)) {
    console.log(
      chalk.green(
        `Checked ${filename} successfully! (${typeChecksPerformed} type checks performed)`
      )
    );
    if (skipRemainingLocation) {
      console.log(
        chalk.yellow(`Note: Partially checked due to skip-remaining comment.`)
      );
    }
  }
  return { typeChecksPerformed, skipped: false };
}

// Function to check if the file has the /*: skip */ comment
function hasSkipComment(comments) {
  if (!comments || comments.length === 0) {
    return false;
  }
  return comments.some((comment) => comment.value.trim() === ": skip");
}

// Function to find the line number of a /*: skip-remaining */ comment
function getSkipRemainingLocation(code) {
  const lines = code.split("\n");
  for (let i = 0; i < lines.length; i++) {
    if (
      lines[i].includes("/*: skip-remaining */") ||
      lines[i].includes("/* : skip-remaining */")
    ) {
      return i + 1; // Line numbers are 1-based
    }
  }
  return null;
}

// Function to find type annotations in inline comments like /*: type */
function findTypeAnnotation(comments, code, declaration) {
  // Extract the line of code for this variable declaration
  const lineStart = declaration.loc.start.line;
  const lineEnd = declaration.loc.end.line;
  const lines = code.split("\n").slice(lineStart - 1, lineEnd);
  const line = lines.join("\n");

  // Look for /*: type */ pattern
  const typeAnnotationMatch = line.match(/\/\*\s*:\s*([\w\[\]<>|&]+)\s*\*\//);

  if (typeAnnotationMatch) {
    return typeAnnotationMatch[1];
  }

  return null;
}

// Function to find type annotations in assignments
function findTypeAnnotationInAssignment(code, node) {
  const lineStart = node.loc.start.line;
  const lineEnd = node.loc.end.line;
  const lines = code.split("\n").slice(lineStart - 1, lineEnd);
  const line = lines.join("\n");

  // Look for /*: type */ pattern
  const typeAnnotationMatch = line.match(/\/\*\s*:\s*([\w\[\]<>|&]+)\s*\*\//);

  if (typeAnnotationMatch) {
    return typeAnnotationMatch[1];
  }

  return null;
}

// Parse the type annotation to handle more complex types
function parseTypeAnnotation(typeAnnotation) {
  // Check if this is a complex type (array, union, etc.)
  const isComplex = /[\[\]<>|&]/.test(typeAnnotation);

  return {
    expectedType: typeAnnotation.toLowerCase(),
    isComplex,
  };
}

// Check if the type matches, handling complex types
function isComplexTypeMatch(expectedType, actualType, node, isComplex) {
  if (!isComplex) {
    return expectedType === actualType;
  }

  // Handle array types: string[], number[], etc.
  if (expectedType.endsWith("[]")) {
    if (actualType !== "array") {
      return false;
    }

    // For empty arrays, we can't check element types
    if (node.elements.length === 0) {
      return true;
    }

    // Check that all elements match the expected element type
    const elementType = expectedType.slice(0, -2);
    // For simplicity, just check the first element
    const firstElement = node.elements[0];
    let firstElementType = "unknown";
    if (t.isStringLiteral(firstElement)) {
      firstElementType = "string";
    } else if (t.isNumericLiteral(firstElement)) {
      firstElementType = "number";
    } else if (t.isBooleanLiteral(firstElement)) {
      firstElementType = "boolean";
    }

    return elementType === firstElementType;
  }

  // Handle union types: string|number
  if (expectedType.includes("|")) {
    const unionTypes = expectedType.split("|");
    return unionTypes.includes(actualType);
  }

  return false;
}

// Check array type and its elements
function checkArrayType(arrayNode, expectedType) {
  if (expectedType.endsWith("[]")) {
    return expectedType;
  }
  return "array";
}

// Get formatted location information for error reporting
function getLocationInfo(filename, node) {
  const relativePath = path.relative(process.cwd(), filename);
  return `${relativePath}:${node.loc.start.line}:${node.loc.start.column + 1}`;
}
