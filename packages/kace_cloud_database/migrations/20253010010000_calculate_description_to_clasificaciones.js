/**
 * @param { import('knex').Knex } knex
 * @returns { Promise<void> }
 */

export async function up(knex) {
    const client = knex.client.config.client;

    if (client === 'pg') {
        await knex.raw(`
      UPDATE clasificaciones
      SET description = NULLIF(
        array_to_string(
          array_remove(ARRAY[
            NULLIF(BTRIM(nivel1), ''),
            NULLIF(BTRIM(nivel2), ''),
            NULLIF(BTRIM(nivel3), ''),
            NULLIF(BTRIM(nivel4), ''),
            NULLIF(BTRIM(nivel5), ''),
            NULLIF(BTRIM(nivel6), ''),
            NULLIF(BTRIM(nivel7), ''),
            NULLIF(BTRIM(nivel8), ''),
            NULLIF(BTRIM(nivel9), ''),
            NULLIF(BTRIM(nivel10), '')
          ], NULL),
          ' -> '
        ),
        ''
      )
      WHERE description IS NULL
    `);
    } else {
        const rows = await knex('clasificaciones')
            .select(
                'id',
                'nivel1',
                'nivel2',
                'nivel3',
                'nivel4',
                'nivel5',
                'nivel6',
                'nivel7',
                'nivel8',
                'nivel9',
                'nivel10'
            )
            .whereNull('description');

        for (const r of rows) {
            const parts = [];
            for (let i = 1; i <= 10; i++) {
                const v = (r[`nivel${i}`] ?? '').toString().trim();
                if (v) parts.push(v);
            }
            const description = parts.length ? parts.join(' -> ') : null;
            await knex('clasificaciones').where({ id: r.id }).update({ description });
        }
    }
}

export async function down(knex) {
    await knex('clasificaciones').update({ description: null });
}
