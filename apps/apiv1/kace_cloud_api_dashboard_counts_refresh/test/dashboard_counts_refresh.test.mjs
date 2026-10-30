import { jest } from '@jest/globals';
import { EventController } from '../src/EventController.mjs';
import { GENERAL_INTERNAL_ERROR } from '@kace/error-codes';

const DEFAULT_MATVIEWS = [
    'mv_dashboard_state_counts',
    'mv_dashboard_group_counts',
    'mv_dashboard_responsible_counts',
    'mv_dashboard_ans_counts',
];

/**
 * Builds a raw mock that:
 *   - Returns the given matview list for the pg_matviews discovery call.
 *   - Returns undefined for every subsequent REFRESH call.
 */
const makeRaw = (matviews = DEFAULT_MATVIEWS) =>
    jest.fn().mockImplementation((sql) => {
        if (sql.includes('pg_matviews')) {
            return Promise.resolve({ rows: matviews.map((m) => ({ matviewname: m })) });
        }
        return Promise.resolve(undefined);
    });

const DEFAULT_MATVIEWS = [
    'mv_dashboard_state_counts',
    'mv_dashboard_group_counts',
    'mv_dashboard_responsible_counts',
    'mv_dashboard_ans_counts',
];

/**
 * Builds a raw mock that:
 *   - Returns the given matview list for the pg_matviews discovery call.
 *   - Returns undefined for every subsequent REFRESH call.
 */
const makeRaw = (matviews = DEFAULT_MATVIEWS) =>
    jest.fn().mockImplementation((sql) => {
        if (sql.includes('pg_matviews')) {
            return Promise.resolve({ rows: matviews.map((m) => ({ matviewname: m })) });
        }
        return Promise.resolve(undefined);
    });

