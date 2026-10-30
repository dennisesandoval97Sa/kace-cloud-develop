import { ValueObjectUuid } from '../../shared/index.js';

export class CustomListAuxItem {
  /** @type {ValueObjectUuid} */
  #aux_id;
  /** @type {number} */
  #order;

  constructor({ aux_id, order }) {
    this.#aux_id = new ValueObjectUuid('aux_id', aux_id, true);
    const ord = Number(order);
    if (!Number.isInteger(ord) || ord < 1) throw new Error('Invalid "order" for CustomListAuxItem');
    this.#order = ord;
  }

  get aux_id() { return this.#aux_id; }
  get order() { return this.#order; }

  toJSON() {
    return { aux_id: this.#aux_id.value, order: this.#order };
  }
}
