import { ensureRelationshipsExist } from '../../../src/cases/application/relationships/ensureRelationshipsExist.js';
import { ClientFactory } from '../../../src/factories/ClientFactory.js';
import { TransitionFactory } from '../../../src/factories/TransitionFactory.js';
import { UserFactory } from '../../../src/factories/UserFactory.js';
import { ClassificationFactory } from '../../../src/factories/ClassificationFactory.js';
import { GroupFactory } from '../../../src/factories/GroupFactory.js';
import { knexConfig } from '../../knexfile.js';

const schemaName = knexConfig.config.schema;

function qualify(tableName) {
    return `${schemaName}.${tableName}`;
}

describe('ensureRelationshipsExist integration', () => {
    let db;
    let clientId;
    let transicionId;
    let responsableId;
    let clasificacionId;
    let grupoId;

    // Las filas padre se crean en cada test: el reset por test devuelve la base
    // al estado de la plantilla antes de cada `it`.
    beforeEach(async () => {
        db = knexConfig;

        // Seed one row in each of the five FK tables using factories.
        // The schema is expected to be fully migrated (run pnpm migrate once before tests).
        // We skip db.migrate.latest() here because the latest CONCURRENTLY index migration
        // has a known pre-existing environment bug when invoked on a fresh schema; that bug
        // is orthogonal to this test. All five tables exist in the test schema.
        const client = await new ClientFactory(knexConfig).create();
        clientId = client.id.value;

        const transition = await new TransitionFactory(knexConfig).create({ status: 1 });
        transicionId = transition.id.value;

        // Apellidos fijos a proposito. Por defecto `UserFactory` los saca de
        // `chance.last()`, y de los 2326 apellidos de esa lista 12 llevan
        // apostrofo recto (O'connor, D'Amico, Degl'Innocenti...). El patron de
        // `ValueObjectUserName` admite la comilla tipografica pero no el
        // apostrofo recto, asi que el constructor de `User` los rechaza: 0,419%
        // por apellido, 0,835% por usuario, y este `beforeEach` corre nueve
        // veces, o sea un 7,2% de que el archivo se ponga rojo por el nombre
        // que toco. Aqui solo hace falta el id del usuario, no su nombre.
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

    // No hay afterAll de limpieza: jest-circus ejecuta los afterAll en orden de
    // registro, asi que el de perFileDatabase.js -registrado antes- ya hizo
    // DROP DATABASE cuando este correria. Cualquier query aqui pega contra una
    // base inexistente. El reset por test ya deja todo limpio.

    it('resolves without throwing when all FK ids exist', async () => {
        await expect(
            ensureRelationshipsExist(db, qualify, {
                clienteId: clientId,
                transicionId,
                responsableId,
                clasificacionId,
                grupoId,
            })
        ).resolves.toBeUndefined();
    });

    it('throws 404 with correct message when clienteId does not exist', async () => {
        const fakeId = '00000000-0000-4000-8000-000000000001';
        await expect(
            ensureRelationshipsExist(db, qualify, {
                clienteId: fakeId,
                transicionId,
                responsableId,
                clasificacionId,
                grupoId,
            })
        ).rejects.toMatchObject({
            statusCode: 404,
            message: `Client with id ${fakeId} does not exist.`,
        });
    });

    it('throws 404 with correct message when transicionId does not exist', async () => {
        const fakeId = '00000000-0000-4000-8000-000000000002';
        await expect(
            ensureRelationshipsExist(db, qualify, {
                clienteId: clientId,
                transicionId: fakeId,
                responsableId,
                clasificacionId,
                grupoId,
            })
        ).rejects.toMatchObject({
            statusCode: 404,
            message: `Transition with id ${fakeId} does not exist.`,
        });
    });

    it('throws 404 with correct message when responsableId does not exist', async () => {
        const fakeId = '00000000-0000-4000-8000-000000000003';
        await expect(
            ensureRelationshipsExist(db, qualify, {
                clienteId: clientId,
                transicionId,
                responsableId: fakeId,
                clasificacionId,
                grupoId,
            })
        ).rejects.toMatchObject({
            statusCode: 404,
            message: `Responsible with id ${fakeId} does not exist.`,
        });
    });

    it('throws 404 with correct message when clasificacionId does not exist', async () => {
        const fakeId = '00000000-0000-4000-8000-000000000004';
        await expect(
            ensureRelationshipsExist(db, qualify, {
                clienteId: clientId,
                transicionId,
                responsableId,
                clasificacionId: fakeId,
                grupoId,
            })
        ).rejects.toMatchObject({
            statusCode: 404,
            message: `Clasification with id ${fakeId} does not exist.`,
        });
    });

    it('throws 404 with correct message when grupoId does not exist', async () => {
        const fakeId = '00000000-0000-4000-8000-000000000005';
        await expect(
            ensureRelationshipsExist(db, qualify, {
                clienteId: clientId,
                transicionId,
                responsableId,
                clasificacionId,
                grupoId: fakeId,
            })
        ).rejects.toMatchObject({
            statusCode: 404,
            message: `Group with id ${fakeId} does not exist.`,
        });
    });

    it('resolves without throwing when transicionId is null (optional FK)', async () => {
        await expect(
            ensureRelationshipsExist(db, qualify, {
                clienteId: clientId,
                transicionId: null,
                responsableId,
                clasificacionId,
                grupoId,
            })
        ).resolves.toBeUndefined();
    });

    it('resolves without throwing when no ids are provided', async () => {
        await expect(ensureRelationshipsExist(db, qualify, {})).resolves.toBeUndefined();
    });

    it('preserves error order: client checked before transicion', async () => {
        const fakeClient = '00000000-0000-4000-8000-000000000006';
        const fakeTrans = '00000000-0000-4000-8000-000000000007';
        await expect(
            ensureRelationshipsExist(db, qualify, {
                clienteId: fakeClient,
                transicionId: fakeTrans,
                responsableId,
                clasificacionId,
                grupoId,
            })
        ).rejects.toMatchObject({
            statusCode: 404,
            message: `Client with id ${fakeClient} does not exist.`,
        });
    });
});
