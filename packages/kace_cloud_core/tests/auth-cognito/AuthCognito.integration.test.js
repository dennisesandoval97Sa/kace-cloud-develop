import { knexConfig } from '../knexfile.js';
import { GroupsMother } from '../grupos/domain/GroupsMother.js';
import { KnexAuthCognitoRepository } from '../../src/auth-cognito/infraestructure/KnexAuthCognitoRepository.js';
import { KnexGroupsRepository } from '../../src/grupos/infrastructure/persistence/KnexGroupsRepository.js';
import { KnexUsersRepository } from '../../src/users/infrastructure/KnexUsersRepository.js';
import UsersMother from '../users/domain/UsersMother.js';
import { StatusEnum } from '../../src/shared/index.js';
import { AuthenticationUser } from '../../src/auth-cognito/index.js';
import { LogoutUser } from '../../src/auth-cognito/application/LogoutUser.js';
import { TenantContext } from '../../src/shared/infrastructure/context/TenantContext.js';
import LocalTenantRepository from '../../src/tenant/infrastructure/local/LocalTenantRepository.js';
import { ensureParentRow } from '../support/ensureParentRow.js';
import { v4 as uuidV4 } from 'uuid';

describe('LogoutUser - repository.update sets last_integration_active_at and last_seen_at to null', () => {
    const repository = new KnexAuthCognitoRepository(knexConfig);
    const usersRepository = new KnexUsersRepository(repository.connection);

    it('should set last_integration_active_at and last_seen_at to null when calling repository.update directly', async () => {
        const now = new Date();
        const user = await UsersMother.createUser(usersRepository, {
            last_integration_active_at: now,
            last_seen_at: now,
        });

        const userBefore = await repository.connection('usuarios').where({ id: user.id.value }).first();
        expect(userBefore.last_integration_active_at).not.toBeNull();
        expect(userBefore.last_seen_at).not.toBeNull();

        await repository.update({
            id: user.id.value,
            last_integration_active_at: null,
            last_seen_at: null,
            updated_at: new Date(),
            updated_by: user.id.value,
        });

        const userAfter = await repository.connection('usuarios').where({ id: user.id.value }).first();
        expect(userAfter.last_integration_active_at).toBeNull();
        expect(userAfter.last_seen_at).toBeNull();
    });
});

describe('LogoutUser - service sets last_integration_active_at and last_seen_at to null', () => {
    const repository = new KnexAuthCognitoRepository(knexConfig);
    const usersRepository = new KnexUsersRepository(repository.connection);

    it('should set last_integration_active_at, last_seen_at and cognito_hash_data to null after LogoutUser.execute()', async () => {
        const tenant = await new LocalTenantRepository().find();

        const now = new Date();

        // refresh_token defaults to null in UsersMother.dto(), so the
        // if (user.refresh_token.value) block inside LogoutUser is skipped
        const user = await UsersMother.createUser(usersRepository, {
            last_integration_active_at: now,
            last_seen_at: now,
        });

        // Set cognito_hash_data to a non-null value so the service does not
        // return early at the "No active session found" guard
        await repository
            .connection('usuarios')
            .where({ id: user.id.value })
            .update({ cognito_hash_data: 'some-cognito-hash' });

        // Use user_id in payload so LogoutUser.execute() resolves the user
        // via findById, bypassing the JWT decode path
        const payload = { user_id: user.id.value };

        await TenantContext.run(tenant, async () => {
            const logoutService = new LogoutUser(payload, repository);
            await logoutService.execute();
        });

        const userAfter = await repository.connection('usuarios').where({ id: user.id.value }).first();
        expect(userAfter.last_integration_active_at).toBeNull();
        expect(userAfter.last_seen_at).toBeNull();
        expect(userAfter.cognito_hash_data).toBeNull();
    });
});

