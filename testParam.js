/**
 * Adds two numbers.
 *
 * @param {number} a  – first addend
 * @param {number} b  – second addend
 * @returns {number}
 */
function add(a, b) {
  return a + b;
}

// ✅ both args are numbers
let sum1 = add(2, 3);

// ❌ wrong type for first param
let sum2 = add("2", 3);

// ❌ wrong type for second param
let sum3 = add(2, "3");

// ✅ return type matches @returns
/** @type {number} */
let sum4 = add(5, 6);
