import { ValueObjectJson } from "@kace/core/src/shared";

export class VOBoardOptions extends ValueObjectJson {
  constructor(value) {
    super('options', value);
  }
}
