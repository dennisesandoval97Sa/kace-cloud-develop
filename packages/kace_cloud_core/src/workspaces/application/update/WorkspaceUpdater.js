import { CustomError, UniquenessValidator } from '../../../shared/index.js';
import { assertWorkspaceHasNonDeletedChannelHubAccount } from '../../domain/WorkspaceChannelHubAccountRequirement.js';
import { WorkspacesFinder } from '../../domain/WorkspacesFinder.js';

export class WorkspaceUpdater {
    /** @type {KnexWorkspacesRepository} is initialized in the constructor */
    #repository;
    /** @type {WorkspacesFinder} is initialized in the constructor */
    #finder;
    /** @type {UniquenessValidator} is initialized in the constructor */
    #uniquenessValidator;

    /**
     *
     * @param {KnexWorkspacesRepository} repository
     */
    constructor(repository) {
        this.#repository = repository;
        this.#finder = new WorkspacesFinder(repository);
        this.#uniquenessValidator = new UniquenessValidator(repository);
    }

    /**
     * Update workspace data by id
     * @param {object} updateDto data object for update
     * @param {string} id id for update
     */
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

        workspace.update(updateDto);

        await this.#repository.update(workspace);

        workspace.flushChanges();
    }
}
