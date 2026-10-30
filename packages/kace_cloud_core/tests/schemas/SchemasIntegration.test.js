import { SchemasMother } from './domain/SchemasMother.js';
import { KnexSchemasRepository } from '../../src/schemas/infrastructure/persistence/KnexSchemasRepository.js';
import { SchemaCreator } from '../../src/schemas/application/create/SchemaCreator.js';
import { SchemaUpdater } from '../../src/schemas/application/update/SchemaUpdater.js';
import { SchemaFinderService } from '../../src/schemas/application/find/SchemaFinderService.js';
import { SchemaDeleter } from '../../src/schemas/application/delete/SchemaDeleter.js';
import { SchemaSearcher } from '../../src/schemas/application/search/SchemaSearcher.js';
import { SchemaRelationsCountService } from '../../src/schemas/application/relations-count/SchemaRelationsCountService.js';
import { knexConfig } from '../knexfile.js';
import { v4 as uuidv4 } from 'uuid';
import WSRestFlowMother from '../ws-rest-flows/domain/WSRestFlowMother.js';
import { KnexWSRestFlowRepository } from '../../src/ws-rest-flows/infrastructure/persistence/KnexWSRestFlowRepository.js';
import { SchemaRules } from '../../src/schemas/application/rules/SchemaRules.js';
import { SchemaRulesSearcher } from '../../src/schemas/application/rules/SchemaRulesSearcher.js';
import { AuxDefinitionsMother } from '../aux_definitions/domain/AuxDefinitionsMother.js';
import { SchemaFunctionsService } from '../../src/schemas/application/functions/SchemaFunctionsService.js';

