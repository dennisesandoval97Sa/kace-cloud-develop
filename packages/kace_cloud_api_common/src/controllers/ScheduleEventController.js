import { KnexUsersRepository } from '@kace/core/src/users/index.js';
import { UserFinder } from '@kace/core/src/users/domain/UserFinder.js';
import { Parameters } from '@kace/core/src/shared/domain/params/Parameters';
import { EventPublisher, Helper } from '@kace/core/src/shared';
import { buildRoutingEventBusFromTenant } from '@kace/core/src/shared/infrastructure/events/buildRoutingEventBusFromTenant.js';

export class ScheduleEventController {
    #event; // is initialized in the constructor
    /** @type {import('@kace/core/src/users/domain/User').User|null} */
    #user = null;
    /** @type {Object} */
    #knexConfig; // is initialized in the constructor
    /** @type {KnexUsersRepository} */
    #userRepository; // is initialized in the constructor
    /** @type {import('@kace/core/src/shared/application/events/EventPublisher.js').EventPublisher|null} */
    #eventPublisher;
    /** @type {Tenant} */
    #tenant;

    constructor(event, knexConfig) {
        this.#event = event;
        this.#knexConfig = knexConfig;
        this.#userRepository = new KnexUsersRepository(this.#knexConfig);
        this.#eventPublisher = this.#buildEventPublisher();
        this.#tenant = event.tenantContext.tenant;
    }

    get tenant() {
        return this.#tenant;
    }

    #buildEventPublisher() {
        const tenant = this.#event?.tenantContext?.tenant;

        if (!tenant) {
            Helper.logWarn('schedule_event_controller: no tenant context, event publishing disabled');
            return null;
        }

        const routingBus = buildRoutingEventBusFromTenant(tenant);
        return new EventPublisher(routingBus);
    }

    /**
     * @returns {Promise<Response>}
     */
    async run() {
        try {
            this.#user = await new UserFinder(this.#userRepository).execute(Parameters.defaultUserId);
            const actionsResult = await this.actionDefault();
            return actionsResult;
        } catch (error) {
            Helper.logError('Error in run:ScheduleEventController', error);
            throw new Error(`Error in run:ScheduleEventController ${error}`);
        } finally {
            await this.destroyDbConnection();
        }
    }

    async destroyDbConnection() {
        await this.#userRepository.destroyConnection();
    }

    async actionDefault() {
        throw new Error('Not implemented');
    }

    /**
     *
     * @returns {import('@kace/core/src/users/domain/User').User|null}
     */
    get user() {
        return this.#user;
    }

    get event() {
        return this.#event;
    }

    get database_connection() {
        return this.#userRepository.connection;
    }

    get eventPublisher() {
        return this.#eventPublisher;
    }
}
