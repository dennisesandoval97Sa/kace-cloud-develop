import { ValueObjectJson } from "@kace/core/src/shared";

export class VOBoardAccessGroups extends ValueObjectJson {
  constructor(value) {
    super('access_groups', value);
  }
}
