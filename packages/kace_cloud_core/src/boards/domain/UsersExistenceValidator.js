import { ValidationFailError } from "@kace/core/src/shared";

export class UsersExistenceValidator {
  constructor(usersRepository) {
    this.repository = usersRepository;
  }

  async validate(userIds = []) {
    if (!userIds.length) return;

    const existingIds = await this.repository.findExistingIds(userIds, "usuarios");
    const missing = userIds.filter(id => !existingIds.includes(id));

    if (missing.length) {
      throw new ValidationFailError(
        `The following users do not exist: ${missing.join(", ")}`,
        "access_users"
      );
    }
  }
}
