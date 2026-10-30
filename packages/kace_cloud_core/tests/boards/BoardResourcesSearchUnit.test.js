import { jest } from '@jest/globals';
import { BoardResourcesSearch } from '../../src/boards/application/resourcesSearch/BoardResourcesSearch.js';
import { SchemaMetadataCache } from '../../src/shared/index.js';

/**
 * Unit tests for the branches of BoardResourcesSearch that
 * tests/boards/BoardResourcesIntegration.test.js does not reach: nullish/`||`
 * fallbacks, and the private static helpers (#resolveAnsField,
 * #appendAuxFkHiddenField, #appendCasesBulkHiddenFields). The repository is a
 * constructor-injected collaborator (same seam as BoardExportData), so this is a
 * pure application-layer unit test with a fake double - no Postgres, no AWS.
 *
 * `SchemaMetadataCache.getTableColumns` is spied via `jest.spyOn` (a plain
 * prototype/static-method monkeypatch, not an ESM module mock) because it is only
 * reached for cases-like *view* tables (tableName !== 'cases'), where it would
 * otherwise hit a real connection.
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

describe('BoardResourcesSearch', () => {
    afterEach(() => {
        jest.restoreAllMocks();
    });

    const buildRepository = (overrides = {}) => ({
        tableName: null,
        connection: {},
        search: jest.fn(async () => ({ rows: [{ id: '1' }] })),
        count: jest.fn(async () => ({ count: '1' })),
        countWithSubQuery: jest.fn(async () => ({ count: '1' })),
        searchCountByStatus: jest.fn(async () => []),
        searchCountByStatusWithSubQuery: jest.fn(async () => []),
        searchCountByAns: jest.fn(async () => []),
        ...overrides,
    });

    const simpleSelect = [{ entity: 'cases', field: 'id', alias: 'id' }];

    describe('fallback ?? [] al recorrer concat_sources sin fuente (linea 68)', () => {
        it('propaga el error de validacion de Criteria en vez de un TypeError', async () => {
            // Arrange: igual que en BoardExportData, una columna CONCAT sin concat_sources
            // resuelve a un `field` SQL vacio, que Criteria rechaza. Sin el fallback `?? []`
            // el forEach sobre `undefined` lanzaria un TypeError antes de llegar ahi.
            const repository = buildRepository();
            const service = new BoardResourcesSearch(repository, 'cases');
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
    });

    describe('subQuery.offset ?? 0 (lineas 116-122 y 171)', () => {
        it('usa 0 cuando subQuery tiene paginacion pero no trae offset', async () => {
            // Arrange
            const repository = buildRepository();
            const service = new BoardResourcesSearch(repository, 'cases');
            const dtoCriteria = {
                tableName: 'cases',
                select: simpleSelect,
                limit: 20,
                offset: 40,
                subQuery: { tableName: 'sub_cases', limit: 5 },
            };

            // Act
            await service.execute(dtoCriteria);

            // Assert
            const [, subQuery] = repository.search.mock.calls[0];
            expect(subQuery.limit).toBe(5);
            expect(subQuery.offset).toBe(0);
        });

        it('respeta subQuery.offset cuando viene explicito', async () => {
            // Arrange
            const repository = buildRepository();
            const service = new BoardResourcesSearch(repository, 'cases');
            const dtoCriteria = {
                tableName: 'cases',
                select: simpleSelect,
                limit: 20,
                offset: 40,
                subQuery: { tableName: 'sub_cases', limit: 5, offset: 15 },
            };

            // Act
            await service.execute(dtoCriteria);

            // Assert
            const [, subQuery] = repository.search.mock.calls[0];
            expect(subQuery.offset).toBe(15);
        });

        it('usa limit/offset del board cuando subQuery.limit es 0 (sin paginacion propia)', async () => {
            // Arrange: subQueryHasPagination es false cuando subQuery.limit === 0, asi que
            // debe caer al limit/offset del board en lugar de a los del subQuery.
            const repository = buildRepository();
            const service = new BoardResourcesSearch(repository, 'cases');
            const dtoCriteria = {
                tableName: 'cases',
                select: simpleSelect,
                limit: 20,
                offset: 40,
                subQuery: { tableName: 'sub_cases', limit: 0, offset: 99 },
            };

            // Act
            await service.execute(dtoCriteria);

            // Assert
            const [, subQuery] = repository.search.mock.calls[0];
            expect(subQuery.limit).toBe(20);
            expect(subQuery.offset).toBe(40);
        });
    });

    describe("countRow.count || countRow['count(*)'] (linea 154, con subQuery)", () => {
        it('usa count(*) cuando countWithSubQuery no devuelve count', async () => {
            // Arrange
            const repository = buildRepository({
                countWithSubQuery: jest.fn(async () => ({ 'count(*)': '7' })),
            });
            const service = new BoardResourcesSearch(repository, 'cases');
            const dtoCriteria = {
                tableName: 'cases',
                select: simpleSelect,
                limit: 10,
                offset: 0,
                subQuery: { tableName: 'sub_cases' },
            };

            // Act
            const response = await service.execute(dtoCriteria);

            // Assert
            expect(response.toJson().metadata.count).toBe(7);
        });

        it('usa count cuando countWithSubQuery lo devuelve', async () => {
            // Arrange
            const repository = buildRepository({
                countWithSubQuery: jest.fn(async () => ({ count: '4' })),
            });
            const service = new BoardResourcesSearch(repository, 'cases');
            const dtoCriteria = {
                tableName: 'cases',
                select: simpleSelect,
                limit: 10,
                offset: 0,
                subQuery: { tableName: 'sub_cases' },
            };

            // Act
            const response = await service.execute(dtoCriteria);

            // Assert
            expect(response.toJson().metadata.count).toBe(4);
        });
    });

    describe("count.count || count['count(*)'] (linea 165, sin subQuery)", () => {
        it('usa count(*) cuando el contador no devuelve count', async () => {
            // Arrange
            const repository = buildRepository({
                count: jest.fn(async () => ({ 'count(*)': '9' })),
            });
            const service = new BoardResourcesSearch(repository, 'cases');
            const dtoCriteria = { tableName: 'cases', select: simpleSelect, limit: 10, offset: 0 };

            // Act
            const response = await service.execute(dtoCriteria);

            // Assert
            expect(response.toJson().metadata.count).toBe(9);
        });

        it('usa count cuando el contador lo devuelve', async () => {
            // Arrange
            const repository = buildRepository({
                count: jest.fn(async () => ({ count: '6' })),
            });
            const service = new BoardResourcesSearch(repository, 'cases');
            const dtoCriteria = { tableName: 'cases', select: simpleSelect, limit: 10, offset: 0 };

            // Act
            const response = await service.execute(dtoCriteria);

            // Assert
            expect(response.toJson().metadata.count).toBe(6);
        });
    });

    describe('effectiveOffset||0 y effectiveLimit||1 (linea 173)', () => {
        it('usa 1 como divisor cuando limit es 0, evitando division por cero', async () => {
            // Arrange
            const repository = buildRepository({ count: jest.fn(async () => ({ count: '3' })) });
            const service = new BoardResourcesSearch(repository, 'cases');
            const dtoCriteria = { tableName: 'cases', select: simpleSelect, limit: 0, offset: 0 };

            // Act
            const response = await service.execute(dtoCriteria);

            // Assert: currentPage = floor(0/1) + 1 = 1; totalPages = ceil(3/0) = Infinity
            const { metadata } = response.toJson();
            expect(metadata.current_page).toBe(1);
            expect(metadata.total_pages).toBe(Infinity);
        });

        it('usa 0 como offset efectivo cuando offset es undefined', async () => {
            // Arrange
            const repository = buildRepository({ count: jest.fn(async () => ({ count: '3' })) });
            const service = new BoardResourcesSearch(repository, 'cases');
            const dtoCriteria = { tableName: 'cases', select: simpleSelect, limit: 10 };

            // Act
            const response = await service.execute(dtoCriteria);

            // Assert: currentPage = floor(0/10) + 1 = 1
            expect(response.toJson().metadata.current_page).toBe(1);
        });
    });

    describe('#resolveAnsField (lineas 244-253)', () => {
        const ansSelect = [
            { entity: 'cases', field: 'ans_field', alias: 'ans_alias', is_ans: true },
            { entity: 'cases', field: 'id', alias: 'id' },
        ];

        it('devuelve null (y no consulta countByAns) cuando no hay quickAnsFilter', async () => {
            // Arrange
            const repository = buildRepository();
            const service = new BoardResourcesSearch(repository, 'cases');
            const dtoCriteria = { tableName: 'cases', select: ansSelect, limit: 10, offset: 0 };

            // Act
            const response = await service.execute(dtoCriteria);

            // Assert
            expect(response.toJson().metadata.countByAns).toBeUndefined();
            expect(repository.searchCountByAns).not.toHaveBeenCalled();
        });

        it('devuelve null cuando quickAnsFilter.enabled no es true', async () => {
            // Arrange
            const repository = buildRepository();
            const service = new BoardResourcesSearch(repository, 'cases');
            const dtoCriteria = {
                tableName: 'cases',
                select: ansSelect,
                limit: 10,
                offset: 0,
                quickAnsFilter: { enabled: false, ans_column_alias: 'ans_alias' },
            };

            // Act
            const response = await service.execute(dtoCriteria);

            // Assert
            expect(response.toJson().metadata.countByAns).toBeUndefined();
        });

        it('devuelve null cuando quickAnsFilter esta habilitado pero sin ans_column_alias', async () => {
            // Arrange
            const repository = buildRepository();
            const service = new BoardResourcesSearch(repository, 'cases');
            const dtoCriteria = {
                tableName: 'cases',
                select: ansSelect,
                limit: 10,
                offset: 0,
                quickAnsFilter: { enabled: true },
            };

            // Act
            const response = await service.execute(dtoCriteria);

            // Assert
            expect(response.toJson().metadata.countByAns).toBeUndefined();
        });

        it('devuelve null cuando el alias no matchea ninguna columna is_ans del select', async () => {
            // Arrange
            const repository = buildRepository();
            const service = new BoardResourcesSearch(repository, 'cases');
            const dtoCriteria = {
                tableName: 'cases',
                select: ansSelect,
                limit: 10,
                offset: 0,
                quickAnsFilter: { enabled: true, ans_column_alias: 'no-existe' },
            };

            // Act
            const response = await service.execute(dtoCriteria);

            // Assert
            expect(response.toJson().metadata.countByAns).toBeUndefined();
        });

        it('devuelve null cuando la columna matcheada trae function (no es un campo simple)', async () => {
            // Arrange
            const repository = buildRepository();
            const service = new BoardResourcesSearch(repository, 'cases');
            const dtoCriteria = {
                tableName: 'cases',
                select: [{ entity: 'cases', field: 'ans_field', alias: 'ans_alias', is_ans: true, function: 'count' }],
                limit: 10,
                offset: 0,
                quickAnsFilter: { enabled: true, ans_column_alias: 'ans_alias' },
            };

            // Act
            const response = await service.execute(dtoCriteria);

            // Assert
            expect(response.toJson().metadata.countByAns).toBeUndefined();
        });

        // NOTA: no hay una prueba equivalente para `!ansColumn.entity` (la otra mitad
        // de la condicion en la linea 251). Es inalcanzable a traves de execute(): esa
        // misma columna del select ya paso por buildSelectColumns/`new Criteria(...)`
        // *antes* de llegar a #resolveAnsField, y una columna sin `entity` hace que
        // Criteria rechace el select con "The table 'undefined' is not part of the
        // allowed relationships" antes de que el codigo bajo prueba se ejecute
        // (verificado manualmente: lanza VOSelectByCriteria/InvalidArgumentError).

        it('devuelve null cuando la columna matcheada no trae field', async () => {
            // Arrange
            const repository = buildRepository();
            const service = new BoardResourcesSearch(repository, 'cases');
            const dtoCriteria = {
                tableName: 'cases',
                select: [{ entity: 'cases', alias: 'ans_alias', is_ans: true }],
                limit: 10,
                offset: 0,
                quickAnsFilter: { enabled: true, ans_column_alias: 'ans_alias' },
            };

            // Act
            const response = await service.execute(dtoCriteria);

            // Assert
            expect(response.toJson().metadata.countByAns).toBeUndefined();
            expect(repository.searchCountByAns).not.toHaveBeenCalled();
        });

        it('calcula countByAns [1,2,3] cuando el alias matchea una columna is_ans valida', async () => {
            // Arrange
            const repository = buildRepository({
                searchCountByAns: jest.fn(async () => [
                    { id: 1, count: 5 },
                    { id: 3, count: 2 },
                ]),
            });
            const service = new BoardResourcesSearch(repository, 'cases');
            const dtoCriteria = {
                tableName: 'cases',
                select: ansSelect,
                limit: 10,
                offset: 0,
                quickAnsFilter: { enabled: true, ans_column_alias: 'ans_alias' },
            };

            // Act
            const response = await service.execute(dtoCriteria);

            // Assert
            expect(response.toJson().metadata.countByAns).toEqual([
                { id: 1, count: 5 },
                { id: 2, count: 0 },
                { id: 3, count: 2 },
            ]);
        });

        it('deja countByAns en null y no revienta la respuesta cuando searchCountByAns falla', async () => {
            // Arrange
            const repository = buildRepository({
                searchCountByAns: jest.fn(async () => {
                    throw new Error('quick_ans_filter mal configurado');
                }),
            });
            const service = new BoardResourcesSearch(repository, 'cases');
            const dtoCriteria = {
                tableName: 'cases',
                select: ansSelect,
                limit: 10,
                offset: 0,
                quickAnsFilter: { enabled: true, ans_column_alias: 'ans_alias' },
            };

            // Act
            const response = await service.execute(dtoCriteria);

            // Assert
            expect(response.toJson().metadata.countByAns).toBeUndefined();
        });
    });

    describe('#appendAuxFkHiddenField (lineas 265-273)', () => {
        it('agrega el FK oculto cuando la tabla esta mapeada y no viene ya en el select', async () => {
            // Arrange
            const repository = buildRepository();
            const service = new BoardResourcesSearch(repository, 'aux_cases');
            const dtoCriteria = {
                tableName: 'aux_cases',
                select: [{ entity: 'aux_cases', field: 'nombre', alias: 'nombre' }],
                limit: 10,
                offset: 0,
            };

            // Act
            await service.execute(dtoCriteria);

            // Assert: aux_cases.caso_id se agrega al SELECT final
            const [criteria] = repository.search.mock.calls[0];
            const { query, calls } = makeFakeKnexQuery();
            criteria.convertToKnex(query);
            expect(calls.select[0][0]).toContain('aux_cases.caso_id');
        });

        it('no toca selectColumns cuando la tabla aux_ no esta en el mapeo de FKs', async () => {
            // Arrange
            const repository = buildRepository();
            const service = new BoardResourcesSearch(repository, 'aux_sin_mapeo');
            const dtoCriteria = {
                tableName: 'aux_sin_mapeo',
                select: [{ entity: 'aux_sin_mapeo', field: 'nombre', alias: 'nombre' }],
                limit: 10,
                offset: 0,
            };

            // Act
            await service.execute(dtoCriteria);

            // Assert: sin mapeo de FK, el SELECT final tiene exactamente las 2 columnas
            // originales (el id anteponido por el else de groupByColumns + nombre), sin el
            // campo FK extra que si se agrega cuando la tabla SI esta mapeada (ver la prueba
            // anterior, que llega a 3 con aux_cases.caso_id agregado).
            const [criteria] = repository.search.mock.calls[0];
            const { query, calls } = makeFakeKnexQuery();
            criteria.convertToKnex(query);
            expect(calls.select[0][0]).toHaveLength(2);
        });

        it('no duplica el FK oculto cuando ya viene explicito en el select', async () => {
            // Arrange: el propio select ya trae aux_cases.caso_id como columna.
            const repository = buildRepository();
            const service = new BoardResourcesSearch(repository, 'aux_cases');
            const dtoCriteria = {
                tableName: 'aux_cases',
                select: [
                    { entity: 'aux_cases', field: 'nombre', alias: 'nombre' },
                    { entity: 'aux_cases', field: 'caso_id', alias: 'caso_id' },
                ],
                limit: 10,
                offset: 0,
            };

            // Act
            await service.execute(dtoCriteria);

            // Assert: 3 columnas (id anteponido + nombre + caso_id), no 4
            const [criteria] = repository.search.mock.calls[0];
            const { query, calls } = makeFakeKnexQuery();
            criteria.convertToKnex(query);
            expect(calls.select[0][0]).toHaveLength(3);
        });

        it('construye el flat de deteccion de FK tambien cuando el select trae una columna con function (rama objeto del map)', async () => {
            // Arrange: una columna COUNT hace que buildSelectColumns devuelva un objeto
            // (no un string) para esa entrada, ejercitando la rama `typeof c !== 'string'`
            // de #appendAuxFkHiddenField y sus fallbacks `??` para entity/field/alias.
            const repository = buildRepository();
            const service = new BoardResourcesSearch(repository, 'aux_cases');
            const dtoCriteria = {
                tableName: 'aux_cases',
                select: [
                    { entity: 'aux_cases', field: 'id', alias: 'id' },
                    { entity: 'aux_cases', field: 'id', alias: 'total', function: 'count' },
                ],
            };

            // Act
            await service.execute(dtoCriteria);

            // Assert: el flat (que igual no contiene "caso_id") no bloquea el agregado del FK
            const [criteria] = repository.search.mock.calls[0];
            const { query, calls } = makeFakeKnexQuery();
            criteria.convertToKnex(query);
            const finalSelect = calls.select[calls.select.length - 1][0];
            expect(finalSelect).toContain('aux_cases.caso_id');
        });
    });

    describe('#appendCasesBulkHiddenFields (lineas 284-303)', () => {
        it('agrega fecha_resolucion y transicion_id cuando faltan en cases', async () => {
            // Arrange
            const repository = buildRepository();
            const service = new BoardResourcesSearch(repository, 'cases');
            const dtoCriteria = {
                tableName: 'cases',
                select: [
                    { entity: 'cases', field: 'id', alias: 'id' },
                    { entity: 'cases', field: 'total', alias: 'total', function: 'count' },
                ],
                limit: 10,
                offset: 0,
            };

            // Act
            await service.execute(dtoCriteria);

            // Assert
            const [criteria] = repository.search.mock.calls[0];
            const { query, calls } = makeFakeKnexQuery();
            criteria.convertToKnex(query);
            const finalSelect = calls.select[calls.select.length - 1][0];
            expect(finalSelect).toContain('cases.fecha_resolucion');
            expect(finalSelect).toContain('cases.transicion_id');
        });

        it('consulta SchemaMetadataCache para una vista cases-like distinta de "cases" y solo agrega las columnas que la vista expone', async () => {
            // Arrange: la vista solo expone fecha_resolucion (no transicion_id).
            const getTableColumns = jest
                .spyOn(SchemaMetadataCache, 'getTableColumns')
                .mockResolvedValue(['id', 'fecha_resolucion']);
            const repository = buildRepository();
            const service = new BoardResourcesSearch(repository, 'boards_cases_view');
            const dtoCriteria = {
                tableName: 'boards_cases_view',
                select: [{ entity: 'boards_cases_view', field: 'id', alias: 'id' }],
                limit: 10,
                offset: 0,
            };

            // Act
            await service.execute(dtoCriteria);

            // Assert: se consulto la vista correcta...
            expect(getTableColumns).toHaveBeenCalledWith(repository.connection, 'boards_cases_view');
            // ...y el SELECT final agrega fecha_resolucion (expuesta) pero NO transicion_id
            // (no expuesta). Sin esta comprobacion sobre el SELECT resultante, un `exposes`
            // que ignorara availableColumns (p.ej. `() => true`) seguiria dejando pasar el
            // test, ya que este solo verificaba la llamada al doble, nunca su efecto.
            const [criteria] = repository.search.mock.calls[0];
            const { query, calls } = makeFakeKnexQuery();
            criteria.convertToKnex(query);
            const finalSelect = calls.select[calls.select.length - 1][0];
            expect(finalSelect).toContain('boards_cases_view.fecha_resolucion');
            expect(finalSelect).not.toContain('boards_cases_view.transicion_id');
        });
    });
});
