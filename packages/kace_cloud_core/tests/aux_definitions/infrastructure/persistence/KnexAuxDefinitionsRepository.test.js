import { v4 as uuidv4 } from 'uuid';
import { knexConfig } from '../../../knexfile.js';
import { KnexAuxDefinitionsRepository } from '../../../../src/aux_definitions/infrastructure/persitance/KnexAuxDefinitionsRepository.js';
import { AuxDefinitionsMother } from '../../domain/AuxDefinitionsMother.js';
import { AuxDefinition } from '../../../../src/aux_definitions/domain/AuxDefinition.js';

describe('KnexAuxDefinitionsRepository', () => {
    const repository = new KnexAuxDefinitionsRepository(knexConfig);

    it('guarda y recupera una AuxDefinition', async () => {
        const dto = AuxDefinitionsMother.dto();
        // La factoria solo arma el dto: quien inserta es el test, asi que el
        // schema y el restflow que inventa hay que respaldarlos aqui.
        await AuxDefinitionsMother.ensureRelations(repository.connection, dto);
        const auxDefinition = AuxDefinition.create(dto);

        await repository.save(auxDefinition);

        const result = await repository.find(auxDefinition.id);

        expect(result).toBeInstanceOf(AuxDefinition);
        expect(result.id.value).toBe(auxDefinition.id.value);
        expect(result.tablename.value).toBe(auxDefinition.tablename.value);
    });

    it('devuelve null si no encuentra el registro', async () => {
        const result = await repository.find({ value: uuidv4() });
        expect(result).toBeNull();
    });

    it('busca AuxDefinitions con search', async () => {
        // Insertar varios registros
        for (let i = 0; i < 3; i++) {
            const dto = AuxDefinitionsMother.dto();
            await AuxDefinitionsMother.ensureRelations(repository.connection, dto);
            const auxDefinition = AuxDefinition.create(dto);
            await repository.save(auxDefinition);
        }
        // Mock de criteria con convertToKnex
        const criteria = {
            convertToKnex: (query) => query.limit(3),
        };
        const results = await repository.search(criteria);
        expect(Array.isArray(results)).toBe(true);
        expect(results.length).toBeGreaterThanOrEqual(1);
        expect(results[0]).toBeInstanceOf(AuxDefinition);
    });

    it('debería encontrar una AuxDefinition por nombre si existe', async () => {
        const dto = AuxDefinitionsMother.dto();
        await AuxDefinitionsMother.ensureRelations(repository.connection, dto);
        const auxDefinition = AuxDefinition.create(dto);

        await repository.save(auxDefinition);

        const result = await repository.findByName(auxDefinition.name);
        expect(result).toBeInstanceOf(AuxDefinition);
        expect(result.name.value).toBe(auxDefinition.name.value);
    });

    it('debería retornar null si no existe una AuxDefinition con ese nombre', async () => {
        const result = await repository.findByName({ value: 'nombre_inexistente' });
        expect(result).toBeNull();
    });

    it('debería retornar null si el registro está eliminado lógicamente', async () => {
        const dto = AuxDefinitionsMother.dto();
        await AuxDefinitionsMother.ensureRelations(repository.connection, dto);
        dto.deleted_at = new Date().toISOString();
        const auxDefinition = AuxDefinition.create(dto);

        await repository.save(auxDefinition);

        const result = await repository.findByName(auxDefinition.name);
        expect(result).toBeNull();
    });

    it('No deberia crea la tabla principal si ya existe', async () => {
        const tableName = { value: `main_table_${Date.now()}` };

        await repository.createMainTable(tableName);

        await repository.createMainTable(tableName);

        const exists = await repository.connection.schema.hasTable(tableName.value);
        expect(exists).toBe(true);

        const columns = await repository.connection(tableName.value).columnInfo();
        expect(columns).toHaveProperty('id');
        expect(columns).toHaveProperty('data');
        expect(columns).toHaveProperty('created_at');
        expect(columns).toHaveProperty('updated_at');
        expect(columns).toHaveProperty('deleted_at');
        expect(columns).toHaveProperty('created_by');
        expect(columns).toHaveProperty('updated_by');
        expect(columns).toHaveProperty('deleted_by');
    });

    it('Deberia crea una tabla de logs si no existe', async () => {
        const logsTable = { value: `logs_table_${Date.now()}` };

        await repository.createHistoryTable(logsTable);

        const exists = await repository.connection.schema.hasTable(logsTable.value);
        expect(exists).toBe(true);
    });

    it('No deberia crea la tabla de logs si ya existe', async () => {
        const logsTable = { value: `logs_table_${Date.now()}` };

        await repository.createHistoryTable(logsTable);

        await repository.createHistoryTable(logsTable);

        const exists = await repository.connection.schema.hasTable(logsTable.value);
        expect(exists).toBe(true);

        const columns = await repository.connection(logsTable.value).columnInfo();
        expect(columns).toHaveProperty('id');
        expect(columns).toHaveProperty('entity_id');
        expect(columns).toHaveProperty('changed_attributes');
        expect(columns).toHaveProperty('created_at');
    });

    it('Deberia crear tablas main y logs con createTables', async () => {
        const dto = AuxDefinitionsMother.dto();
        const auxDefinition = AuxDefinition.create(dto);

        await repository.createTables(auxDefinition);

        const existsMain = await repository.connection.schema.hasTable(auxDefinition.tablename.value);
        const existsLogs = await repository.connection.schema.hasTable(auxDefinition.logs_tablename.value);

        expect(existsMain).toBe(true);
        expect(existsLogs).toBe(true);
    });
});
