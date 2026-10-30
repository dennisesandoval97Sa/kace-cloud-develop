import {
    KnexSubcaseRelationshipRepository,
    SubCaseRelationCreator,
    SubCaseRelationDeleter,
    SubCaseRelationSearcher,
    SubCaseRelationCollectionResponse,
    SubcasesRelationship,
} from '../../src/cases';
import { v4 as uuidv4 } from 'uuid';
import { knexConfig } from '../knexfile.js';
import { KnexCaseRepository } from '../../src/cases';
import { SubcasesOpenStatusService } from '../../src/cases';
import CasesMother from './domain/CasesMother.js';
import { ValueObjectUuid, InvalidArgumentError } from '../../src/shared/index.js';
describe('Subcases Integration Tests', () => {
    const repository = new KnexSubcaseRelationshipRepository(knexConfig);
    const caseRepository = new KnexCaseRepository(knexConfig);
    let service;

    beforeEach(async () => {
        service = new SubcasesOpenStatusService({
            subcaseRepo: repository,
        });
    });

    const createCase = async () => {
        const dto = CasesMother.dto();
        await CasesMother.ensureRelations(caseRepository.connection, dto, {});
        await caseRepository.connection(caseRepository.tableName).insert({
            id: dto.id,
            cliente_id: dto.cliente_id,
            transicion_id: dto.transicion_id,
            responsable_id: dto.responsable_id,
            clasificacion_id: dto.clasificacion_id,
            descripcion_caso_id: dto.descripcion_caso_id,
            cambio_estado_comentario_id: dto.cambio_estado_comentario_id,
            grupo_id: dto.grupo_id,
            fecha_resolucion: dto.fecha_resolucion,
            antiguedad: dto.antiguedad,
            ans_posicion: dto.ans_posicion,
            antiguedad_dias: dto.antiguedad_dias,
            antiguedad_horas: dto.antiguedad_horas,
            antiguedad_minutos: dto.antiguedad_minutos,
            motivo_baja: dto.motivo_baja,
            alto_impacto: dto.alto_impacto,
            vista: dto.vista,
            created_at: dto.created_at,
            updated_at: dto.updated_at,
            created_by: dto.created_by,
            updated_by: dto.updated_by,
            deleted_at: dto.deleted_at,
            deleted_by: dto.deleted_by,
            external_code: dto.external_code,
        });
        return dto.id;
    };

    it('should create a SubcaseRelationship', async () => {
        const parentId = await createCase();
        const childId = await createCase();
        const creator = new SubCaseRelationCreator(repository, caseRepository);

        await creator.execute(parentId, childId);

        const rows = await repository
            .connection(repository.tableName)
            .select('*')
            .where({ parent_case_id: parentId, child_case_id: childId });

        expect(rows.length).toBe(1);
    });

    it('can find an existing SubcaseRelationship', async () => {
        const parentId = await createCase();
        const childId = await createCase();
        const creator = new SubCaseRelationCreator(repository, caseRepository);
        await creator.execute(parentId, childId);

        const found = await repository.find(new ValueObjectUuid('id', parentId), new ValueObjectUuid('id', childId));

        expect(found).toBeInstanceOf(SubcasesRelationship);
    });

    it('should delete an existing SubcaseRelationship', async () => {
        const parentId = await createCase();
        const childId = await createCase();
        const creator = new SubCaseRelationCreator(repository, caseRepository);
        await creator.execute(parentId, childId);

        const deleter = new SubCaseRelationDeleter(repository);
        await deleter.execute(parentId, childId);

        const result = await repository.find(new ValueObjectUuid('id', parentId), new ValueObjectUuid('id', childId));
        expect(result).toBeNull();
    });

    it('searches SubcaseRelationships with given criteria (filter by parent_case_id)', async () => {
        const parentId = await createCase();
        const childIds = [await createCase(), await createCase()];
        const creator = new SubCaseRelationCreator(repository, caseRepository);
        await Promise.all(childIds.map((c) => creator.execute(parentId, c)));

        const searcher = new SubCaseRelationSearcher(repository);
        const criteria = {
            filter: [{ field: `${repository.tableName}.parent_case_id`, operator: 'eq', value: parentId, type: 'and' }],
            relationship: undefined,
            limit: 10,
            offset: 0,
            order: null,
        };

        const result = await searcher.execute(criteria);
        const json = result.toJson();

        expect(Number(json.metadata.count)).toBe(2);
    });

    it('search returns empty collection when nothing matches', async () => {
        const searcher = new SubCaseRelationSearcher(repository);
        const criteria = {
            filter: [{ field: `${repository.tableName}.parent_case_id`, operator: 'eq', value: uuidv4(), type: 'and' }],
            relationship: undefined,
            limit: 10,
            offset: 0,
            order: null,
        };

        const result = await searcher.execute(criteria);
        const json = result.toJson();
        expect(result).toBeInstanceOf(SubCaseRelationCollectionResponse);
        expect(json.data.items.length).toBe(0);
        expect(Number(json.metadata.count)).toBe(0);
    });

    it('should throw when trying to create duplicated SubcaseRelationship', async () => {
        const parentId = await createCase();
        const childId = await createCase();
        const creator = new SubCaseRelationCreator(repository, caseRepository);

        await creator.execute(parentId, childId);
        await expect(creator.execute(parentId, childId)).rejects.toThrow();
    });

    it('should count SubcaseRelationships correctly', async () => {
        const parentId = await createCase();
        const creator = new SubCaseRelationCreator(repository, caseRepository);
        await creator.execute(parentId, await createCase());
        await creator.execute(parentId, await createCase());
        await creator.execute(parentId, await createCase());

        const searcher = new SubCaseRelationSearcher(repository);
        const dtoCriteria = {
            filter: [{ field: `${repository.tableName}.parent_case_id`, operator: 'eq', value: parentId, type: 'AND' }],
            relationship: undefined,
            limit: 10,
            offset: 0,
            order: undefined,
        };
        const result = await searcher.execute(dtoCriteria);
        expect(Number(result.toJson().metadata.count)).toBe(3);
    });

    it('should return null when finding non-existent relation', async () => {
        const nonParent = uuidv4();
        const nonChild = uuidv4();

        const found = await repository.find(new ValueObjectUuid('id', nonParent), new ValueObjectUuid('id', nonChild));
        expect(found).toBeNull();
    });

    it('should reject deletion of non-existent relation with clear error', async () => {
        const parentId = uuidv4();
        const childId = uuidv4();
        const deleter = new SubCaseRelationDeleter(repository);

        await expect(deleter.execute(parentId, childId)).rejects.toThrow('Relation does not exist');
    });

    it('logs to history on create relation', async () => {
        const parentId = await createCase();
        const childId = await createCase();
        const createdBy = uuidv4();
        const creator = new SubCaseRelationCreator(repository, caseRepository);

        await creator.execute(parentId, childId, createdBy);

        const rows = await repository
            .connection('history_rel_cases_subcases')
            .select('*')
            .where({ parent_case_id: parentId, child_case_id: childId })
            .orderBy('created_at', 'asc');

        expect(rows.length).toBe(1);
        expect(rows[0].action).toBe('create');
        expect(rows[0].parent_case_id).toBe(parentId);
        expect(rows[0].child_case_id).toBe(childId);
        expect(rows[0].created_by).toBe(createdBy);
    });

    it('logs to history on delete relation', async () => {
        const parentId = await createCase();
        const childId = await createCase();
        const creator = new SubCaseRelationCreator(repository, caseRepository);
        await creator.execute(parentId, childId, uuidv4());

        const deleter = new SubCaseRelationDeleter(repository);
        const deletedBy = uuidv4();

        await deleter.execute(parentId, childId, deletedBy);

        const rows = await repository
            .connection('history_rel_cases_subcases')
            .select('*')
            .where({ parent_case_id: parentId, child_case_id: childId })
            .orderBy('created_at', 'asc');

        expect(rows.length).toBe(2);

        const last = rows[rows.length - 1];
        expect(last.action).toBe('delete');
        expect(last.parent_case_id).toBe(parentId);
        expect(last.child_case_id).toBe(childId);
        expect(last.created_by).toBe(deletedBy);
    });

    it('returns false when parent has no children', async () => {
        const parentId = await createCase();

        const hasOpen = await service.hasOpenChildren(parentId);
        expect(hasOpen).toBe(false);
    });

    it('returns true when at least one child is open', async () => {
        const parentId = await createCase();
        const childOpen = await createCase();
        const childClose = await createCase();

        await caseRepository
            .connection(caseRepository.tableName)
            .where({ id: childOpen })
            .update({ fecha_resolucion: null });

        await caseRepository
            .connection(caseRepository.tableName)
            .where({ id: childClose })
            .update({ fecha_resolucion: new Date().toISOString() });

        const creator = new SubCaseRelationCreator(repository, caseRepository);
        await creator.execute(parentId, childOpen);
        await creator.execute(parentId, childClose);

        const hasOpen = await service.hasOpenChildren(parentId);
        expect(hasOpen).toBe(true);
    });

    it('returns false when all children are closed', async () => {
        const parentId = await createCase();
        const c1 = await createCase();
        const c2 = await createCase();

        await caseRepository
            .connection(caseRepository.tableName)
            .whereIn('id', [c1, c2])
            .update({ fecha_resolucion: new Date().toISOString() });

        const creator = new SubCaseRelationCreator(repository, caseRepository);
        await creator.execute(parentId, c1);
        await creator.execute(parentId, c2);

        const hasOpen = await service.hasOpenChildren(parentId);
        expect(hasOpen).toBe(false);
    });

    it('searches SubcaseRelationships with given real case criteria', async () => {
        const parentId = await createCase();
        const childIds = [await createCase(), await createCase()];
        const creator = new SubCaseRelationCreator(repository, caseRepository);
        await Promise.all(childIds.map((c) => creator.execute(parentId, c)));

        const searcher = new SubCaseRelationSearcher(repository);
        const criteria = {
            filter: [],
            relationship: null,
            order: {
                field: 'created_at',
                direction: 'desc',
            },
            limit: 10,
            offset: 0,
        };

        const result = await searcher.execute(criteria);
        const json = result.toJson();

        expect(Number(json.metadata.count)).toBe(2);
    });

    it('includes transicion_id on items so the frontend can validate same-transition bulk actions', async () => {
        const parentCase = await CasesMother.createCaseWithRelations(caseRepository);
        const childCase = await CasesMother.createCaseWithRelations(caseRepository);
        const parentId = parentCase.id.value;
        const childId = childCase.id.value;
        const creator = new SubCaseRelationCreator(repository, caseRepository);
        await creator.execute(parentId, childId);

        const searcher = new SubCaseRelationSearcher(repository);
        const criteria = {
            filter: [{ field: `${repository.tableName}.parent_case_id`, operator: 'eq', value: parentId, type: 'AND' }],
            relationship: undefined,
            limit: 10,
            offset: 0,
            order: null,
        };

        const result = await searcher.execute(criteria);
        const json = result.toJson();

        expect(json.data.items).toHaveLength(1);
        expect(json.data.items[0].transicion_id).toBe(childCase.transicion_id.value);
    });

    it('search with relationship and select returns aux_cases_data on items', async () => {
        const parentCase = await CasesMother.createCaseWithRelations(caseRepository);
        const childCase = await CasesMother.createCaseWithRelations(caseRepository);
        const parentId = parentCase.id.value;
        const childId = childCase.id.value;
        const creator = new SubCaseRelationCreator(repository, caseRepository);
        await creator.execute(parentId, childId);

        const auxPayload = { integration_aux: 'integration_value' };
        await repository
            .connection('aux_cases')
            .where({ caso_id: childId })
            .update({
                data: JSON.stringify(auxPayload),
            });

        const searcher = new SubCaseRelationSearcher(repository);
        const criteria = {
            filter: [{ field: `${repository.tableName}.parent_case_id`, operator: 'eq', value: parentId, type: 'AND' }],
            relationship: [
                {
                    table: 'aux_cases',
                    condition: { column: 'aux_cases.caso_id', refColumn: 'cases.id' },
                    type: 'left',
                },
            ],
            select: ['aux_cases.data as aux_cases_data'],
            limit: 10,
            offset: 0,
            order: null,
        };

        const result = await searcher.execute(criteria);
        const json = result.toJson();
        expect(json.data.items.length).toBe(1);
        const raw = json.data.items[0].aux_cases_data;
        const parsed = typeof raw === 'string' ? JSON.parse(raw) : raw;
        expect(parsed.integration_aux).toBe('integration_value');
    });

    it('search with relationship and json_extract selects nested path under aux_cases.data', async () => {
        const parentCase = await CasesMother.createCaseWithRelations(caseRepository);
        const childCase = await CasesMother.createCaseWithRelations(caseRepository);
        const parentId = parentCase.id.value;
        const childId = childCase.id.value;
        const creator = new SubCaseRelationCreator(repository, caseRepository);
        await creator.execute(parentId, childId);

        const auxPayload = {
            profile: {
                contact: {
                    name: 'nested_contact_name',
                },
            },
        };
        await repository
            .connection('aux_cases')
            .where({ caso_id: childId })
            .update({
                data: JSON.stringify(auxPayload),
            });

        const searcher = new SubCaseRelationSearcher(repository);
        const criteria = {
            filter: [{ field: `${repository.tableName}.parent_case_id`, operator: 'eq', value: parentId, type: 'AND' }],
            relationship: [
                {
                    table: 'aux_cases',
                    condition: { column: 'aux_cases.caso_id', refColumn: 'cases.id' },
                    type: 'left',
                },
            ],
            select: ["json_extract(aux_cases.data, '$.profile.contact.name') as aux_cases_data"],
            limit: 10,
            offset: 0,
            order: null,
        };

        const result = await searcher.execute(criteria);
        const json = result.toJson();
        expect(json.data.items.length).toBe(1);
        expect(json.data.items[0].aux_cases_data).toBe('nested_contact_name');
    });

    it('search with relationship and multiple json_extract selects for aux_cases.data fields', async () => {
        const parentCase = await CasesMother.createCaseWithRelations(caseRepository);
        const childCase = await CasesMother.createCaseWithRelations(caseRepository);
        const parentId = parentCase.id.value;
        const childId = childCase.id.value;
        const creator = new SubCaseRelationCreator(repository, caseRepository);
        await creator.execute(parentId, childId);

        const auxPayload = {
            name: 'aux_first_name',
            lastname: 'aux_last_name',
        };
        await repository
            .connection('aux_cases')
            .where({ caso_id: childId })
            .update({
                data: JSON.stringify(auxPayload),
            });

        const searcher = new SubCaseRelationSearcher(repository);
        const criteria = {
            filter: [{ field: `${repository.tableName}.parent_case_id`, operator: 'eq', value: parentId, type: 'AND' }],
            relationship: [
                {
                    table: 'aux_cases',
                    condition: { column: 'aux_cases.caso_id', refColumn: 'cases.id' },
                    type: 'left',
                },
            ],
            select: [
                "json_extract(aux_cases.data, '$.name') as aux_cases_name",
                "json_extract(aux_cases.data, '$.lastname') as aux_cases_lastname",
            ],
            limit: 10,
            offset: 0,
            order: null,
        };

        const result = await searcher.execute(criteria);
        const json = result.toJson();
        expect(json.data.items.length).toBe(1);
        expect(json.data.items[0].aux_cases_name).toBe('aux_first_name');
        expect(json.data.items[0].aux_cases_lastname).toBe('aux_last_name');
    });

    it('search with relationship and json_extract for aux_cases.data.genre as array of strings', async () => {
        const parentCase = await CasesMother.createCaseWithRelations(caseRepository);
        const childCase = await CasesMother.createCaseWithRelations(caseRepository);
        const parentId = parentCase.id.value;
        const childId = childCase.id.value;
        const creator = new SubCaseRelationCreator(repository, caseRepository);
        await creator.execute(parentId, childId);

        const genreValues = ['female', 'male', 'non_binary'];
        await repository
            .connection('aux_cases')
            .where({ caso_id: childId })
            .update({
                data: JSON.stringify({ genre: genreValues }),
            });

        const searcher = new SubCaseRelationSearcher(repository);
        const criteria = {
            filter: [{ field: `${repository.tableName}.parent_case_id`, operator: 'eq', value: parentId, type: 'AND' }],
            relationship: [
                {
                    table: 'aux_cases',
                    condition: { column: 'aux_cases.caso_id', refColumn: 'cases.id' },
                    type: 'left',
                },
            ],
            select: ["json_extract(aux_cases.data, '$.genre') as aux_cases_genre"],
            limit: 10,
            offset: 0,
            order: null,
        };

        const result = await searcher.execute(criteria);
        const json = result.toJson();
        expect(json.data.items.length).toBe(1);
        const raw = json.data.items[0].aux_cases_genre;
        const parsed = typeof raw === 'string' ? JSON.parse(raw) : raw;
        expect(parsed).toEqual(genreValues);
    });

    it('search with relationship and json_extract for aux_cases.data.genre as array of objects', async () => {
        const parentCase = await CasesMother.createCaseWithRelations(caseRepository);
        const childCase = await CasesMother.createCaseWithRelations(caseRepository);
        const parentId = parentCase.id.value;
        const childId = childCase.id.value;
        const creator = new SubCaseRelationCreator(repository, caseRepository);
        await creator.execute(parentId, childId);

        const genreObjects = [
            { label: 'female', code: '01' },
            { label: 'male', code: '02' },
        ];
        await repository
            .connection('aux_cases')
            .where({ caso_id: childId })
            .update({
                data: JSON.stringify({ genre: genreObjects }),
            });

        const searcher = new SubCaseRelationSearcher(repository);
        const criteria = {
            filter: [{ field: `${repository.tableName}.parent_case_id`, operator: 'eq', value: parentId, type: 'AND' }],
            relationship: [
                {
                    table: 'aux_cases',
                    condition: { column: 'aux_cases.caso_id', refColumn: 'cases.id' },
                    type: 'left',
                },
            ],
            select: [
                "json_extract(aux_cases.data, '$.genre') as aux_cases_genre",
                "json_extract(aux_cases.data, '$.genre[0].code') as aux_cases_genre_first_code",
            ],
            limit: 10,
            offset: 0,
            order: null,
        };

        const result = await searcher.execute(criteria);
        const json = result.toJson();
        expect(json.data.items.length).toBe(1);
        const rawGenre = json.data.items[0].aux_cases_genre;
        const parsedGenre = typeof rawGenre === 'string' ? JSON.parse(rawGenre) : rawGenre;
        expect(parsedGenre).toEqual(genreObjects);
        expect(json.data.items[0].aux_cases_genre_first_code).toBe('01');
    });

    it('search with relationship but without select does not include aux_cases_data', async () => {
        const parentCase = await CasesMother.createCaseWithRelations(caseRepository);
        const childCase = await CasesMother.createCaseWithRelations(caseRepository);
        const parentId = parentCase.id.value;
        const childId = childCase.id.value;
        const creator = new SubCaseRelationCreator(repository, caseRepository);
        await creator.execute(parentId, childId);

        await repository
            .connection('aux_cases')
            .where({ caso_id: childId })
            .update({
                data: JSON.stringify({ k: 'v' }),
            });

        const searcher = new SubCaseRelationSearcher(repository);
        const criteria = {
            filter: [{ field: `${repository.tableName}.parent_case_id`, operator: 'eq', value: parentId, type: 'AND' }],
            relationship: [
                {
                    table: 'aux_cases',
                    condition: { column: 'aux_cases.caso_id', refColumn: 'cases.id' },
                    type: 'left',
                },
            ],
            limit: 10,
            offset: 0,
            order: null,
        };

        const result = await searcher.execute(criteria);
        const json = result.toJson();
        expect(json.data.items[0].aux_cases_data).toBeUndefined();
    });

    it('search rejects select for table not present in relationship', async () => {
        const parentCase = await CasesMother.createCaseWithRelations(caseRepository);
        const childCase = await CasesMother.createCaseWithRelations(caseRepository);
        const parentId = parentCase.id.value;
        const childId = childCase.id.value;
        const creator = new SubCaseRelationCreator(repository, caseRepository);
        await creator.execute(parentId, childId);

        const searcher = new SubCaseRelationSearcher(repository);
        const criteria = {
            filter: [{ field: `${repository.tableName}.parent_case_id`, operator: 'eq', value: parentId, type: 'AND' }],
            relationship: undefined,
            select: ['aux_cases.data as aux_cases_data'],
            limit: 10,
            offset: 0,
            order: null,
        };

        await expect(searcher.execute(criteria)).rejects.toThrow(InvalidArgumentError);
    });
});
