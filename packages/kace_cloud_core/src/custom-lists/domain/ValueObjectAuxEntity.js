export class ValueObjectAuxEntity {
  #value;
  constructor(value) {
    const v = (value ?? '').toString().trim();
    const ok = /^[a-z_][a-z0-9_]*$/.test(v);
    if (!ok) throw new Error('Invalid "aux_entity" (use snake_case, e.g., aux_countries)');
    this.#value = v;
  }
  get value() { return this.#value; }
}
