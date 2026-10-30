export class usersCsvFileStructureValidator {
    static #ALLOWED_COLUMNS = new Set([
        'id',
        'nombres',
        'apellido1',
        'apellido2',
        'email',
        'telefono',
        'movil',
        'is_active',
        'rol_id',
        'codigos_externos',
        'external_id',
        'grupos',
    ]);

    /**
     * Valida un conjunto de registros CSV.
     * @param {Array<Object>} csvContent - Datos del CSV en formato de objetos.
     * @returns {boolean|string} - true si no hay errores, o un string con los errores.
     */
    static execute(csvContent) {
        let errors = [];

        for (const record of csvContent) {
            if (!record.id) {
                errors.push(`Archivo inválido: el campo "id" es requerido`);
            }
            const invalidColumns = Object.keys(record).filter((column) => !this.#ALLOWED_COLUMNS.has(column));

            if (invalidColumns.length > 0 && record.id) {
                invalidColumns.forEach((col) => {
                    errors.push(`registro con id:${record.id} presenta la siguiente columna invalida:${col}`);
                });
            }

            if (errors.length >= 20) break;
        }

        return errors;
    }
}
