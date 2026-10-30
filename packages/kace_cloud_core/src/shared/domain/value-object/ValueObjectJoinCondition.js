import { ValueObjectString } from './ValueObjectString.js';

export class ValueObjectJoinCondition extends ValueObjectString {
  constructor(field, value, nullable = false) {
    super(field, value, nullable);

    const parts = value.split('=');
    if (parts.length !== 2) {
      throw new Error(`${this.field}: Must contain exactly one "="`);
    }

    const pattern = /^[A-Za-z0-9_]+\.[A-Za-z0-9_]+$/;
    if (!pattern.test(parts[0].trim()) || !pattern.test(parts[1].trim())) {
      throw new Error(`${this.field}: Invalid format, expected "entity.column = relation.column"`);
    }

  }
}
