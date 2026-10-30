import { ActionJob, ActionJobResponse, DomainActionJobFinder } from '../../index.js';
import { CustomError } from '../../../shared/errors/CustomError.js';
import { ActionJobCreated } from '../../domain/events/ActionJobCreated.js';
import { Helper } from '../../../shared/infrastructure/utils/Helper.js';

export class ActionJobCreator {
    /**
     * @type {KnexActionJobRepository}
     * is initialized in the constructor
     */
    #repository;

    /**
     * @type {DomainActionJobFinder}
     * is initialized in the constructor
     */
    #finder;

    /** @type {import('../../../shared/application/events/EventPublisher.js').EventPublisher|null} */
    #eventPublisher;

    /** @type {Tenant} */
    #tenant;

    /** @type {User} */
    #currentUser;

    /**
     * @param {KnexActionJobRepository} repository - The repository for managing ActionJob records.
     * @param {import('../../../shared/application/events/EventPublisher.js').EventPublisher} [eventPublisher] - Optional event publisher for domain events
     * @param {Tenant} tenant
     * @param {User} currentUser
     */
    constructor(repository, eventPublisher, tenant, currentUser) {
        this.#repository = repository;
        this.#finder = new DomainActionJobFinder(repository);
        this.#eventPublisher = eventPublisher || null;
        this.#tenant = tenant;
        this.#currentUser = currentUser;
    }

    /**
     * Executes the process of creating a new ActionJob.
     * @param {Object} dto - The data transfer object containing the properties for the ActionJob object.
     * @returns {Promise<ActionJobResponse>}
     */
    async execute(dto) {
        if (!dto) throw new Error('DTO cannot be null or undefined');

        const actionJob = new ActionJob(dto);

        const existingActionJob = await this.#finder.execute(actionJob.id.value);
        if (existingActionJob) {
            throw new CustomError(`ActionJob with id ${actionJob.id.value} already exists`, 400);
        }

        const newRecord = await this.#repository.save(actionJob);

        await this.#publishDomainEvents(newRecord);

        return new ActionJobResponse(newRecord);
    }

    /**
     * @private
     */
    async #publishDomainEvents(actionJob) {
        if (!this.#eventPublisher) {
            return;
        }

        try {
            actionJob.recordDomainEvent(
                new ActionJobCreated({
                    actionJobId: actionJob.id.value,
                    type: actionJob.type.value,
                    actionId: actionJob.action_id.value,
                    restflowId: actionJob.restflow_id.value,
                    totalRecords: actionJob.total_records.value,
                    metadata: {
                        tenant_id: this.#tenant?.id?.value ?? null,
                        user_id: this.#currentUser?.id?.value ?? null,
                        correlation_id: null,
                        causation_id: null,
                    },
                })
            );

            const domainEvents = actionJob.pullDomainEvents();
            await this.#eventPublisher.publishAll(domainEvents);
        } catch (error) {
            Helper.logError('ActionJobCreator: Failed to publish domain events', error);
        }
    }
}
