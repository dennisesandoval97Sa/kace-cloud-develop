import { ValueObjectJson } from '../../shared/domain/value-object/ValueObjectJson.js';

export class VOBoardRelations extends ValueObjectJson {
  constructor(value, nullable = false) {
    super('relations', value, nullable);
  }
}
