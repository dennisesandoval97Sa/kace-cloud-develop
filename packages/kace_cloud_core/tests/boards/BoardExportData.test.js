import { jest } from '@jest/globals';
import { BoardExportData } from '../../src/boards/application/export/BoardExportData.js';
import { BoardCriteriaFormat } from '../../src/boards/domain/BoardCriteriaFormat.js';
import { ValidationFailError } from '../../src/shared/errors/ValidationFailError.js';
import { TenantContext } from '../../src/shared/infrastructure/context/TenantContext.js';
import { BoardUnifiedStatusPolicy } from '../../src/boards/domain/BoardUnifiedStatusPolicy.js';

/**
 * Unit tests for BoardExportData.
 *
 * The repository and the export service are constructor-injected collaborators
 * (see src/boards/application/export/BoardExportData.js:31-36), so this is a pure
 * application-layer unit test with fake doubles for both - it never touches
 * Postgres nor AWS. The real AWS/S3 upload lives inside ExportExcelData
 * (src/shared/domain/services/ExportExcelData.js), which BoardExportData never
 * imports directly; it only calls the injected `exportService.execute(...)`. There
 * is therefore nothing to mock at the @aws-sdk boundary for this file specifically.
 *
 * The real (unmocked) Criteria/BoardCriteriaFormat classes are used throughout:
 * Criteria wraps its constructor args in strictly-validated ValueObjects and
 * exposes no public getter for `select`/`groupBy`/`having` (see
 * src/shared/criteria/Criteria.js), so those branches of #buildQuery are verified
 * either through `jest.spyOn` on BoardCriteriaFormat.prototype (call-with
 * assertions on the delegated builder methods) or - for the GROUP BY computation,
 * which is inline in #buildQuery and never delegated - by feeding the real
 * Criteria instance BoardExportData built into `Criteria.convertToKnex()` with a
 * minimal call-recording fake query builder, and inspecting the resulting
 * `groupBy(...)` call.
 */
function makeFakeKnexQuery() {
    const calls = {};
    const target = {
        client: { raw: (sql, bindings) => ({ __raw: sql, bindings }) },
    };
    const proxy = new Proxy(target, {
        get(obj, prop) {
            if (prop in obj) return obj[prop];
            return (...args) => {
                (calls[prop] ??= []).push(args);
                return proxy;
            };
        },
    });
    return { query: proxy, calls };
}

