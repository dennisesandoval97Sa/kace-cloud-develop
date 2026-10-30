import { v4 as uuidV4 } from 'uuid';
import { knexConfig } from '../knexfile.js';
import { InteractionCreator } from '../../src/interactions/application/create/InteractionCreator.js';
import { InteractionEmailAlreadyLinkedError } from '../../src/interactions/domain/InteractionEmailAlreadyLinkedError.js';
import { KnexInteractionRepository } from '../../src/interactions/infrastructure/persistence/KnexInteractionRepository.js';
import InteractionMother from './domain/InteractionMother.js';

// InteractionsIntegration.test.js ya cubre el camino feliz y la deteccion NORMAL (no
// concurrente) de un email_id duplicado. Lo que falta, y lo que exige el catch de
// InteractionCreator.execute(), es lo que solo aparece bajo una condicion de carrera real:
// otro escritor inserta la fila conflictiva DESPUES de la verificacion previa (findByEmailId)
// pero ANTES de que este save() termine. Se reproduce con Postgres real lanzando dos
// execute() concurrentes, sin mockear el repositorio.
describe('InteractionCreator — condiciones de carrera en save()', () => {
    const repository = new KnexInteractionRepository(knexConfig);

    async function insertEmailRow(emailId) {
        await repository.connection('emails').insert({ id: emailId });
    }

    it('creates successfully when the email_id is not linked to any existing interaction', async () => {
        const emailId = uuidV4();
        await insertEmailRow(emailId);
        const dto = InteractionMother.dto({ email_id: emailId });
        await InteractionMother.ensureRelations(repository.connection, dto);

        const interaction = await new InteractionCreator(repository).execute(dto);

        expect(interaction.id.value).toEqual(dto.id);
        const row = await repository.connection('interactions').where({ id: dto.id }).first();
        expect(row.email_id).toEqual(emailId);
    });

    it('propagates a foreign-key violation unrelated to email_id unchanged', async () => {
        const emailId = uuidV4();
        await insertEmailRow(emailId);
        const missingWorkspaceId = uuidV4();
        const dto = InteractionMother.dto({ email_id: emailId, workspace_id: missingWorkspaceId });
        // No se garantiza la fila padre de workspace_id a proposito: se busca una violacion de
        // clave foranea real, no relacionada con email_id. repository.save() ya la envuelve en un
        // QueryDBError generico (sin .constraint) antes de que InteractionCreator la vea, asi que
        // lo observable aqui es que isEmailLinkUniqueViolation la descarta y el catch se limita a
        // relanzarla intacta.
        const rejection = expect(new InteractionCreator(repository).execute(dto)).rejects;
        await rejection.toMatchObject({ message: 'Transaction failed: error saving data.' });
        await rejection.not.toBeInstanceOf(InteractionEmailAlreadyLinkedError);
    });

    it('reports the concurrent winner when two creations race for the same email_id', async () => {
        const racedEmailId = uuidV4();
        await insertEmailRow(racedEmailId);

        const dtoA = InteractionMother.dto({ email_id: racedEmailId });
        const dtoB = InteractionMother.dto({ email_id: racedEmailId });
        await InteractionMother.ensureRelations(repository.connection, dtoA);
        await InteractionMother.ensureRelations(repository.connection, dtoB);

        const results = await Promise.allSettled([
            new InteractionCreator(repository).execute(dtoA),
            new InteractionCreator(repository).execute(dtoB),
        ]);

        const fulfilled = results.filter((result) => result.status === 'fulfilled');
        const rejected = results.filter((result) => result.status === 'rejected');
        expect(fulfilled).toHaveLength(1);
        expect(rejected).toHaveLength(1);

        const winnerId = fulfilled[0].value.id.value;
        const loserReason = rejected[0].reason;
        expect(loserReason).toBeInstanceOf(InteractionEmailAlreadyLinkedError);
        // El perdedor debe reportar al ganador real (el que efectivamente quedo enlazado al
        // email_id), no un id inventado ni null.
        expect(loserReason.interactionId).toEqual(winnerId);
        expect(loserReason.emailId).toEqual(racedEmailId);

        const linkedRows = await repository.connection('interactions').where({ email_id: racedEmailId });
        expect(linkedRows).toHaveLength(1);
        expect(linkedRows[0].id).toEqual(winnerId);
    });

    // BUG DE PRODUCCION (documentado, no corregido: la tarea prohibe tocar src/):
    // isEmailLinkUniqueViolation() usa la misma heuristica fragil que
    // KnexInteractionRepository.save(): knex antepone el SQL completo (con la lista de columnas
    // del INSERT, que siempre incluye `email_id`) al mensaje del error. Por eso CUALQUIER
    // violacion unique sobre `interactions` -incluida una colision de id ajena por completo al
    // enlace de email- se clasifica como "email ya enlazado". Este test fija ese comportamiento
    // real: una carrera por el mismo `id` (con emails DISTINTOS y nunca usados) termina
    // reportando un email_id que en realidad no tiene ninguna fila asociada.
    it('misclassifies a same-id race as an already-linked email (documented bug)', async () => {
        const sharedId = uuidV4();
        const emailIdA = uuidV4();
        const emailIdB = uuidV4();
        await insertEmailRow(emailIdA);
        await insertEmailRow(emailIdB);

        const dtoA = InteractionMother.dto({ id: sharedId, email_id: emailIdA });
        const dtoB = InteractionMother.dto({ id: sharedId, email_id: emailIdB });
        await InteractionMother.ensureRelations(repository.connection, dtoA);
        await InteractionMother.ensureRelations(repository.connection, dtoB);

        const results = await Promise.allSettled([
            new InteractionCreator(repository).execute(dtoA),
            new InteractionCreator(repository).execute(dtoB),
        ]);

        const fulfilled = results.filter((result) => result.status === 'fulfilled');
        const rejected = results.filter((result) => result.status === 'rejected');
        expect(fulfilled).toHaveLength(1);
        expect(rejected).toHaveLength(1);

        const loserReason = rejected[0].reason;
        expect(loserReason).toBeInstanceOf(InteractionEmailAlreadyLinkedError);
        // Ninguna fila quedo realmente enlazada al email_id del perdedor: el fallback
        // `?? null` de InteractionCreator.js linea 64 es el que se ejercita aqui.
        expect(loserReason.interactionId).toBeNull();

        const winnerEmailId = fulfilled[0].value.email_id.value;
        expect(loserReason.emailId).not.toEqual(winnerEmailId);
        const rowsForLoserEmail = await repository.connection('interactions').where({
            email_id: loserReason.emailId,
        });
        expect(rowsForLoserEmail).toHaveLength(0);
    });
});
