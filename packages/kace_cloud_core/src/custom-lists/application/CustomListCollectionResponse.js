import { CustomListResponse } from './CustomListResponse.js';

export class CustomListCollectionResponse {
  /** @type {CustomList[]} */
  #collection;
  /** @type {number} */
  #count;

  /**
   * @param {CustomList[]} collection
   * @param {number} [count] - opcional, si no se provee usa collection.length
   */
  constructor(collection = [], count) {
    this.#collection = Array.isArray(collection) ? collection : [];
    this.#count = Number.isInteger(count) ? count : this.#collection.length;
  }

  toJson() {
    return {
      data: {
        items: this.#collection.map((agg) => new CustomListResponse(agg).toJson().data),
      },
      metadata: {
        count: this.#count,
      },
    };
  }
}