describe('KnexAuthCognitoRepository - findActiveGroupsByUserId', () => {
    const repository = new KnexAuthCognitoRepository(knexConfig);
    const groupsRepository = new KnexGroupsRepository(repository.connection);
    const usersRepository = new KnexUsersRepository(repository.connection);

    it('should return active groups for a given user', async () => {
        const user = await UsersMother.createUser(usersRepository);
        const group = await GroupsMother.createRandomGroup(groupsRepository);

        await repository.connection('rel_usuarios_grupos').insert({
            usuario_id: user.id.value,
            grupo_id: group.id.value,
        });

        const result = await repository.findActiveGroupsByUserId(user.id);

        expect(result).toHaveLength(1);
        expect(result[0]).toMatchObject({
            id: group.id.value,
            nombre: group.nombre.value,
            configuration_id: group.configuration_id.value,
        });
    });

    it('should return empty array when no active groups found', async () => {
        const user = await UsersMother.createUser(usersRepository);

        const result = await repository.findActiveGroupsByUserId(user.id);

        expect(result).toEqual([]);
    });

    it('should not return soft-deleted and inactive groups', async () => {
        const user = await UsersMother.createUser(usersRepository);

        const group = await GroupsMother.createRandomGroup(groupsRepository);
        group.delete({ deleted_by: user.id.value, deleted_at: new Date() });
        await groupsRepository.delete(group);

        const group1 = await GroupsMother.createRandomGroup(groupsRepository);
        group1.update({ status: StatusEnum.INACTIVE.value });
        await groupsRepository.update(group1);

        await repository.connection('rel_usuarios_grupos').insert([
            {
                usuario_id: user.id.value,
                grupo_id: group.id.value,
            },
            {
                usuario_id: user.id.value,
                grupo_id: group1.id.value,
            },
        ]);

        const result = await repository.findActiveGroupsByUserId(user.id);

        expect(result).toEqual([]);
    });

    it('should update last_login_at date when a user logs in', async () => {
        const payload = {
            id_token:
                'eyJraWQiOiJ1UTdOdllzZUNKS3Nia09odHY2VVJVUnJ4S2wxMit3RXlSKzR3Mk9kUXBJPSIsImFsZyI6IlJTMjU2In0.eyJhdF9oYXNoIjoiRWVDNEExMmZLNXVkdHJsamM0N3FadyIsInN1YiI6ImQ0Nzg1NDk4LTIwZTEtNzBiYi1kYjY4LTk5OWRiMGQ3NzBiZiIsImNvZ25pdG86Z3JvdXBzIjpbInVzLWVhc3QtMV9IRnRIZ1BydjVfa2V5Y2xvYWstZGV2Il0sImVtYWlsX3ZlcmlmaWVkIjpmYWxzZSwiaXNzIjoiaHR0cHM6XC9cL2NvZ25pdG8taWRwLnVzLWVhc3QtMS5hbWF6b25hd3MuY29tXC91cy1lYXN0LTFfSEZ0SGdQcnY1IiwiY29nbml0bzp1c2VybmFtZSI6ImtleWNsb2FrLWRldl9jbzc2MjRteHMiLCJub25jZSI6Ilk4a3U4YVpCZ0RnUjFQWmRmY0RxQ3N0RlczenhKRnFVSkJncllrMW4wV2NKZkZaZ2pySjdDMkNfY2RmZXdZZ1FnS0FnbEhGNWRrbng2UDIxZ2NJSHEyV0x5UkZTQ3VrTkhxaTJmVVJMR3ctVmJYNEJqcEMxUFdxakZINEYtSW5oVDJyeExXTUJEV1RLd2dFT29PYkZDNTRnSFQ1VmNrMDRscWZUdUxBTDVxQSIsIm9yaWdpbl9qdGkiOiJhNjgzMWNmNC0yOTg0LTQ3MGYtYjQ3MS1lMTE0YmFjOTIxZmMiLCJhdWQiOiJjbGE5djQ5dGcwc2ZjdmpmYnY3c29zbGoyIiwiaWRlbnRpdGllcyI6W3siZGF0ZUNyZWF0ZWQiOiIxNzMwODE3NDA0OTE1IiwidXNlcklkIjoiY283NjI0bXhzIiwicHJvdmlkZXJOYW1lIjoia2V5Y2xvYWstZGV2IiwicHJvdmlkZXJUeXBlIjoiU0FNTCIsImlzc3VlciI6bnVsbCwicHJpbWFyeSI6InRydWUifV0sInRva2VuX3VzZSI6ImlkIiwiYXV0aF90aW1lIjoxNzMxMDgzMzgzLCJleHAiOjE3MzEwODY5ODMsImlhdCI6MTczMTA4MzM4MywianRpIjoiZTU4NmVhM2MtY2EyMS00YjMyLTlkOGUtNzc1MDA4N2FkOGM0IiwiZW1haWwiOiJkYXZpZC5jYXN0aWxsZWpvQGtvbmVjdGEtZ3JvdXAuY29tIn0.ES9kXdh5zrfMk6rJ_IrlJb-B_zvAhpj3gjqtZyEcWr-iHa1HM0GuS-fjbfBoyWXVN5I36yiKttspIMF6iwvRiBqfqyq51BB_KohARGG_KNvgZBSeBU1COMi72dudcjxvajhDynQjnkktvvD4n2D7kJ2vZl1Gyh7zj_k9O8BJasIknZW5L-Wo4Pa_iaKeic4GIbLmARVBwI_tnFyoKM4YpxEDXZzF2Ypy4goXPTqlsrA6DVFhQTxGw1i3_sl420VuEHuYXp-C5EhIyLICzUiXe4raKG9xaoFtztePVjxIygwfnWOWzdXBYDmf7_8DpZoBPHt_9Ifk7qvOnG67v1zm3g',
            access_token:
                'eyJraWQiOiJwY0FONmd1M1JlUGhidTRFWHZBcEtJbWtIWW10VDhBNHU3ZzllNnJjWTF3PSIsImFsZyI6IlJTMjU2In0.eyJzdWIiOiJkNDc4NTQ5OC0yMGUxLTcwYmItZGI2OC05OTlkYjBkNzcwYmYiLCJjb2duaXRvOmdyb3VwcyI6WyJ1cy1lYXN0LTFfSEZ0SGdQcnY1X2tleWNsb2FrLWRldiJdLCJpc3MiOiJodHRwczpcL1wvY29nbml0by1pZHAudXMtZWFzdC0xLmFtYXpvbmF3cy5jb21cL3VzLWVhc3QtMV9IRnRIZ1BydjUiLCJ2ZXJzaW9uIjoyLCJjbGllbnRfaWQiOiJjbGE5djQ5dGcwc2ZjdmpmYnY3c29zbGoyIiwib3JpZ2luX2p0aSI6ImE2ODMxY2Y0LTI5ODQtNDcwZi1iNDcxLWUxMTRiYWM5MjFmYyIsInRva2VuX3VzZSI6ImFjY2VzcyIsInNjb3BlIjoib3BlbmlkIGVtYWlsIiwiYXV0aF90aW1lIjoxNzMxMDgzMzgzLCJleHAiOjE3MzEwODY5ODMsImlhdCI6MTczMTA4MzM4MywianRpIjoiNjg0MzU2MmQtMmJmYy00OWQ0LTk2YmYtZTBmZjYxZTFjYzcxIiwidXNlcm5hbWUiOiJrZXljbG9hay1kZXZfY283NjI0bXhzIn0.d8ZQZT-PhtXbBxyIGe9ACLj05fa8jV0XMh8-EZLcpPjgV3E0guYErit1q-ksM8mflDhTTGCZf7KHjgnBPchN-UlsJoEkFNSYHRKKgrSKdfCouIjfLCq5L_CWlRK3QvcnLUwET9efjqHL1q1lT3A86hacEBpSfelujSMMMhJ9b-3hB1vPH_DVB5XYdQLb-cCm8PWMJ4X4_bdWIZgm5AMJrHHy3AdXMvLUxL1XkHMtb2rWEpurvFsb92HNVe5Afh6PkzaWA3HW1Zkq2bMmnDtc0hSzhuKJCQ5N5_HENg83hurR5c-i_M1Teg0Kc_nnBRmZLBgza2M3oNXmYsobP_eZ-Q',
            refresh_token:
                'eyJjdHkiOiJKV1QiLCJlbmMiOiJBMjU2R0NNIiwiYWxnIjoiUlNBLU9BRVAifQ.2OclF_Gu1ZiFyB53xOhwXmoI3UgTu5czTnSYACCkA1wBFQKY66xSz235R6JItH81gtTaDPfbaD2VGJ0Rl27cEHfUaOwCZlEhxh9Z9SGi7cLAQlCX3kDqYweTibGl4DpCgeFoKY_SpDDCNRcRRYqYOI9hD5J9sDxX2WQA3n_fuJ-g-XV1QpoJzzF0csU2yXSyXwyyxsxPF7bxwMCZWeI690xoNRIzlGzaibczDJxKD4Z18dNEemfx2uUIeuTmTic7tbf0Giu8YyGk1wLaB6gG9snT3W1Aiv10zbc6JLO4aaenSt-wKL5DIaadN-0bglfC_14CnA95s7F82poYr74Yhw.C7tamgA7rJy866hU.DdV5SLVkGTnQfF1L5QS4Zd8tMaKmmYEXztvlQf90spMyAIOc2Q58NNltvPwmGYu2QNW6IVGPj_cdwD_3BbIVlYdzlUf0SSqhKxT7ZS5VAF4oNx-Nu314C44zY_IZCshNSHvxM0MZjY9tQUtg0aKQN1B14Fw52i7iKsn8XqmRqmtcVdzzZGe8Thom6PNaliAxCEwh6FnPuvMmyMThu3aMbFtoTEN_f_2vAmdt4uXbDW2wAofPUBnKREcThYd6H42ldnUpk0ElAUguEcbnaUeDjWowkuzII-r2Kory73pgfAt0XFU9NWSSWEppTJcybhxRn20UhwIPLtP093q5Eg-IKtYH0TepYhhDy-xlnVd7cUKklMqfDHLYzx25tEQTdrP458BYu26CQGmT9xzay5ZEb7K_jYIjOVKOTlHPdxSIFOB9r1noSs1VYs_QlywReNqWMRs71ab29jJ_KZXMNyiwKq9tj90MO13Hl9z4V9TgEjBrmMUXQaNwfRblMp85kBENuS0RsPAPRKlxpwx8L209kRloXqIixyYnmOKGqyugAKjMNM6TI3f6FF5OSrxqiDAclcYEW-1Q1zo7Vl3ECDNnJFQ1Xk1SrcQZkvgJVNv4c8U8W1NKLAcnUdOfrL7QmWEHGolMQgfkqYEmWadOJdJvp7tGqAvk3VhFDMPE6YNWmrETW_Vd8EyC4INAQ5-oHCatowp93bmorgoMrsDGisg2-TkkodAYRvZgw4lwPJ_RwHg3NHLIEm-cnUiJwQW2_LK6tMoTRijJmWp-c3ulYTDwSF7pnN_VNf58_SWfS_iV95AF6imTX0RJMlsYBDFxJ2YpRmA5Papj7e6iwS2endiVuFXcCXYcT-sgeBXbd9ohWT63QZJGu1_Asouv9VjBbQfvqbkctbE9ffWqnJeNy1JGzUxLpFPcN6XMSLPO1kBRmi3E_ZLYitbsf0Ve7HWiuPU3GlPaNq7bBMuOXfsUkcB_QYBwUOz6Ljz5v2N0doKoI9Hm1e7OD23XSqm5z9hu9xMzdWkDd3IQ7QKUaipj_0vwj7KxQ8MofOn4ctUp8SEqfn7bmSgVABJaiuQXArvbVYqRNpsAVt8fvd3E2t09zL9VrAi24QWQ7rYmwmBlEscbU1NQycN8_mkdOs6ZQ1lWHvdBApBkxa_hEJhwicSfEUc222yc7o88rJp7mekbJPkMhYr5HfHRVJid4qCNfShBNw0.aU3X9tVJr8m1zFObcMNogw',
            expires_in: 3600,
            token_type: 'Bearer',
            sourceIP: '127.0.0.1',
            clientFingerprint: '11111111',
        };

        const cryptoParams = {
            secret_iv: 'r3+b0fC/GrFq7F+a+Yb3LQ==',
            secret_key: 'YcvkRf1pZ6NQ/49b+DbGoL+jUEZ4Cz9S8kFucEQKc5g=',
            encryption_method: 'aes-256-cbc',
        };

        const authService = new AuthenticationUser(payload, repository, cryptoParams);

        // Esta primera llamada solo aprovisiona el usuario a partir del token; lo que el test
        // mide es la segunda, ya con el usuario activo y con grupo.
        await authService.execute();

        // Hay usuarios sembrados en la base, asi que no vale coger el primero de la tabla: el que
        // acaba de aprovisionar el token es el que lleva el email de ese token.
        const [user] = await usersRepository
            .connection('usuarios')
            .select('*')
            .where({ email: 'david.castillejo@konecta-group.com' });
        expect(user).toBeDefined();

        const group = await GroupsMother.createRandomGroup(groupsRepository);

        // El usuario que aprovisiona el token nace sin rol, y `find` rechaza a quien no lo tiene
        // antes de mirar el login: hay que darselo aqui junto con el grupo activo.
        const rolId = uuidV4();
        await ensureParentRow(usersRepository.connection, 'roles', rolId);
        await usersRepository
            .connection(usersRepository.tableName)
            .update({ is_active: StatusEnum.ACTIVE.value, grupo_activo: group.id.value, rol_id: rolId })
            .where({ id: user.id });

        const authResponse = await authService.execute();

        const response = authResponse.toJson();

        expect(response.data.user.last_login_at).toBeDefined();
        expect(typeof response.data.user.last_login_at).toBe('string');
        expect(new Date(response.data.user.last_login_at)).toBeInstanceOf(Date);
    });
});

