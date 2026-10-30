import { jest } from '@jest/globals';
import { KnexBoardPrimaryRepository } from '../../src/boards/infrastructure/persistence/KnexBoardPrimaryRepository.js';
import { knexConfig } from '../knexfile.js';

/**
 * Unit tests for KnexBoardPrimaryRepository.
 *
 * `buildQuery` never awaits/executes the query it returns - it only assembles a
 * Knex query builder (Knex is lazy: no connection is opened until the query is
 * actually run). That makes `.toString()` on the returned builder a legitimate,
 * unmocked way to assert on the generated SQL without touching Postgres at all,
 * using the SAME real `knexConfig` (pg dialect, per-file test database) every
 * other repository test in this suite uses - see tests/knexfile.js.
 *
 * `fetchPaginated` DOES execute (it awaits `.limit().offset()`), so those tests
 * run against the real per-file Postgres database (the `cases` table always
 * exists there); `KnexBoardPrimaryRepository.prototype.buildQuery` is spied
 * (call-through, real implementation) purely to recover a reference to the
 * exact query object fetchPaginated built, so the executed SQL's `limit`/
 * `offset` clauses can be asserted on afterwards - no behavior is replaced.
 *
 * BUG FOUND (documented, not fixed per task instructions): buildQuery's
 * selectColumns (line 13) builds `` `${primary_entity}.${c.expression} as
 * "${c.alias}"` ``, i.e. it manually wraps the alias in double quotes AND hands
 * the whole string to Knex's `.distinct()`, which knows nothing about the
 * pre-quoting and quotes the identifier itself again. The result is a
 * double-double-quoted alias, e.g. `as """id"""` instead of `as "id"` - see the
 * first test below. Any consumer selecting by that alias downstream would break.
 */
