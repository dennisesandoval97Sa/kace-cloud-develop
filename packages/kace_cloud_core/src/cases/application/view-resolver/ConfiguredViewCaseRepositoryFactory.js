import { KnexViewCaseRepository } from '../../infrastructure/persistence/KnexViewCaseRepository.js';
import { CaseViewNameResolver } from './CaseViewNameResolver.js';
import { CASES_DEFAULT_VIEW } from '../../constants.js';

const MATVIEW_DEFAULT_PREFIX = 'mv_dashboard';

/**
 * Application factory that builds a cases view repository pointing to the view
 * configured for the tenant (custom_view_name) with fallback resolution.
 *
 * Encapsulates the orchestration "resolve configured view name -> build repository"
 * so the interface layer (controllers) only needs to provide the global config.
 *
 * MV prefix existence is verified lazily by KnexViewCaseRepository on first use,
 * avoiding a DB round-trip on every repository instantiation.
 */
export class ConfiguredViewCaseRepositoryFactory {
    /** @type {import('knex').Knex} */
    #connection;
    /** @type {import('knex').Knex.Config|null} */
    #knexConfig;
    /** @type {import('knex').Knex.Config|null} */
    #readerConfig;

    /**
     * @param {import('knex').Knex} connection - writer connection, used for view-name resolution
     * @param {{ knexConfig?: import('knex').Knex.Config, readerConfig?: import('knex').Knex.Config }} [options]
     *   When knexConfig is provided, the repository is built from configs (enabling a real reader pool).
     *   When omitted, the repository is built from `connection` (back-compat; reader aliases writer).
     */
    constructor(connection, options = {}) {
        this.#connection = connection;
        this.#knexConfig = options.knexConfig ?? null;
        this.#readerConfig = options.readerConfig ?? null;
    }

    /**
     * @param {import('../../../global-config/domain/GlobalConfigurations').GlobalConfigurations} globalConfig
     * @returns {Promise<KnexViewCaseRepository>}
     * @throws {CustomError} when no valid view is available in the database
     */
    async create(globalConfig) {
        const viewName = await new CaseViewNameResolver(this.#connection).resolve(globalConfig);
        const matviewPrefix = viewName === CASES_DEFAULT_VIEW ? MATVIEW_DEFAULT_PREFIX : `mv_${viewName}`;
        if (this.#knexConfig) {
            return new KnexViewCaseRepository(this.#knexConfig, viewName, this.#readerConfig, matviewPrefix);
        }
        return new KnexViewCaseRepository(this.#connection, viewName, null, matviewPrefix);
    }
}
