import { v4 as uuidV4 } from 'uuid';
import { knexConfig } from '../../knexfile.js';
import { KnexInteractionRepository } from '../../../src/interactions/infrastructure/persistence/KnexInteractionRepository.js';
import { Interaction } from '../../../src/interactions/domain/Interaction.js';
import { QueryDBError } from '../../../src/shared/errors/QueryDBError.js';
import InteractionMother from '../domain/InteractionMother.js';

// Ejercita, contra Postgres real, las combinaciones de argumentos y los caminos de error de
// KnexInteractionRepository que InteractionsIntegration.test.js e InteractionsUnit.test.js no
// tocan: siempre invocan estos metodos con opciones explicitas (nunca con el default `{}`), o
// nunca provocan el error real de Postgres que dispara la rama del catch.
describe('KnexInteractionRepository — branch coverage', () => {
    const repository = new KnexInteractionRepository(knexConfig);
    // Todos los metodos *ForActiveGroup delegan el filtrado en
    // applyActiveGroupWorkspaceScope, que con un scope vacio (sin userId/activeGroupId) agrega
    // `whereRaw('1 = 0')`: la consulta es valida pero nunca devuelve filas. Sirve para ejercer las
    // ramas propias de KnexInteractionRepository sin tener que levantar todo el grafo de
    // usuarios/grupos/workspaces que exige ese scope.
    const emptyScope = {};
    const stubCriteria = { convertToKnex: (queryBuilder) => queryBuilder };

    async function insertEmailRow(emailId) {
        await repository.connection('emails').insert({ id: emailId });
    }

    async function insertWorkspaceRow(workspaceId, { isActive = true } = {}) {
        await repository.connection('workspaces').insert({ id: workspaceId, is_active: isActive });
    }

    /**
     * Levanta, contra Postgres real, el grafo minimo que
     * `applyActiveGroupWorkspaceScope` exige para dejar pasar una fila:
     * usuario -> rel_usuarios_grupos -> grupo (status activo) ->
     * workspaces_grupos_relations -> workspace (activo). Sin esto, cualquier
     * assert sobre las filas/orden que produce un metodo *ForActiveGroup usa
     * un scope vacio que bloquea TODO con `1 = 0`, y termina afirmando `[]`
     * sin ejercitar de verdad el filtrado ni el ORDER BY.
     *
     * @param {string} workspaceId - workspace ya perteneciente al grupo activo devuelto.
     * @returns {Promise<{ userId: string, activeGroupId: string, scope: { userId: string, activeGroupId: string } }>}
     */
    async function seedActiveGroupScope(workspaceId) {
        const userId = uuidV4();
        const activeGroupId = uuidV4();

        await insertWorkspaceRow(workspaceId, { isActive: true });
        await repository.connection('grupos').insert({ id: activeGroupId, status: 1 });
        await repository.connection('usuarios').insert({ id: userId, grupo_activo: activeGroupId });
        await repository.connection('rel_usuarios_grupos').insert({ usuario_id: userId, grupo_id: activeGroupId });
        await repository
            .connection('workspaces_grupos_relations')
            .insert({ workspace_id: workspaceId, grupo_id: activeGroupId });

        return { userId, activeGroupId, scope: { userId, activeGroupId } };
    }

    /**
     * Compite por el MISMO renglon desde una transaccion independiente, con un
     * `lock_timeout` corto: si la llamada bajo prueba tomo de verdad el
     * bloqueo de fila, esta consulta falla RAPIDO con el error 55P03 de
     * Postgres en vez de competir contra una espera de reloj. Mismo patron que
     * `tests/cases/infrastructure/KnexCaseRepositoryCountersIntegration.test.js`.
     *
     * @param {string} id
     * @returns {Promise<unknown>}
     */
    const attemptCompetingRowLock = (id) =>
        repository.connection.transaction(async (trx2) => {
            await trx2.raw("SET LOCAL lock_timeout = '300ms'");
            return trx2.raw('SELECT id FROM interactions WHERE id = ? FOR UPDATE', [id]);
        });

    describe('uniqueLinkedEmailIds default parameter', () => {
        it('bulkMoveLinkedEmails treats a missing interactions argument as an empty list', async () => {
            const updatedCount = await repository.bulkMoveLinkedEmails(undefined, { workspace_id: uuidV4() });

            expect(updatedCount).toBe(0);
        });

        it('bulkSoftDeleteLinkedEmailAggregate treats a missing interactions argument as an empty list', async () => {
            const result = await repository.bulkSoftDeleteLinkedEmailAggregate(undefined, {
                deleted_at: new Date().toISOString(),
                deleted_by: uuidV4(),
            });

            expect(result).toEqual({ emails: 0, bodies: 0, attachments: 0 });
        });
    });

    describe('#queryTable trx routing', () => {
        it('runs findByIds inside the given transaction instead of opening a new query', async () => {
            const interaction = await InteractionMother.createInteraction(repository);

            const rows = await repository.connection.transaction((trx) =>
                repository.findByIds([interaction.id.value], { trx })
            );

            expect(rows).toHaveLength(1);
            expect(rows[0].id).toEqual(interaction.id.value);
        });
    });

    describe('save() unique-email-violation classification', () => {
        it('rethrows the raw Postgres error when the constraint name matches interactions_email_id_unique', async () => {
            const emailId = uuidV4();
            await insertEmailRow(emailId);
            await InteractionMother.createInteraction(repository, { email_id: emailId });

            const second = Interaction.create(InteractionMother.dto({ email_id: emailId }));

            await expect(repository.save(second)).rejects.toMatchObject({
                constraint: 'interactions_email_id_unique',
            });
        });

        it('wraps an unrelated foreign-key violation in a generic QueryDBError', async () => {
            const missingWorkspaceId = uuidV4();
            const dto = InteractionMother.dto({ workspace_id: missingWorkspaceId, email_id: null });
            const interaction = Interaction.create(dto);

            const rejection = expect(repository.save(interaction)).rejects;
            await rejection.toBeInstanceOf(QueryDBError);
            await rejection.toMatchObject({ message: 'Transaction failed: error saving data.' });
        });

        // BUG DE PRODUCCION (documentado, no corregido: la tarea prohibe tocar src/):
        // knex antepone el SQL completo (con la lista de columnas del INSERT) al mensaje del
        // DatabaseError. Como `email_id` SIEMPRE es una de esas columnas, la tercera clausula del
        // if -`/unique/i.test(message) && /email_id/i.test(message)`- se cumple para CUALQUIER
        // violacion unique sobre `interactions`, no solo para la del email vinculado. Este test
        // fija ese comportamiento real (una colision de id -interactions_pkey- se re-lanza cruda,
        // igual que si fuera una colision de email_id) en vez de el que el nombre de la clausula
        // sugeriria. El mismo patron (`isEmailLinkUniqueViolation`) se repite en
        // src/interactions/application/create/InteractionCreator.js.
        it('misclassifies a duplicate primary key violation as an email-link unique violation (documented bug)', async () => {
            const interaction = await InteractionMother.createInteraction(repository);
            // Reutiliza el mismo workspace_id que la fila original para que la unica violacion
            // real sea la de la primary key: si dejaramos que dto() genere uno nuevo, la fila
            // padre no existiria y Postgres podria reportar antes la violacion de FK.
            const duplicate = Interaction.create(
                InteractionMother.dto({
                    id: interaction.id.value,
                    workspace_id: interaction.workspace_id.value,
                    email_id: null,
                })
            );

            await expect(repository.save(duplicate)).rejects.toMatchObject({
                constraint: 'interactions_pkey',
                code: '23505',
            });
        });
    });

    describe('findByEmailId', () => {
        it('accepts a raw string id', async () => {
            const emailId = uuidV4();
            await insertEmailRow(emailId);
            const interaction = await InteractionMother.createInteraction(repository, { email_id: emailId });

            const found = await repository.findByEmailId(emailId);

            expect(found.id.value).toEqual(interaction.id.value);
        });

        it('accepts a value object with a .value property', async () => {
            const emailId = uuidV4();
            await insertEmailRow(emailId);
            const interaction = await InteractionMother.createInteraction(repository, { email_id: emailId });

            const found = await repository.findByEmailId({ value: emailId });

            expect(found.id.value).toEqual(interaction.id.value);
        });

        it('wraps a query-building failure (undefined binding) in a generic QueryDBError', async () => {
            // Un objeto sin .value produce email_id: undefined, y knex rechaza un binding
            // undefined al construir la consulta: ejercita el catch real, sin mockear la BD.
            await expect(repository.findByEmailId({})).rejects.toMatchObject({
                message: 'Transaction failed [findByEmailId].',
            });
        });

        it('returns null when no interaction is linked to the given email', async () => {
            await expect(repository.findByEmailId(uuidV4())).resolves.toBeNull();
        });
    });

    describe('findByEmailIds', () => {
        it('defaults trx when the options argument is omitted', async () => {
            const emailId = uuidV4();
            await insertEmailRow(emailId);
            const interaction = await InteractionMother.createInteraction(repository, { email_id: emailId });

            const rows = await repository.findByEmailIds([emailId]);

            expect(rows).toHaveLength(1);
            expect(rows[0].id.value).toEqual(interaction.id.value);
        });

        it('treats a nullish emailIds argument as an empty list and short-circuits before querying', async () => {
            await expect(repository.findByEmailIds(null)).resolves.toEqual([]);
            await expect(repository.findByEmailIds(undefined)).resolves.toEqual([]);
        });

        it('accepts a mix of raw string ids and value objects, and drops falsy ids', async () => {
            const emailIdA = uuidV4();
            const emailIdB = uuidV4();
            await insertEmailRow(emailIdA);
            await insertEmailRow(emailIdB);
            const interactionA = await InteractionMother.createInteraction(repository, { email_id: emailIdA });
            const interactionB = await InteractionMother.createInteraction(repository, { email_id: emailIdB });

            const rows = await repository.findByEmailIds([emailIdA, { value: emailIdB }, null, undefined]);

            const ids = rows.map((row) => row.id.value).sort();
            expect(ids).toEqual([interactionA.id.value, interactionB.id.value].sort());
        });
    });

    describe('searchForActiveGroup', () => {
        it('defaults statusOrder and scope when omitted, skipping the ORDER BY CASE clause', async () => {
            const rows = await repository.searchForActiveGroup(stubCriteria);

            // Sin userId/activeGroupId el scope vacio no deja pasar ninguna fila: lo relevante es
            // que la consulta se ejecuta y resuelve, no una fila concreta.
            expect(rows).toEqual([]);
        });

        // Con `emptyScope` (usado en el resto de este archivo) NINGUNA fila pasa nunca el
        // `1 = 0` de applyActiveGroupWorkspaceScope, asi que un test que solo mira `rows`
        // nunca observa el ORDER BY: pasa igual si el CASE esta invertido, roto o ausente.
        // Estos dos tests siembran el grafo real de grupo activo (seedActiveGroupScope) para
        // que las filas SI salgan, y afirman el orden concreto en el que salen.
        it('orders open < in review < closed for direction "asc"', async () => {
            const workspaceId = uuidV4();
            const { scope } = await seedActiveGroupScope(workspaceId);
            const baseReceipt = Date.now();
            const open = await InteractionMother.createInteraction(repository, {
                workspace_id: workspaceId,
                is_closed: false,
                in_review: false,
                receipt_at: new Date(baseReceipt).toISOString(),
            });
            const review = await InteractionMother.createInteraction(repository, {
                workspace_id: workspaceId,
                is_closed: false,
                in_review: true,
                receipt_at: new Date(baseReceipt + 1000).toISOString(),
            });
            const closed = await InteractionMother.createInteraction(repository, {
                workspace_id: workspaceId,
                is_closed: true,
                in_review: false,
                receipt_at: new Date(baseReceipt + 2000).toISOString(),
            });

            const rows = await repository.searchForActiveGroup(stubCriteria, { direction: 'asc' }, scope);

            expect(rows.map((row) => row.id.value)).toEqual([open.id.value, review.id.value, closed.id.value]);
        });

        it('orders closed < in review < open for direction "desc" (the reverse)', async () => {
            const workspaceId = uuidV4();
            const { scope } = await seedActiveGroupScope(workspaceId);
            const baseReceipt = Date.now();
            const open = await InteractionMother.createInteraction(repository, {
                workspace_id: workspaceId,
                is_closed: false,
                in_review: false,
                receipt_at: new Date(baseReceipt).toISOString(),
            });
            const review = await InteractionMother.createInteraction(repository, {
                workspace_id: workspaceId,
                is_closed: false,
                in_review: true,
                receipt_at: new Date(baseReceipt + 1000).toISOString(),
            });
            const closed = await InteractionMother.createInteraction(repository, {
                workspace_id: workspaceId,
                is_closed: true,
                in_review: false,
                receipt_at: new Date(baseReceipt + 2000).toISOString(),
            });

            const rows = await repository.searchForActiveGroup(stubCriteria, { direction: 'desc' }, scope);

            expect(rows.map((row) => row.id.value)).toEqual([closed.id.value, review.id.value, open.id.value]);
        });

        // Complementa los dos tests de arriba: cambiar el valor numerico del CASE (p. ej.
        // `THEN 2` por `THEN 999`) no invierte el orden relativo de solo 3 categorias frente a
        // ningun `statusOrder.direction` (999 sigue siendo mayor que 1 y que 0, igual que 2), asi
        // que ese mutante concreto es indetectable por orden de filas por diseno: es una mutacion
        // equivalente en comportamiento externo con solo 3 estados discretos. Lo unico que lo
        // distingue es el SQL literal emitido, que es tambien un observable legitimo para este
        // archivo segun el encargo ("lo observable es la consulta o las filas devueltas").
        it('embeds the documented CASE literal in the generated SQL', async () => {
            const queries = [];
            const listener = (query) => queries.push(query?.sql ?? '');
            repository.connection.on('query', listener);

            try {
                await repository.searchForActiveGroup(stubCriteria, { direction: 'asc' }, emptyScope);
            } finally {
                repository.connection.removeListener('query', listener);
            }

            const orderQuery = queries.find((sql) => sql.includes('CASE WHEN'));
            expect(orderQuery).toContain('CASE WHEN is_closed THEN 2 WHEN in_review THEN 1 ELSE 0 END');
        });
    });

    describe('countForActiveGroup', () => {
        it('defaults scope to {} when omitted', async () => {
            const count = await repository.countForActiveGroup(stubCriteria);

            expect(count).toBeDefined();
            expect(Number(Object.values(count)[0])).toBe(0);
        });
    });

    describe('findByIds', () => {
        it('defaults options to {} when omitted', async () => {
            const interaction = await InteractionMother.createInteraction(repository);

            const rows = await repository.findByIds([interaction.id.value]);

            expect(rows).toHaveLength(1);
            expect(rows[0].id).toEqual(interaction.id.value);
        });

        // Antes, este test solo comprobaba que `findByIds(..., { forUpdate: true })` no
        // reventaba: un `if (forUpdate) query.forUpdate();` convertido en no-op seguia en
        // verde. Se sustituye por el patron determinista de
        // KnexCaseRepositoryCountersIntegration.test.js: una segunda transaccion compite por
        // el MISMO renglon con un `lock_timeout` corto, asi que si el bloqueo se tomo de
        // verdad, la competidora falla rapido en vez de que el test dependa de un reloj.
        it('acquires a row-level lock when forUpdate is true, blocking a concurrent FOR UPDATE on the same row', async () => {
            const interaction = await InteractionMother.createInteraction(repository);
            const trx = await repository.connection.transaction();

            try {
                await repository.findByIds([interaction.id.value], { trx, forUpdate: true });

                await expect(attemptCompetingRowLock(interaction.id.value)).rejects.toThrow(/lock/i);
            } finally {
                await trx.rollback();
            }
        });

        it('does not block a concurrent FOR UPDATE on the same row when forUpdate is omitted', async () => {
            const interaction = await InteractionMother.createInteraction(repository);
            const trx = await repository.connection.transaction();

            try {
                await repository.findByIds([interaction.id.value], { trx });

                await expect(attemptCompetingRowLock(interaction.id.value)).resolves.toBeDefined();
            } finally {
                await trx.rollback();
            }
        });
    });

    describe('findByIdsForActiveGroup', () => {
        it('defaults options to {} when omitted', async () => {
            const interaction = await InteractionMother.createInteraction(repository);

            const rows = await repository.findByIdsForActiveGroup([interaction.id.value], emptyScope);

            // El scope vacio no habilita ninguna fila; comprobamos que la consulta corre sin las
            // opciones (branch del default) y produce el resultado esperado (ninguna fila).
            expect(rows).toEqual([]);
        });

        // Con `emptyScope` NINGUNA fila pasa nunca el filtro, asi que `forUpdate: true` nunca
        // llegaba a bloquear nada real (SELECT ... FOR UPDATE sin filas no toma ningun
        // bloqueo): el test anterior solo demostraba que la llamada no lanzaba. Se siembra el
        // grafo real de grupo activo para que la fila SI salga y el bloqueo sea observable.
        it('acquires a row-level lock when forUpdate is true, blocking a concurrent FOR UPDATE on the same row', async () => {
            const workspaceId = uuidV4();
            const { scope } = await seedActiveGroupScope(workspaceId);
            const interaction = await InteractionMother.createInteraction(repository, { workspace_id: workspaceId });
            const trx = await repository.connection.transaction();

            try {
                const rows = await repository.findByIdsForActiveGroup([interaction.id.value], scope, {
                    trx,
                    forUpdate: true,
                });
                expect(rows).toHaveLength(1);

                await expect(attemptCompetingRowLock(interaction.id.value)).rejects.toThrow(/lock/i);
            } finally {
                await trx.rollback();
            }
        });

        it('does not block a concurrent FOR UPDATE on the same row when forUpdate is omitted', async () => {
            const workspaceId = uuidV4();
            const { scope } = await seedActiveGroupScope(workspaceId);
            const interaction = await InteractionMother.createInteraction(repository, { workspace_id: workspaceId });
            const trx = await repository.connection.transaction();

            try {
                const rows = await repository.findByIdsForActiveGroup([interaction.id.value], scope, { trx });
                expect(rows).toHaveLength(1);

                await expect(attemptCompetingRowLock(interaction.id.value)).resolves.toBeDefined();
            } finally {
                await trx.rollback();
            }
        });
    });

    describe('findActiveWorkspaceById', () => {
        it('defaults options to {} when omitted', async () => {
            const workspaceId = uuidV4();
            await insertWorkspaceRow(workspaceId, { isActive: true });

            const row = await repository.findActiveWorkspaceById(workspaceId);

            expect(row).toMatchObject({ id: workspaceId });
        });
    });

    describe('findActiveWorkspaceByIdForActiveGroup', () => {
        it('defaults options to {} when omitted', async () => {
            const workspaceId = uuidV4();
            await insertWorkspaceRow(workspaceId, { isActive: true });

            const row = await repository.findActiveWorkspaceByIdForActiveGroup(workspaceId, emptyScope);

            // El scope vacio bloquea la fila (whereRaw 1 = 0). A diferencia de otros métodos de
            // este archivo, aquí no hay `?? null`: knex resuelve `.first()` sin filas como
            // undefined, y eso es justamente lo que confirma que el default de opciones no rompe
            // la consulta.
            expect(row).toBeUndefined();
        });
    });

    describe('#bulkUpdate default options', () => {
        it('bulkMove runs without an explicit trx and updates the targeted rows', async () => {
            const interaction = await InteractionMother.createInteraction(repository);
            const destinationWorkspaceId = uuidV4();
            await insertWorkspaceRow(destinationWorkspaceId);

            await repository.bulkMove([interaction.id.value], { workspace_id: destinationWorkspaceId });

            const [updated] = await repository.findByIds([interaction.id.value]);
            expect(updated.workspace_id).toEqual(destinationWorkspaceId);
        });

        it('bulkClose runs without an explicit trx and updates the targeted rows', async () => {
            const interaction = await InteractionMother.createInteraction(repository);
            const closedAt = new Date();

            await repository.bulkClose([interaction.id.value], { is_closed: true, closed_at: closedAt });

            const [updated] = await repository.findByIds([interaction.id.value]);
            expect(updated.is_closed).toBe(true);
            // Compara contra el valor exacto que se paso, no solo "hay algo": una mutacion que
            // escribiera cualquier otro timestamp (o el de otra fila) pasaria con toBeTruthy().
            expect(updated.closed_at).toEqual(closedAt);
        });

        it('bulkDelete runs without an explicit trx and updates the targeted rows', async () => {
            const interaction = await InteractionMother.createInteraction(repository);
            const deletedAt = new Date().toISOString();
            const deletedBy = uuidV4();

            await repository.bulkDelete([interaction.id.value], { deleted_at: deletedAt, deleted_by: deletedBy });

            const [updated] = await repository.findByIds([interaction.id.value]);
            expect(updated.deleted_at).toEqual(new Date(deletedAt));
            expect(updated.deleted_by).toEqual(deletedBy);
        });
    });

    describe('bulkMoveLinkedEmails default options', () => {
        it('runs without an explicit trx and moves the linked email', async () => {
            const emailId = uuidV4();
            await insertEmailRow(emailId);
            const interaction = await InteractionMother.createInteraction(repository, { email_id: emailId });
            const destinationWorkspaceId = uuidV4();
            await insertWorkspaceRow(destinationWorkspaceId);

            const updatedCount = await repository.bulkMoveLinkedEmails([interaction], {
                workspace_id: destinationWorkspaceId,
                updated_at: new Date().toISOString(),
                updated_by: uuidV4(),
            });

            expect(updatedCount).toBe(1);
            const [emailRow] = await repository.connection('emails').where({ id: emailId });
            expect(emailRow.workspace_id).toEqual(destinationWorkspaceId);
        });
    });

    describe('bulkSoftDeleteLinkedEmailAggregate default options', () => {
        it('runs without an explicit trx and soft-deletes the linked email', async () => {
            const emailId = uuidV4();
            await insertEmailRow(emailId);
            const interaction = await InteractionMother.createInteraction(repository, { email_id: emailId });
            const deletedAt = new Date().toISOString();
            const deletedBy = uuidV4();

            const result = await repository.bulkSoftDeleteLinkedEmailAggregate([interaction], {
                deleted_at: deletedAt,
                deleted_by: deletedBy,
            });

            expect(result).toEqual({ emails: 1, bodies: 0, attachments: 0 });
            const [emailRow] = await repository.connection('emails').where({ id: emailId });
            expect(emailRow.deleted_at).toEqual(new Date(deletedAt));
            expect(emailRow.deleted_by).toEqual(deletedBy);
        });
    });

    describe('findByIdForReview', () => {
        it('defaults options to {} and returns null when the row does not exist', async () => {
            await expect(repository.findByIdForReview(uuidV4())).resolves.toBeNull();
        });

        it('returns the row when it exists', async () => {
            const interaction = await InteractionMother.createInteraction(repository);

            const row = await repository.findByIdForReview(interaction.id.value);

            expect(row).toMatchObject({ id: interaction.id.value });
        });

        it('acquires a row-level lock when forUpdate is true, blocking a concurrent FOR UPDATE on the same row', async () => {
            const interaction = await InteractionMother.createInteraction(repository);
            const trx = await repository.connection.transaction();

            try {
                const row = await repository.findByIdForReview(interaction.id.value, { trx, forUpdate: true });
                expect(row).toMatchObject({ id: interaction.id.value });

                await expect(attemptCompetingRowLock(interaction.id.value)).rejects.toThrow(/lock/i);
            } finally {
                await trx.rollback();
            }
        });

        it('does not block a concurrent FOR UPDATE on the same row when forUpdate is omitted', async () => {
            const interaction = await InteractionMother.createInteraction(repository);
            const trx = await repository.connection.transaction();

            try {
                const row = await repository.findByIdForReview(interaction.id.value, { trx });
                expect(row).toMatchObject({ id: interaction.id.value });

                await expect(attemptCompetingRowLock(interaction.id.value)).resolves.toBeDefined();
            } finally {
                await trx.rollback();
            }
        });
    });

    describe('findByIdForActiveGroup', () => {
        // Con `emptyScope` la fila nunca sale (`1 = 0`), asi que `forUpdate: true` no llegaba a
        // bloquear nada real: el test anterior solo demostraba "no lanza". Se siembra el grafo
        // real de grupo activo para que la fila SI salga y el bloqueo sea observable.
        it('acquires a row-level lock when forUpdate is true, blocking a concurrent FOR UPDATE on the same row', async () => {
            const workspaceId = uuidV4();
            const { scope } = await seedActiveGroupScope(workspaceId);
            const interaction = await InteractionMother.createInteraction(repository, { workspace_id: workspaceId });
            const trx = await repository.connection.transaction();

            try {
                const row = await repository.findByIdForActiveGroup(interaction.id.value, scope, {
                    trx,
                    forUpdate: true,
                });
                expect(row).toMatchObject({ id: interaction.id.value });

                await expect(attemptCompetingRowLock(interaction.id.value)).rejects.toThrow(/lock/i);
            } finally {
                await trx.rollback();
            }
        });

        it('does not block a concurrent FOR UPDATE on the same row when forUpdate is omitted', async () => {
            const workspaceId = uuidV4();
            const { scope } = await seedActiveGroupScope(workspaceId);
            const interaction = await InteractionMother.createInteraction(repository, { workspace_id: workspaceId });
            const trx = await repository.connection.transaction();

            try {
                const row = await repository.findByIdForActiveGroup(interaction.id.value, scope, { trx });
                expect(row).toMatchObject({ id: interaction.id.value });

                await expect(attemptCompetingRowLock(interaction.id.value)).resolves.toBeDefined();
            } finally {
                await trx.rollback();
            }
        });
    });

    describe('updateReviewFields', () => {
        it('defaults options to {} when omitted', async () => {
            const interaction = await InteractionMother.createInteraction(repository);

            const affected = await repository.updateReviewFields(interaction.id.value, { in_review: true });

            expect(affected).toBe(1);
            const [row] = await repository.findByIds([interaction.id.value]);
            expect(row.in_review).toBe(true);
        });
    });

    describe('bulkSaveInteractionHistory', () => {
        it('defaults options to {} and is a no-op for an empty interactions array', async () => {
            await expect(repository.bulkSaveInteractionHistory([], { updated_by: uuidV4() })).resolves.toBeUndefined();
        });

        it('derives created_by from updated_by when present', async () => {
            const entityId = uuidV4();
            const updatedBy = uuidV4();

            await repository.bulkSaveInteractionHistory([{ id: entityId }], { updated_by: updatedBy });

            const [historyRow] = await repository.connection('history_interactions').where({ entity_id: entityId });
            expect(historyRow.created_by).toEqual(updatedBy);
        });

        it('falls back to deleted_by when updated_by is absent', async () => {
            const entityId = uuidV4();
            const deletedBy = uuidV4();

            await repository.bulkSaveInteractionHistory([{ id: entityId }], { deleted_by: deletedBy });

            const [historyRow] = await repository.connection('history_interactions').where({ entity_id: entityId });
            expect(historyRow.created_by).toEqual(deletedBy);
        });

        it('falls back to closed_by when neither updated_by nor deleted_by are present', async () => {
            const entityId = uuidV4();
            const closedBy = uuidV4();

            await repository.bulkSaveInteractionHistory([{ id: entityId }], { closed_by: closedBy });

            const [historyRow] = await repository.connection('history_interactions').where({ entity_id: entityId });
            expect(historyRow.created_by).toEqual(closedBy);
        });
    });
});