// usuarios/rel_usuarios_grupos/grupos all exist in the real migrated schema (see
// tests/knexfile.js — every test file gets its own cloned postgres database, already
// migrated), so this describe block reuses the shared per-file connection like the ones
// above it, instead of building its own sqlite instance and migrating it per test.
describe('LogoutUser - clears session_key and session_id on logout', () => {
    const repository = new KnexAuthCognitoRepository(knexConfig);
    const usersRepository = new KnexUsersRepository(repository.connection);
    const groupsRepository = new KnexGroupsRepository(repository.connection);

    it('T7: sets session_key and session_id to null after logout', async () => {
        const tenant = await new LocalTenantRepository().find();
        const user = await UsersMother.createUser(usersRepository);
        await repository.connection('usuarios').where({ id: user.id.value }).update({
            cognito_hash_data: 'some-hash',
            session_key: 'some-session-key',
            session_id: 'some-session-id',
        });

        await TenantContext.run(tenant, async () => {
            await new LogoutUser({ user_id: user.id.value }, repository).execute();
        });

        const after = await repository.connection('usuarios').where({ id: user.id.value }).first();
        expect(after.session_key).toBeNull();
        expect(after.session_id).toBeNull();
        expect(after.cognito_hash_data).toBeNull();
    });

    it('T9: sets grupo_activo to null after logout', async () => {
        const tenant = await new LocalTenantRepository().find();
        const group = await GroupsMother.createRandomGroup(groupsRepository);
        const user = await UsersMother.createUser(usersRepository);
        await repository.connection('usuarios').where({ id: user.id.value }).update({
            cognito_hash_data: 'some-hash',
            grupo_activo: group.id.value,
        });

        await TenantContext.run(tenant, async () => {
            await new LogoutUser({ user_id: user.id.value }, repository).execute();
        });

        const after = await repository.connection('usuarios').where({ id: user.id.value }).first();
        expect(after.grupo_activo).toBeNull();
    });

    it('T8: returns "No active session found" message when cognito_hash_data is null', async () => {
        const tenant = await new LocalTenantRepository().find();
        const user = await UsersMother.createUser(usersRepository);
        await repository.connection('usuarios').where({ id: user.id.value }).update({ cognito_hash_data: null });

        await TenantContext.run(tenant, async () => {
            const result = await new LogoutUser({ user_id: user.id.value }, repository).execute();
            expect(result.message).toBe('No active session found for logout.');
        });
    });
});
