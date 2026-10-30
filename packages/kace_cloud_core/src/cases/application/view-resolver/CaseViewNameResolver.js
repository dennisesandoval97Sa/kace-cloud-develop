import { CustomError, Helper } from '../../../shared/index.js';
import { CASES_DEFAULT_VIEW } from '../../constants.js';

/**
 * Application service responsible for resolving which database view
 * should be used to query cases, based on the group's global configuration.
 *
 * Resolution order:
 *   1. Tenant view from config (custom_view_name, if starts with "view_" and exists in DB)
 *   2. Default view CASES_DEFAULT_VIEW = 'view_case_details' (if it exists in DB)
 *   3. Throws CustomError 500 if neither exists
 */
export class CaseViewNameResolver {
    /** @type {import('knex').Knex} */
    #connection;

    /** @type {string|null} schema extracted from the connection config, e.g. 'asistencia' */
    #schema;

    /**
     * @param {import('knex').Knex} connection - Knex database connection
     */
    constructor(connection) {
        this.#connection = connection;
        // Extract schema from Knex client config (same approach as KnexRepository).
        this.#schema = connection?.client?.config?.schema || null;
    }

    /**
     * Builds the fully-qualified view identifier ("schema.view", or just "view" when no schema is set).
     * @param {string} viewName
     * @returns {string}
     */
    #qualifiedView(viewName) {
        return this.#schema ? `${this.#schema}.${viewName}` : viewName;
    }

    /**
     * Checks whether a view or table exists by attempting a lightweight query against it.
     * This approach works because schema.hasTable() only detects tables, not views.
     * @param {string} viewName
     * @returns {Promise<boolean>}
     * @throws {Error} when the error is not a missing-relation error (e.g. connection failure, timeout)
     */
    async #viewExists(viewName) {
        const qualified = this.#qualifiedView(viewName);
        try {
            Helper.logInfo(`CaseViewNameResolver: checking if view exists -> ${qualified}`);
            await this.#connection.raw(`SELECT 1 FROM ?? LIMIT 1`, [qualified]);
            Helper.logInfo(`CaseViewNameResolver: view exists -> ${qualified}`);
            return true;
        } catch (error) {
            // PostgreSQL error code 42P01 = "undefined_table" (relation does not exist)
            const isRelationNotFound =
                error?.code === '42P01' ||
                error?.message?.includes('no such table') ||
                error?.message?.includes('no such view');

            if (isRelationNotFound) {
                Helper.logInfo(`CaseViewNameResolver: view not found -> ${viewName}`);
                return false;
            }

            Helper.logError(`CaseViewNameResolver: infrastructure error while checking view "${viewName}"`, error);
            throw error;
        }
    }

    /**
     * Resolves the view name to use for querying cases.
     * @param {import('../../../global-config/domain/GlobalConfigurations').GlobalConfigurations} globalConfig
     * @returns {Promise<string>}
     * @throws {CustomError} when no valid view is available in the database
     */
    async resolve(globalConfig) {
        let configuredViewName = null;

        try {
            const casesConfig = globalConfig.settings.layouts.getConfig('admin', 'cases');
            const viewName = casesConfig?.custom_view_name;

            if (viewName && viewName.startsWith('view_')) {
                configuredViewName = viewName;
            }
        } catch (error) {
            Helper.logError('CaseViewNameResolver: could not read cases config from global config', error);
        }

        if (configuredViewName) {
            const exists = await this.#viewExists(configuredViewName);
            if (exists) {
                Helper.logInfo(`CaseViewNameResolver: using custom view -> ${configuredViewName}`);
                return configuredViewName;
            }
            Helper.logInfo(
                `CaseViewNameResolver: custom view "${configuredViewName}" not found, falling back to default`
            );
        }

        const defaultExists = await this.#viewExists(CASES_DEFAULT_VIEW);
        if (defaultExists) {
            Helper.logInfo(`CaseViewNameResolver: using default view -> ${CASES_DEFAULT_VIEW}`);

            return CASES_DEFAULT_VIEW;
        }

        throw new CustomError(
            `No valid cases view found. Configured: "${configuredViewName ?? 'none'}", default: "${CASES_DEFAULT_VIEW}". Neither exists in the database.`,
            500
        );
    }
}
