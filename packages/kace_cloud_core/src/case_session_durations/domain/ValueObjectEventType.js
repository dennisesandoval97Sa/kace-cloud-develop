import { ValueObjectEnum } from '@kace/core/src/shared/index.js';

export class ValueObjectEventType extends ValueObjectEnum {
  constructor(field, value) {
    super(field, value, ['PAUSED', 'FINISHED', 'VIEW', 'CANCELLED']);
  }
}
