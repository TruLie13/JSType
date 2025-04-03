let name /*: string */ = "Alice"; // ✅ No error
// let age /*: number */ = "twenty"; // ❌ Type mismatch error
let arr /*: array */ = [1, 2, 3]; // ✅ Matches array type
// let numbers /*: number[] */ = [1, 2, "three"]; // ❌ Type mismatch error (string in number array)
let mixedType /*: string|number */ = 42; // ✅ Matches union type
let person /*: object */ = { name: "Bob", age: 30 }; // ✅ Matches object type
let greeting /*: function */ = () => console.log("Hello"); // ✅ Matches function type
// let isValid /*: boolean */ = "true"; // ❌ Type mismatch error (string, not boolean)
// isValid = 3; // ❌ Type mismatch error (string, not boolean)
/*: skip-remaining */
let empty /*: null */ = null; // ✅ Matches null type
let none /*: undefined */ = void 0; // ✅ Matches undefined type

// Type checking in assignments
let count /*: number */ = 5;
count /*: number */ = 10; // ✅ Valid assignment
count /*: number */ = "ten"; // ❌ Type mismatch error in assignment
