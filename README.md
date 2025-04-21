# JSType CLI

| v1.2

JSType is a lightweight type checker for JavaScript, designed to help you catch type errors without switching to TypeScript. It scans your JavaScript files for inline JSDoc comment type annotations and verifies that variable values match their declared types.

## Features

- 📝 **Non-intrusive type checking** - Uses inline JSDoc comment syntax for declaring types.
- 💡 **Type inference (--infer)** – Optionally Infer types when JSDoc annotations are missing.
- 🔄 **No build step required** - Install and run the CLI tool (_no need to change file extensions or refactor code_).
- ✅ **Gradual adoption** - Adopt type checking in stages. You can apply types to entire files or parts of files (_great for legacy projects_).
- ⚡ **Performance-Oriented** - Skip files or file segments with special comments (/_: skip _/, /_: skip-remaining _/).
- 📑 **Full project report (--full)** – Generate a JSON error log (jstype-errors.json) and summary for multi-file scans.
- 🔍 **Rich type support** - Handles primitive types, arrays, unions, and more.
  - Primitive: `string`, `number`, `boolean`, `null`, `undefined`  
  - Complex: `object`, `array`, `function`  
  - Array types: `type[]` (e.g. `string[]`)  
  - Union types: `type1|type2` (e.g. `string|number`)  
  - **Function returns**: `@returns` annotations drive return‑type inference  
  - **Function parameters**: `@param` annotations validate call‑site arguments

## Installation

### Global Install

```bash
npm install -g jstype-cli
```

### Local Development / Testing

```bash
git clone https://github.com/your-username/JSType.git
cd JSType
npm install
npm link
```

## Usage

### Basic Usage

#Works with path to file or entire folder

```bash
jstype <path> [options]
```

### Options

- [-i, --infer] - Enable type inference when JSDoc not present (reveals gaps in @type/@returns coverage).
- [--full] - Full multi‑file report with JSON error log (jstype-errors.json) and summary.

## Type Annotations

### Variables
```javascript
// Basic types
/** @type {string} */
let name = "Alice"; // ✅ No error

/** @type {number} */
let age = "twenty"; // ❌ Type mismatch error

/** @type {boolean} */
let isValid = "true"; // ❌ Type mismatch error (string, not boolean)

/** @type {array} */
let arr = [1, 2, 3]; // ✅ Matches array type
```

### Assignments
```javascript
/** @type {number} */
let count = 5; // ✅ Matches number type

/** @type {string} */
count = "10"; // ❌ Cannot reassign type

count = "ten"; // ❌ Type mismatch error in assignment
```

### Function Returns
```javascript
/**
 * @returns {array<string>}
 */
function getNames() {
  return ["Alice", "Bob"];
}

let names = getNames();      // ✅ OK
```

### Function Parameters
```javascript
/**
 * Concatenates two strings.
 * @param {string} a
 * @param {string} b
 * @returns {string}
 */
function join(a, b) {
  return a + b;
}

let good = join("foo", "bar");   // ✅ OK
let bad1 = join(1, "bar");       // ❌ Param mismatch
let bad2 = join("foo", 2);       // ❌ Param mismatch
```

## Results Reported

JSType provides clear error messages when type mismatches are detected:

## Output & Logs

- By default, JSType prints errors immediately and exits on the first file with errors.
- With --full: jstype-errors.json file is generated at project root and terminal displays summary
  (ex: 'Found 3 type error(s) in 2 files — scan time: 0.45s — see jstype-errors.json')

### Error example

<img width="792" alt="image" src="https://github.com/user-attachments/assets/bbee5e5d-3c95-44c5-b1f8-361309c1bfbb" />

### Success example

 <img width="961" alt="image" src="https://github.com/user-attachments/assets/a8c3532b-3679-4817-8492-2fa4e722051d" />

## Contributing

Contributions are welcome! Please feel free to submit a Pull Request.

## License

This project is licensed under the MIT License - see the LICENSE file for details.

## Roadmap

- [x] Add type check for function variables
- [x] Add type check for component props
- [ ] Add type check for local imports
- [x] Convert to package so it can be installed globally with npm
- [ ] Memory Management - garbage collecting
