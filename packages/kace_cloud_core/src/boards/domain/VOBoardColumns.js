import { ValueObjectJson } from "@kace/core/src/shared";

export class VOBoardColumns extends ValueObjectJson {
  constructor(value) {
    super('columns', value);
  }
}
