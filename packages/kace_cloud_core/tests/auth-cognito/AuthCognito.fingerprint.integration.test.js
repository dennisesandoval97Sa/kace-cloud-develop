import { knexConfig } from '../knexfile.js';
import { v4 as uuid } from 'uuid';
import { KnexAuthCognitoRepository } from '../../src/auth-cognito/index.js';
import { AuthenticationUser } from '../../src/auth-cognito/index.js';
import { KnexUsersRepository } from '../../src/users/infrastructure/KnexUsersRepository.js';
import UsersMother from '../users/domain/UsersMother.js';
import { SecurePasswordEncoder } from '../../src/shared/index.js';
import { AUTH_SESSION_ACTIVE_ON_ANOTHER_DEVICE } from '@kace/error-codes';

function makeIdToken(payloadObj) {
    const header = { alg: 'none', typ: 'JWT' };
    const h = Buffer.from(JSON.stringify(header)).toString('base64url');
    const p = Buffer.from(JSON.stringify(payloadObj)).toString('base64url');
    return `${h}.${p}.`;
}

describe('AuthenticationUser - validaciones de fingerprint y token revocado', () => {
    let repository;
    let usersRepository;
    let db;

    const cryptoParams = {
        secret_iv: 'r3+b0fC/GrFq7F+a+Yb3LQ==',
        secret_key: 'YcvkRf1pZ6NQ/49b+DbGoL+jUEZ4Cz9S8kFucEQKc5g=',
        encryption_method: 'aes-256-cbc',
    };

    beforeAll(async () => {
        repository = new KnexAuthCognitoRepository(knexConfig);
        db = repository.connection;
        usersRepository = new KnexUsersRepository(db);
    });

    afterEach(async () => {
        await db('revoked_tokens').del();
        // Los seeds dejan filas en rel_usuarios_grupos apuntando a usuarios; postgres
        // rechaza borrar el padre mientras el hijo exista.
        await db('rel_usuarios_grupos').del();
        await db('usuarios').del();
    });

    it('debe rechazar si el fingerprint es distinto al guardado', async () => {
        const existingUser = await UsersMother.createUser(usersRepository);

        const email = 'test@example.com';
        const sub = 'a4788448-c031-704d-d524-bca3eee04468';
        const fingerprintA = '12345678';
        const fingerprintB = '11111111';

        await db('usuarios')
            .update({
                login: sub,
                email,
                cognito_hash_data: fingerprintA,
                session_key: 'sk-legacy-active',
                is_active: 1,
            })
            .where({ id: existingUser.id.value });

        const idToken = makeIdToken({ email, sub });

        const authPayload = {
            id_token: idToken,
            access_token: 'acc',
            refresh_token: 'ref',
            expires_in: 3600,
            token_type: 'Bearer',
            sourceIp: '127.0.0.1',
            clientFingerprint: fingerprintB,
            sub,
            email,
        };

        const useCase = new AuthenticationUser(authPayload, repository, cryptoParams);

        await expect(useCase.execute()).rejects.toMatchObject({
            errorCode: AUTH_SESSION_ACTIVE_ON_ANOTHER_DEVICE,
            statusCode: 409,
        });
    });
    it('debe permitir login cuando cognito_hash_data es null (sin sesión activa), ignorando token revocado', async () => {
        const user = await UsersMother.createUser(usersRepository);

        const email = 'test2@example.com';
        const sub = 'user-sub-2';
        const fingerprintC = 'fp-C-intento';
        const authTime = Math.floor(Date.now() / 1000);

        await db('usuarios')
            .update({
                login: sub,
                email,
                cognito_hash_data: null,
                is_active: 1,
            })
            .where({ id: user.id.value });

        const idToken = makeIdToken({ email, sub, auth_time: authTime });

        const tokenHash = SecurePasswordEncoder.prehashWithSHA256(JSON.stringify({ id_token: idToken }));
        await db('revoked_tokens').insert({
            id: uuid(),
            token_hash: tokenHash,
            revoked_at: new Date(),
        });

        const authPayload = {
            id_token: idToken,
            access_token: 'acc',
            refresh_token: 'ref',
            expires_in: 3600,
            token_type: 'Bearer',
            sourceIp: '127.0.0.1',
            clientFingerprint: fingerprintC,
            sub,
            email,
        };

        const useCase = new AuthenticationUser(authPayload, repository, cryptoParams);

        // With the new dual-detection logic, null cognito_hash_data means no active session —
        // the revoked token check is no longer performed, so login succeeds.
        await expect(useCase.execute()).resolves.toBeDefined();
    });
});

