import { ValueObjectJson } from "@kace/core/src/shared";

export class VOBoardAccessUsers extends ValueObjectJson {
  constructor(value) {
    super('access_users', value);
  }
}
