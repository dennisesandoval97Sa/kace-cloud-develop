import { KnexUsersRepository } from '../../../../src/users/infrastructure/KnexUsersRepository.js';
import { Login } from '../../../../src/users/application/auth/Login.js';
import { CustomError } from '../../../../src/shared/errors/CustomError.js';
import { AccountTypeEnum } from '../../../../src/shared/domain/enum/AccountTypeEnum.js';
import UsersMother from '../../domain/UsersMother.js';
import { withTestTenant, buildTestTenant } from '../../../support/testTenant.js';
import { knexConfig } from '../../../knexfile.js';
import jwt from 'jsonwebtoken';

describe('Login', () => {
    const repository = new KnexUsersRepository(knexConfig);

    it('rejects with a 400 CustomError when no user matches the given login', async () => {
        const login = new Login(repository);

        await expect(login.execute('does-not-exist-login', 'irrelevant')).rejects.toMatchObject({
            message: 'Invalid credentials',
            statusCode: 400,
        });
    });

    it('logs in a non-SERVICE account without checking any password (account_type branch skip)', async () => {
        const user = await UsersMother.createUser(repository, {
            account_type: AccountTypeEnum.ACTIVE_DIRECTORY.value,
        });
        const login = new Login(repository);

        const response = await withTestTenant(() => login.execute(user.login.value, 'this password is never checked'));

        const json = response.toJson();
        expect(json.data.id).toBe(user.id.value);

        // El token se VERIFICA con el mismo secreto que usa produccion (el `secret_key` del
        // tenant activo, ver Login.execute -> TenantContext.getTenant().secret_key.value) y se
        // comprueba su payload claim a claim. Con `expect.any(String)` un token emitido para
        // OTRO usuario o con OTRO rol pasaba igual: la firma es valida, pero la identidad no.
        const payload = jwt.verify(json.data.token, buildTestTenant().secret_key.value);
        expect(payload).toMatchObject({
            id: user.id.value,
            name: user.nombres.value,
            // BUG DE PRODUCCION (User.authenticate, src/users/domain/User.js): el claim `rol`
            // recibe el ValueObject `rol_id` ENTERO en vez de `rol_id.value`. Como `value` es un
            // campo privado (#value) de ValueObject, JSON.stringify solo conserva `field`, asi
            // que el token viaja con `rol: { field: 'rol_id' }` y NUNCA con el uuid del rol. Se
            // documenta el comportamiento observado, no se corrige.
            rol: { field: 'rol_id' },
        });
        expect(payload.exp).toEqual(expect.any(Number));
    });

    // BUG DE PRODUCCION: la rama de validacion de password para cuentas SERVICE
    // (`if (false === PasswordEncoder.compareHash(password, user.password.value))`) es
    // inalcanzable: la clase `User` (src/users/domain/User.js) NO define ningun getter
    // `password`, asi que `user.password` es siempre `undefined` y `user.password.value`
    // lanza un TypeError ANTES de que `compareHash` llegue a ejecutarse. El resultado es
    // que TODO intento de login con una cuenta SERVICE revienta con un TypeError en vez de
    // validar (o rechazar) la contraseña -- nunca se llega a autenticar una cuenta SERVICE
    // por esta via. El test "Can login with a service user account" en UsersIntegration.test.js
    // esta marcado como skip (sin motivo documentado) y el unico test activo sobre esto
    // ("Should return error when try login with a incorrect password") solo comprueba
    // `rejects.toThrow(Error)` generico, que tambien pasa con este TypeError -- por eso el bug
    // ha pasado desapercibido. Se documenta el comportamiento observado, no se corrige.
    it('crashes with a TypeError instead of validating the password for SERVICE accounts', async () => {
        const user = await UsersMother.createUser(repository, {
            account_type: AccountTypeEnum.SERVICE.value,
        });
        const login = new Login(repository);

        await expect(login.execute(user.login.value, 'any-password')).rejects.toThrow(
            /Cannot read propert(y|ies) of undefined/
        );
    });
});
