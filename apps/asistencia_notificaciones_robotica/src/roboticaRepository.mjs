import knex from 'knex';

export async function fetchLastUpdate({ db, schema }) {
    const connection = knex({
        client: 'pg',
        connection: {
            host: db.host,
            port: db.port,
            user: db.user,
            password: db.password,
            database: db.database,
        },
        pool: {
            min: 0,
            max: 1,
            afterCreate: (conn, done) => {
                conn.query('SET timezone="UTC";', (err) => done(err, conn));
            },
        },
    });

    try {
        const result = await connection.raw(
            'SELECT MAX(updated_at) AS last_update, ' +
                'EXTRACT(EPOCH FROM (now() - MAX(updated_at))) / 60 AS minutes_since ' +
                'FROM ??',
            [`${schema}.aux_notificaciones_robotica`]
        );

        const row = result.rows[0];
        return {
            lastUpdate: row.last_update ?? null,
            minutesSince: row.minutes_since === null ? null : Number(row.minutes_since),
        };
    } finally {
        await connection.destroy();
    }
}
