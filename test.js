// tests/type-examples.js

/** @type {string} */
let name = "Alice"; // ✅ No error

/** @type {number} */
let age = "twenty"; // ❌ Type mismatch error

/** @type {array} */
let arr = [1, 2, 3]; // ✅ Matches array type

/** @type {object} */
let person = { name: "Bob", age: 30 }; // ✅ Matches object type

/** @type {function} */
let greeting = () => console.log("Hello"); // ✅ Matches function type

/** @type {boolean} */
let isValid = "true"; // ❌ Type mismatch error (string, not boolean)

/** @type {null} */
let empty = null; // ✅ Matches null type

/** @type {undefined} */
let none = void 0; // ✅ Matches undefined type

// ————————————————————————————
// Type checking in assignments

/** @type {number} */
let count = 5;

/** @type {string} */
count = "10"; // ❌ Cannot reassign type

count = "ten"; // ❌ Type mismatch error in assignment
