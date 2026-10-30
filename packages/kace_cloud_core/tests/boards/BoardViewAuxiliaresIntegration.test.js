import { BoardResourcesSearch } from '../../src/boards/application/resourcesSearch/BoardResourcesSearch.js';
import { KnexBoardResourcesRepository } from '../../src/boards/infrastructure/persistence/KnexBoardResourcesRepository.js';
import { KnexBoardsRepository } from '../../src/boards/infrastructure/persistence/KnexBoardsRepository.js';
import BoardsMother from './domain/BoardsMother.js';
import { KnexCaseRepository } from '../../src/cases/infrastructure/persistence/KnexCaseRepository.js';
import CasesMother from '../cases/domain/CasesMother.js';
import { knexConfig } from '../knexfile.js';
import TestHelper from '../TestHelper.js';
import { v4 as uuidv4 } from 'uuid';
import dayjs from 'dayjs';

const VIEW_NAME = 'boards_board_auxiliares';

const GROUPS = {
    A: { placa: 'ABC001', servicio: 'SVC_ALPHA' },
    B: { placa: 'DEF002', servicio: 'SVC_BETA' },
    C: { placa: 'GHI003', servicio: 'SVC_GAMMA' },
    D: { placa: 'JKL004', servicio: 'SVC_DELTA' },
    E: { placa: 'MNO005', servicio: 'SVC_EPSILON' },
};

const BASE_COLUMNS = [
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
        field: 'placa',
        alias: 'placa',
        position: 2,
        is_filterable: true,
        data_type: 'STRING',
        format: '',
        function: null,
        group_by: false,
    },
    {
        entity: VIEW_NAME,
        field: 'servicio',
        alias: 'servicio',
        position: 3,
        is_filterable: true,
        data_type: 'STRING',
        format: '',
        function: null,
        group_by: false,
    },
    {
        entity: VIEW_NAME,
        field: 'gestionado',
        alias: 'gestionado',
        position: 4,
        is_filterable: true,
        data_type: 'STRING',
        format: '',
        function: null,
        group_by: false,
    },
    {
        entity: VIEW_NAME,
        field: 'cantidad',
        alias: 'cantidad',
        position: 5,
        is_filterable: true,
        data_type: 'NUMBER',
        format: '',
        function: null,
        group_by: false,
    },
];