describe('BoardExportData', () => {
    afterEach(() => {
        jest.restoreAllMocks();
    });

    const fakeTenant = (tzValue) => ({
        id: { value: 'tenant-1' },
        timezone: { value: tzValue },
    });

    const buildRepository = (searchResult) => ({
        tableName: null,
        search: jest.fn(async () => searchResult),
    });

    const buildExportService = () => ({
        execute: jest.fn(async () => 'https://bucket.example.com/signed-url'),
    });

    const baseSelect = [
        { entity: 'cases', field: 'id', alias: 'id' },
        {
            entity: 'cases',
            field: 'created_at',
            alias: 'creado',
            data_type: 'DATE',
        },
    ];

    it('lanza ValidationFailError con el codigo BOARD_EXPORT_NO_RECORDS cuando rows es undefined', async () => {
        // Arrange
        const repository = buildRepository({});
        const exportService = buildExportService();
        const service = new BoardExportData(repository, 'cases', exportService);
        const dtoCriteria = { tableName: 'cases', select: baseSelect };

        // Act & Assert
        await expect(service.execute(dtoCriteria)).rejects.toMatchObject({
            publicErrorCode: '0x030007',
        });
        expect(exportService.execute).not.toHaveBeenCalled();
    });

    it('lanza ValidationFailError cuando rows esta vacio', async () => {
        // Arrange
        const repository = buildRepository({ rows: [] });
        const exportService = buildExportService();
        const service = new BoardExportData(repository, 'cases', exportService);
        const dtoCriteria = { tableName: 'cases', select: baseSelect };

        // Act & Assert
        await expect(service.execute(dtoCriteria)).rejects.toBeInstanceOf(ValidationFailError);
        expect(exportService.execute).not.toHaveBeenCalled();
    });

    it('usa tableName_export como nombre de archivo por defecto cuando no se pasa options.fileName', async () => {
        // Arrange
        const repository = buildRepository({ rows: [{ id: '1', creado: null }] });
        const exportService = buildExportService();
        const service = new BoardExportData(repository, 'cases', exportService);
        const dtoCriteria = { tableName: 'cases', select: baseSelect };

        // Act
        await service.execute(dtoCriteria);

        // Assert
        expect(exportService.execute).toHaveBeenCalledWith(expect.any(Array), 'cases_export', expect.any(Array));
    });

    it('usa options.fileName cuando se provee explicitamente', async () => {
        // Arrange
        const repository = buildRepository({ rows: [{ id: '1', creado: null }] });
        const exportService = buildExportService();
        const service = new BoardExportData(repository, 'cases', exportService);
        const dtoCriteria = { tableName: 'cases', select: baseSelect };

        // Act
        await service.execute(dtoCriteria, { fileName: 'reporte-personalizado' });

        // Assert
        expect(exportService.execute).toHaveBeenCalledWith(
            expect.any(Array),
            'reporte-personalizado',
            expect.any(Array)
        );
    });

    it('usa UTC por defecto cuando no hay tenant en contexto', async () => {
        // Arrange
        const repository = buildRepository({ rows: [{ id: '1', creado: '2026-01-15T12:30:00.000Z' }] });
        const exportService = buildExportService();
        const service = new BoardExportData(repository, 'cases', exportService);
        const dtoCriteria = { tableName: 'cases', select: baseSelect };

        // Act
        await service.execute(dtoCriteria);

        // Assert: formateado en UTC -> 2026/01/15 12:30:00
        const [rows] = exportService.execute.mock.calls[0];
        expect(rows[0].creado).toBe('2026/01/15 12:30:00');
    });

    it('usa la zona horaria del tenant en contexto cuando esta configurada', async () => {
        // Arrange
        const repository = buildRepository({ rows: [{ id: '1', creado: '2026-01-15T12:30:00.000Z' }] });
        const exportService = buildExportService();
        const service = new BoardExportData(repository, 'cases', exportService);
        const dtoCriteria = { tableName: 'cases', select: baseSelect };

        // Act
        await TenantContext.run(fakeTenant('America/Bogota'), async () => {
            await service.execute(dtoCriteria);
        });

        // Assert: America/Bogota = UTC-5 -> 2026/01/15 07:30:00
        const [rows] = exportService.execute.mock.calls[0];
        expect(rows[0].creado).toBe('2026/01/15 07:30:00');
    });

    it('no formatea columnas DATE cuyo valor es null o undefined', async () => {
        // Arrange
        const repository = buildRepository({
            rows: [{ id: '1', creado: null }, { id: '2' }],
        });
        const exportService = buildExportService();
        const service = new BoardExportData(repository, 'cases', exportService);
        const dtoCriteria = { tableName: 'cases', select: baseSelect };

        // Act
        await service.execute(dtoCriteria);

        // Assert
        const [rows] = exportService.execute.mock.calls[0];
        expect(rows[0].creado).toBeNull();
        expect(rows[1].creado).toBeUndefined();
    });

    it('usa el formato por defecto YYYY/MM/DD HH:MM:SS cuando la columna DATE no trae format', async () => {
        // Arrange
        const repository = buildRepository({ rows: [{ id: '1', creado: '2026-03-02T05:00:00.000Z' }] });
        const exportService = buildExportService();
        const service = new BoardExportData(repository, 'cases', exportService);
        const dtoCriteria = { tableName: 'cases', select: baseSelect };

        // Act
        await service.execute(dtoCriteria);

        // Assert
        const [rows] = exportService.execute.mock.calls[0];
        expect(rows[0].creado).toBe('2026/03/02 05:00:00');
    });

    it('respeta col.format cuando la columna DATE lo trae', async () => {
        // Arrange
        const select = [
            { entity: 'cases', field: 'id', alias: 'id' },
            { entity: 'cases', field: 'created_at', alias: 'creado', data_type: 'DATE', format: 'YYYY/MM/DD' },
        ];
        const repository = buildRepository({ rows: [{ id: '1', creado: '2026-03-02T05:00:00.000Z' }] });
        const exportService = buildExportService();
        const service = new BoardExportData(repository, 'cases', exportService);
        const dtoCriteria = { tableName: 'cases', select };

        // Act
        await service.execute(dtoCriteria);

        // Assert
        const [rows] = exportService.execute.mock.calls[0];
        expect(rows[0].creado).toBe('2026/03/02');
    });

    it('no aplica formateo de fecha a columnas DATE que usan la funcion DATE_DIFFERENCE', async () => {
        // Arrange
        const select = [
            { entity: 'cases', field: 'id', alias: 'id' },
            {
                entity: 'cases',
                field: 'created_at',
                alias: 'comparacion',
                data_type: 'DATE',
                function: 'date_difference',
                comparison_type: 'VALUE',
                comparison_value: 'NOW',
            },
        ];
        // 439200s = 5d 2h 0m
        const FIVE_DAYS_TWO_HOURS = 5 * 86400 + 2 * 3600;
        const repository = buildRepository({ rows: [{ id: '1', comparacion: FIVE_DAYS_TWO_HOURS }] });
        const exportService = buildExportService();
        const service = new BoardExportData(repository, 'cases', exportService);
        const dtoCriteria = { tableName: 'cases', select };

        // Act
        await service.execute(dtoCriteria);

        // Assert
        const [rows] = exportService.execute.mock.calls[0];
        expect(rows[0].comparacion).toBe('5 días → 2 horas → 0 minutos');
    });

    it('no aplica formateo de fecha a columnas DATE con funcion de agregacion COUNT', async () => {
        // Arrange
        const select = [
            { entity: 'cases', field: 'id', alias: 'id' },
            {
                entity: 'cases',
                field: 'created_at',
                alias: 'total_casos',
                data_type: 'DATE',
                function: 'count',
            },
        ];
        const repository = buildRepository({ rows: [{ id: '1', total_casos: '5' }] });
        const exportService = buildExportService();
        const service = new BoardExportData(repository, 'cases', exportService);
        const dtoCriteria = { tableName: 'cases', select };

        // Act
        await service.execute(dtoCriteria);

        // Assert
        const [rows] = exportService.execute.mock.calls[0];
        expect(rows[0].total_casos).toBe('5');
    });

    it('aplica formateo de fecha a columnas DATE con funcion de agregacion MIN o MAX', async () => {
        // Arrange
        const select = [
            { entity: 'cases', field: 'id', alias: 'id' },
            {
                entity: 'cases',
                field: 'created_at',
                alias: 'primera_fecha',
                data_type: 'DATE',
                function: 'MIN',
            },
            {
                entity: 'cases',
                field: 'created_at',
                alias: 'ultima_fecha',
                data_type: 'DATE',
                function: 'max',
                format: 'YYYY/MM/DD',
            },
        ];
        const repository = buildRepository({
            rows: [
                {
                    id: '1',
                    primera_fecha: '2026-03-02T05:00:00.000Z',
                    ultima_fecha: '2026-03-10T12:00:00.000Z',
                },
            ],
        });
        const exportService = buildExportService();
        const service = new BoardExportData(repository, 'cases', exportService);
        const dtoCriteria = { tableName: 'cases', select };

        // Act
        await service.execute(dtoCriteria);

        // Assert
        const [rows] = exportService.execute.mock.calls[0];
        expect(rows[0].primera_fecha).toBe('2026/03/02 05:00:00');
        expect(rows[0].ultima_fecha).toBe('2026/03/10');
    });

    it('no aplica formateo de fecha a columnas auxiliares JSON_ARRAY_KEY_EXTRACT con data_type DATE', async () => {
        // Arrange
        const select = [
            { entity: 'cases', field: 'id', alias: 'id' },
            {
                entity: 'aux_cases',
                field: 'fechas.vencimiento',
                alias: 'vencimientos',
                data_type: 'DATE',
            },
        ];
        const relationship = [
            {
                related_entity: 'aux_cases',
                alias: 'aux_cases',
                join_type: 'left',
                on: [{ left: 'cases.id', right: 'aux_cases.case_id' }],
            },
        ];
        const repository = buildRepository({
            rows: [{ id: '1', vencimientos: [{ vencimiento: '2026-03-02' }, { vencimiento: '2026-04-15' }] }],
        });
        const exportService = buildExportService();
        const service = new BoardExportData(repository, 'cases', exportService);
        const dtoCriteria = { tableName: 'cases', select, relationship };

        // Act
        await service.execute(dtoCriteria);

        // Assert
        const [rows] = exportService.execute.mock.calls[0];
        expect(rows[0].vencimientos).toBe('2026-03-02, 2026-04-15');
    });

    it('formatea correctamente columnas DATE_DIFFERENCE con valores negativos y nulos', async () => {
        // Arrange
        const select = [
            { entity: 'cases', field: 'id', alias: 'id' },
            {
                entity: 'cases',
                field: 'created_at',
                alias: 'diferencia_negativa',
                data_type: 'DATE',
                function: 'date_difference',
                comparison_type: 'VALUE',
                comparison_value: 'NOW',
            },
            {
                entity: 'cases',
                field: 'created_at',
                alias: 'diferencia_nula',
                data_type: 'DATE',
                function: 'date_difference',
                comparison_type: 'VALUE',
                comparison_value: 'NOW',
            },
        ];
        // -439200s = -5d -2h -0m
        const NEGATIVE_FIVE_DAYS_TWO_HOURS = -(5 * 86400 + 2 * 3600);
        const repository = buildRepository({
            rows: [
                {
                    id: '1',
                    diferencia_negativa: NEGATIVE_FIVE_DAYS_TWO_HOURS,
                    diferencia_nula: null,
                },
            ],
        });
        const exportService = buildExportService();
        const service = new BoardExportData(repository, 'cases', exportService);
        const dtoCriteria = { tableName: 'cases', select };

        // Act
        await service.execute(dtoCriteria);

        // Assert
        const [rows] = exportService.execute.mock.calls[0];
        expect(rows[0].diferencia_negativa).toBe('-5 días → -2 horas → -0 minutos');
        expect(rows[0].diferencia_nula).toBeNull();
    });

    it('usa col.field como key de dateColumns cuando la columna DATE no trae alias', async () => {
        // Arrange
        const select = [
            { entity: 'cases', field: 'id', alias: 'id' },
            { entity: 'cases', field: 'fecha_limite', data_type: 'DATE' },
        ];
        const repository = buildRepository({ rows: [{ id: '1', fecha_limite: '2026-03-02T05:00:00.000Z' }] });
        const exportService = buildExportService();
        const service = new BoardExportData(repository, 'cases', exportService);
        const dtoCriteria = { tableName: 'cases', select };

        // Act
        await service.execute(dtoCriteria);

        // Assert
        const [rows] = exportService.execute.mock.calls[0];
        expect(rows[0].fecha_limite).toBe('2026/03/02 05:00:00');
    });

    it('extrae los headers usando el alias cuando existe y el field cuando no', async () => {
        // Arrange
        const select = [
            { entity: 'cases', field: 'id', alias: 'ID Caso' },
            { entity: 'cases', field: 'reference' },
        ];
        const repository = buildRepository({ rows: [{ id: '1', reference: 'REF-1' }] });
        const exportService = buildExportService();
        const service = new BoardExportData(repository, 'cases', exportService);
        const dtoCriteria = { tableName: 'cases', select };

        // Act
        await service.execute(dtoCriteria);

        // Assert
        const [, , headers] = exportService.execute.mock.calls[0];
        expect(headers).toEqual(['ID Caso', 'reference']);
    });

    it('ignora relationship y filter cuando no vienen como arrays', async () => {
        // Arrange
        const buildRelationships = jest.spyOn(BoardCriteriaFormat.prototype, 'buildRelationships');
        const buildFilters = jest.spyOn(BoardCriteriaFormat.prototype, 'buildFilters');
        const repository = buildRepository({ rows: [{ id: '1' }] });
        const exportService = buildExportService();
        const service = new BoardExportData(repository, 'cases', exportService);
        const dtoCriteria = {
            tableName: 'cases',
            select: [{ entity: 'cases', field: 'id', alias: 'id' }],
            relationship: 'no-es-array',
            filter: 'tampoco-es-array',
        };

        // Act
        await service.execute(dtoCriteria);

        // Assert
        expect(buildRelationships).not.toHaveBeenCalled();
        expect(buildFilters).not.toHaveBeenCalled();
    });

    it('construye relationships y filters cuando vienen como arrays', async () => {
        // Arrange
        const buildRelationships = jest.spyOn(BoardCriteriaFormat.prototype, 'buildRelationships');
        const buildFilters = jest.spyOn(BoardCriteriaFormat.prototype, 'buildFilters');
        const repository = buildRepository({ rows: [{ id: '1' }] });
        const exportService = buildExportService();
        const service = new BoardExportData(repository, 'cases', exportService);
        const relationship = [
            {
                related_entity: 'users',
                alias: 'u',
                join_type: 'left',
                on: [{ left: 'cases.user_id', right: 'u.id' }],
            },
        ];
        const filter = [{ entity: 'cases', field: 'status', operator: 'eq', value: 'open', type: 'AND' }];
        const dtoCriteria = {
            tableName: 'cases',
            select: [{ entity: 'cases', field: 'id', alias: 'id' }],
            relationship,
            filter,
        };

        // Act
        await service.execute(dtoCriteria);

        // Assert
        expect(buildRelationships).toHaveBeenCalledWith(relationship);
        // El filtro llega expandido por BoardUnifiedStatusPolicy.expandFilters; como el
        // operador no es 'eq' sobre un valor booleano queda intacto (misma forma).
        expect(buildFilters).toHaveBeenCalledWith(filter);
    });

    it('construye having cuando dtoCriteria.having es un array', async () => {
        // Arrange
        const buildHavings = jest.spyOn(BoardCriteriaFormat.prototype, 'buildHavings');
        const repository = buildRepository({ rows: [{ id: '1' }] });
        const exportService = buildExportService();
        const service = new BoardExportData(repository, 'cases', exportService);
        const having = [{ entity: 'cases', field: 'id', operator: 'gt', value: 1 }];
        const dtoCriteria = {
            tableName: 'cases',
            select: [{ entity: 'cases', field: 'id', alias: 'id', group_by: true, function: null }],
            having,
        };

        // Act
        await service.execute(dtoCriteria);

        // Assert
        expect(buildHavings).toHaveBeenCalledWith(having);
    });

    it('deja having en null (sin invocar buildHavings) cuando dtoCriteria.having no viene', async () => {
        // Arrange
        const buildHavings = jest.spyOn(BoardCriteriaFormat.prototype, 'buildHavings');
        const repository = buildRepository({ rows: [{ id: '1' }] });
        const exportService = buildExportService();
        const service = new BoardExportData(repository, 'cases', exportService);
        const dtoCriteria = {
            tableName: 'cases',
            select: [{ entity: 'cases', field: 'id', alias: 'id' }],
        };

        // Act
        await service.execute(dtoCriteria);

        // Assert
        expect(buildHavings).not.toHaveBeenCalled();
    });

    it('agrupa por columnas group_by y agrega los concat_sources que faltan al GROUP BY', async () => {
        // Arrange
        const repository = buildRepository({ rows: [{ id: '1' }] });
        const exportService = buildExportService();
        const service = new BoardExportData(repository, 'cases', exportService);
        const dtoCriteria = {
            tableName: 'cases',
            select: [
                { entity: 'cases', field: 'id', alias: 'id', group_by: true, function: null },
                {
                    entity: 'cases',
                    field: 'fullname',
                    alias: 'fullname',
                    function: 'concat',
                    concat_sources: [
                        { entity: 'cases', field: 'id' },
                        { entity: 'cases', field: 'name' },
                    ],
                },
            ],
        };

        // Act
        await service.execute(dtoCriteria);

        // Assert: cases.id ya estaba en el GROUP BY (no se duplica), cases.name se agrega.
        // Se observa a traves del Criteria real que recibio el repositorio, convirtiendolo
        // a Knex con un query builder falso que solo graba las llamadas.
        const [criteria] = repository.search.mock.calls[0];
        const { query, calls } = makeFakeKnexQuery();
        criteria.convertToKnex(query);
        expect(calls.groupBy[0][0]).toEqual(['cases.id', 'cases.name']);
    });

    it('no agrega columnas al GROUP BY cuando ninguna columna trae group_by, y antepone el id de la tabla al SELECT', async () => {
        // Arrange
        const repository = buildRepository({ rows: [{ id: '1' }] });
        const exportService = buildExportService();
        const service = new BoardExportData(repository, 'cases', exportService);
        const dtoCriteria = {
            tableName: 'cases',
            select: [
                { entity: 'cases', field: 'id', alias: 'id' },
                { entity: 'cases', field: 'reference', alias: 'reference' },
            ],
        };

        // Act
        await service.execute(dtoCriteria);

        // Assert
        const [criteria] = repository.search.mock.calls[0];
        const { query, calls } = makeFakeKnexQuery();
        criteria.convertToKnex(query);
        expect(calls.groupBy).toBeUndefined();
        expect(calls.select[0][0]).toEqual(['cases.id as id', 'cases.id as id', 'cases.reference as reference']);
    });

    it('usa el fallback ?? [] al recorrer concat_sources cuando una columna CONCAT no los trae', async () => {
        // Arrange: una columna CONCAT sin concat_sources resuelve a un `field` SQL vacio,
        // que Criteria rechaza mas adelante (VOSelectByCriteria exige `field` no vacio). El
        // punto de esta prueba es la linea `(col.concat_sources ?? []).forEach(...)` de
        // #buildQuery: sin el fallback, iterar sobre `undefined` lanzaria un TypeError antes
        // de llegar siquiera a Criteria; con el fallback, el forEach sobre [] es un no-op y
        // el error observado es el de validacion de Criteria, no un TypeError.
        const repository = buildRepository({ rows: [{ id: '1' }] });
        const exportService = buildExportService();
        const service = new BoardExportData(repository, 'cases', exportService);
        const dtoCriteria = {
            tableName: 'cases',
            select: [
                { entity: 'cases', field: 'id', alias: 'id', group_by: true, function: null },
                { entity: 'cases', field: 'fullname', alias: 'fullname', function: 'concat' },
            ],
        };

        // Act & Assert
        await expect(service.execute(dtoCriteria)).rejects.toThrow('Missing required property: field');
        expect(repository.search).not.toHaveBeenCalled();
    });

    it('ignora subQuery cuando no viene en dtoCriteria', async () => {
        // Arrange
        const repository = buildRepository({ rows: [{ id: '1' }] });
        const exportService = buildExportService();
        const service = new BoardExportData(repository, 'cases', exportService);
        const dtoCriteria = {
            tableName: 'cases',
            select: [{ entity: 'cases', field: 'id', alias: 'id' }],
        };

        // Act
        await service.execute(dtoCriteria);

        // Assert
        const [, subQuery] = repository.search.mock.calls[0];
        expect(subQuery).toBeUndefined();
    });

    it('fuerza limit/offset a null en subQuery y expande subQuery.filter cuando es array', async () => {
        // Arrange: el filtro apunta a una columna de estado unificado (`is_status_column`), que
        // es justo el caso que BoardUnifiedStatusPolicy.expandFilters REESCRIBE por completo
        // (de {entity,field,operator,value} a {isBoardUnifiedSqlWhere, sql, type}). Con el
        // filtro "open" anterior la entrada cruda y la expandida eran identicas, asi que
        // descartar la expansion pasaba inadvertido.
        const repository = buildRepository({ rows: [{ id: '1' }] });
        const exportService = buildExportService();
        const service = new BoardExportData(repository, 'cases', exportService);
        const originalFilter = [{ entity: 'cases', field: 'estado', operator: 'eq', value: true }];
        const dtoCriteria = {
            tableName: 'cases',
            select: [
                { entity: 'cases', field: 'id', alias: 'id' },
                { entity: 'cases', field: 'status', alias: 'estado', is_status_column: true },
            ],
            subQuery: {
                tableName: 'sub_cases',
                limit: 10,
                offset: 5,
                filter: originalFilter,
            },
        };

        // Act
        await service.execute(dtoCriteria);

        // Assert
        const [, subQuery] = repository.search.mock.calls[0];
        expect(subQuery.limit).toBeNull();
        expect(subQuery.offset).toBeNull();
        // El filtro que llega al repositorio debe ser EXACTAMENTE el que produce la politica,
        // con el alias externo 't' y el `select` externo como contexto.
        expect(subQuery.filter).toEqual(
            BoardUnifiedStatusPolicy.expandFilters(originalFilter, dtoCriteria.select, 't')
        );
        // ...y no puede ser el filtro crudo reenviado tal cual.
        expect(subQuery.filter).not.toEqual(originalFilter);
        expect(subQuery.filter[0]).toMatchObject({ isBoardUnifiedSqlWhere: true, type: 'AND' });
        expect(subQuery.filter[0].sql).toContain('t.estado');
        // El dtoCriteria original no se muta.
        expect(originalFilter).toEqual([{ entity: 'cases', field: 'estado', operator: 'eq', value: true }]);
    });

    it('conserva subQuery.filter sin cambios cuando no es un array', async () => {
        // Arrange
        const repository = buildRepository({ rows: [{ id: '1' }] });
        const exportService = buildExportService();
        const service = new BoardExportData(repository, 'cases', exportService);
        const rawFilter = { some: 'legacy-shape' };
        const dtoCriteria = {
            tableName: 'cases',
            select: [{ entity: 'cases', field: 'id', alias: 'id' }],
            subQuery: { tableName: 'sub_cases', filter: rawFilter },
        };

        // Act
        await service.execute(dtoCriteria);

        // Assert
        const [, subQuery] = repository.search.mock.calls[0];
        expect(subQuery.filter).toBe(rawFilter);
    });

    it('aplica orden insensible a mayusculas cuando subQuery.order referencia una columna STRING', async () => {
        // Arrange
        const repository = buildRepository({ rows: [{ id: '1' }] });
        const exportService = buildExportService();
        const service = new BoardExportData(repository, 'cases', exportService);
        const order = { entity: 'cases', field: 'name' };
        const dtoCriteria = {
            tableName: 'cases',
            select: [{ entity: 'cases', field: 'name', alias: 'name', data_type: 'STRING' }],
            subQuery: { tableName: 'sub_cases', order },
        };

        // Act
        await service.execute(dtoCriteria);

        // Assert: applyCaseInsensitiveOrders muto realmente el objeto order
        expect(order.data_type).toBe('STRING');
        expect(order.insensitive).toBe(true);
    });

    it('no toca subQuery.order cuando no viene', async () => {
        // Arrange
        const repository = buildRepository({ rows: [{ id: '1' }] });
        const exportService = buildExportService();
        const service = new BoardExportData(repository, 'cases', exportService);
        const dtoCriteria = {
            tableName: 'cases',
            select: [{ entity: 'cases', field: 'id', alias: 'id' }],
            subQuery: { tableName: 'sub_cases' },
        };

        // Act
        await service.execute(dtoCriteria);

        // Assert
        const [, subQuery] = repository.search.mock.calls[0];
        expect(subQuery.order).toBeUndefined();
    });

    it('devuelve el downloadUrl que resuelve el exportService inyectado', async () => {
        // Arrange
        const repository = buildRepository({ rows: [{ id: '1' }] });
        const exportService = buildExportService();
        const service = new BoardExportData(repository, 'cases', exportService);
        const dtoCriteria = { tableName: 'cases', select: [{ entity: 'cases', field: 'id', alias: 'id' }] };

        // Act
        const result = await service.execute(dtoCriteria);

        // Assert
        expect(result).toEqual({ data: { downloadUrl: 'https://bucket.example.com/signed-url' } });
    });
});
