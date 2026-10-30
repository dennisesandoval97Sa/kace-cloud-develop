/*
 * Formik validates with "" turned into undefined but submits the raw values, so every predicate
 * reads the cells normalized. Cells are coerced to string so the predicates stay in lockstep with
 * WorkspaceSchemaForm's `Joi.string().required()` — `0` and `false` are rejected by Joi, so the
 * predicates must treat them as non-empty too.
 */
const ruleCells = (row) => [row?.field, row?.operator, row?.value].map((cell) => (cell == null ? "" : String(cell)));

export const isRuleRowEmpty = (row) => ruleCells(row).every((cell) => cell === "");

export const isRuleRowComplete = (row) => ruleCells(row).every((cell) => cell !== "");

// Fully empty rows are dropped on submit, so they do not count as a rule change.
export const ruleRowsSignature = (rows) =>
    JSON.stringify((rows ?? []).filter((row) => !isRuleRowEmpty(row)).map(ruleCells));
