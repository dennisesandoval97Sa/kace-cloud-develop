export class CaseResponseAllRelations {
  #row;

  /**
   * @param {object} row - Objeto plano con el caso y sus relaciones embebidas
   */
  constructor(row) {
    this.#row = row || null;
  }

  toJson() {
    if (!this.#row) {
      return {};
    }

    const source = this.#row;
    const ordered = {};
    const inserted = new Set();

    for (const [key, value] of Object.entries(source)) {
      if (inserted.has(key)) continue;

      ordered[key] = value;
      inserted.add(key);

      if (/_id$/.test(key)) {
        const pairKey = key.slice(0, -3);
        if (Object.prototype.hasOwnProperty.call(source, pairKey) && !inserted.has(pairKey)) {
          ordered[pairKey] = source[pairKey];
          inserted.add(pairKey);
        }
      }
    }

    return {
      data: ordered,
    };
  }
}
