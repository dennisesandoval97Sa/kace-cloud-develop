export class AuxiliaryColumnFieldHelper {
    static COLUMN_FIELDS = ['id', 'created_at', 'updated_at', 'deleted_at', 'created_by', 'updated_by', 'deleted_by'];

    /**
     * Columnas fisicas que solo tienen las dos tablas auxiliares especializadas, creadas por
     * migracion (20240918191116 y 20240918191125). Las tablas auxiliares que crea
     * AuxDefinitionCreator.createMainTable llevan unicamente id, data y las de auditoria, asi
     * que ahi un `caso_id` seria una clave del JSON, no una columna.
     *
     * Mismo conocimiento que `AUX_SPECIALIZED_FK` en
     * `src/auxiliaries/domain/AuxFkMapping.js` (no se importa desde aqui para no invertir la
     * capa shared -> auxiliaries). `tests/shared/criteria/AuxiliaryColumnFieldHelper.test.js`
     * verifica que ambos mapas coincidan en las tablas que comparten.
     */
    static SPECIALIZED_COLUMN_FIELDS = {
        aux_cases: 'caso_id',
        case_auxiliar: 'caso_id',
        aux_clients: 'cliente_id',
        clients_auxiliar: 'cliente_id',
    };

    /**
     * Determines if a field is a physical column (not JSON).
     *
     * @param {string} field
     * @param {string} [table] - tabla o alias del auxiliar. Sin el, las FK a la entidad duena
     *   no se reconocen: son columnas en aux_cases/aux_clients y claves JSON en el resto.
     * @returns {boolean}
     */
    static isColumnField(field, table = null) {
        if (!field || typeof field !== 'string') return false;
        if (this.COLUMN_FIELDS.includes(field)) return true;
        if (table && this.SPECIALIZED_COLUMN_FIELDS[table] === field) return true;
        return field.endsWith('_extracted');
    }
}
