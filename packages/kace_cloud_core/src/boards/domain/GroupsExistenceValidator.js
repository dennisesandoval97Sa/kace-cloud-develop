import { ValidationFailError } from "@kace/core/src/shared";

export class GroupsExistenceValidator {
  constructor(groupsRepository) {
    this.repository = groupsRepository;
  }

  async validate(groupIds = []) {
    if (!groupIds.length) return;

    const existingIds = await this.repository.findExistingIds(groupIds, "grupos");
    const missing = groupIds.filter(id => !existingIds.includes(id));

    if (missing.length) {
      throw new ValidationFailError(
        `The following groups do not exist: ${missing.join(", ")}`,
        "access_groups"
      );
    }
  }
}