describe('AuthenticationUser - dual conflict detection (session_key cookie + fingerprint)', () => {
    let repository;
    let usersRepository;
    let db;

    const cryptoParams = {
        secret_iv: 'r3+b0fC/GrFq7F+a+Yb3LQ==',
        secret_key: 'YcvkRf1pZ6NQ/49b+DbGoL+jUEZ4Cz9S8kFucEQKc5g=',
        encryption_method: 'aes-256-cbc',
    };

    const makeIdToken = (payloadObj) => {
        const header = { alg: 'none', typ: 'JWT' };
        const h = Buffer.from(JSON.stringify(header)).toString('base64url');
        const p = Buffer.from(JSON.stringify(payloadObj)).toString('base64url');
        return `${h}.${p}.`;
    };

    const makePayload = (email, sub, fingerprint) => ({
        id_token: makeIdToken({ email, sub, auth_time: Math.floor(Date.now() / 1000) }),
        access_token: 'acc',
        refresh_token: 'ref',
        expires_in: 3600,
        token_type: 'Bearer',
        sourceIp: '127.0.0.1',
        clientFingerprint: fingerprint,
    });

    beforeAll(async () => {
        // Se reutiliza la conexion compartida del archivo: la base de este test ya es un clon de
        // la plantilla migrada, asi que ni hace falta abrir un segundo pool ni correr
        // `db.migrate.latest()` (que ademas buscaba las migraciones en un `migrations/` que no
        // existe dentro de @kace/core y moria con ENOENT).
        repository = new KnexAuthCognitoRepository(knexConfig);
        db = repository.connection;
        usersRepository = new KnexUsersRepository(db);
    });

    afterEach(async () => {
        await db('revoked_tokens').del();
        // Los seeds dejan filas en rel_usuarios_grupos apuntando a usuarios; postgres
        // rechaza borrar el padre mientras el hijo exista.
        await db('rel_usuarios_grupos').del();
        await db('usuarios').del();
    });

    it('T1: allows login when cognito_hash_data is null (no active session)', async () => {
        const email = 'user1@test.com';
        const sub = 'sub-t1-' + Date.now();
        const user = await UsersMother.createUser(usersRepository);
        await db('usuarios')
            .update({ login: sub, email, cognito_hash_data: null, is_active: 1 })
            .where({ id: user.id.value });

        const useCase = new AuthenticationUser(makePayload(email, sub, 'fp-any'), repository, cryptoParams);
        await expect(useCase.execute(false, null)).resolves.toBeDefined();
    });

    it('T2: allows login when session_key cookie matches DB value (same browser re-auth)', async () => {
        const email = 'user2@test.com';
        const sub = 'sub-t2-' + Date.now();
        const user = await UsersMother.createUser(usersRepository);
        await db('usuarios')
            .update({ login: sub, email, cognito_hash_data: 'fp-A', session_key: 'sk-known-A', is_active: 1 })
            .where({ id: user.id.value });

        const useCase = new AuthenticationUser(makePayload(email, sub, 'fp-A'), repository, cryptoParams);
        await expect(useCase.execute(false, 'sk-known-A')).resolves.toBeDefined();
    });

    it('T3: allows login when session exists, same fingerprint, and no cookie is present', async () => {
        const email = 'user3@test.com';
        const sub = 'sub-t3-' + Date.now();
        const user = await UsersMother.createUser(usersRepository);
        await db('usuarios')
            .update({
                login: sub,
                email,
                cognito_hash_data: 'fp-A',
                session_key: 'sk-A',
                session_key_rotated_at: new Date().toISOString(),
                is_active: 1,
            })
            .where({ id: user.id.value });

        const useCase = new AuthenticationUser(makePayload(email, sub, 'fp-A'), repository, cryptoParams);
        await expect(useCase.execute(false, null)).resolves.toBeDefined();

        const after = await db('usuarios').where({ id: user.id.value }).first();
        expect(after.session_key).toBe('sk-A');
    });

    it('T4: allows login when cookie does not match DB session_key but fingerprint matches', async () => {
        const email = 'user4@test.com';
        const sub = 'sub-t4-' + Date.now();
        const user = await UsersMother.createUser(usersRepository);
        await db('usuarios')
            .update({
                login: sub,
                email,
                cognito_hash_data: 'fp-A',
                session_key: 'sk-A',
                session_key_rotated_at: new Date().toISOString(),
                is_active: 1,
            })
            .where({ id: user.id.value });

        const useCase = new AuthenticationUser(makePayload(email, sub, 'fp-A'), repository, cryptoParams);
        await expect(useCase.execute(false, 'sk-WRONG')).resolves.toBeDefined();

        const after = await db('usuarios').where({ id: user.id.value }).first();
        expect(after.session_key).toBe('sk-A');
    });

    it('T4b: throws SESSION_ACTIVE_ON_ANOTHER_DEVICE when fingerprint differs', async () => {
        const email = 'user4b@test.com';
        const sub = 'sub-t4b-' + Date.now();
        const user = await UsersMother.createUser(usersRepository);
        await db('usuarios')
            .update({
                login: sub,
                email,
                cognito_hash_data: 'fp-A',
                session_key: 'sk-A',
                session_key_rotated_at: new Date().toISOString(),
                is_active: 1,
            })
            .where({ id: user.id.value });

        const useCase = new AuthenticationUser(makePayload(email, sub, 'fp-B'), repository, cryptoParams);
        const err = await useCase.execute(false, null).catch((e) => e);
        expect(err.errorCode).toBe(AUTH_SESSION_ACTIVE_ON_ANOTHER_DEVICE);
        expect(err.statusCode).toBe(409);
    });

    it('T5: with force=true, clears old session and completes login', async () => {
        const email = 'user5@test.com';
        const sub = 'sub-t5-' + Date.now();
        const user = await UsersMother.createUser(usersRepository);
        await db('usuarios')
            .update({ login: sub, email, cognito_hash_data: 'fp-A', session_key: 'sk-A', is_active: 1 })
            .where({ id: user.id.value });

        const payload = { ...makePayload(email, sub, 'fp-NEW'), force: true };
        const useCase = new AuthenticationUser(payload, repository, cryptoParams);
        await expect(useCase.execute(false, null)).resolves.toBeDefined();

        const after = await db('usuarios').where({ id: user.id.value }).first();
        expect(after.cognito_hash_data).not.toBe('fp-A');
    });

    it('T6: non-AD account bypasses session conflict check', async () => {
        const email = 'user6@test.com';
        const sub = 'sub-t6-' + Date.now();
        const user = await UsersMother.createUser(usersRepository, { account_type: 2 });
        await db('usuarios')
            .update({ login: sub, email, cognito_hash_data: 'fp-A', session_key: 'sk-A', is_active: 1 })
            .where({ id: user.id.value });

        const useCase = new AuthenticationUser(makePayload(email, sub, 'fp-A'), repository, cryptoParams);
        await expect(useCase.execute(false, null)).resolves.toBeDefined();
    });

    it('T7: rotates session_key after 8h with same fingerprint', async () => {
        const email = 'user7@test.com';
        const sub = 'sub-t7-' + Date.now();
        const user = await UsersMother.createUser(usersRepository);
        const nineHoursAgo = new Date(Date.now() - 9 * 60 * 60 * 1000);
        await db('usuarios')
            .update({
                login: sub,
                email,
                cognito_hash_data: 'fp-A',
                session_key: 'sk-old',
                session_key_rotated_at: nineHoursAgo.toISOString(),
                is_active: 1,
            })
            .where({ id: user.id.value });

        const useCase = new AuthenticationUser(makePayload(email, sub, 'fp-A'), repository, cryptoParams);
        await expect(useCase.execute(false, null)).resolves.toBeDefined();

        const after = await db('usuarios').where({ id: user.id.value }).first();
        expect(after.session_key).not.toBe('sk-old');
        expect(after.session_key_rotated_at).not.toBeNull();
    });
});
