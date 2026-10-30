const ALLOWED_CONNECTIONS_TABLE = 'allowed_connections';

const SYSTEM_USER_ID = '7d15692d-5bf4-4135-8096-06e7b1098b54';
const CREATED_AT = '2026-05-28 10:00:00.000000 -05:00';

export const CHANNEL_HUB_ALLOWED_CONNECTIONS = [
    {
        id: '4168c3d0-a896-49a2-99a4-2998f3aaf512',
        description: 'ChannelHubOauth',
        connection: 'ch-tst.auth.eu-west-1.amazoncognito.com',
        certificate: '55b6acc270e5addb1abd1a6e0f8502787576d79ca137821bd638198ee8b5a1b6',
    },
    {
        id: '231866cf-2e98-4c18-bd68-31f5a91993d6',
        description: 'ChannelHub Cloudfront',
        connection: 'd13sfafwp8nvyq.cloudfront.net',
        certificate: 'c6c6d5c7f79211bbd598b6eb4302e5657be832e775cee0a829b0dea35eaf4e02',
    },
].map((row) => ({
    ...row,
    is_active: true,
    has_ssl: true,
    created_at: CREATED_AT,
    created_by: SYSTEM_USER_ID,
    updated_at: CREATED_AT,
    updated_by: SYSTEM_USER_ID,
    deleted_at: null,
    deleted_by: null,
}));

async function upsertAllowedConnection(knex, row) {
    const existingByConnection = await knex(ALLOWED_CONNECTIONS_TABLE)
        .where({ connection: row.connection })
        .whereNull('deleted_at')
        .first('id');

    const updateColumns = {
        description: row.description,
        certificate: row.certificate,
        is_active: row.is_active,
        has_ssl: row.has_ssl,
        updated_at: row.updated_at,
        updated_by: row.updated_by,
        deleted_at: null,
        deleted_by: null,
    };

    if (existingByConnection) {
        await knex(ALLOWED_CONNECTIONS_TABLE).where({ id: existingByConnection.id }).update(updateColumns);
        return;
    }

    await knex(ALLOWED_CONNECTIONS_TABLE).insert(row).onConflict('id').merge(updateColumns);
}

/**
 * @param { import('knex').Knex } knex
 * @returns { Promise<void> }
 */
export async function seed(knex) {
    for (const row of CHANNEL_HUB_ALLOWED_CONNECTIONS) {
        await upsertAllowedConnection(knex, row);
    }
}
