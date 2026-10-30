/**
 *
 * @param { import("knex").Knex } knex
 */
export async function up(knex) {
    if (knex.client.config.client === 'pg') {
        await knex.schema.raw(`DROP TRIGGER IF EXISTS trigger_insert_fake_cliente ON clients;`);
        await knex.schema.raw(`DROP FUNCTION IF EXISTS insertar_fake_cliente();`);
    }
}

export async function down(knex) {
    const statementFunction = `
    CREATE FUNCTION insertar_fake_cliente() RETURNS trigger
      LANGUAGE plpgsql
    AS $$
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
    CREATE TRIGGER trigger_insert_fake_cliente
    AFTER INSERT ON clients
    FOR EACH ROW
    EXECUTE PROCEDURE insertar_fake_cliente();
  `;

    if (knex.client.config.client === 'pg') {
        await knex.schema.raw(statementFunction);
        await knex.schema.raw(statementTrigger);
    }
}