describe('Dashboard counts refresh EventController', () => {
    it('discovers matviews via pg_matviews and issues a CONCURRENTLY refresh for each', async () => {
        const raw = makeRaw();
        const controller = new EventController({}, { raw });

        const res = await controller.run();

        const refreshSqls = raw.mock.calls.filter((c) => c[0].startsWith('REFRESH')).map((c) => c[0]);

        expect(refreshSqls).toEqual([
            'REFRESH MATERIALIZED VIEW CONCURRENTLY mv_dashboard_state_counts',
            'REFRESH MATERIALIZED VIEW CONCURRENTLY mv_dashboard_group_counts',
            'REFRESH MATERIALIZED VIEW CONCURRENTLY mv_dashboard_responsible_counts',
            'REFRESH MATERIALIZED VIEW CONCURRENTLY mv_dashboard_ans_counts',
        ]);
        expect(res.toJson().statusCode).toBe(200);
    });

    it('schema-qualifies both the discovery query and the REFRESH statements', async () => {
        const raw = makeRaw();
        const connection = { raw, client: { config: { schema: 'asistencia' } } };
        const controller = new EventController({}, connection);

        await controller.run();

        const discoveryCall = raw.mock.calls.find((c) => c[0].includes('pg_matviews'));
        expect(discoveryCall[1]).toEqual(['asistencia', 'mv_%']);

        const refreshSqls = raw.mock.calls.filter((c) => c[0].startsWith('REFRESH')).map((c) => c[0]);
        expect(refreshSqls).toEqual([
            'REFRESH MATERIALIZED VIEW CONCURRENTLY "asistencia"."mv_dashboard_state_counts"',
            'REFRESH MATERIALIZED VIEW CONCURRENTLY "asistencia"."mv_dashboard_group_counts"',
            'REFRESH MATERIALIZED VIEW CONCURRENTLY "asistencia"."mv_dashboard_responsible_counts"',
            'REFRESH MATERIALIZED VIEW CONCURRENTLY "asistencia"."mv_dashboard_ans_counts"',
        ]);
    });

    it('refreshes custom mv_view_* matviews discovered dynamically', async () => {
        const customMatviews = [
            'mv_view_custom_abc_ans_counts',
            'mv_view_custom_abc_group_counts',
            'mv_view_custom_abc_responsible_counts',
            'mv_view_custom_abc_state_counts',
        ];
        const raw = makeRaw(customMatviews);
        const controller = new EventController({}, { raw });

        const res = await controller.run();

        const refreshSqls = raw.mock.calls.filter((c) => c[0].startsWith('REFRESH')).map((c) => c[0]);
        expect(refreshSqls).toEqual(customMatviews.map((m) => `REFRESH MATERIALIZED VIEW CONCURRENTLY ${m}`));
        expect(res.toJson().statusCode).toBe(200);
    });

    it('falls back to the default list when pg_matviews query fails', async () => {
        const raw = jest.fn().mockImplementation((sql) => {
            if (sql.includes('pg_matviews')) return Promise.reject(new Error('relation not found'));
            return Promise.resolve(undefined);
        });
        const controller = new EventController({}, { raw });

        const res = await controller.run();

        const refreshSqls = raw.mock.calls.filter((c) => c[0].startsWith('REFRESH')).map((c) => c[0]);
        expect(refreshSqls).toEqual(DEFAULT_MATVIEWS.map((m) => `REFRESH MATERIALIZED VIEW CONCURRENTLY ${m}`));
        expect(res.toJson().statusCode).toBe(200);
    });

    it('falls back to the default list when pg_matviews returns no rows', async () => {
        const raw = jest.fn().mockImplementation((sql) => {
            if (sql.includes('pg_matviews')) return Promise.resolve({ rows: [] });
            return Promise.resolve(undefined);
        });
        const controller = new EventController({}, { raw });

        const res = await controller.run();

        const refreshSqls = raw.mock.calls.filter((c) => c[0].startsWith('REFRESH')).map((c) => c[0]);
        expect(refreshSqls.length).toBe(DEFAULT_MATVIEWS.length);
        expect(res.toJson().statusCode).toBe(200);
    });

    it('builds a real connection from a Knex config object (withTenantContext shape) and qualifies with config.schema', async () => {
        const raw = makeRaw();
        const destroy = jest.fn().mockResolvedValue(undefined);
        const buildConnection = jest.fn(() => ({ connection: { raw, destroy }, schema: 'asistencia' }));
        const config = { client: 'pg', connection: { host: 'h' }, pool: { max: 3 }, schema: 'asistencia' };

        const controller = new EventController({}, config, { buildConnection });
        const res = await controller.run();

        expect(buildConnection).toHaveBeenCalledWith(config);
        const refreshSqls = raw.mock.calls.filter((c) => c[0].startsWith('REFRESH')).map((c) => c[0]);
        expect(refreshSqls).toEqual([
            'REFRESH MATERIALIZED VIEW CONCURRENTLY "asistencia"."mv_dashboard_state_counts"',
            'REFRESH MATERIALIZED VIEW CONCURRENTLY "asistencia"."mv_dashboard_group_counts"',
            'REFRESH MATERIALIZED VIEW CONCURRENTLY "asistencia"."mv_dashboard_responsible_counts"',
            'REFRESH MATERIALIZED VIEW CONCURRENTLY "asistencia"."mv_dashboard_ans_counts"',
        ]);
        expect(destroy).toHaveBeenCalledTimes(1);
        expect(res.toJson().statusCode).toBe(200);
    });

    it('does not destroy a pre-built connection injected by the caller', async () => {
        const raw = makeRaw();
        const destroy = jest.fn().mockResolvedValue(undefined);
        const controller = new EventController({}, { raw, destroy });

        await controller.run();

        expect(destroy).not.toHaveBeenCalled();
    });

    it('returns 500 when a refresh fails', async () => {
        const raw = jest.fn().mockImplementation((sql) => {
            if (sql.includes('pg_matviews'))
                return Promise.resolve({ rows: [{ matviewname: 'mv_dashboard_ans_counts' }] });
            return Promise.reject(new Error('boom'));
        });
        const controller = new EventController({}, { raw });

        const res = await controller.run();
        const body = JSON.parse(res.toJson().body);

        expect(res.toJson().statusCode).toBe(500);
        expect(body.data.code).toBe(GENERAL_INTERNAL_ERROR);
        expect(res.toJson().body).not.toContain('boom');
        expect(res.toJson().body).not.toContain('mv_dashboard_ans_counts');
    });

    it('attempts all discovered matviews even if one fails, and returns 500', async () => {
        const matviews = DEFAULT_MATVIEWS;
        let refreshCount = 0;
        const raw = jest.fn().mockImplementation((sql) => {
            if (sql.includes('pg_matviews')) {
                return Promise.resolve({ rows: matviews.map((m) => ({ matviewname: m })) });
            }
            refreshCount++;
            if (refreshCount === 2) return Promise.reject(new Error('group boom'));
            return Promise.resolve(undefined);
        });
        const controller = new EventController({}, { raw });

        const res = await controller.run();
        const body = JSON.parse(res.toJson().body);

        expect(refreshCount).toBe(4);
        expect(res.toJson().statusCode).toBe(500);
        expect(body.data.code).toBe(GENERAL_INTERNAL_ERROR);
        expect(res.toJson().body).not.toContain('group boom');
        expect(res.toJson().body).not.toContain('failed');
    });
});
