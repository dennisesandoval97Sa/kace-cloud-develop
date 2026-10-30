/**
 *
 * @param { import("knex").Knex } knex
 */
export async function up(knex) {
    const statementFunction = `
create function insertar_fake_cliente() returns trigger
    language plpgsql
as
$$
BEGIN

    IF NOT EXISTS (SELECT 1 FROM fake_clients WHERE id = NEW.id) THEN
        INSERT INTO fake_clients (id)
        VALUES (NEW.id);
    END IF;
    RETURN NEW;
END;
$$;
    `;
    const statementTrigger = `
create trigger trigger_insert_fake_cliente
    after insert
    on clientes
    for each row
execute procedure insertar_fake_cliente();
`;

    if (knex.client.config.client === 'pg') {
        await knex.schema.raw(statementFunction);
        await knex.schema.raw(statementTrigger);
    }
}

export async function down(knex) {
    if (knex.client.config.client === 'pg') {
        await knex.schema.raw(`drop trigger trigger_insert_fake_cliente on clientes;`);
        await knex.schema.raw(`drop function insertar_fake_cliente();`);
    }
}
