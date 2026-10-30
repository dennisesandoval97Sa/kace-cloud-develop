import { KnexRepository } from '../../../shared/infrastructure/persistence/KnexRepository.js';
import { Helper } from '../../../shared/infrastructure/utils/Helper.js';

export class KnexExportsRepository extends KnexRepository {
    constructor(config, readerConfig = null) {
        super(config, null, readerConfig);
    }

    /**
     * Obtiene los datos de una tabla específica con opción de seleccionar columnas.
     * @param {string} tableName - Nombre de la tabla a exportar.
     * @param {string[]} [headers] - Columnas específicas a incluir (opcional).
     * @returns {Promise<Array<Object>>} Lista de registros.
     */
    async getData(tableName, headers = [], criteria) {
        try {
            const query = this.read.table(tableName).select(headers.length ? headers : '*');
            if (criteria) criteria.convertToKnex(query);
            const result = await query;
            return result;
        } catch (error) {
            Helper.logInfo(`Error obteniendo datos de la tabla ${tableName}:`, error);
            throw new Error(`Error obteniendo datos de la tabla ${tableName}`);
        }
    }

    /**
     * Obtiene los grupos de una lista de usuarios en un solo query.
     * @param {string[]} userIds
     * @returns {Promise<Map<string, string[]>>} mapa usuario_id -> [grupo_id, ...]
     */
    async getUserGroupLinks(userIds = []) {
        try {
            if (!Array.isArray(userIds) || userIds.length === 0) return [];
            return await this.read
                .table('rel_usuarios_grupos')
                .select('usuario_id', 'grupo_id')
                .whereIn('usuario_id', userIds);
        } catch (error) {
            Helper.logInfo('Error obteniendo grupos por usuarios:', error);
            throw new Error('No se pudieron obtener los grupos de los usuarios');
        }
    }
}
