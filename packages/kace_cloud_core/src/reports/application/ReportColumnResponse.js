export class ReportColumnResponse {
	/** @type {string[]} */
	#columns;

	/**
	 * Creates an instance of ReportColumnResponse.
	 *
	 * @param {string[]|any} columns - Array-like of column names. Values will be converted to strings.
	 */
	constructor(columns) {
		if (!columns) {
			this.#columns = [];
			return;
		}

		if (Array.isArray(columns)) {
			this.#columns = columns.map((c) => (c === null || c === undefined ? '' : String(c)));
		} else {
			// If an object with keys was passed, use the keys as column names
			this.#columns = Object.keys(columns).map((k) => String(k));
		}
	}

	/**
	 * Returns a plain JSON representation with a single `columns` field.
	 *
	 * @returns {{columns: string[]}}
	 */
	toJson() {
		return { columns: this.#columns };
	}

	/**
	 * Public getter for easier access in code (non-enumerable private field remains hidden).
	 * @returns {string[]}
	 */
	get columns() {
		return Array.isArray(this.#columns) ? [...this.#columns] : [];
	}
}