describe('BoardView - boards_board_auxiliares (CTE + window functions + JSONB)', () => {
    const repository = new KnexBoardsRepository(knexConfig);
    const boardsResourcesRepository = new KnexBoardResourcesRepository(repository.connection);
    const casesRepository = new KnexCaseRepository(repository.connection);

    async function createCaseWithAuxData({ placa, servicio, gestionado, created_at } = {}) {
        const kase = await CasesMother.createCaseWithRelations(casesRepository, {
            created_at: created_at ?? dayjs().subtract(6, 'day').toISOString(),
        });

        await repository.connection('aux_cases').insert({
            id: uuidv4(),
            caso_id: kase.id.value,
            data: JSON.stringify({
                info_parent_case: { placa, servicio, gestionado },
            }),
            created_at: new Date().toISOString(),
        });

        return kase;
    }

    beforeEach(async () => {
        // resetSchemaAndMigrate deja search_path en `public`; restaurar el schema del
        // tenant para que el CREATE VIEW resuelva `cases`/`aux_cases` y la vista quede en
        // el schema del tenant (limpiada por DROP SCHEMA CASCADE en cada reset).
        await repository.connection.raw(`SET search_path TO ${repository.connection.client.config.schema}`);

        await repository.connection.raw(`
            CREATE VIEW ${VIEW_NAME} AS
            WITH base_data AS (
                SELECT
                    c.id,
                    ac.id AS aux_id,
                    c.external_code,
                    c.created_at,
                    c.deleted_at,
                    (ac.data -> 'info_parent_case' ->> 'placa')     AS placa,
                    (ac.data -> 'info_parent_case' ->> 'servicio')  AS servicio,
                    (ac.data -> 'info_parent_case' ->> 'gestionado') AS gestionado,
                    COUNT(*) OVER (
                        PARTITION BY
                            ac.data -> 'info_parent_case' ->> 'placa',
                            ac.data -> 'info_parent_case' ->> 'servicio'
                    ) AS cantidad,
                    BOOL_AND((ac.data -> 'info_parent_case' ->> 'gestionado') = 'SI')
                    OVER (
                        PARTITION BY
                            ac.data -> 'info_parent_case' ->> 'placa',
                            ac.data -> 'info_parent_case' ->> 'servicio'
                    ) AS todo_el_grupo_gestionado,
                    BOOL_OR((ac.data -> 'info_parent_case' ->> 'gestionado') = 'SI')
                    OVER (
                        PARTITION BY
                            ac.data -> 'info_parent_case' ->> 'placa',
                            ac.data -> 'info_parent_case' ->> 'servicio'
                    ) AS grupo_tiene_gestionado
                FROM cases c
                JOIN aux_cases ac ON ac.caso_id = c.id
                WHERE
                    c.created_at <= NOW() - INTERVAL '72 hours'
                    AND (ac.data -> 'info_parent_case' ->> 'gestionado') IS NOT NULL
            )
            SELECT id, aux_id, external_code, placa, servicio, cantidad, gestionado, deleted_at
            FROM base_data
            WHERE cantidad > 1 AND todo_el_grupo_gestionado IS FALSE
            ORDER BY grupo_tiene_gestionado, placa, servicio
        `);

        await createCaseWithAuxData({ ...GROUPS.A, gestionado: 'NO' });
        await createCaseWithAuxData({ ...GROUPS.A, gestionado: 'NO' });
        await createCaseWithAuxData({ ...GROUPS.A, gestionado: 'NO' });

        await createCaseWithAuxData({ ...GROUPS.B, gestionado: 'NO' });
        await createCaseWithAuxData({ ...GROUPS.B, gestionado: 'NO' });
        await createCaseWithAuxData({ ...GROUPS.B, gestionado: 'NO' });
        await createCaseWithAuxData({ ...GROUPS.B, gestionado: 'SI' });

        await createCaseWithAuxData({ ...GROUPS.C, gestionado: 'SI' });
        await createCaseWithAuxData({ ...GROUPS.C, gestionado: 'SI' });
        await createCaseWithAuxData({ ...GROUPS.C, gestionado: 'SI' });
        await createCaseWithAuxData({ ...GROUPS.C, gestionado: 'SI' });
        await createCaseWithAuxData({ ...GROUPS.C, gestionado: 'SI' });

        await createCaseWithAuxData({ ...GROUPS.D, gestionado: 'NO' });

        const recentDate = dayjs().subtract(1, 'hour').toISOString();
        await createCaseWithAuxData({ ...GROUPS.E, gestionado: 'NO', created_at: recentDate });
        await createCaseWithAuxData({ ...GROUPS.E, gestionado: 'NO', created_at: recentDate });
    });

    async function buildBoard(columns = BASE_COLUMNS) {
        return BoardsMother.createAuxiliary(repository, {
            primary_entity: VIEW_NAME,
            filters: { items: [] },
            columns,
        });
    }

    async function search(board, extraFilter = []) {
        const dtoCriteria = {
            filter: [...board.criteria.value.items, ...extraFilter],
            relationship: board.relations.value,
            limit: board.page_size.value,
            offset: 0,
            tableName: board.primary_entity.value,
            select: board.columns.value,
            having: board.havings.value,
            subQuery: false,
        };
        const service = new BoardResourcesSearch(boardsResourcesRepository, board.primary_entity.value);
        const result = await service.execute(dtoCriteria);
        return result.toJson().data.items;
    }

    function filterByPlaca(placa) {
        return [{ type: 'and', entity: VIEW_NAME, field: 'placa', value: placa, operator: 'eq' }];
    }

    it('shows only groups A and B — total 7 rows (C, D and E are excluded by view logic)', async () => {
        const board = await buildBoard();
        const items = await search(board);
        expect(items.length).toBe(7);
    });
    it('group A — ningún gestionado: 3 rows, all gestionado=NO, cantidad=3', async () => {
        const board = await buildBoard();
        const items = await search(board, filterByPlaca(GROUPS.A.placa));

        expect(items.length).toBe(3);
        items.forEach((item) => {
            expect(item.gestionado).toBe('NO');
            expect(Number(item.cantidad)).toBe(3);
            expect(item.placa).toBe(GROUPS.A.placa);
            expect(item.servicio).toBe(GROUPS.A.servicio);
        });
    });

    it('group B — 1 solo gestionado: 4 rows, exactly 1 SI and 3 NO, cantidad=4', async () => {
        const board = await buildBoard();
        const items = await search(board, filterByPlaca(GROUPS.B.placa));

        expect(items.length).toBe(4);

        const gestionados = items.filter((i) => i.gestionado === 'SI');
        const noGestionados = items.filter((i) => i.gestionado === 'NO');
        expect(gestionados.length).toBe(1);
        expect(noGestionados.length).toBe(3);

        items.forEach((item) => expect(Number(item.cantidad)).toBe(4));
    });

    it('group C — todos gestionados: 0 rows (excluded by todo_el_grupo_gestionado IS FALSE)', async () => {
        const board = await buildBoard();
        const items = await search(board, filterByPlaca(GROUPS.C.placa));
        expect(items.length).toBe(0);
    });

    it('group D — solo 1 registro: 0 rows (excluded by cantidad > 1)', async () => {
        const board = await buildBoard();
        const items = await search(board, filterByPlaca(GROUPS.D.placa));
        expect(items.length).toBe(0);
    });

    it('group E — reciente (< 72h): 0 rows (excluded by time window filter)', async () => {
        const board = await buildBoard();
        const items = await search(board, filterByPlaca(GROUPS.E.placa));
        expect(items.length).toBe(0);
    });

    it('ordering: group A (ninguno gestionado) appears before group B (alguno gestionado)', async () => {
        const board = await buildBoard();
        const items = await search(board);

        const firstGroupPlacas = items.slice(0, 3).map((i) => i.placa);
        const secondGroupPlacas = items.slice(3, 7).map((i) => i.placa);

        expect(firstGroupPlacas.every((p) => p === GROUPS.A.placa)).toBe(true);
        expect(secondGroupPlacas.every((p) => p === GROUPS.B.placa)).toBe(true);
    });

    it('cantidad reflects the window-function partition size, not the filtered result count', async () => {
        const board = await buildBoard();
        const items = await search(board);

        const groupAItems = items.filter((i) => i.placa === GROUPS.A.placa);
        const groupBItems = items.filter((i) => i.placa === GROUPS.B.placa);

        groupAItems.forEach((item) => expect(Number(item.cantidad)).toBe(3));
        groupBItems.forEach((item) => expect(Number(item.cantidad)).toBe(4));
    });
});
