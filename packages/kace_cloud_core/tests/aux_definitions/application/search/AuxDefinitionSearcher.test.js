import { AuxDefinitionsMother } from '../../domain/AuxDefinitionsMother.js';
import { AuxDefinition } from '../../../../src/aux_definitions/domain/AuxDefinition.js';
import { AuxDefinitionSearcher } from '../../../../src/aux_definitions/application/search/AuxDefinitionSearcher.js';
import { KnexAuxDefinitionsRepository } from '../../../../src/aux_definitions/infrastructure/persitance/KnexAuxDefinitionsRepository.js';
import { knexConfig } from '../../../knexfile.js';

describe('AuxDefinitionSearcher (integración)', () => {
    const repository = new KnexAuxDefinitionsRepository(knexConfig);
    const searcher = new AuxDefinitionSearcher(repository);

    // La semilla del tenant ya deja dos `aux_definitions` activas y sin borrar
    // (`aux_cases` y `aux_clients`), y los `it` de este archivo comparten base.
    // Contar "todo lo activo" mezclaria esas filas con las del test, asi que
    // cada busqueda se acota por `tablename`.
    const TABLENAME_DEL_TEST = 'aux_test_table';
    const TABLENAME_SIN_FILAS = 'aux_tabla_sin_coincidencias';

    /**
     * `AuxDefinitionsMother.create` solo construye el agregado; quien inserta
     * es el test. Postgres exige que existan las filas de `schemas` y
     * `ws_rest_flows` que la factoria inventa, asi que el guardado pasa por
     * aqui para respaldarlas antes.
     *
     * @param {Object} overrides
     * @returns {Promise<void>}
     */
    const saveAuxDefinition = async (overrides) => {
        const dto = AuxDefinitionsMother.dto({ tablename: TABLENAME_DEL_TEST, ...overrides });
        await AuxDefinitionsMother.ensureRelations(repository.connection, dto);
        await repository.save(AuxDefinition.create(dto));
    };

    /**
     * @param {string} tablename
     * @returns {Object} payload de busqueda de definiciones activas y vivas
     */
    const payloadActivas = (tablename) => ({
        filter: [
            { field: 'tablename', operator: 'eq', value: tablename, type: 'AND' },
            { field: 'is_active', operator: 'eq', value: true, type: 'AND' },
            { field: 'deleted_at', operator: 'null', value: 'null', type: 'AND' },
        ],
        order: { field: 'created_at', direction: 'desc' },
        limit: 100,
        offset: 0,
    });

    it('debería retornar solo registros activos y no eliminados según el payload', async () => {
        // Guardar registros activos y no eliminados
        const activos = [
            { is_active: true, deleted_at: null },
            { is_active: true, deleted_at: null },
        ];
        for (const overrides of activos) {
            await saveAuxDefinition(overrides);
        }
        // Guardar registros inactivos o eliminados
        const inactivos = [
            { is_active: false, deleted_at: null },
            { is_active: true, deleted_at: new Date() },
        ];
        for (const overrides of inactivos) {
            await saveAuxDefinition(overrides);
        }

        const response = await searcher.execute(payloadActivas(TABLENAME_DEL_TEST));
        const items = response.toJson().data.items;
        expect(Array.isArray(items)).toBe(true);
        expect(items.length).toBe(activos.length);
        items.forEach((item) => {
            // `is_active` es `boolean` en postgres, no un entero.
            expect(item.is_active).toBe(true);
            expect(item.deleted_at).toBeNull();
        });
    });

    it('debería retornar una colección vacía si no hay coincidencias', async () => {
        // No hay ninguna definicion guardada con esta tabla.
        const response = await searcher.execute(payloadActivas(TABLENAME_SIN_FILAS));
        const items = response.toJson().data.items;
        expect(Array.isArray(items)).toBe(true);
        expect(items.length).toBe(0);
    });
});
