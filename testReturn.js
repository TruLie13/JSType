// A helper with a known return type, but no JSDoc @returns
/**
 * @return {array}
 */
function helper() {
  return [1, 2, 3];
}

// No `@type` on `values`, so default mode will skip it
let values = [];

// ❌ Only when you run with `--infer` this assignment is checked

values = helper();
