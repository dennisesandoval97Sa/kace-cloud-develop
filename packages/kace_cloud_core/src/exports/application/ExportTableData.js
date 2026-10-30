import { ValidationFailError } from '../../shared';
import { ExportUsersTableData } from './ExportUsersTableData';
import { ExportAuxTableData } from './ExportAuxTableData';

export class ExportTableData {
    /** @type {KnexExportsRepository} is initialized in the constructor */
    #repository;

    constructor(repository) {
        this.#repository = repository;
    }

    /**
     * Ejecuta la exportación de una tabla específica a un archivo CSV.
     * @param {string} tableName - Nombre de la tabla a exportar.
     * @param {string[]} [headers] - Columnas específicas a incluir en la exportación (opcional).
     * @returns {Promise<{ downloadUrl: string }>} URL de descarga del archivo exportado.
     */
    async execute({ tableName, headers = [], criteria }) {
        if (tableName.toLowerCase().includes('history')) {
            throw new ValidationFailError(`Exporting data from "${tableName}" is not allowed.`, 'tableName');
        }
        if (tableName === 'usuarios') {
            return await new ExportUsersTableData(this.#repository).execute({ tableName, headers, criteria });
        }

        if (tableName.startsWith('aux_')) {
            return await new ExportAuxTableData(this.#repository).execute({
                tableName,
                headers,
                criteria,
            });
        }

        throw new ValidationFailError(`Exporting data from "${tableName}" is not allowed.`, 'tableName');
    }
}
