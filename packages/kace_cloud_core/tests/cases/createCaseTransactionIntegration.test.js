import { AuxCasesCreator } from '../../src/aux_casos/application/create/AuxCasesCreator.js';
import { CaseDescriptionCreator } from '../../src/case-descriptions/application/create/CaseDescriptionCreator.js';
import { CaseCreator } from '../../src/cases/application/create/CaseCreator.js';
import { KnexAuxCasesRepository } from '../../src/aux_casos/infrastructure/persitance/KnexAuxCasesRepository.js';
import { KnexCaseDescriptionRepository } from '../../src/case-descriptions/infrastructure/persistence/KnexCaseDescriptionRepository.js';
import { KnexCaseRepository } from '../../src/cases/infrastructure/persistence/KnexCaseRepository.js';
import { ClientFactory } from '../../src/factories/ClientFactory.js';
import { TransitionFactory } from '../../src/factories/TransitionFactory.js';
import { UserFactory } from '../../src/factories/UserFactory.js';
import { ClassificationFactory } from '../../src/factories/ClassificationFactory.js';
import { GroupFactory } from '../../src/factories/GroupFactory.js';
import { knexConfig } from '../knexfile.js';
import { v4 as uuidv4 } from 'uuid';

// Este archivo se construia su propia conexion sobre DB_TEST_DATABASE con un
// esquema por worker (`CREATE SCHEMA ... _w<JEST_WORKER_ID>`), que es el modelo
// anterior a la base por archivo. Ese nombre no distinguia una corrida de otra,
// asi que dos corridas concurrentes con el mismo JEST_WORKER_ID compartian
// esquema y se pisaban las filas.
//
// El unico motivo tecnico que quedaba para la conexion propia era el pool: la
// prueba necesita mas de una conexion viva a la vez, porque el camino sin
// transaccion que este test descarta pide una SEGUNDA conexion mientras la
// transaccion retiene la primera, y con un pool de uno se bloquearia en vez de
// fallar. El knexfile compartido ya da `pool: { min: 0, max: 5 }`, asi que ese
// motivo ya no aplica y el test puede vivir en la base clonada del archivo.

/**
 * Builds the three DTOs (case, description, aux) that mirror what
 * actionCreateWithAux assembles before persisting, sharing the created FK ids.
 */
function buildDtos({ clientId, transicionId, responsableId, clasificacionId, grupoId }) {
    const caseId = uuidv4();
    const descriptionId = uuidv4();
    const auxId = uuidv4();
    const userId = responsableId;
    const now = new Date().toISOString();

    const descriptionDto = {
        id: descriptionId,
        descripcion: 'tx test description',
        created_at: now,
        created_by: userId,
    };

    const caseDto = {
        id: caseId,
        cliente_id: clientId,
        transicion_id: transicionId,
        responsable_id: responsableId,
        clasificacion_id: clasificacionId,
        grupo_id: grupoId,
        descripcion_caso_id: descriptionId,
        alto_impacto: 1,
        vista: 'tx-test',
        update_source: 'manual',
        created_at: now,
        created_by: userId,
    };

    const auxDto = {
        id: auxId,
        caso_id: caseId,
        data: {},
        created_at: now,
        created_by: userId,
    };

    return { caseDto, descriptionDto, auxDto, caseId, descriptionId, auxId };
}

async function countRows(db, table, id) {
    const row = await db(table).where({ id }).count({ c: '*' }).first();
    return parseInt(row.c, 10);
}

