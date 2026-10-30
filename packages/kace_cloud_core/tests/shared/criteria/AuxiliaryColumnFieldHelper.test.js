import { AuxiliaryColumnFieldHelper } from '../../../src/shared/criteria/AuxiliaryColumnFieldHelper';
import { AUX_SPECIALIZED_FK } from '../../../src/auxiliaries/domain/AuxFkMapping';

describe('AuxiliaryColumnFieldHelper - isColumnField', () => {
    it('should return false when field is null or undefined', () => {
        expect(AuxiliaryColumnFieldHelper.isColumnField(null)).toBe(false);
        expect(AuxiliaryColumnFieldHelper.isColumnField(undefined)).toBe(false);
    });

    it('should return false when field is not a string', () => {
        expect(AuxiliaryColumnFieldHelper.isColumnField(123)).toBe(false);
        expect(AuxiliaryColumnFieldHelper.isColumnField({})).toBe(false);
        expect(AuxiliaryColumnFieldHelper.isColumnField([])).toBe(false);
    });

    it('should return false for empty string', () => {
        expect(AuxiliaryColumnFieldHelper.isColumnField('')).toBe(false);
    });

    it('should return true for hardcoded system column fields', () => {
        expect(AuxiliaryColumnFieldHelper.isColumnField('id')).toBe(true);
        expect(AuxiliaryColumnFieldHelper.isColumnField('created_at')).toBe(true);
        expect(AuxiliaryColumnFieldHelper.isColumnField('updated_at')).toBe(true);
        expect(AuxiliaryColumnFieldHelper.isColumnField('deleted_at')).toBe(true);
        expect(AuxiliaryColumnFieldHelper.isColumnField('created_by')).toBe(true);
        expect(AuxiliaryColumnFieldHelper.isColumnField('updated_by')).toBe(true);
        expect(AuxiliaryColumnFieldHelper.isColumnField('deleted_by')).toBe(true);
    });

    it('should return true for fields ending with _extracted', () => {
        expect(AuxiliaryColumnFieldHelper.isColumnField('type_extracted')).toBe(true);
        expect(AuxiliaryColumnFieldHelper.isColumnField('value_extracted')).toBe(true);
        expect(AuxiliaryColumnFieldHelper.isColumnField('name_extracted')).toBe(true);
        expect(AuxiliaryColumnFieldHelper.isColumnField('any_thing_extracted')).toBe(true);
    });

    it('should return false for fields that contain but do not end with _extracted', () => {
        expect(AuxiliaryColumnFieldHelper.isColumnField('extracted_value')).toBe(false);
        expect(AuxiliaryColumnFieldHelper.isColumnField('_extracted_more')).toBe(false);
    });

    it('should return false for unknown JSON-key style fields', () => {
        expect(AuxiliaryColumnFieldHelper.isColumnField('type')).toBe(false);
        expect(AuxiliaryColumnFieldHelper.isColumnField('value')).toBe(false);
        expect(AuxiliaryColumnFieldHelper.isColumnField('foo')).toBe(false);
        expect(AuxiliaryColumnFieldHelper.isColumnField('data')).toBe(false);
    });

    it('reconoce caso_id como columna de aux_cases y de su alias', () => {
        expect(AuxiliaryColumnFieldHelper.isColumnField('caso_id', 'aux_cases')).toBe(true);
        expect(AuxiliaryColumnFieldHelper.isColumnField('caso_id', 'case_auxiliar')).toBe(true);
    });

    it('reconoce cliente_id como columna de aux_clients y de su alias', () => {
        expect(AuxiliaryColumnFieldHelper.isColumnField('cliente_id', 'aux_clients')).toBe(true);
        expect(AuxiliaryColumnFieldHelper.isColumnField('cliente_id', 'clients_auxiliar')).toBe(true);
    });

    it('no trata caso_id como columna en una tabla auxiliar definida por el usuario', () => {
        // createMainTable solo crea id, data y las columnas de auditoria: ahi caso_id, si
        // existe, es una clave del JSON.
        expect(AuxiliaryColumnFieldHelper.isColumnField('caso_id', 'aux_proveedores')).toBe(false);
        expect(AuxiliaryColumnFieldHelper.isColumnField('cliente_id', 'aux_proveedores')).toBe(false);
    });

    it('sin tabla, mantiene el comportamiento anterior para las FK especializadas', () => {
        expect(AuxiliaryColumnFieldHelper.isColumnField('caso_id')).toBe(false);
        expect(AuxiliaryColumnFieldHelper.isColumnField('cliente_id')).toBe(false);
    });
});

describe('AuxiliaryColumnFieldHelper.SPECIALIZED_COLUMN_FIELDS vs AuxFkMapping.AUX_SPECIALIZED_FK', () => {
    // Este conocimiento -que tabla auxiliar tiene que FK fisica- vive por duplicado: aqui como
    // "columna vs clave JSON" y en AuxFkMapping como "a que tabla dueña apunta". Ambos mapas
    // deberian coincidir en las tablas que comparten para no repetir el defecto que origino esta
    // rama (un mapeo desincronizado del esquema real).
    it('coincide en el fkColumn de cada tabla que ambos mapas conocen', () => {
        const sharedTables = Object.keys(AUX_SPECIALIZED_FK).filter(
            (table) => table in AuxiliaryColumnFieldHelper.SPECIALIZED_COLUMN_FIELDS
        );

        // Si esto llega a 0, el test de arriba deja de proteger nada: las tablas se
        // desalinearon silenciosamente (por ejemplo, si alguien renombra una de las claves).
        expect(sharedTables).toEqual(expect.arrayContaining(['aux_cases', 'aux_clients']));

        for (const table of sharedTables) {
            expect(AuxiliaryColumnFieldHelper.SPECIALIZED_COLUMN_FIELDS[table]).toBe(
                AUX_SPECIALIZED_FK[table].fkColumn
            );
        }
    });
});
