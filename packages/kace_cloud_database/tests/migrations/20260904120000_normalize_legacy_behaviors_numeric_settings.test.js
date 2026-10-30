import { test } from 'node:test';
import assert from 'node:assert/strict';

import knex from 'knex';

import {
    NUMERIC_REPAIR_RULES,
    isValidInt,
    up,
} from '../../migrations/20260904120000_normalize_legacy_behaviors_numeric_settings.js';

const ROW_ID = 'row-id';

const createTestDatabase = async () => {
    const db = knex({
        client: 'sqlite3',
        connection: { filename: ':memory:' },
        useNullAsDefault: true,
    });

    await db.schema.createTable('global_configurations', (table) => {
        table.string('id', 36).primary();
        table.jsonb('settings');
    });

    return db;
};

const insertSettings = async (db, settings) => {
    await db('global_configurations').insert({ id: ROW_ID, settings: JSON.stringify(settings) });
};

const getSettings = async (db) => {
    const row = await db('global_configurations').where({ id: ROW_ID }).first('settings');
    return typeof row.settings === 'string' ? JSON.parse(row.settings) : row.settings;
};

test('isValidInt rejects booleans, arrays and blank strings that Number() would coerce', () => {
    assert.equal(isValidInt(true, 1, 60), false);
    assert.equal(isValidInt(false, 1, 60), false);
    assert.equal(isValidInt(['30'], 1, 60), false);
    assert.equal(isValidInt('', 1, 60), false);
    assert.equal(isValidInt('   ', 1, 60), false);
    assert.equal(isValidInt('30', 1, 60), true);
    assert.equal(isValidInt(30, 1, 60), true);
    assert.equal(isValidInt(2.5, 1, 60), false);
    assert.equal(isValidInt(0, 1, 60), false);
    assert.equal(isValidInt(0, 0, 60), true);
});

test('NUMERIC_REPAIR_RULES has one entry per settings.behaviors numeric leaf covered by this migration', () => {
    const paths = NUMERIC_REPAIR_RULES.map((rule) => rule.path.join('.'));
    assert.deepEqual(
        [...paths].sort(),
        [
            'admin.reports.report_filter_days',
            'admin.users.active_session_limit',
            'admin.users.group_membership_check_interval',
            'admin.users.inactivity_time',
            'admin.users.warning_logout_time',
            'agente.casos.assignment_active_session_limit',
            'agente.onescript.onescript_cache_ttl_ms',
        ].sort()
    );
});

test('up repairs every out-of-range legacy leaf, including report_filter_days and onescript_cache_ttl_ms', async () => {
    const db = await createTestDatabase();

    try {
        await insertSettings(db, {
            behaviors: {
                application: {
                    admin: {
                        users: {
                            active_session_limit: 500,
                            inactivity_time: 1000,
                            warning_logout_time: 200,
                            group_membership_check_interval: -50,
                        },
                        reports: { report_filter_days: 90 },
                    },
                    agente: {
                        casos: { assignment_active_session_limit: true },
                        onescript: { onescript_cache_ttl_ms: ['30'] },
                    },
                },
            },
        });

        await up(db);

        const settings = await getSettings(db);
        const { admin, agente } = settings.behaviors.application;

        assert.equal(admin.users.active_session_limit, 2);
        assert.equal(admin.users.inactivity_time, 120);
        assert.equal(admin.users.warning_logout_time, 5);
        assert.equal(admin.users.group_membership_check_interval, 0);
        assert.equal(admin.reports.report_filter_days, 1);
        assert.equal(agente.casos.assignment_active_session_limit, 2);
        assert.equal(agente.onescript.onescript_cache_ttl_ms, 0);
    } finally {
        await db.destroy();
    }
});

test('up leaves already-valid rows untouched (no no-op UPDATE)', async () => {
    const db = await createTestDatabase();

    try {
        await insertSettings(db, {
            behaviors: {
                application: {
                    admin: {
                        users: {
                            active_session_limit: 2,
                            inactivity_time: 120,
                            warning_logout_time: 5,
                            group_membership_check_interval: 0,
                        },
                        reports: { report_filter_days: 1 },
                    },
                    agente: {
                        casos: { assignment_active_session_limit: 2 },
                        onescript: { onescript_cache_ttl_ms: 0 },
                    },
                },
            },
        });

        let updateCalled = false;
        db.on('query', (query) => {
            if (/^update/i.test(query.sql)) {
                updateCalled = true;
            }
        });

        await up(db);

        assert.equal(updateCalled, false);
    } finally {
        await db.destroy();
    }
});

test('up applies the warning_logout_time >= inactivity_time cross-field repair', async () => {
    const db = await createTestDatabase();

    try {
        await insertSettings(db, {
            behaviors: {
                application: {
                    admin: {
                        users: {
                            active_session_limit: 2,
                            inactivity_time: 20,
                            warning_logout_time: 30,
                            group_membership_check_interval: 0,
                        },
                    },
                },
            },
        });

        await up(db);

        const settings = await getSettings(db);
        assert.equal(settings.behaviors.application.admin.users.warning_logout_time, 0);
    } finally {
        await db.destroy();
    }
});

test('up skips rows missing settings.behaviors.application entirely', async () => {
    const db = await createTestDatabase();

    try {
        await insertSettings(db, { unrelated: true });

        await assert.doesNotReject(up(db));
    } finally {
        await db.destroy();
    }
});