describe('Schemas - integración', () => {
    const repository = new KnexSchemasRepository(knexConfig);

    const service = new SchemaFunctionsService();
    const allFuncs = Object.values(service.getAll().data).flat();

    it('crea y guarda un Schema correctamente', async () => {
        const creator = new SchemaCreator(repository);
        const dto = SchemasMother.dto();
        await creator.execute(dto);
        const found = await repository.find({ value: dto.id });
        expect(found).not.toBeNull();
        expect(found.id.value).toBe(dto.id);
    });

    it('lanza validation fail error si el Schema ya existe', async () => {
        const creator = new SchemaCreator(repository);
        const dto = SchemasMother.dto();
        await creator.execute(dto);
        await expect(creator.execute(dto)).rejects.toThrow(`Schema with id ${dto.id} already exists`);
    });

    it('actualiza correctamente un Schema existente', async () => {
        const creator = new SchemaCreator(repository);
        const updater = new SchemaUpdater(repository);

        const dto = SchemasMother.dto();
        await creator.execute(dto);

        const updaterDto = { name: 'nuevo_nombre_schema', is_active: false };
        await updater.execute(updaterDto, dto.id);

        const found = await repository.find({ value: dto.id });
        expect(found).not.toBeNull();
        expect(found.name.value).toBe('nuevo_nombre_schema');
        expect(found.is_active.value).toBe(false);
    });

    it('lanza error al actualizar un Schema inexistente', async () => {
        const updater = new SchemaUpdater(repository);
        const updaterDto = { name: 'nuevo_nombre_schema' };
        const invalidId = uuidv4();
        await expect(updater.execute(updaterDto, invalidId)).rejects.toThrow(
            `Schema with id ${invalidId} does not exist`
        );
    });

    it('elimina correctamente un Schema existente', async () => {
        const creator = new SchemaCreator(repository);
        const deleter = new SchemaDeleter(repository);

        const dto = SchemasMother.dto();
        await creator.execute(dto);

        const deleteDto = { deleted_at: new Date(), deleted_by: uuidv4() };
        await deleter.execute(dto.id, deleteDto);

        const found = await repository.find({ value: dto.id });
        expect(found).not.toBeNull();
        expect(found.deleted_at.value).not.toBeNull();
        expect(found.deleted_by.value).toBe(deleteDto.deleted_by);
    });

    it('lanza error al eliminar un Schema inexistente', async () => {
        const deleter = new SchemaDeleter(repository);
        const deleteDto = { deleted_at: new Date(), deleted_by: uuidv4() };
        const invalidId = uuidv4();
        await expect(deleter.execute(invalidId, deleteDto)).rejects.toThrow(
            `Schema with id ${invalidId} does not exist`
        );
    });

    it('busca un Schema existente', async () => {
        const creator = new SchemaCreator(repository);
        const finder = new SchemaFinderService(repository);
        const dto = SchemasMother.dto();
        await creator.execute(dto);
        const response = await finder.execute(dto.id);
        expect(response.toJson().data.id).toBe(dto.id);
    });

    it('devuelve objeto vacío al buscar un Schema inexistente', async () => {
        const finder = new SchemaFinderService(repository);
        const invalidId = uuidv4();
        const response = await finder.execute(invalidId);
        expect(response.toJson()).toEqual({});
    });

    it('busca una colección de Schemas activos y no eliminados', async () => {
        const searcher = new SchemaSearcher(repository);
        const payload = {
            filter: [
                { field: 'is_active', operator: 'eq', value: 1, type: 'AND' },
                { field: 'deleted_at', operator: 'null', value: 'null', type: 'AND' },
            ],
            order: { field: 'created_at', direction: 'desc' },
            limit: 100,
            offset: 0,
        };

        // La semilla deja schemas auxiliares activos: se mide el incremento.
        const initialItems = (await searcher.execute(payload)).toJson().data.items;

        await SchemasMother.create({ is_active: true, deleted_at: null }, repository);
        await SchemasMother.create({ is_active: true, deleted_at: null }, repository);
        await SchemasMother.create({ is_active: false, deleted_at: null }, repository);
        await SchemasMother.create({ is_active: true, deleted_at: new Date() }, repository);

        const response = await searcher.execute(payload);
        const items = response.toJson().data.items;
        expect(Array.isArray(items)).toBe(true);
        expect(items.length).toBe(initialItems.length + 2);
        items.forEach((item) => {
            // `is_active` es boolean en postgres, no 1.
            expect(item.is_active).toBe(true);
            expect(item.deleted_at).toBeNull();
        });
    });

    it('devuelve colección vacía si no hay coincidencias', async () => {
        const searcher = new SchemaSearcher(repository);
        const payload = {
            // El filtro original (activos y no borrados) casaba con los schemas de
            // la semilla, asi que nunca devolvia vacio.
            filter: [{ field: 'name', operator: 'eq', value: `sin_coincidencias_${uuidv4()}`, type: 'AND' }],
            order: { field: 'created_at', direction: 'desc' },
            limit: 100,
            offset: 0,
        };
        const response = await searcher.execute(payload);
        const items = response.toJson().data.items;
        expect(Array.isArray(items)).toBe(true);
        expect(items.length).toBe(0);
    });

    it('SchemaRulesSearcher devuelve items con data_structure resuelto filtrando por nombre', async () => {
        const creator = new SchemaCreator(repository);
        const uniqueName = `rs_int_${uuidv4()}`;
        const dto = SchemasMother.dto({ name: uniqueName });
        await creator.execute(dto);

        const searcher = new SchemaRulesSearcher(repository);
        const response = await searcher.execute({
            filter: [{ field: 'name', operator: 'eq', value: uniqueName, type: 'AND' }],
            relationship: null,
            limit: 10,
            offset: 0,
            order: { field: 'created_at', direction: 'desc' },
        });

        const json = response.toJson();
        expect(json.data.items.length).toBe(1);
        expect(json.data.items[0].id).toBe(dto.id);
        expect(json.data.items[0].name).toBe(uniqueName);
        expect(json.data.items[0].data_structure).toBeDefined();
        expect(json.data.items[0].data_structure.campo1).toBeDefined();
        expect(Number(json.metadata.count)).toBeGreaterThanOrEqual(1);
    });

    it('SchemaRulesSearcher aplica filtro name AND con id OR', async () => {
        const creator = new SchemaCreator(repository);
        const uniqueName = `rs_or_${uuidv4()}`;
        const dto = SchemasMother.dto({ name: uniqueName });
        await creator.execute(dto);

        const searcher = new SchemaRulesSearcher(repository);
        const response = await searcher.execute({
            filter: [
                { field: 'name', operator: 'eq', value: '__no_match_rules_search__', type: 'AND' },
                { field: 'id', operator: 'eq', value: dto.id, type: 'OR' },
            ],
            relationship: null,
            limit: 10,
            offset: 0,
            order: { field: 'created_at', direction: 'desc' },
        });

        const json = response.toJson();
        expect(json.data.items.length).toBe(1);
        expect(json.data.items[0].id).toBe(dto.id);
    });

    it('cuenta correctamente las relaciones asociadas a un schema', async () => {
        const creator = new SchemaCreator(repository);
        const relationsCounter = new SchemaRelationsCountService(repository);

        const dto = SchemasMother.dto();
        await creator.execute(dto);

        for (let i = 0; i < 2; i++) {
            const auxDefinitionDto = AuxDefinitionsMother.dto({
                name: `definicion_${i}`,
                tablename: `tabla_${i}`,
                logs_tablename: `logs_tabla_${i}`,
                schema_id: dto.id,
            });
            await AuxDefinitionsMother.ensureRelations(repository.connection, auxDefinitionDto);
            await repository.connection('aux_definitions').insert(auxDefinitionDto);
        }

        for (let i = 0; i < 3; i++) {
            await repository.connection('one-script').insert({
                id: uuidv4(),
                name: `script_${i}`,
                schema_id: dto.id,
                created_at: new Date(),
                updated_at: new Date(),
                deleted_at: null,
                created_by: uuidv4(),
                updated_by: uuidv4(),
                deleted_by: null,
            });
        }

        const response = await relationsCounter.execute(dto.id);
        expect(response).toEqual({ data: { related_count: 5 } });
    });

    it('devuelve 0 si no hay relaciones asociadas', async () => {
        const creator = new SchemaCreator(repository);
        const relationsCounter = new SchemaRelationsCountService(repository);

        const dto = SchemasMother.dto();
        await creator.execute(dto);
        const response = await relationsCounter.execute(dto.id);
        expect(response).toEqual({ data: { related_count: 0 } });
    });

    it('lanza error al contar relaciones de un Schema inexistente', async () => {
        const relationsCounter = new SchemaRelationsCountService(repository);
        const invalidId = uuidv4();
        await expect(relationsCounter.execute(invalidId)).rejects.toThrow(`The schema does not exist`);
    });

    it('lanza error si falta deleted_at al eliminar', async () => {
        const creator = new SchemaCreator(repository);
        const deleter = new SchemaDeleter(repository);
        const dto = SchemasMother.dto();
        await creator.execute(dto);
        const deleteDto = { deleted_by: uuidv4() };
        await expect(deleter.execute(dto.id, deleteDto)).rejects.toThrow('The deleted_at field is required to delete.');
    });

    it('lanza error si falta deleted_by al eliminar', async () => {
        const creator = new SchemaCreator(repository);
        const deleter = new SchemaDeleter(repository);
        const dto = SchemasMother.dto();
        await creator.execute(dto);
        const deleteDto = { deleted_at: new Date() };
        await expect(deleter.execute(dto.id, deleteDto)).rejects.toThrow('The deleted_by field is required to delete.');
    });

    it('crea correctamente un Schema con restflow_id válido', async () => {
        const creator = new SchemaCreator(repository);
        const wsRestFlowRepository = new KnexWSRestFlowRepository(knexConfig);
        const wsRestFlowDto = WSRestFlowMother.dto();

        await WSRestFlowMother.create(wsRestFlowRepository, wsRestFlowDto);

        const schemaDto = SchemasMother.dto({
            data_structure: {
                field1: {
                    type: 'string',
                    required: true,
                    restflow_id: wsRestFlowDto.id,
                },
                field2: {
                    type: 'number',
                    required: false,
                },
            },
        });

        await creator.execute(schemaDto);
        const found = await repository.find({ value: schemaDto.id });
        expect(found).not.toBeNull();
        expect(found.id.value).toBe(schemaDto.id);
    });

    it('lanza error al crear un Schema con restflow_id inválido', async () => {
        const creator = new SchemaCreator(repository);
        const invalidRestFlowId = uuidv4();
        const schemaDto = SchemasMother.dto({
            data_structure: {
                field1: {
                    type: 'string',
                    required: true,
                    restflow_id: invalidRestFlowId,
                },
            },
        });

        await expect(creator.execute(schemaDto)).rejects.toThrow(
            new RegExp(`The ${invalidRestFlowId} does not exist in Rest Flows`)
        );
    });

    it('actualiza correctamente un Schema con restflow_id válido', async () => {
        const creator = new SchemaCreator(repository);
        const updater = new SchemaUpdater(repository);
        const wsRestFlowRepository = new KnexWSRestFlowRepository(knexConfig);
        const wsRestFlowDto = WSRestFlowMother.dto();

        await WSRestFlowMother.create(wsRestFlowRepository, wsRestFlowDto);

        const dto = SchemasMother.dto();
        await creator.execute(dto);

        const updaterDto = {
            name: 'nuevo_nombre_schema',
            data_structure: {
                field1: {
                    type: 'string',
                    required: true,
                    restflow_id: wsRestFlowDto.id,
                },
                field2: {
                    type: 'number',
                    required: false,
                },
            },
        };

        await updater.execute(updaterDto, dto.id);
        const found = await repository.find({ value: dto.id });
        expect(found).not.toBeNull();
        expect(found.name.value).toBe('nuevo_nombre_schema');
        expect(found.data_structure.value.field1.restflow_id).toBe(wsRestFlowDto.id);
    });

    it('lanza error al actualizar un Schema con restflow_id inválido', async () => {
        const creator = new SchemaCreator(repository);
        const updater = new SchemaUpdater(repository);

        const dto = SchemasMother.dto();
        await creator.execute(dto);

        const invalidRestFlowId = uuidv4();
        const updaterDto = {
            name: 'nuevo_nombre_schema',
            data_structure: {
                field1: {
                    type: 'string',
                    required: true,
                    restflow_id: invalidRestFlowId,
                },
            },
        };

        await expect(updater.execute(updaterDto, dto.id)).rejects.toThrow(
            new RegExp(`The ${invalidRestFlowId} does not exist in Rest Flows`)
        );
    });

    it('obtiene correctamente las relaciones de schemas con 5 niveles de arrays anidados', async () => {
        const relationsDetail = new SchemaRules(repository);
        const creator = new SchemaCreator(repository);
        // Crear 5 schemas anidados
        const schemaId5 = uuidv4();
        const schemaId4 = uuidv4();
        const schemaId3 = uuidv4();
        const schemaId2 = uuidv4();
        const schemaId1 = uuidv4();

        // Nivel 5: el más interno, sin más arrays
        const schema5 = SchemasMother.dto({
            id: schemaId5,
            name: 'schema_nivel_5',
            data_structure: {
                value: { type: 'string', required: true },
            },
        });
        await creator.execute(schema5);

        // Nivel 4: array que referencia a schema5
        const schema4 = SchemasMother.dto({
            id: schemaId4,
            name: 'schema_nivel_4',
            data_structure: {
                itemsLvl4: { type: 'array', required: true, schema_id: schemaId5 },
            },
        });
        await creator.execute(schema4);

        // Nivel 3: array que referencia a schema4
        const schema3 = SchemasMother.dto({
            id: schemaId3,
            name: 'schema_nivel_3',
            data_structure: {
                itemsLvl3: { type: 'array', required: true, schema_id: schemaId4 },
            },
        });
        await creator.execute(schema3);

        // Nivel 2: array que referencia a schema3
        const schema2 = SchemasMother.dto({
            id: schemaId2,
            name: 'schema_nivel_2',
            data_structure: {
                itemsLvl2: { type: 'array', required: true, schema_id: schemaId3 },
            },
        });
        await creator.execute(schema2);

        // Nivel 1: principal, array que referencia a schema2
        const schema1 = SchemasMother.dto({
            id: schemaId1,
            name: 'schema_nivel_1',
            data_structure: {
                itemsLvl1: { type: 'array', required: true, schema_id: schemaId2 },
            },
        });
        await creator.execute(schema1);

        // Ejecutar el método recursivo
        const response = await relationsDetail.execute(schemaId1);
        const result = response.toJson().data;

        // Validar la estructura anidada
        expect(result).toBeDefined();
        expect(result.data_structure.itemsLvl1).toBeDefined();
        expect(result.data_structure.itemsLvl1.type).toBe('array');
        expect(result.data_structure.itemsLvl1.data_structure).toBeDefined();
        // Nivel 2
        const level2 = result.data_structure.itemsLvl1.data_structure;
        expect(level2.itemsLvl2).toBeDefined();
        expect(level2.itemsLvl2.type).toBe('array');
        expect(level2.itemsLvl2.data_structure).toBeDefined();
        // Nivel 3
        const level3 = level2.itemsLvl2.data_structure;
        expect(level3.itemsLvl3).toBeDefined();
        expect(level3.itemsLvl3.type).toBe('array');
        expect(level3.itemsLvl3.data_structure).toBeDefined();
        // Nivel 4
        const level4 = level3.itemsLvl3.data_structure;
        expect(level4.itemsLvl4).toBeDefined();
        expect(level4.itemsLvl4.type).toBe('array');
        expect(level4.itemsLvl4.data_structure).toBeDefined();
        // Nivel 5
        const level5 = level4.itemsLvl4.data_structure;
        expect(level5.value).toBeDefined();
        expect(level5.value.type).toBe('string');
        // No debe haber más relaciones
        expect(level5.data_structure).toBeUndefined();
    });

    it('obtiene correctamente las relaciones de schemas con 5 niveles de objetos anidados', async () => {
        const relationsDetail = new SchemaRules(repository);
        const creator = new SchemaCreator(repository);
        // Crear 5 schemas anidados
        const schemaId5 = uuidv4();
        const schemaId4 = uuidv4();
        const schemaId3 = uuidv4();
        const schemaId2 = uuidv4();
        const schemaId1 = uuidv4();

        // Nivel 5: el más interno, sin más objetos
        const schema5 = SchemasMother.dto({
            id: schemaId5,
            name: 'schema_objeto_nivel_5',
            data_structure: {
                value: { type: 'string', required: true },
            },
        });
        await creator.execute(schema5);

        // Nivel 4: objeto que referencia a schema5
        const schema4 = SchemasMother.dto({
            id: schemaId4,
            name: 'schema_objeto_nivel_4',
            data_structure: {
                campoLvl4: { type: 'object', required: true, schema_id: schemaId5 },
            },
        });
        await creator.execute(schema4);

        // Nivel 3: objeto que referencia a schema4
        const schema3 = SchemasMother.dto({
            id: schemaId3,
            name: 'schema_objeto_nivel_3',
            data_structure: {
                campoLvl3: { type: 'object', required: true, schema_id: schemaId4 },
            },
        });
        await creator.execute(schema3);

        // Nivel 2: objeto que referencia a schema3
        const schema2 = SchemasMother.dto({
            id: schemaId2,
            name: 'schema_objeto_nivel_2',
            data_structure: {
                campoLvl2: { type: 'object', required: true, schema_id: schemaId3 },
            },
        });
        await creator.execute(schema2);

        // Nivel 1: principal, objeto que referencia a schema2
        const schema1 = SchemasMother.dto({
            id: schemaId1,
            name: 'schema_objeto_nivel_1',
            data_structure: {
                campoLvl1: { type: 'object', required: true, schema_id: schemaId2 },
            },
        });
        await creator.execute(schema1);

        // Ejecutar el método recursivo
        const response = await relationsDetail.execute(schemaId1);
        const result = response.toJson().data;
        // Validar la estructura anidada
        expect(result).toBeDefined();
        expect(result.data_structure.campoLvl1).toBeDefined();
        expect(result.data_structure.campoLvl1.type).toBe('object');
        expect(result.data_structure.campoLvl1.data_structure).toBeDefined();
        // Nivel 2
        const level2 = result.data_structure.campoLvl1.data_structure;
        expect(level2.campoLvl2).toBeDefined();
        expect(level2.campoLvl2.type).toBe('object');
        expect(level2.campoLvl2.data_structure).toBeDefined();
        // Nivel 3
        const level3 = level2.campoLvl2.data_structure;
        expect(level3.campoLvl3).toBeDefined();
        expect(level3.campoLvl3.type).toBe('object');
        expect(level3.campoLvl3.data_structure).toBeDefined();
        // Nivel 4
        const level4 = level3.campoLvl3.data_structure;
        expect(level4.campoLvl4).toBeDefined();
        expect(level4.campoLvl4.type).toBe('object');
        expect(level4.campoLvl4.data_structure).toBeDefined();
        // Nivel 5
        const level5 = level4.campoLvl4.data_structure;
        expect(level5.value).toBeDefined();
        expect(level5.value.type).toBe('string');
        // No debe haber más relaciones
        expect(level5.data_structure).toBeUndefined();
    });

    it('falla si min es mayor que max en string', async () => {
        const creator = new SchemaCreator(repository);
        const dto = SchemasMother.dto({ data_structure: SchemasMother.stringMinGreaterThanMax() });
        await expect(creator.execute(dto)).rejects.toThrow(/min.*mayor que.*max/);
    });

    it('falla si valid e invalid tienen valores en común en string', async () => {
        const creator = new SchemaCreator(repository);
        const dto = SchemasMother.dto({ data_structure: SchemasMother.stringValidAndInvalidOverlap() });
        await expect(creator.execute(dto)).rejects.toThrow(/valores en común/);
    });

    it('falla si length y min/max coexisten en string', async () => {
        const creator = new SchemaCreator(repository);
        const dto = SchemasMother.dto({ data_structure: SchemasMother.stringLengthWithMinOrMax() });
        await expect(creator.execute(dto)).rejects.toThrow(/no puede tener 'length' junto con 'min' o 'max'/);
    });

    it('falla si default no está en valid en string', async () => {
        const creator = new SchemaCreator(repository);
        const dto = SchemasMother.dto({ data_structure: SchemasMother.stringDefaultNotInValid() });
        await expect(creator.execute(dto)).rejects.toThrow(/debe estar en la lista de valores válidos/);
    });

    it('falla si default está en invalid en string', async () => {
        const creator = new SchemaCreator(repository);
        const dto = SchemasMother.dto({ data_structure: SchemasMother.stringDefaultInInvalid() });
        await expect(creator.execute(dto)).rejects.toThrow(/no puede estar en la lista de valores inválidos/);
    });

    it('falla si default no cumple length en string', async () => {
        const creator = new SchemaCreator(repository);
        const dto = SchemasMother.dto({ data_structure: SchemasMother.stringDefaultWrongLength() });
        await expect(creator.execute(dto)).rejects.toThrow(/debe tener longitud exactamente/);
    });

    it('falla si default no cumple min en string', async () => {
        const creator = new SchemaCreator(repository);
        const dto = SchemasMother.dto({ data_structure: SchemasMother.stringDefaultWrongMin() });
        await expect(creator.execute(dto)).rejects.toThrow(/debe tener longitud mínima/);
    });

    it('falla si default no cumple max en string', async () => {
        const creator = new SchemaCreator(repository);
        const dto = SchemasMother.dto({ data_structure: SchemasMother.stringDefaultWrongMax() });
        await expect(creator.execute(dto)).rejects.toThrow(/debe tener longitud máxima/);
    });

    it('falla si default no cumple pattern en string', async () => {
        const creator = new SchemaCreator(repository);
        const dto = SchemasMother.dto({ data_structure: SchemasMother.stringDefaultPatternFail() });
        await expect(creator.execute(dto)).rejects.toThrow(/no cumple con el patrón/);
    });

    it('falla si default no es alfanumérico en string', async () => {
        const creator = new SchemaCreator(repository);
        const dto = SchemasMother.dto({ data_structure: SchemasMother.stringDefaultNotAlphanum() });
        await expect(creator.execute(dto)).rejects.toThrow(/debe ser alfanumérico/);
    });

    it('falla si default no es lowercase en string', async () => {
        const creator = new SchemaCreator(repository);
        const dto = SchemasMother.dto({ data_structure: SchemasMother.stringDefaultNotLowercase() });
        await expect(creator.execute(dto)).rejects.toThrow(/debe estar en minúsculas/);
    });

    it('falla si default no es uppercase en string', async () => {
        const creator = new SchemaCreator(repository);
        const dto = SchemasMother.dto({ data_structure: SchemasMother.stringDefaultNotUppercase() });
        await expect(creator.execute(dto)).rejects.toThrow(/debe estar en mayúsculas/);
    });

    it('acepta un string válido con todas las restricciones lógicas', async () => {
        const creator = new SchemaCreator(repository);
        const dto = SchemasMother.dto({ data_structure: SchemasMother.stringValidAll() });
        await expect(creator.execute(dto)).resolves.not.toThrow();
    });

    it('falla si min es mayor que max en number', async () => {
        const creator = new SchemaCreator(repository);
        const dto = SchemasMother.dto({ data_structure: SchemasMother.numberMinGreaterThanMax() });
        await expect(creator.execute(dto)).rejects.toThrow(/min.*mayor que.*max/);
    });

    it('falla si greater es mayor o igual que less en number', async () => {
        const creator = new SchemaCreator(repository);
        const dto = SchemasMother.dto({ data_structure: SchemasMother.numberGreaterGteLess() });
        await expect(creator.execute(dto)).rejects.toThrow(/greater.*mayor o igual que.*less/);
    });

    it('falla si min y greater están definidos en number', async () => {
        const creator = new SchemaCreator(repository);
        const dto = SchemasMother.dto({ data_structure: SchemasMother.numberMinAndGreater() });
        await expect(creator.execute(dto)).rejects.toThrow(/no puede tener 'min' y 'greater'/);
    });

    it('falla si max y less están definidos en number', async () => {
        const creator = new SchemaCreator(repository);
        const dto = SchemasMother.dto({ data_structure: SchemasMother.numberMaxAndLess() });
        await expect(creator.execute(dto)).rejects.toThrow(/no puede tener 'max' y 'less'/);
    });

    it('falla si multiple es 0 en number', async () => {
        const creator = new SchemaCreator(repository);
        const dto = SchemasMother.dto({ data_structure: SchemasMother.numberMultipleZero() });
        await expect(creator.execute(dto)).rejects.toThrow(/multiple.*no puede ser 0/);
    });

    it('falla si default no es entero cuando integer es true en number', async () => {
        const creator = new SchemaCreator(repository);
        const dto = SchemasMother.dto({ data_structure: SchemasMother.numberDefaultNotInteger() });
        await expect(creator.execute(dto)).rejects.toThrow(/debe ser un entero porque 'integer' es true/);
    });

    it('falla si default no está en valid en number', async () => {
        const creator = new SchemaCreator(repository);
        const dto = SchemasMother.dto({ data_structure: SchemasMother.numberDefaultNotInValid() });
        await expect(creator.execute(dto)).rejects.toThrow(/debe estar en la lista de valores válidos/);
    });

    it('falla si default está en invalid en number', async () => {
        const creator = new SchemaCreator(repository);
        const dto = SchemasMother.dto({ data_structure: SchemasMother.numberDefaultInInvalid() });
        await expect(creator.execute(dto)).rejects.toThrow(/no puede estar en la lista de valores inválidos/);
    });

    it('falla si default no es positivo cuando positive es true en number', async () => {
        const creator = new SchemaCreator(repository);
        const dto = SchemasMother.dto({ data_structure: SchemasMother.numberDefaultNotPositive() });
        await expect(creator.execute(dto)).rejects.toThrow(/debe ser positivo/);
    });

    it('falla si default no es negativo cuando negative es true en number', async () => {
        const creator = new SchemaCreator(repository);
        const dto = SchemasMother.dto({ data_structure: SchemasMother.numberDefaultNotNegative() });
        await expect(creator.execute(dto)).rejects.toThrow(/debe ser negativo/);
    });

    it('falla si default no es múltiplo de multiple en number', async () => {
        const creator = new SchemaCreator(repository);
        const dto = SchemasMother.dto({ data_structure: SchemasMother.numberDefaultNotMultiple() });
        await expect(creator.execute(dto)).rejects.toThrow(/debe ser múltiplo/);
    });

    it('falla si default está fuera de rango de puerto en number', async () => {
        const creator = new SchemaCreator(repository);
        const dto = SchemasMother.dto({ data_structure: SchemasMother.numberDefaultOutOfPortRange() });
        await expect(creator.execute(dto)).rejects.toThrow(/debe estar entre 0 y 65535/);
    });

    it('falla si default está fuera del rango seguro en number', async () => {
        const creator = new SchemaCreator(repository);
        const dto = SchemasMother.dto({ data_structure: SchemasMother.numberDefaultUnsafe() });
        await expect(creator.execute(dto)).rejects.toThrow(/debe estar en el rango seguro/);
    });

    it('falla si default no cumple precision en number', async () => {
        const creator = new SchemaCreator(repository);
        const dto = SchemasMother.dto({ data_structure: SchemasMother.numberDefaultWrongPrecision() });
        await expect(creator.execute(dto)).rejects.toThrow(/debe tener exactamente 2 decimales/);
    });

    it('falla si valid e invalid tienen valores en común en number', async () => {
        const creator = new SchemaCreator(repository);
        const dto = SchemasMother.dto({ data_structure: SchemasMother.numberValidAndInvalidOverlap() });
        await expect(creator.execute(dto)).rejects.toThrow(/valores en común/);
    });

    it('acepta un number válido con todas las restricciones lógicas', async () => {
        const creator = new SchemaCreator(repository);
        const dto = SchemasMother.dto({ data_structure: SchemasMother.numberValidAll() });
        await expect(creator.execute(dto)).resolves.not.toThrow();
    });

    it('falla si default no es booleano ni está en truthy/falsy en boolean', async () => {
        const creator = new SchemaCreator(repository);
        const dto = SchemasMother.dto({ data_structure: SchemasMother.booleanDefaultNotAllowed() });
        await expect(creator.execute(dto)).rejects.toThrow(/debe ser booleano o estar en truthyValues o falsyValues/);
    });

    it('acepta default en truthyValues en boolean', async () => {
        const creator = new SchemaCreator(repository);
        const dto = SchemasMother.dto({ data_structure: SchemasMother.booleanDefaultInTruthy() });
        await expect(creator.execute(dto)).resolves.not.toThrow();
    });

    it('acepta default en falsyValues en boolean', async () => {
        const creator = new SchemaCreator(repository);
        const dto = SchemasMother.dto({ data_structure: SchemasMother.booleanDefaultInFalsy() });
        await expect(creator.execute(dto)).resolves.not.toThrow();
    });

    it('acepta default booleano en boolean', async () => {
        const creator = new SchemaCreator(repository);
        const dto = SchemasMother.dto({ data_structure: SchemasMother.booleanDefaultBoolean() });
        await expect(creator.execute(dto)).resolves.not.toThrow();
    });

    /*
  VALIDAR EXPRESION REGULAR PARAMETRIZADA CUANDO SE CONFIGURE
  */

    it('falla si truthyValues y falsyValues tienen valores en común en boolean', async () => {
        const creator = new SchemaCreator(repository);
        const dto = SchemasMother.dto({ data_structure: SchemasMother.booleanTruthyFalsyOverlap() });
        await expect(creator.execute(dto)).rejects.toThrow(/valores en común/);
    });

    it('falla si truthyValues tiene duplicados en boolean', async () => {
        const creator = new SchemaCreator(repository);
        const dto = SchemasMother.dto({ data_structure: SchemasMother.booleanTruthyWithDuplicates() });
        await expect(creator.execute(dto)).rejects.toThrow(/no puede contener valores duplicados/);
    });

    it('falla si falsyValues tiene duplicados en boolean', async () => {
        const creator = new SchemaCreator(repository);
        const dto = SchemasMother.dto({ data_structure: SchemasMother.booleanFalsyWithDuplicates() });
        await expect(creator.execute(dto)).rejects.toThrow(/no puede contener valores duplicados/);
    });

    it('falla si truthyValues es un array vacío en boolean', async () => {
        const creator = new SchemaCreator(repository);
        const dto = SchemasMother.dto({ data_structure: SchemasMother.booleanTruthyEmpty() });
        await expect(creator.execute(dto)).rejects.toThrow(/no puede ser un array vacío/);
    });

    it('falla si falsyValues es un array vacío en boolean', async () => {
        const creator = new SchemaCreator(repository);
        const dto = SchemasMother.dto({ data_structure: SchemasMother.booleanFalsyEmpty() });
        await expect(creator.execute(dto)).rejects.toThrow(/no puede ser un array vacío/);
    });

    it('falla si truthyValues contiene null, undefined o vacío en boolean', async () => {
        const creator = new SchemaCreator(repository);
        const dto = SchemasMother.dto({ data_structure: SchemasMother.booleanTruthyWithNullUndefinedEmpty() });
        await expect(creator.execute(dto)).rejects.toThrow(/no puede contener valores vacíos, null o undefined/);
    });

    it('falla si min es mayor que max en date', async () => {
        const creator = new SchemaCreator(repository);
        const dto = SchemasMother.dto({ data_structure: SchemasMother.dateMinGreaterThanMax() });
        await expect(creator.execute(dto)).rejects.toThrow(/min.*no puede ser posterior a.*max/);
    });

    it('falla si greater es mayor o igual que less en date', async () => {
        const creator = new SchemaCreator(repository);
        const dto = SchemasMother.dto({ data_structure: SchemasMother.dateGreaterGteLess() });
        await expect(creator.execute(dto)).rejects.toThrow(/greater.*no puede ser igual o posterior a.*less/);
    });

    it('falla si min y greater están definidos en date', async () => {
        const creator = new SchemaCreator(repository);
        const dto = SchemasMother.dto({ data_structure: SchemasMother.dateMinAndGreater() });
        await expect(creator.execute(dto)).rejects.toThrow(/no puede tener 'min' y 'greater'/);
    });

    it('falla si max y less están definidos en date', async () => {
        const creator = new SchemaCreator(repository);
        const dto = SchemasMother.dto({ data_structure: SchemasMother.dateMaxAndLess() });
        await expect(creator.execute(dto)).rejects.toThrow(/no puede tener 'max' y 'less'/);
    });

    it('falla si integer y precision están definidos en date', async () => {
        const creator = new SchemaCreator(repository);
        const dto = SchemasMother.dto({ data_structure: SchemasMother.dateIntegerAndPrecision() });
        await expect(creator.execute(dto)).rejects.toThrow(/no puede tener 'integer' y 'precision' definidos a la vez/);
    });

    it('falla si default no es string en date', async () => {
        const creator = new SchemaCreator(repository);
        const dto = SchemasMother.dto({ data_structure: SchemasMother.dateDefaultNotString() });
        await expect(creator.execute(dto)).rejects.toThrow(/must be a string/);
    });

    it('falla si default no es fecha válida ni now en date', async () => {
        const creator = new SchemaCreator(repository);
        const dto = SchemasMother.dto({ data_structure: SchemasMother.dateDefaultInvalidString() });
        await expect(creator.execute(dto)).rejects.toThrow(/debe ser una fecha válida o 'now'/);
    });

    it('falla si default está fuera de min en date', async () => {
        const creator = new SchemaCreator(repository);
        const dto = SchemasMother.dto({ data_structure: SchemasMother.dateDefaultOutOfMin() });
        await expect(creator.execute(dto)).rejects.toThrow(/debe ser igual o posterior a/);
    });

    it('falla si default está fuera de max en date', async () => {
        const creator = new SchemaCreator(repository);
        const dto = SchemasMother.dto({ data_structure: SchemasMother.dateDefaultOutOfMax() });
        await expect(creator.execute(dto)).rejects.toThrow(/debe ser igual o anterior a/);
    });

    it('falla si default está fuera de greater en date', async () => {
        const creator = new SchemaCreator(repository);
        const dto = SchemasMother.dto({ data_structure: SchemasMother.dateDefaultOutOfGreater() });
        await expect(creator.execute(dto)).rejects.toThrow(/debe ser posterior a/);
    });

    it('falla si default está fuera de less en date', async () => {
        const creator = new SchemaCreator(repository);
        const dto = SchemasMother.dto({ data_structure: SchemasMother.dateDefaultOutOfLess() });
        await expect(creator.execute(dto)).rejects.toThrow(/debe ser anterior a/);
    });

    it('acepta un date válido con todas las restricciones lógicas', async () => {
        const creator = new SchemaCreator(repository);
        const dto = SchemasMother.dto({ data_structure: SchemasMother.dateValidAll() });
        await expect(creator.execute(dto)).resolves.not.toThrow();
    });

    it('falla si min es now y max es fecha pasada en date', async () => {
        const creator = new SchemaCreator(repository);
        const dto = SchemasMother.dto({ data_structure: SchemasMother.dateMinNowMaxPast() });
        await expect(creator.execute(dto)).rejects.toThrow(/min.*no puede ser posterior a.*max/);
    });

    it('falla si greater es now y less es fecha pasada en date', async () => {
        const creator = new SchemaCreator(repository);
        const dto = SchemasMother.dto({ data_structure: SchemasMother.dateGreaterNowLessPast() });
        await expect(creator.execute(dto)).rejects.toThrow(/greater.*no puede ser igual o posterior a.*less/);
    });

    it('falla si timestamp unix es inválido en date', async () => {
        const creator = new SchemaCreator(repository);
        const dto = SchemasMother.dto({ data_structure: SchemasMother.dateTimestampUnixInvalid() });
        await expect(creator.execute(dto)).rejects.toThrow(/debe ser una fecha válida en formato ISO/);
    });

    it('falla si timestamp javascript es inválido en date', async () => {
        const creator = new SchemaCreator(repository);
        const dto = SchemasMother.dto({ data_structure: SchemasMother.dateTimestampJsInvalid() });
        await expect(creator.execute(dto)).rejects.toThrow(/debe ser una fecha válida en formato ISO/);
    });

    it('falla si el nombre del campo contiene un punto', async () => {
        const creator = new SchemaCreator(repository);
        const dto = SchemasMother.dto({ data_structure: SchemasMother.fieldNameWithDot() });
        await expect(creator.execute(dto)).rejects.toThrow(/is invalid: only letters, numbers, and underscores/);
    });

    it('falla si el nombre del campo supera los 45 caracteres', async () => {
        const creator = new SchemaCreator(repository);
        const dto = SchemasMother.dto({ data_structure: SchemasMother.fieldNameTooLong() });
        await expect(creator.execute(dto)).rejects.toThrow(/too long: maximum length is 45 characters/);
    });

    it('Genera de forma correcta un schema rules con los data structures definidos en los tipo object y array utilizando un ejemplo real de produccion "aux_cases"', async () => {
        const schemas = await SchemasMother.createAuxCaseNestedExampleSchema(repository);

        const schemaRulesService = new SchemaRules(repository);
        const response = await schemaRulesService.execute(schemas[0].id);

        const dataStructure = response.toJson().data.data_structure;

        expect(
            dataStructure['form_ef61161d-4dd2-4a2e-87f4-1d2e936ec315'].data_structure['puntos_de_venta'].data_structure
        ).toBeDefined();
        expect(
            dataStructure['form_ef61161d-4dd2-4a2e-87f4-1d2e936ec315'].data_structure['documentos_para_estudio']
                .data_structure
        ).toBeDefined();
        expect(
            dataStructure['form_9368b49d-b095-4b28-843f-c59ec516138f'].data_structure['puntos_de_venta'].data_structure
        ).toBeDefined();
        expect(
            dataStructure['form_9368b49d-b095-4b28-843f-c59ec516138f'].data_structure['documentos_para_estudio']
                .data_structure
        ).toBeDefined();
    });

    it('crea correctamente un Schema con funcion válida', async () => {
        const creator = new SchemaCreator(repository);
        const schemaDto = SchemasMother.dto({
            data_structure: {
                valor1: { type: 'number', required: true },
                valor2: { type: 'number', required: true },
                valor3: { type: 'number', required: true },
                suma_total: {
                    type: 'calculated',
                    required: true,
                    ui: { label: 'Suma total', input_type: 'number', show_in_grid: true },
                    calc: {
                        formula: 'sum(ref("valor1"), ref("valor2"), ref("valor3"))',
                        on: ['create'],
                        error_policy: 'error',
                    },
                },
            },
        });

        await creator.execute(schemaDto);
        const found = await repository.find({ value: schemaDto.id });
        expect(found).not.toBeNull();
        expect(found.id.value).toBe(schemaDto.id);
        expect(found.data_structure.value.suma_total.calc.formula).toBe(
            'sum(ref("valor1"), ref("valor2"), ref("valor3"))'
        );
    });

    it('lanza error con fórmula calculada inválida', async () => {
        const creator = new SchemaCreator(repository);

        const schemaDto = SchemasMother.dto({
            data_structure: {
                suma_total: {
                    required: true,
                    type: 'calculated',
                    calc: { formula: 'invalid()', on: ['create'], error_policy: 'error' },
                },
            },
        });
        await expect(creator.execute(schemaDto)).rejects.toThrow('Invalid function "invalid" in formula');
    });

    it('lanza error cuando "on" contiene un valor inválido', async () => {
        const creator = new SchemaCreator(repository);

        const schemaDto = SchemasMother.dto({
            data_structure: {
                val: { type: 'string', required: true },
                suma_total: {
                    required: true,
                    type: 'calculated',
                    calc: { formula: 'concat(ref(val))', on: ['invalid'], error_policy: 'error' },
                },
            },
        });
        await expect(creator.execute(schemaDto)).rejects.toThrow(
            "'suma_total.calc.on' contiene valor inválido: invalid"
        );
    });

    it('asigna ui.label vacío al no tener ui.label y formula min', async () => {
        const creator = new SchemaCreator(repository);

        const schemaDto = SchemasMother.dto({
            data_structure: {
                valor1: { type: 'number', required: true },
                valor2: { type: 'number', required: true },
                suma_total: {
                    required: true,
                    type: 'calculated',
                    ui: { input_type: 'number', show_in_grid: true },
                    calc: { formula: 'min(ref("valor1"),ref("valor2"))', on: ['create'], error_policy: 'error' },
                },
            },
        });

        await creator.execute(schemaDto);
        const found = await repository.find({ value: schemaDto.id });
        expect(found).not.toBeNull();
        expect(found.id.value).toBe(schemaDto.id);
        expect(found.data_structure.value.suma_total.ui.label).toBe('');
    });

    it('lanza error si input_type no es válido', async () => {
        const creator = new SchemaCreator(repository);

        const schemaDto = SchemasMother.dto({
            data_structure: {
                suma_total: {
                    required: true,
                    type: 'calculated',
                    ui: { input_type: 'slider' },
                    calc: { formula: 'sum(1,2)', on: ['create'], error_policy: 'error' },
                },
            },
        });

        await expect(creator.execute(schemaDto)).rejects.toThrow(`'suma_total.ui.input_type' tiene un valor inválido.`);
    });

    allFuncs.forEach((func) => {
        it(`crea correctamente un Schema con función válida "${func.name}"`, async () => {
            const creator = new SchemaCreator(repository);

            const data_structure = {};
            func.params.forEach((p) => {
                if (p.type === 'number') data_structure[p.name] = { type: 'number', required: true };
                else if (p.type === 'string') data_structure[p.name] = { type: 'string', required: true };
                else if (p.type === 'date')
                    data_structure[p.name] = { type: 'date', required: true, timezoneFormat: 'withTimezone' };
                else data_structure[p.name] = { type: 'string', required: true };
            });

            const formulaArgs = func.params.map((p) => `ref("${p.name}")`).join(',');
            data_structure['calc_field'] = {
                type: 'calculated',
                required: true,
                calc: { formula: `${func.name}(${formulaArgs})`, on: ['create'], error_policy: 'error' },
            };

            const schemaDto = SchemasMother.dto({
                data_structure,
            });

            await expect(creator.execute(schemaDto)).resolves.not.toThrow();

            const found = await repository.find({ value: schemaDto.id });
            expect(found).not.toBeNull();
            expect(found.data_structure.value.calc_field.calc.formula).toBe(`${func.name}(${formulaArgs})`);
        });
    });

    it('crea y guarda un Schema correctamente con ui de tipo password', async () => {
        const creator = new SchemaCreator(repository);
        const dto = SchemasMother.dto({
            data_structure: {
                pasword: {
                    alphanum: false,
                    empty: false,
                    required: false,
                    trim: false,
                    type: 'string',
                    ui: {
                        css: 'border-0 border-bottom',
                        label: 'pass',
                        input_type: 'password',
                        is_visible: true,
                        show_in_grid: true,
                        read_only: true,
                        ui_modified: true,
                    },
                },
            },
        });

        await creator.execute(dto);
        const found = await repository.find({ value: dto.id });
        expect(found).not.toBeNull();
        expect(found.id.value).toBe(dto.id);
        expect(found.data_structure.value.pasword.ui.input_type).toBe('password');
    });

    // --- Timezone integration tests ---

    describe('Timezone support', () => {
        const originalEnv = process.env.TIMEZONE;

        afterEach(() => {
            if (originalEnv !== undefined) {
                process.env.TIMEZONE = originalEnv;
            } else {
                delete process.env.TIMEZONE;
            }
        });

        it('crea correctamente un Schema con timezoneFormat=withTimezone', async () => {
            const creator = new SchemaCreator(repository);
            const dto = SchemasMother.dto({
                data_structure: {
                    event_date: {
                        type: 'date',
                        required: true,
                        timezoneFormat: 'withTimezone',
                    },
                },
            });

            await creator.execute(dto);
            const found = await repository.find({ value: dto.id });
            expect(found).not.toBeNull();
            expect(found.data_structure.value.event_date.timezoneFormat).toBe('withTimezone');
        });

        it('crea correctamente un Schema con timezoneFormat=withoutTimezone y timezone IANA', async () => {
            const creator = new SchemaCreator(repository);
            const dto = SchemasMother.dto({
                data_structure: {
                    event_date: {
                        type: 'date',
                        required: true,
                        timezoneFormat: 'withoutTimezone',
                        timezone: 'America/Bogota',
                    },
                },
            });

            await creator.execute(dto);
            const found = await repository.find({ value: dto.id });
            expect(found).not.toBeNull();
            expect(found.data_structure.value.event_date.timezoneFormat).toBe('withoutTimezone');
            expect(found.data_structure.value.event_date.timezone).toBe('America/Bogota');
        });

        it('crea correctamente un Schema con timezoneFormat=withTimezone y timestamp=javascript', async () => {
            const creator = new SchemaCreator(repository);
            const dto = SchemasMother.dto({
                data_structure: {
                    event_date: {
                        type: 'date',
                        required: true,
                        timezoneFormat: 'withTimezone',
                        timestamp: 'javascript',
                    },
                },
            });

            await creator.execute(dto);
            const found = await repository.find({ value: dto.id });
            expect(found).not.toBeNull();
            expect(found.data_structure.value.event_date.timezoneFormat).toBe('withTimezone');
            expect(found.data_structure.value.event_date.timestamp).toBe('javascript');
        });

        it('aplica defaults correctamente: timezoneFormat=withoutTimezone y timezone explícita', async () => {
            const creator = new SchemaCreator(repository);
            const dto = SchemasMother.dto({
                data_structure: {
                    event_date: {
                        type: 'date',
                        required: true,
                        timezone: 'America/New_York',
                    },
                },
            });

            await creator.execute(dto);
            const found = await repository.find({ value: dto.id });
            expect(found).not.toBeNull();
            expect(found.data_structure.value.event_date.timezoneFormat).toBe('withoutTimezone');
            expect(found.data_structure.value.event_date.timezone).toBe('America/New_York');
        });

        it('crea correctamente un Schema con timezoneFormat=withoutTimezone y timestamp (coexisten)', async () => {
            const creator = new SchemaCreator(repository);
            const dto = SchemasMother.dto({
                data_structure: {
                    event_date: {
                        type: 'date',
                        required: true,
                        timezoneFormat: 'withoutTimezone',
                        timezone: 'America/Bogota',
                        timestamp: 'javascript',
                    },
                },
            });

            await creator.execute(dto);
            const found = await repository.find({ value: dto.id });
            expect(found).not.toBeNull();
            expect(found.data_structure.value.event_date.timezoneFormat).toBe('withoutTimezone');
            expect(found.data_structure.value.event_date.timezone).toBe('America/Bogota');
            expect(found.data_structure.value.event_date.timestamp).toBe('javascript');
        });

        it('falla al crear Schema con timezone IANA inválida', async () => {
            const creator = new SchemaCreator(repository);
            const dto = SchemasMother.dto({
                data_structure: {
                    event_date: {
                        type: 'date',
                        required: true,
                        timezoneFormat: 'withoutTimezone',
                        timezone: 'Invalid/Timezone',
                    },
                },
            });

            await expect(creator.execute(dto)).rejects.toThrow(/debe ser una zona horaria IANA válida/);
        });

        it('falla al crear Schema con timezoneFormat inválido', async () => {
            const creator = new SchemaCreator(repository);
            const dto = SchemasMother.dto({
                data_structure: {
                    event_date: {
                        type: 'date',
                        required: true,
                        timezoneFormat: 'invalidFormat',
                    },
                },
            });

            await expect(creator.execute(dto)).rejects.toThrow(/debe ser 'withTimezone' o 'withoutTimezone'/);
        });

        it('falla al crear Schema sin timezone y sin variable de entorno TIMEZONE', async () => {
            delete process.env.TIMEZONE;
            const creator = new SchemaCreator(repository);
            const dto = SchemasMother.dto({
                data_structure: {
                    event_date: {
                        type: 'date',
                        required: true,
                        timezoneFormat: 'withoutTimezone',
                        timezone: null,
                    },
                },
            });

            await expect(creator.execute(dto)).rejects.toThrow(/Variable de entorno TIMEZONE no está definida/);
        });

        it('crea correctamente un Schema con timezoneFormat=withTimezone y timestamp=unix', async () => {
            const creator = new SchemaCreator(repository);
            const dto = SchemasMother.dto({
                data_structure: {
                    event_date: {
                        type: 'date',
                        required: true,
                        timezoneFormat: 'withTimezone',
                        timestamp: 'unix',
                    },
                },
            });

            await creator.execute(dto);
            const found = await repository.find({ value: dto.id });
            expect(found).not.toBeNull();
            expect(found.data_structure.value.event_date.timestamp).toBe('unix');
        });

        it('crea correctamente un Schema con timezoneFormat=withoutTimezone y constraints min/max', async () => {
            const creator = new SchemaCreator(repository);
            const dto = SchemasMother.dto({
                data_structure: {
                    event_date: {
                        type: 'date',
                        required: true,
                        timezoneFormat: 'withoutTimezone',
                        timezone: 'America/Bogota',
                        min: '2024-06-01',
                        max: '2024-06-30',
                        default: '2024-06-15',
                    },
                },
            });

            await creator.execute(dto);
            const found = await repository.find({ value: dto.id });
            expect(found).not.toBeNull();
            expect(found.data_structure.value.event_date.min).toBe('2024-06-01');
            expect(found.data_structure.value.event_date.max).toBe('2024-06-30');
        });
    });
});
