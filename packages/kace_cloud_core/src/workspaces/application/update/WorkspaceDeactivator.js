import { CustomError, UniquenessValidator } from '../../../shared/index.js';
import { assertWorkspaceHasNonDeletedChannelHubAccount } from '../../domain/WorkspaceChannelHubAccountRequirement.js';
import { WorkspacesFinder } from '../../domain/WorkspacesFinder.js';

const withoutLegacyRuleId = (rules) => {
    if (rules == null || Array.isArray(rules)) return rules;
    const { ruleId: _ruleId, ...remainingRules } = rules;
    return remainingRules;
};

/**
 * Finalizes a remote-confirmed workspace deactivation. Unlike an ordinary edit,
 * this path clears all persisted Channel Hub rule ids so later reactivation can
 * register fresh remote rules.
 */
export class WorkspaceDeactivator {
    #repository;
    #finder;
    #uniquenessValidator;

    constructor(repository) {
        this.#repository = repository;
        this.#finder = new WorkspacesFinder(repository);
        this.#uniquenessValidator = new UniquenessValidator(repository);
    }

    async execute(updateDto, id) {
        const workspace = await this.#finder.execute(id);
        if (workspace === null) {
            throw new CustomError(`The workspace you are trying update does not exist`, 404);
        }

        if (updateDto.description) {
            await this.#uniquenessValidator.validate('description', updateDto.description, id);
        }

        const hasChannelHubAccounts = Object.prototype.hasOwnProperty.call(updateDto, 'channel_hub_accounts');
        const resultingChannelHubAccounts = hasChannelHubAccounts
            ? updateDto.channel_hub_accounts
            : workspace.channel_hub_accounts.value;
        await assertWorkspaceHasNonDeletedChannelHubAccount(this.#repository, resultingChannelHubAccounts);

        const resultingRules = Object.prototype.hasOwnProperty.call(updateDto, 'rules')
            ? updateDto.rules
            : workspace.rules.value;
        workspace.update({
            ...updateDto,
            is_active: false,
            rules: withoutLegacyRuleId(resultingRules),
        });

        await this.#repository.deactivate(workspace);
        workspace.flushChanges();
    }
}