describe('KnexBoardPrimaryRepository', () => {
    afterEach(() => {
        jest.restoreAllMocks();
    });

    const repository = () => new KnexBoardPrimaryRepository(knexConfig);

    it('lanza un Error cuando falta primary_entity', () => {
        // Arrange
        const repo = repository();

        // Act & Assert
        expect(() => repo.buildQuery({ columns: [{ expression: 'id', alias: 'id' }] })).toThrow(
            'primary_entity y columnas son requeridos'
        );
    });

    it('lanza un Error cuando columns no viene (usa el default [] y columns?.length es 0)', () => {
        // Arrange
        const repo = repository();

        // Act & Assert
        expect(() => repo.buildQuery({ primary_entity: 'cases' })).toThrow('primary_entity y columnas son requeridos');
    });

    it('lanza un Error cuando columns es explicitamente null (rama null-safe de columns?.length)', () => {
        // Arrange
        const repo = repository();

        // Act & Assert
        expect(() => repo.buildQuery({ primary_entity: 'cases', columns: null })).toThrow(
            'primary_entity y columnas son requeridos'
        );
    });

    it('construye un SELECT DISTINCT minimo sin joins, where, group by ni having cuando solo se pasan los requeridos', () => {
        // Arrange
        const repo = repository();

        // Act
        const sql = repo
            .buildQuery({ primary_entity: 'cases', columns: [{ expression: 'id', alias: 'id' }] })
            .toString();

        // Assert
        // BUG: el alias termina con comillas dobles duplicadas (ver el comentario del describe).
        expect(sql).toBe('select distinct "cases"."id" as """id""" from "public"."cases"');
    });

    it('usa join_type explicito en las relaciones', () => {
        // Arrange
        const repo = repository();

        // Act
        const sql = repo
            .buildQuery({
                primary_entity: 'cases',
                columns: [{ expression: 'id', alias: 'id' }],
                relations: [
                    {
                        related_entity: 'users',
                        join_type: 'LEFT',
                        on: [{ left: 'cases.user_id', op: '=', right: 'users.id' }],
                    },
                ],
            })
            .toString();

        // Assert
        expect(sql).toContain('left join "users"');
    });

    it('usa INNER como join_type por defecto cuando la relacion no lo trae', () => {
        // Arrange
        const repo = repository();

        // Act
        const sql = repo
            .buildQuery({
                primary_entity: 'cases',
                columns: [{ expression: 'id', alias: 'id' }],
                relations: [
                    {
                        related_entity: 'users',
                        on: [{ left: 'cases.user_id', op: '=', right: 'users.id' }],
                    },
                ],
            })
            .toString();

        // Assert
        expect(sql).toContain('inner join "users"');
        expect(sql).not.toContain('left join');
    });

    // knex's generic `.where(col, 'in', [...])` produces SQL text IDENTICAL to
    // `.whereIn(col, [...])` (verified manually), so asserting on `.toString()`
    // alone cannot tell the three operator branches apart - a mutant that renames
    // the 'in' comparison to something else still falls through to the final
    // `else` branch and produces the same-looking WHERE clause. These three tests
    // spy on the shared QueryBuilder prototype instead, to assert on WHICH knex
    // method was actually invoked.
    it("usa whereIn (no where) cuando el operador es 'in'", () => {
        // Arrange
        const repo = repository();
        const proto = Object.getPrototypeOf(repo.table('cases'));
        const whereInSpy = jest.spyOn(proto, 'whereIn');
        const whereSpy = jest.spyOn(proto, 'where');

        // Act
        repo.buildQuery({
            primary_entity: 'cases',
            columns: [{ expression: 'id', alias: 'id' }],
            filters: [{ column: 'estado', operator: 'in', value: ['abierto', 'cerrado'] }],
        });

        // Assert
        expect(whereInSpy).toHaveBeenCalledWith('estado', ['abierto', 'cerrado']);
        expect(whereSpy).not.toHaveBeenCalled();
    });

    it("usa whereNotIn (no where) cuando el operador es 'not in'", () => {
        // Arrange
        const repo = repository();
        const proto = Object.getPrototypeOf(repo.table('cases'));
        const whereNotInSpy = jest.spyOn(proto, 'whereNotIn');
        const whereSpy = jest.spyOn(proto, 'where');

        // Act
        repo.buildQuery({
            primary_entity: 'cases',
            columns: [{ expression: 'id', alias: 'id' }],
            filters: [{ column: 'estado', operator: 'not in', value: ['abierto'] }],
        });

        // Assert
        expect(whereNotInSpy).toHaveBeenCalledWith('estado', ['abierto']);
        expect(whereSpy).not.toHaveBeenCalled();
    });

    it('usa where(columna, operador, valor) para cualquier otro operador', () => {
        // Arrange
        const repo = repository();
        const proto = Object.getPrototypeOf(repo.table('cases'));
        const whereSpy = jest.spyOn(proto, 'where');
        const whereInSpy = jest.spyOn(proto, 'whereIn');
        const whereNotInSpy = jest.spyOn(proto, 'whereNotIn');

        // Act
        repo.buildQuery({
            primary_entity: 'cases',
            columns: [{ expression: 'id', alias: 'id' }],
            filters: [{ column: 'estado', operator: '=', value: 'abierto' }],
        });

        // Assert
        expect(whereSpy).toHaveBeenCalledWith('estado', '=', 'abierto');
        expect(whereInSpy).not.toHaveBeenCalled();
        expect(whereNotInSpy).not.toHaveBeenCalled();
    });

    it('agrega GROUP BY cuando se pasan columnas de agrupamiento', () => {
        // Arrange
        const repo = repository();

        // Act
        const sql = repo
            .buildQuery({
                primary_entity: 'cases',
                columns: [{ expression: 'id', alias: 'id' }],
                groupBy: ['cases.id'],
            })
            .toString();

        // Assert
        expect(sql).toContain('group by "cases"."id"');
    });

    it('no agrega GROUP BY cuando groupBy viene vacio', () => {
        // Arrange
        const repo = repository();

        // Act
        const sql = repo
            .buildQuery({
                primary_entity: 'cases',
                columns: [{ expression: 'id', alias: 'id' }],
                groupBy: [],
            })
            .toString();

        // Assert
        expect(sql).not.toContain('group by');
    });

    it('agrega HAVING cuando se pasan condiciones', () => {
        // Arrange
        const repo = repository();

        // Act
        const sql = repo
            .buildQuery({
                primary_entity: 'cases',
                columns: [{ expression: 'id', alias: 'id' }],
                groupBy: ['cases.id'],
                having: [{ column: 'cases.id', operator: '>', value: 1 }],
            })
            .toString();

        // Assert
        expect(sql).toContain('having "cases"."id" > 1');
    });

    it('fetchPaginated usa page=1 y pageSize=25 por defecto (offset 0, limit 25)', async () => {
        // Arrange
        const repo = repository();
        const buildQuerySpy = jest.spyOn(KnexBoardPrimaryRepository.prototype, 'buildQuery');

        // Act
        await repo.fetchPaginated({ primary_entity: 'cases', columns: [{ expression: 'id', alias: 'id' }] });

        // Assert: Knex omite la clausula OFFSET por completo cuando vale 0
        const builtQuery = buildQuerySpy.mock.results[0].value;
        expect(builtQuery.toString()).toContain('limit 25');
        expect(builtQuery.toString()).not.toContain('offset');
    });

    it('fetchPaginated calcula el offset a partir de page y pageSize explicitos', async () => {
        // Arrange
        const repo = repository();
        const buildQuerySpy = jest.spyOn(KnexBoardPrimaryRepository.prototype, 'buildQuery');

        // Act
        await repo.fetchPaginated({ primary_entity: 'cases', columns: [{ expression: 'id', alias: 'id' }] }, 3, 10);

        // Assert: offset = (3 - 1) * 10 = 20
        const builtQuery = buildQuerySpy.mock.results[0].value;
        expect(builtQuery.toString()).toContain('limit 10');
        expect(builtQuery.toString()).toContain('offset 20');
    });
});