describe('createCase transaction integration (atomicity)', () => {
    let db;
    let clientId;
    let transicionId;
    let responsableId;
    let clasificacionId;
    let grupoId;

    // Las filas de apoyo se crean por test y no en un beforeAll: el reset por
    // test de perFileDatabase.js devuelve la base al estado de la plantilla
    // antes de cada `it`, asi que cualquier fila sembrada en beforeAll habria
    // desaparecido antes del primer test.
    //
    // Tampoco hay afterAll de limpieza: la base es un clon desechable que el
    // afterAll de perFileDatabase.js elimina entera, y cualquier consulta
    // lanzada desde un afterAll de este archivo correria DESPUES del DROP
    // DATABASE, porque jest-circus ejecuta los hooks en orden de registro y el
    // de setupFilesAfterEnv se registra primero.
    beforeEach(async () => {
        db = knexConfig;

        const client = await new ClientFactory(knexConfig).create();
        clientId = client.id.value;

        const transition = await new TransitionFactory(knexConfig).create({ status: 1 });
        transicionId = transition.id.value;

        // Apellidos fijos a proposito. Por defecto `UserFactory` los saca de
        // `chance.last()`, y de esa lista una docena llevan apostrofe recto
        // (O'connor, D'Angelo, Degl'Innocenti...). El patron de
        // `ValueObjectUserName` admite la comilla tipografica pero no el
        // apostrofe recto, asi que el constructor de `User` los rechaza y la
        // factoria relanza un escueto `Error creating factory instance`. Aqui
        // solo hace falta el id del usuario, no su nombre.
        const user = await new UserFactory(knexConfig).create({
            apellido1: 'Ramirez',
            apellido2: 'Delgado',
        });
        responsableId = user.id.value;

        const classification = await new ClassificationFactory(knexConfig).create();
        clasificacionId = classification.id.value;

        const group = await new GroupFactory(knexConfig).create();
        grupoId = group.id.value;
    });

    it('rolls back aux + description + case when the transaction throws (zero orphans)', async () => {
        const auxRepository = new KnexAuxCasesRepository(db);
        const descriptionRepository = new KnexCaseDescriptionRepository(db);
        const caseRepository = new KnexCaseRepository(db);

        const { caseDto, descriptionDto, auxDto, caseId, descriptionId, auxId } = buildDtos({
            clientId,
            transicionId,
            responsableId,
            clasificacionId,
            grupoId,
        });

        const sentinel = new Error('forced rollback after persist');

        await expect(
            caseRepository.connection.transaction(async (trx) => {
                await new AuxCasesCreator(auxRepository).execute(
                    { ...auxDto, external_code: caseDto.external_code },
                    {},
                    trx
                );
                await new CaseDescriptionCreator(descriptionRepository).execute(descriptionDto, trx);
                await new CaseCreator(caseRepository, null, null, null, { id: { value: responsableId } }).execute(
                    caseDto,
                    {
                        trx,
                        skipTransitionValidation: true,
                    }
                );
                // Force the transaction to abort AFTER all three persistence writes.
                throw sentinel;
            })
        ).rejects.toBe(sentinel);

        // None of the three rows (nor their history rows) must survive the rollback.
        expect(await countRows(db, 'aux_cases', auxId)).toBe(0);
        expect(await countRows(db, 'descripciones_casos', descriptionId)).toBe(0);
        expect(await countRows(db, 'cases', caseId)).toBe(0);

        const caseHistory = await db('history_cases').where({ entity_id: caseId }).count({ c: '*' }).first();
        expect(parseInt(caseHistory.c, 10)).toBe(0);

        // history_aux_cases uses entity_id = caso_id (see saveHistoryWithRelationships call in AuxCasesCreator)
        const auxHistory = await db('history_aux_cases').where({ entity_id: caseId }).count({ c: '*' }).first();
        expect(parseInt(auxHistory.c, 10)).toBe(0);

        // history_descripciones_casos uses entity_id = description id (see saveHistory call in CaseDescriptionCreator)
        const descHistory = await db('history_descripciones_casos')
            .where({ entity_id: descriptionId })
            .count({ c: '*' })
            .first();
        expect(parseInt(descHistory.c, 10)).toBe(0);
    });

    it('commits all three rows on success; runPostPersistence is independent of persistence', async () => {
        const auxRepository = new KnexAuxCasesRepository(db);
        const descriptionRepository = new KnexCaseDescriptionRepository(db);
        const caseRepository = new KnexCaseRepository(db);

        const { caseDto, descriptionDto, auxDto, caseId, descriptionId, auxId } = buildDtos({
            clientId,
            transicionId,
            responsableId,
            clasificacionId,
            grupoId,
        });

        let creatorForPost;
        let kaseForPost;

        await caseRepository.connection.transaction(async (trx) => {
            await new AuxCasesCreator(auxRepository).execute(
                { ...auxDto, external_code: caseDto.external_code },
                {},
                trx
            );
            await new CaseDescriptionCreator(descriptionRepository).execute(descriptionDto, trx);
            const creator = new CaseCreator(caseRepository, null, null, null, { id: { value: responsableId } });
            const persisted = await creator.execute(caseDto, { trx, skipTransitionValidation: true });
            creatorForPost = creator;
            kaseForPost = persisted.kase;
            expect(persisted.response).toBeDefined();
        });

        // Rows exist purely because the transaction committed; no side-effects ran yet.
        expect(await countRows(db, 'aux_cases', auxId)).toBe(1);
        expect(await countRows(db, 'descripciones_casos', descriptionId)).toBe(1);
        expect(await countRows(db, 'cases', caseId)).toBe(1);

        // Post-commit side-effects (event publish, SLA timers, event logging) are best-effort
        // and must not throw even with a null event publisher.
        await expect(creatorForPost.runPostPersistence(kaseForPost)).resolves.toBeUndefined();
    });
});
