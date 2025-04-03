# JSType CLI

JSType is a lightweight type checker for JavaScript, designed to help you catch type errors without switching to TypeScript. It scans your JavaScript files for inline comment type annotations and verifies that variable values match their declared types.

## Features

- 📝 **Non-intrusive type checking** - Add types via comments in your regular JavaScript code
- 🔄 **No build step required** - Unlike TypeScript, works directly with vanilla JS
- ✅ **Gradual adoption** - Add type checking incrementally to existing projects
- 🔍 **Rich type support** - Handles primitive types, arrays, unions, and more

## Installation

```bash
# Install globally from npm
npm install -g jstype

# Or clone and install locally
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
let name /*: string */ = "Alice";
let age /*: number */ = 30;
let isActive /*: boolean */ = true;

// Array types
let fruits /*: string[] */ = ["apple", "banana", "orange"];

// Union types
let id /*: string|number */ = "user123";

// Type checking in assignments
let count /*: number */ = 5;
count /*: number */ = 10; // Type checked at assignment
```

## Supported Types

- Primitive types: `string`, `number`, `boolean`, `null`, `undefined`
- Complex types: `object`, `array`, `function`
- Array types: `type[]` (e.g., `string[]`, `number[]`)
- Union types: `type1|type2` (e.g., `string|number`)

## Error Reporting

JSType provides clear error messages when type mismatches are detected:

```
❌ Type mismatch at test.js:2:24:
  Variable: age
  Expected: number, Found: string ("twenty")
```

## Contributing

Contributions are welcome! Please feel free to submit a Pull Request.

## License

This project is licensed under the MIT License - see the LICENSE file for details.

## Roadmap

- [ ] Add support for interface and custom type definitions
- [ ] Add configuration options for strict/loose mode
- [ ] Create VS Code extension for inline type checking
- [ ] Add support for generics and more complex type patterns
- [ ] Improve type inference for better error reporting
