import { Criteria } from '../../criteria/Criteria.js';
import { EventLogger } from '../../EventLogger.js';
import { ValidationFailError } from '../../errors/ValidationFailError.js';

export class AdvancedSearch {
    /** @type {KnexUsersRepository} is initialized in the constructor */
    #repository;

    /**
     * Creates an instance of the `AdvancedSearch` class.
     *
     * @param {KnexUsersRepository} repository - An instance of the repository that manages user records.
     */
    constructor(repository) {
        this.#repository = repository;
        this.eventLogger = new EventLogger(repository);
    }

    /**
     * Searches for users based on the provided criteria.
     *
     * @param {Object} dtoCriteria - The criteria for searching users. This object should include:
     *   - `filter`: An object specifying the filter conditions.
     *   - `relationship`: An object specifying relationships to include in the search results.
     *   - `limit`: The maximum number of records to return.
     *   - `offset`: The number of records to skip before starting to collect results.
     *   - `order`: An object specifying the sorting order of the results.
     * @return {Promise<UserCollectionResponse>} A promise that resolves to an instance of `UserCollectionResponse` containing the search results.
     */
    async execute(dtoCriteria, tableName) {
        const tablename = tableName ?? this.#repository.tableName;

        if (!tablename || tablename === '') {
            throw new ValidationFailError('table name is required in advance search', 'tableName');
        }

        const tables = await this.#repository.getSchemaTables();

        const tableEQ = this.#getTableEquivalence(tablename, tables);

        if (!tableEQ || tableEQ === null) {
            throw new ValidationFailError('table doesnt have a database equivalence', 'tableName');
        }

        const criteria = new Criteria(
            dtoCriteria.filter,
            dtoCriteria.relationship,
            dtoCriteria.limit,
            dtoCriteria.offset,
            dtoCriteria.order,
            tableEQ,
            dtoCriteria.select,
            dtoCriteria.group_by,
            dtoCriteria.having,
            dtoCriteria.distinct
        );
        const rows = await this.#repository.advancedSearch(criteria, tableEQ);

        const criteriaCount = new Criteria(
            dtoCriteria.filter,
            dtoCriteria.relationship,
            0,
            0,
            undefined,
            tableEQ,
            dtoCriteria.select,
            dtoCriteria.group_by,
            dtoCriteria.having,
            dtoCriteria.distinct
        );
        const count = await this.#repository.advancedCount(criteriaCount, tableEQ);

        const countResult = Number(count?.count ?? count?.['count(*)'] ?? 0);

        return {
            data: {
                items: rows,
            },
            metadata: {
                count: countResult,
            },
        };
    }

    /**
     * Encuentra la tabla equivalente en base de datos para un path dado.
     * Mezcla equivalencias manuales y detección dinámica basada en similitud textual.
     *
     * @param {string} pathName - Nombre del path (por ejemplo: "users", "cases", "clients")
     * @param {string[]} tables - Lista de tablas disponibles en el esquema (de getSchemaTables()).
     * @returns {string|null} Nombre de la tabla equivalente o null si no se encuentra.
     */

    #getTableEquivalence(pathName, tables = []) {
        if (!pathName || !Array.isArray(tables) || tables.length === 0) {
            return null;
        }

        const MANUAL_EQUIVALENCES = {
            users: 'usuarios',
            comments: 'comentarios',
            cases: 'cases',
            clients: 'clients',
            roles: 'roles',
            banners: 'banners',
            'helps-attachments': 'helps_attachments',
            'global-configurations': 'global_configurations',
            actions: 'actions',
            'action-batch-executions': 'action_jobs',
            'action-update-model': 'action_model_updates',
            'actions-queue-executions': 'actions_queue_executions',
            'actions-queue-executor': 'action_job_processing',
            agendas: 'agendas',
            'agendas-groups': 'agendas_groups',
            'allowed-connections': 'allowed_connections',
            ans: 'ans',
            'ans-calculate': 'ans',
            'ans-types': 'ans',
            'appointment-time-slots': 'appointment_time_slots',
            appointments: 'appointments',
            'assignment-users-list': 'lista_usuarios',
            'automation-settings': 'automation_settings',
            auxiliaries: 'usuarios',
            'case-attachments': 'case_attachments',
            'case-available-states': 'estados',
            'case-calculate-ans': 'ans',
            'case-clone': 'cases',
            'case-close': 'cases',
            'case-count': 'cases',
            'case-count-by-group': 'cases',
            'case-count-by-responsable': 'cases',
            'case-descriptions': 'descripciones_casos',
            'case-re-open': 'cases',
            'case-reclassify': 'cases',
            'case-transitions': 'transiciones',
            'classification-group-relationships': 'classification_group_relationships',
            'classification-group-relationships-batch': 'classification_group_relationships',
            'classification-group-relationships-batch-delete': 'classification_group_relationships',
            'classification-template-relations': 'classification_template_relations',
            classifications: 'clasificaciones',
            'classifications-levels': 'clasificaciones',
            'client-contacts': 'clients',
            'client-notifications': 'client_notifications',
            'clients-doc-types': 'clients',
            'cognito-authorization': 'usuarios',
            'download-s3-files': 's3_files',
            exports: 'csv_export_views',
            'fake-cases': 'fake_cases',
            'fake-clients': 'fake_clients',
            'field-list': 'schemas',
            flow: 'flujos',
            'generate-csv': 'csv_export_views',
            geolocation: 'geolocation',
            groups: 'grupos',
            'group-cases-assignment': 'rel_usuarios_grupos',
            'group-lists': 'lista_grupos',
            helps: 'helps',
            imports: 'imports_dashboard',
            'imports-dashboard': 'imports_dashboard',
            'imports-processor': 'imports_dashboard',
            literals: 'literales',
            'mail-accounts': 'mail_accounts',
            'mail-accounts-types': 'mail_accounts',
            'one-script': 'one-script',
            permissions: 'policies',
            's3-files': 's3_files',
            schemas: 'schemas',
            'secrets-vault': 'boveda_secretos',
            'shift-management': 'shift_management',
            states: 'estados',
            'states-distinct': 'estados',
            'template-attachments': 'template_attachments',
            templates: 'plantillas',
            transitions: 'transiciones',
            'upload-s3-files': 's3_files',
            'user-cases-assignment': 'rel_usuarios_grupos',
            'user-group-relations': 'rel_usuarios_grupos',
            'user-notifications': 'user_notifications',
            'ws-hook-rest-flow': 'ws_rest_flows',
            'ws-rest-endpoints': 'ws_rest_endpoints',
            'ws-rest-flows': 'ws_rest_flows',
            'ws-rest-functions': 'ws_rest_functions',
            'ws-rest-steps': 'ws_rest_workflow_steps',
            'event-logs': 'event_logs',
        };

        const manual = MANUAL_EQUIVALENCES[pathName];
        if (manual) return manual;

        const validTables = tables.filter((t) => !t.startsWith('history_') && !t.startsWith('aux_'));

        const normalize = (name) =>
            name
                .toLowerCase()
                .replace(/[-_]/g, '')
                .replace(/(es|s)$/, '');

        const normPath = normalize(pathName);

        let bestTable = null;
        let bestScore = 0;

        for (const table of validTables) {
            const normTable = normalize(table);

            if (normTable === normPath) {
                return table;
            }

            let score = 0;
            for (let i = 0; i < Math.min(normPath.length, normTable.length); i++) {
                if (normPath[i] === normTable[i]) score++;
                else break;
            }

            if (score > bestScore) {
                bestScore = score;
                bestTable = table;
            }
        }

        return bestScore >= 3 ? bestTable : null;
    }
}
