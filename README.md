# JSType CLI

JSType is a lightweight type checker for JavaScript, designed to help you catch type errors without switching to TypeScript. It scans your JavaScript files for inline JSDoc comment type annotations and verifies that variable values match their declared types.

## Features

- 📝 **Non-intrusive type checking** - Uses inline JSDoc comment syntax for declaring types.
- 🔄 **No build step required** - Just install and link the CLI tool (_no need to change file extensions or refactor code_).
- ✅ **Gradual adoption** - Adopt type checking in stages. You can apply types to entire files or parts of files (_great for legacy projects_).
- ⚡ **Performance-Oriented** - Includes support for skipping entire files or file segments with special comments.
- 🔍 **Rich type support** - Handles primitive types, arrays, unions, and more.

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

```bash
jstype path/to/your/file.js
```

### With Verbose Output

```bash
jstype path/to/your/file.js --verbose
```

## Type Annotations

JSType uses inline comment annotations to specify types:

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

// Type checking in assignments
/** @type {number} */
let count = 5; // ✅ Matches number type

/** @type {string} */
count = "10"; // ❌ Cannot reassign type

count = "ten"; // ❌ Type mismatch error in assignment
```

## Supported Types

- Primitive types: `string`, `number`, `boolean`, `null`, `undefined`
- Complex types: `object`, `array`, `function`
- Array types: `type[]` (e.g., `string[]`, `number[]`)
- Union types: `type1|type2` (e.g., `string|number`)

## Results Reported

JSType provides clear error messages when type mismatches are detected:

### Error example

<img width="792" alt="image" src="https://github.com/user-attachments/assets/bbee5e5d-3c95-44c5-b1f8-361309c1bfbb" />

### Success example

 <img width="961" alt="image" src="https://github.com/user-attachments/assets/a8c3532b-3679-4817-8492-2fa4e722051d" />

## Contributing

Contributions are welcome! Please feel free to submit a Pull Request.

## License

This project is licensed under the MIT License - see the LICENSE file for details.

## Roadmap

- [ ] Add type check for function variables
- [ ] Add type check for component props
- [ ] Add type check for local imports
- [ ] Convert to package so it can be installed globally with npm
- [ ] Memory Management - garbage colleting
