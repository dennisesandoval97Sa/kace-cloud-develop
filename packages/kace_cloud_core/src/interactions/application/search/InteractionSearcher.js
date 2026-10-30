import { Criteria } from '../../../shared/index.js';
import { InteractionCounter } from '../../domain/InteractionCounter.js';
import { InteractionCollectionResponse } from '../InteractionCollectionResponse.js';

const STATUS_ORDER_FIELD = 'status';

const normalizeDirection = (direction) =>
    String(direction ?? 'asc')
        .trim()
        .toLowerCase() === 'desc'
        ? 'desc'
        : 'asc';

export class InteractionSearcher {
    /**
     * @type {KnexInteractionRepository}
     * is initialized in the constructor
     */
    #repository;

    /** @type {InteractionCounter} is initialized in the constructor */
    #counter;

    /**
     *
     * @param {KnexInteractionRepository} repository
     */
    constructor(repository) {
        this.#repository = repository;
        this.#counter = new InteractionCounter(repository);
    }

    /**
     *
     * @param {object} dtoCriteria criteria for filter interactions
     * @returns {Promise<InteractionCollectionResponse>} collection of interactions
     */
    async execute(dtoCriteria, activeGroupScope = null) {
        const tablename = this.#repository.tableName;

        // `status` is a derived state (computed from is_closed/in_review), not a real
        // column. Intercept an order on it so the generic Criteria does not emit an
        // invalid `ORDER BY status`; the repository applies a CASE expression instead.
        const { order, statusOrder } = this.#extractStatusOrder(dtoCriteria.order);

        const criteria = new Criteria(
            dtoCriteria.filter,
            dtoCriteria.relationship,
            dtoCriteria.limit,
            dtoCriteria.offset,
            order,
            tablename
        );

        const result = activeGroupScope
            ? await this.#repository.searchForActiveGroup(criteria, statusOrder, activeGroupScope)
            : await this.#repository.search(criteria, statusOrder);
        const counter = await this.#counter.execute(dtoCriteria, activeGroupScope);

        return new InteractionCollectionResponse(result, counter.count);
    }

    /**
     * Executes the ordinary Admin search with its mandatory active-workspace
     * eligibility predicate. This is intentionally separate from Agent scope
     * and from the unscoped collection index path.
     *
     * @param {object} dtoCriteria criteria for filter interactions
     * @returns {Promise<InteractionCollectionResponse>} collection of interactions
     */
    async executeForAdminSearch(dtoCriteria) {
        const tablename = this.#repository.tableName;
        const { order, statusOrder } = this.#extractStatusOrder(dtoCriteria.order);
        const criteria = new Criteria(
            dtoCriteria.filter,
            dtoCriteria.relationship,
            dtoCriteria.limit,
            dtoCriteria.offset,
            order,
            tablename
        );

        const result = await this.#repository.searchForAdminActiveWorkspaces(criteria, statusOrder);
        const counter = await this.#counter.executeForAdminSearch(dtoCriteria);

        return new InteractionCollectionResponse(result, counter.count);
    }

    /**
     * Splits an order on the derived `status` field away from the regular order so
     * the generic Criteria never receives a non-existent column.
     *
     * @param {object|array|null|undefined} order
     * @returns {{ order: object|array|null, statusOrder: {direction: string}|null }}
     */
    #extractStatusOrder(order) {
        if (Array.isArray(order)) {
            const statusEntry = order.find((entry) => entry?.field === STATUS_ORDER_FIELD);
            if (!statusEntry) {
                return { order, statusOrder: null };
            }
            // Strip the derived `status` entry so Criteria never emits an invalid
            // `ORDER BY status`; remaining (real-column) orders pass through.
            const rest = order.filter((entry) => entry?.field !== STATUS_ORDER_FIELD);
            return {
                order: rest.length ? rest : null,
                statusOrder: { direction: normalizeDirection(statusEntry.direction) },
            };
        }
        if (order && order.field === STATUS_ORDER_FIELD) {
            return { order: null, statusOrder: { direction: normalizeDirection(order.direction) } };
        }
        return { order: order ?? null, statusOrder: null };
    }
}
