import { BoardResourcesSearch } from '../../src/boards/application/resourcesSearch/BoardResourcesSearch.js';
import { KnexBoardResourcesRepository } from '../../src/boards/infrastructure/persistence/KnexBoardResourcesRepository.js';
import { KnexBoardsRepository } from '../../src/boards/infrastructure/persistence/KnexBoardsRepository.js';
import { BoardBulkViewColumnsValidator } from '../../src/boards/domain/BoardBulkViewColumnsValidator.js';
import { SchemaMetadataCache, ValidationFailError } from '../../src/shared/index.js';
import BoardsMother from './domain/BoardsMother.js';
import { KnexCaseRepository } from '../../src/cases/infrastructure/persistence/KnexCaseRepository.js';
import CasesMother from '../cases/domain/CasesMother.js';
import { knexConfig } from '../knexfile.js';
import TestHelper from '../TestHelper.js';

const VIEW_NAME = 'boards_cases_summary';

describe('BoardView - boards_ prefixed views as primary entity', () => {
    const repository = new KnexBoardsRepository(knexConfig);
    const boardsResourcesRepository = new KnexBoardResourcesRepository(repository.connection);
    const casesRepository = new KnexCaseRepository(repository.connection);

    beforeEach(async () => {
        await repository.connection.raw(`SET search_path TO ${repository.connection.client.config.schema}`);

        await repository.connection.raw(`
            CREATE VIEW ${VIEW_NAME} AS
            SELECT id, reference, responsable_id, created_by, created_at, deleted_at
            FROM cases
        `);
    });

    it('should persist a board with a boards_ prefixed view as primary_entity', async () => {
        const board = await BoardsMother.createAuxiliary(repository, {
            primary_entity: VIEW_NAME,
            filters: { items: [] },
            columns: [
                {
                    entity: VIEW_NAME,
                    field: 'id',
                    alias: 'id',
                    position: 1,
                    is_filterable: false,
                    data_type: 'STRING',
                    format: '',
                    function: null,
                    group_by: false,
                },
            ],
        });

        const boards = await repository.connection(repository.tableName).select('*');
        expect(boards.length).toBe(1);
        expect(board.primary_entity.value).toBe(VIEW_NAME);
    });

    it('should retrieve rows from a boards_ prefixed view via BoardResourcesSearch', async () => {
        const kase = await CasesMother.createCaseWithRelations(casesRepository);

        const board = await BoardsMother.createAuxiliary(repository, {
            primary_entity: VIEW_NAME,
            filters: { items: [] },
            columns: [
                {
                    entity: VIEW_NAME,
                    field: 'id',
                    alias: 'id',
                    position: 1,
                    is_filterable: true,
                    data_type: 'STRING',
                    format: '',
                    function: null,
                    group_by: false,
                },
                {
                    entity: VIEW_NAME,
                    field: 'reference',
                    alias: 'numero_caso',
                    position: 2,
                    is_filterable: true,
                    data_type: 'NUMBER',
                    format: '',
                    function: null,
                    group_by: false,
                },
            ],
        });

        const dtoCriteria = {
            filter: board.criteria.value.items,
            relationship: board.relations.value,
            limit: board.page_size.value,
            offset: 0,
            tableName: board.primary_entity.value,
            select: board.columns.value,
            having: board.havings.value,
            subQuery: false,
        };

        const service = new BoardResourcesSearch(boardsResourcesRepository, board.primary_entity.value);
        const results = await service.execute(dtoCriteria);
        const boardResult = results.toJson();

        expect(boardResult.data.items.length).toBe(1);
        expect(boardResult.data.items[0].id).toBe(kase.id.value);
        expect(boardResult.data.items[0].numero_caso).toBeDefined();
    });

    it('should apply WHERE filters when querying a boards_ prefixed view', async () => {
        await CasesMother.createCaseWithRelations(casesRepository);
        await CasesMother.createCaseWithRelations(casesRepository);

        const board = await BoardsMother.createAuxiliary(repository, {
            primary_entity: VIEW_NAME,
            filters: { items: [] },
            columns: [
                {
                    entity: VIEW_NAME,
                    field: 'id',
                    alias: 'id',
                    position: 1,
                    is_filterable: true,
                    data_type: 'STRING',
                    format: '',
                    function: null,
                    group_by: false,
                },
                {
                    entity: VIEW_NAME,
                    field: 'reference',
                    alias: 'numero_caso',
                    position: 2,
                    is_filterable: true,
                    data_type: 'NUMBER',
                    format: '',
                    function: null,
                    group_by: false,
                },
            ],
        });

        const dtoCriteria = {
            filter: [
                {
                    type: 'and',
                    entity: VIEW_NAME,
                    field: 'reference',
                    value: 1,
                    operator: 'eq',
                },
            ],
            relationship: board.relations.value,
            limit: board.page_size.value,
            offset: 0,
            tableName: board.primary_entity.value,
            select: board.columns.value,
            having: board.havings.value,
            subQuery: false,
        };

        const service = new BoardResourcesSearch(boardsResourcesRepository, board.primary_entity.value);
        const results = await service.execute(dtoCriteria);
        const boardResult = results.toJson();

        expect(boardResult.data.items.length).toBe(1);
        expect(boardResult.data.items[0].numero_caso).toBe(1);
    });

    it('should support GROUP BY and COUNT on a boards_ prefixed view', async () => {
        await CasesMother.createCaseWithRelations(casesRepository);
        await CasesMother.createCaseWithRelations(casesRepository);

        const board = await BoardsMother.createAuxiliary(repository, {
            primary_entity: VIEW_NAME,
            filters: { items: [] },
            columns: [
                {
                    entity: VIEW_NAME,
                    field: 'responsable_id',
                    alias: 'responsable',
                    position: 1,
                    is_filterable: false,
                    data_type: 'STRING',
                    format: '',
                    function: null,
                    group_by: true,
                },
                {
                    entity: VIEW_NAME,
                    field: 'id',
                    alias: 'total',
                    position: 2,
                    is_filterable: false,
                    data_type: 'STRING',
                    format: '',
                    function: 'count',
                    group_by: true,
                },
            ],
        });

        const dtoCriteria = {
            filter: [],
            relationship: board.relations.value,
            limit: board.page_size.value,
            offset: 0,
            tableName: board.primary_entity.value,
            select: board.columns.value,
            having: board.havings.value,
            subQuery: false,
        };

        const service = new BoardResourcesSearch(boardsResourcesRepository, board.primary_entity.value);
        const results = await service.execute(dtoCriteria);
        const boardResult = results.toJson();

        expect(boardResult.data.items.length).toBeGreaterThan(0);
        boardResult.data.items.forEach((item) => {
            expect(item).toHaveProperty('responsable');
            expect(item).toHaveProperty('total');
        });
    });

    it('should support subQuery pagination on a boards_ prefixed view', async () => {
        await CasesMother.createCaseWithRelations(casesRepository);
        await CasesMother.createCaseWithRelations(casesRepository);
        await CasesMother.createCaseWithRelations(casesRepository);

        const board = await BoardsMother.createAuxiliary(repository, {
            primary_entity: VIEW_NAME,
            filters: {
                items: [{ type: 'and', entity: VIEW_NAME, field: 'id', value: 'notNull', operator: 'notNull' }],
            },
            columns: [
                {
                    entity: VIEW_NAME,
                    field: 'id',
                    alias: 'id',
                    position: 1,
                    is_filterable: true,
                    data_type: 'STRING',
                    format: '',
                    function: null,
                    group_by: false,
                },
                {
                    entity: VIEW_NAME,
                    field: 'reference',
                    alias: 'numero_caso',
                    position: 2,
                    is_filterable: true,
                    data_type: 'NUMBER',
                    format: '',
                    function: null,
                    group_by: false,
                },
            ],
            page_size: 25,
        });

        const subQuery = { filter: [], limit: 2, offset: 1 };

        const dtoCriteria = {
            filter: board.criteria.value.items,
            relationship: board.relations.value,
            limit: board.page_size.value,
            offset: 0,
            tableName: board.primary_entity.value,
            select: board.columns.value,
            having: board.havings.value,
            subQuery,
        };

        const service = new BoardResourcesSearch(boardsResourcesRepository, board.primary_entity.value);
        const results = await service.execute(dtoCriteria);
        const boardResult = results.toJson();

        expect(boardResult.data.items.length).toBe(2);
        expect(boardResult.metadata.count).toBe(3);
    });

    describe('cases-like view bulk actions', () => {
        // View that exposes every column case bulk actions rely on (id + eligibility fields).
        const BULK_VIEW = 'boards_cases_bulk';
        // Cases-like view by name but missing the eligibility columns required for bulk actions.
        const PARTIAL_VIEW = 'boards_casos_partial';

        const createView = (name, columns) =>
            repository.connection.raw(`CREATE VIEW ${name} AS SELECT ${columns} FROM cases`);

        beforeEach(() => {
            // The schema is dropped/recreated on every reset; clear the module-level metadata
            // cache so view introspection never reads stale columns from a prior test.
            SchemaMetadataCache.clear();
        });

        it('appends fecha_resolucion and transicion_id when a cases-like view exposes them', async () => {
            const kase = await CasesMother.createCaseWithRelations(casesRepository);
            await createView(BULK_VIEW, 'id, reference, fecha_resolucion, transicion_id, created_at, deleted_at');

            // Board selects only id + reference; the eligibility columns must still be appended.
            const board = await BoardsMother.createAuxiliary(repository, {
                primary_entity: BULK_VIEW,
                filters: { items: [] },
                columns: [
                    {
                        entity: BULK_VIEW,
                        field: 'reference',
                        alias: 'numero_caso',
                        position: 1,
                        is_filterable: true,
                        data_type: 'NUMBER',
                        format: '',
                        function: null,
                        group_by: false,
                    },
                ],
            });

            const dtoCriteria = {
                filter: board.criteria.value.items,
                relationship: board.relations.value,
                limit: board.page_size.value,
                offset: 0,
                tableName: board.primary_entity.value,
                select: board.columns.value,
                having: board.havings.value,
                subQuery: false,
            };

            const service = new BoardResourcesSearch(boardsResourcesRepository, board.primary_entity.value);
            const boardResult = (await service.execute(dtoCriteria)).toJson();

            expect(boardResult.data.items.length).toBe(1);
            expect(boardResult.data.items[0].id).toBe(kase.id.value);
            expect(boardResult.data.items[0]).toHaveProperty('fecha_resolucion');
            expect(boardResult.data.items[0]).toHaveProperty('transicion_id');
        });

        it('does not append eligibility columns a cases-like view does not expose', async () => {
            await CasesMother.createCaseWithRelations(casesRepository);
            await createView(PARTIAL_VIEW, 'id, reference, created_at, deleted_at');

            const board = await BoardsMother.createAuxiliary(repository, {
                primary_entity: PARTIAL_VIEW,
                filters: { items: [] },
                columns: [
                    {
                        entity: PARTIAL_VIEW,
                        field: 'reference',
                        alias: 'numero_caso',
                        position: 1,
                        is_filterable: true,
                        data_type: 'NUMBER',
                        format: '',
                        function: null,
                        group_by: false,
                    },
                ],
            });

            const dtoCriteria = {
                filter: board.criteria.value.items,
                relationship: board.relations.value,
                limit: board.page_size.value,
                offset: 0,
                tableName: board.primary_entity.value,
                select: board.columns.value,
                having: board.havings.value,
                subQuery: false,
            };

            const service = new BoardResourcesSearch(boardsResourcesRepository, board.primary_entity.value);
            const boardResult = (await service.execute(dtoCriteria)).toJson();

            // The query must not reference columns the view lacks (it would error); the rows
            // simply omit them.
            expect(boardResult.data.items.length).toBe(1);
            expect(boardResult.data.items[0]).not.toHaveProperty('fecha_resolucion');
            expect(boardResult.data.items[0]).not.toHaveProperty('transicion_id');
        });

        it('validator passes for a cases-like view exposing the required columns', async () => {
            await createView(BULK_VIEW, 'id, reference, fecha_resolucion, transicion_id, created_at, deleted_at');
            const validator = new BoardBulkViewColumnsValidator(repository);

            await expect(
                validator.validate({ primary_entity: BULK_VIEW, can_admin_bulk_actions: true })
            ).resolves.toBeUndefined();
        });

        it('validator rejects a cases-like view missing the required columns', async () => {
            await createView(PARTIAL_VIEW, 'id, reference, created_at, deleted_at');
            const validator = new BoardBulkViewColumnsValidator(repository);

            await expect(
                validator.validate({ primary_entity: PARTIAL_VIEW, can_agent_bulk_actions: true })
            ).rejects.toThrow(ValidationFailError);
        });
    });
});
