import { Criteria, ValidationFailError } from '../../shared';
import { CSVStorage } from '../domain/CSVStorage';
import flattenExternalCodes from '../../shared/domain/utilities/processExternalCodes';

export class ExportUsersTableData {
    /** @type {KnexExportsRepository} is initialized in the constructor */
    #repository;
    /** @type {CSVStorage} is initialized in the constructor */
    #storage;

    constructor(repository) {
        this.#repository = repository;
        this.#storage = new CSVStorage();
    }

    /**
     * Ejecuta la exportación de usuarios a un archivo CSV.
     * @param {string} tableName - Nombre de la tabla a exportar.
     * @param {string[]} [headers] - Columnas específicas a incluir.
     * @returns {Promise<{ downloadUrl: string }>}
     */
    async execute({ tableName, headers = [], criteria }) {
        if (tableName.toLowerCase().includes('history')) {
            throw new ValidationFailError(`Exporting data from "${tableName}" is not allowed.`, 'tableName');
        }

        const forbiddenHeaders = [
            '*',
            'token',
            'session_id',
            'grid',
            'deleted_at',
            'deleted_by',
            'filters',
            'cognito_hash_data',
            'refresh_token',
            'data',
            'ips_allowed',
            'cognito_id_token',
            'cognito_id_token_cached_at',
        ];

        if (headers.includes('*')) {
            throw new ValidationFailError(
                'No se permite exportar todas las columnas (*) para usuarios. Debes especificar columnas válidas.',
                'headers'
            );
        }

        const originalHeaders = [...headers];
        headers = headers.filter((h) => !forbiddenHeaders.includes(h));

        if (headers.length === 0) {
            throw new ValidationFailError(
                `No quedan columnas válidas para exportar. Los campos enviados eran inválidos: ${originalHeaders.join(', ')}`,
                'headers'
            );
        }

        if (!criteria) {
            criteria = {
                limit: 0,
                offset: 0,
            };
        }

        const baseFilter = Array.isArray(criteria.filter) ? [...criteria.filter] : [];

        baseFilter.push({
            field: 'deleted_at',
            operator: 'null',
            value: 'null',
            type: 'AND',
        });

        criteria = {
            ...criteria,
            filter: baseFilter,
        };

        const wantsGroups = tableName === 'usuarios' && headers?.includes('grupos');
        const headersForSelect = wantsGroups ? headers.filter((h) => h !== 'grupos') : headers;

        const agregateCriteria = new Criteria(
            criteria.filter,
            criteria.relationships,
            criteria.limit,
            criteria.offset,
            criteria.order,
            tableName
        );

        const data = await this.#repository.getData(tableName, headersForSelect, agregateCriteria);

        if (!data || data.length === 0) {
            throw new ValidationFailError(
                `No se encontraron registros en "${tableName}" que coincidan con el criterio de búsqueda.`,
                'criteria'
            );
        }

        let finalData = data;

        if (wantsGroups) {
            const userIds = data.map((row) => row.id).filter(Boolean);

            const rows = await this.#repository.getUserGroupLinks(userIds);

            const groupsMap = new Map();
            for (const r of rows) {
                if (!groupsMap.has(r.usuario_id)) groupsMap.set(r.usuario_id, []);
                groupsMap.get(r.usuario_id).push(String(r.grupo_id));
            }

            finalData = data.map((row) => ({
                ...row,
                grupos: (groupsMap.get(row.id) || []).join(','),
            }));
        }

        const wantsCodigosExternos = headers?.includes('codigos_externos');

        if (wantsCodigosExternos) {
            finalData = finalData.map((row) => ({
                ...row,
                codigos_externos: flattenExternalCodes(row.codigos_externos),
            }));
        }

        const fileUrl = await this.#storage.save(tableName, finalData);
        const downloadUrl = await this.#storage.getDownloadUrl(fileUrl);

        return { downloadUrl };
    }
}
