import { CaseResponseAllRelations } from './CaseResponseAllRelations';

export class CasesAllRelationsCollectionResponse {
  #items;
  #count;

  /**
   * @param {Array<object>} items - filas enriquecidas (objetos planos) de casos
   */
  constructor(items = [], count) {
    this.#items = Array.isArray(items) ? items : [];
    this.#count = count;
  }

  toJson() {
    const items = this.#items.map((row) => {
      const item = new CaseResponseAllRelations(row).toJson();
      return item?.data ?? {};
    });

    return {
      data: {
        items,
      },
      metadata: {
                count: this.#count,
    },
    };
  }
}
