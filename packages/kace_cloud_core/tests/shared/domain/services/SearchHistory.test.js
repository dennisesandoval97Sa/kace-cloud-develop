import { SearchHistory } from '../../../../src/shared/domain/services/SearchHistory.js';
import { SchemaCreator } from '../../../../src/schemas/application/create/SchemaCreator.js';
import { KnexSchemasRepository } from '../../../../src/schemas/infrastructure/persistence/KnexSchemasRepository.js';
import { SchemasMother } from '../../../schemas/domain/SchemasMother.js';
import { v4 as uuidv4 } from 'uuid';
import CasesMother from '../../../cases/domain/CasesMother.js';
import { KnexCaseRepository } from '../../../../src/cases/index.js';
import { AuxCasesMother } from '../../../aux_casos/domain/AuxCasesMother.js';
import { AuxCasesCreator, KnexAuxCasesRepository } from '../../../../src/aux_casos/index.js';
import { knexConfig } from '../../../knexfile.js';
import TestHelper from '../../../TestHelper.js';

describe('SearchHistory (integración con Schemas)', () => {
    const repository = new KnexSchemasRepository(knexConfig);
    const caseRepository = new KnexCaseRepository(repository.connection);
    const auxCaseRepository = new KnexAuxCasesRepository(repository.connection);

    beforeEach(async () => {
        await repository.connection.schema.dropTableIfExists('aux_proveedores');
        await repository.connection.schema.createTable('aux_proveedores', (table) => {
            table.string('id', 36).primary();
            table.jsonb('data').notNullable();
            table.timestamp('created_at');
            table.timestamp('updated_at');
            table.timestamp('deleted_at').nullable();
            table.string('created_by', 36);
            table.string('updated_by', 36);
            table.string('deleted_by', 36);
        });
    });

    afterEach(async () => {});

    it('debería devolver los históricos de un Schema', async () => {
        const searchHistoryService = new SearchHistory(repository);
        const creator = new SchemaCreator(repository);
        const dto = SchemasMother.dto();
        await creator.execute(dto);

        const dtoCriteria = { filter: null, relationship: null, limit: 10, offset: 0, order: null };
        const result = await searchHistoryService.execute(dto.id, dtoCriteria);

        expect(result.data.items.length).toBeGreaterThan(0);
        expect(result.data.items[0].entity_id).toBe(dto.id);
        expect(result.metadata.count).toBeGreaterThan(0);
    });

    it('debería devolver vacío si el Schema no tiene históricos', async () => {
        const searchHistoryService = new SearchHistory(repository);
        const nonExistentId = uuidv4();
        const dtoCriteria = { filter: null, relationship: null, limit: 10, offset: 0, order: null };

        const result = await searchHistoryService.execute(nonExistentId, dtoCriteria);

        expect(result.data.items).toEqual([]);
        expect(result.metadata.count).toBe(0);
    });

    it('debería respetar el parámetro limit', async () => {
        const searchHistoryService = new SearchHistory(repository);
        const creator = new SchemaCreator(repository);
        const dto1 = SchemasMother.dto();
        const dto2 = SchemasMother.dto();

        await creator.execute(dto1);
        await creator.execute(dto2);
        const dtoCriteria = { filter: null, relationship: null, limit: 1, offset: 0, order: null };
        const result = await searchHistoryService.execute(dto1.id, dtoCriteria);

        expect(result.data.items.length).toBeLessThanOrEqual(1);
        expect(result.metadata.count).toBeGreaterThanOrEqual(result.data.items.length);
    });

    it('debería devolver error si el id no es un UUID válido', async () => {
        const searchHistoryService = new SearchHistory(repository);
        const dtoCriteria = { filter: null, relationship: null, limit: 10, offset: 0, order: null };

        await expect(searchHistoryService.execute('no-uuid', dtoCriteria)).rejects.toThrow();
    });

    it('debería manejar correctamente históricos con atributos JSON complejos', async () => {
        const searchHistoryService = new SearchHistory(repository);
        const creator = new SchemaCreator(repository);
        const dto = SchemasMother.dto();

        await creator.execute(dto);
        const dtoCriteria = { filter: null, relationship: null, limit: 10, offset: 0, order: null };
        const result = await searchHistoryService.execute(dto.id, dtoCriteria);

        if (result.data.items.length > 0) {
            expect(result.data.items[0].new_attributes?.data_structure?.campo1).toEqual(dto.data_structure.campo1);
        }
    });

    it('debería devolver los históricos de aux_caso', async () => {
        const kase = await CasesMother.createCaseWithRelations(caseRepository);
        await caseRepository.connection('aux_cases').where({ caso_id: kase.id.value }).del();
        const auxCaseCreator = new AuxCasesCreator(auxCaseRepository);
        await auxCaseCreator.execute(AuxCasesMother.dto({ caso_id: kase.id.value }));

        const searchHistoryService = new SearchHistory(auxCaseRepository);
        const dtoCriteria = { filter: null, relationship: null, limit: 10, offset: 0, order: null };
        const result = await searchHistoryService.execute(kase.id.value, dtoCriteria);

        expect(result.data.items.length).toBe(1);
        expect(result.data.items[0].entity_id).toBe(kase.id.value);
        expect(result.metadata.count).toBe(1);
    });

    it('debería devolver creator_name con el nombre completo del usuario cuando created_by existe en usuarios', async () => {
        const roleId = uuidv4();
        const userId = uuidv4();
        await repository.connection.withSchema(knexConfig.config.schema).table('roles').insert({
            id: roleId,
            descripcion: 'Test role',
            status: 1,
        });
        await repository.connection
            .withSchema(knexConfig.config.schema)
            .table('usuarios')
            .insert({
                id: userId,
                nombres: 'María',
                apellido1: 'García',
                apellido2: 'López',
                rol_id: roleId,
                login: `user_${userId.substring(0, 8)}`,
                is_active: 1,
            });

        const searchHistoryService = new SearchHistory(repository);
        const creator = new SchemaCreator(repository);
        const dto = SchemasMother.dto({ created_by: userId, updated_by: userId });
        await creator.execute(dto);

        const dtoCriteria = { filter: null, relationship: null, limit: 10, offset: 0, order: null };
        const result = await searchHistoryService.execute(dto.id, dtoCriteria);

        expect(result.data.items.length).toBeGreaterThan(0);
        expect(result.data.items[0]).toHaveProperty('creator_name');
        expect(result.data.items[0].creator_name.trim()).toBe('María García López');
    });
});
