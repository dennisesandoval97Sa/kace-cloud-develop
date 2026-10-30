import { CustomError, UniquenessValidator } from '../../../shared/index.js';
import { Workspaces } from '../../domain/Workspaces.js';
import { assertWorkspaceHasNonDeletedChannelHubAccount } from '../../domain/WorkspaceChannelHubAccountRequirement.js';
import { WorkspacesFinder } from '../../domain/WorkspacesFinder.js';

export class WorkspaceCreator {
    /** @type {KnexWorkspacesRepository} is initialized in the constructor*/
    #repository;
    /** @type {WorkspacesFinder} is initialized in the constructor*/
    #finder;
    /** @type {UniquenessValidator} is initialized in the constructor*/
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
     *
     * @param {object} dto data for insert a new workspace
     * @returns {Promise<Any>}
     */
    async execute(dto) {
        if (dto === null || dto === undefined) throw new CustomError('dto cannot be null or undefined', 400);

        await assertWorkspaceHasNonDeletedChannelHubAccount(this.#repository, dto.channel_hub_accounts);

        const creator = Workspaces.create(dto);
        const result = await this.#finder.execute(creator.id.value);
        if (result) {
            throw new CustomError(`Workspace with id ${creator.id.value} already exists`, 400);
        }

        await this.#uniquenessValidator.validate('description', dto.description);
        await this.#repository.save(creator);
    }
}
