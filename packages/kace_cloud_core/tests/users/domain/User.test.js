import { v4 as uuidv4 } from 'uuid';
import { User } from '../../../src/users/domain/User.js';
import UsersMother from './UsersMother.js';

describe('User', () => {
    describe('constructor defaults', () => {
        test('falls back to "default" login/nombres and default email when the dto omits them', () => {
            const dto = UsersMother.dto();
            delete dto.login;
            delete dto.nombres;
            delete dto.email;

            const user = new User(dto);

            expect(user.login.value).toBe('default');
            expect(user.nombres.value).toBe('default');
            expect(user.email.value).toBe('default@default.com');
        });

        test('uses the dto values for login/nombres/email when provided', () => {
            const dto = UsersMother.dto({ login: 'jperez', nombres: 'Juan', email: 'jperez@example.com' });

            const user = new User(dto);

            expect(user.login.value).toBe('jperez');
            expect(user.nombres.value).toBe('Juan');
            expect(user.email.value).toBe('jperez@example.com');
        });
    });

    describe('scalar setters: no-op when unchanged, mutate + register change when different', () => {
        test('login', () => {
            const user = new User(UsersMother.dto({ login: 'original-login' }));

            user.login = 'original-login';
            expect(user.login.value).toBe('original-login');
            expect(user.changedAttributes.login).toBeUndefined();

            user.login = 'changed-login';
            expect(user.login.value).toBe('changed-login');
            expect(user.changedAttributes.login).toBe('changed-login');
        });

        test('nombres', () => {
            const user = new User(UsersMother.dto({ nombres: 'Juan' }));

            user.nombres = 'Juan';
            expect(user.nombres.value).toBe('Juan');
            expect(user.changedAttributes.nombres).toBeUndefined();

            user.nombres = 'Pedro';
            expect(user.nombres.value).toBe('Pedro');
            expect(user.changedAttributes.nombres).toBe('Pedro');
        });

        test('apellido1', () => {
            const user = new User(UsersMother.dto({ apellido1: 'Doe' }));

            user.apellido1 = 'Doe';
            expect(user.apellido1.value).toBe('Doe');
            expect(user.changedAttributes.apellido1).toBeUndefined();

            user.apellido1 = 'Smith';
            expect(user.apellido1.value).toBe('Smith');
            expect(user.changedAttributes.apellido1).toBe('Smith');
        });

        test('apellido2', () => {
            const user = new User(UsersMother.dto({ apellido2: 'Doe' }));

            user.apellido2 = 'Doe';
            expect(user.apellido2.value).toBe('Doe');
            expect(user.changedAttributes.apellido2).toBeUndefined();

            user.apellido2 = 'Smith';
            expect(user.apellido2.value).toBe('Smith');
            expect(user.changedAttributes.apellido2).toBe('Smith');
        });

        test('email', () => {
            const user = new User(UsersMother.dto({ email: 'a@example.com' }));

            user.email = 'a@example.com';
            expect(user.email.value).toBe('a@example.com');
            expect(user.changedAttributes.email).toBeUndefined();

            user.email = 'b@example.com';
            expect(user.email.value).toBe('b@example.com');
            expect(user.changedAttributes.email).toBe('b@example.com');
        });

        test('telefono', () => {
            const user = new User(UsersMother.dto({ telefono: '1234567890' }));

            user.telefono = '1234567890';
            expect(user.telefono.value).toBe('1234567890');
            expect(user.changedAttributes.telefono).toBeUndefined();

            user.telefono = '0987654321';
            expect(user.telefono.value).toBe('0987654321');
            expect(user.changedAttributes.telefono).toBe('0987654321');
        });

        test('movil', () => {
            const user = new User(UsersMother.dto({ movil: '1234567890' }));

            user.movil = '1234567890';
            expect(user.movil.value).toBe('1234567890');
            expect(user.changedAttributes.movil).toBeUndefined();

            user.movil = '0987654321';
            expect(user.movil.value).toBe('0987654321');
            expect(user.changedAttributes.movil).toBe('0987654321');
        });

        test('rol_id', () => {
            const originalRolId = uuidv4();
            const newRolId = uuidv4();
            const user = new User(UsersMother.dto({ rol_id: originalRolId }));

            user.rol_id = originalRolId;
            expect(user.rol_id.value).toBe(originalRolId);
            expect(user.changedAttributes.rol_id).toBeUndefined();

            user.rol_id = newRolId;
            expect(user.rol_id.value).toBe(newRolId);
            expect(user.changedAttributes.rol_id).toBe(newRolId);
        });

        test('inactivo_desde', () => {
            const original = '2026-01-01T00:00:00.000Z';
            const changed = '2026-02-01T00:00:00.000Z';
            const user = new User(UsersMother.dto({ inactivo_desde: original }));

            user.inactivo_desde = original;
            expect(user.inactivo_desde.value).toBe(original);
            expect(user.changedAttributes.inactivo_desde).toBeUndefined();

            user.inactivo_desde = changed;
            expect(user.inactivo_desde.value).toBe(changed);
            expect(user.changedAttributes.inactivo_desde).toBe(changed);
        });

        test('inactivo_hasta', () => {
            const original = '2026-01-01T00:00:00.000Z';
            const changed = '2026-02-01T00:00:00.000Z';
            const user = new User(UsersMother.dto({ inactivo_hasta: original }));

            user.inactivo_hasta = original;
            expect(user.inactivo_hasta.value).toBe(original);
            expect(user.changedAttributes.inactivo_hasta).toBeUndefined();

            user.inactivo_hasta = changed;
            expect(user.inactivo_hasta.value).toBe(changed);
            expect(user.changedAttributes.inactivo_hasta).toBe(changed);
        });

        test('intento_login', () => {
            const user = new User(UsersMother.dto({ intento_login: 3 }));

            user.intento_login = 3;
            expect(user.intento_login.value).toBe(3);
            expect(user.changedAttributes.intento_login).toBeUndefined();

            user.intento_login = 4;
            expect(user.intento_login.value).toBe(4);
            expect(user.changedAttributes.intento_login).toBe(4);
        });

        test('fecha_bloqueo', () => {
            const original = '2026-01-01T00:00:00.000Z';
            const changed = '2026-02-01T00:00:00.000Z';
            const user = new User(UsersMother.dto({ fecha_bloqueo: original }));

            user.fecha_bloqueo = original;
            expect(user.fecha_bloqueo.value).toBe(original);
            expect(user.changedAttributes.fecha_bloqueo).toBeUndefined();

            user.fecha_bloqueo = changed;
            expect(user.fecha_bloqueo.value).toBe(changed);
            expect(user.changedAttributes.fecha_bloqueo).toBe(changed);
        });

        test('grupo_activo', () => {
            const originalGroup = uuidv4();
            const newGroup = uuidv4();
            const user = new User(UsersMother.dto({ grupo_activo: originalGroup }));

            user.grupo_activo = originalGroup;
            expect(user.grupo_activo.value).toBe(originalGroup);
            expect(user.changedAttributes.grupo_activo).toBeUndefined();

            user.grupo_activo = newGroup;
            expect(user.grupo_activo.value).toBe(newGroup);
            expect(user.changedAttributes.grupo_activo).toBe(newGroup);
        });

        test('is_active', () => {
            const user = new User(UsersMother.dto({ is_active: 1 }));

            user.is_active = 1;
            expect(user.is_active.value).toBe(1);
            expect(user.changedAttributes.is_active).toBeUndefined();

            user.is_active = 2;
            expect(user.is_active.value).toBe(2);
            expect(user.changedAttributes.is_active).toBe(2);
        });

        test('session_key', () => {
            const user = new User(UsersMother.dto({ session_key: 'abc-key' }));

            user.session_key = 'abc-key';
            expect(user.session_key.value).toBe('abc-key');
            expect(user.changedAttributes.session_key).toBeUndefined();

            user.session_key = 'new-key';
            expect(user.session_key.value).toBe('new-key');
            expect(user.changedAttributes.session_key).toBe('new-key');
        });

        test('session_key_rotated_at', () => {
            const original = '2026-01-01T00:00:00.000Z';
            const changed = '2026-02-01T00:00:00.000Z';
            const user = new User(UsersMother.dto({ session_key_rotated_at: original }));

            user.session_key_rotated_at = original;
            expect(user.session_key_rotated_at.value).toBe(original);
            expect(user.changedAttributes.session_key_rotated_at).toBeUndefined();

            user.session_key_rotated_at = changed;
            expect(user.session_key_rotated_at.value).toBe(changed);
            expect(user.changedAttributes.session_key_rotated_at).toBe(changed);
        });

        // BUG DE PRODUCCION: `set session_id` construye el VO con
        // `new ValueObjectSessionId('session_id', value)`, pero
        // ValueObjectSessionId.constructor(value, nullable) NO recibe field como primer
        // argumento (a diferencia de casi todos los demas VOs de este archivo). El resultado
        // es que el VO guarda el literal 'session_id' como valor y usa el `value` real como
        // flag `nullable`. `changedAttributes.session_id` sigue registrando el valor correcto
        // (viene de la asignacion directa `value`, no del VO), pero `user.session_id.value`
        // despues de un cambio NUNCA refleja lo que se asigno. Se documenta el comportamiento
        // observado tal cual, sin corregirlo (fuera de alcance: solo tests).
        test('session_id', () => {
            const user = new User(UsersMother.dto({ session_id: 'session-1' }));

            user.session_id = 'session-1';
            expect(user.session_id.value).toBe('session-1');
            expect(user.changedAttributes.session_id).toBeUndefined();

            user.session_id = 'session-2';
            expect(user.session_id.value).toBe('session_id');
            expect(user.changedAttributes.session_id).toBe('session-2');
        });

        // BUG DE PRODUCCION: mismo problema que `session_id` (ver comentario arriba) pero con
        // `set cognito_hash_data` / ValueObjectCognitoData.constructor(value, nullable).
        test('cognito_hash_data', () => {
            const user = new User(UsersMother.dto({ cognito_hash_data: 'hash-1' }));

            user.cognito_hash_data = 'hash-1';
            expect(user.cognito_hash_data.value).toBe('hash-1');
            expect(user.changedAttributes.cognito_hash_data).toBeUndefined();

            user.cognito_hash_data = 'hash-2';
            expect(user.cognito_hash_data.value).toBe('cognito_hash_data');
            expect(user.changedAttributes.cognito_hash_data).toBe('hash-2');
        });

        test('last_integration_active_at', () => {
            const original = '2026-01-01T00:00:00.000Z';
            const changed = '2026-02-01T00:00:00.000Z';
            const user = new User(UsersMother.dto({ last_integration_active_at: original }));

            user.last_integration_active_at = original;
            expect(user.last_integration_active_at.value).toBe(original);
            expect(user.changedAttributes.last_integration_active_at).toBeUndefined();

            user.last_integration_active_at = changed;
            expect(user.last_integration_active_at.value).toBe(changed);
            expect(user.changedAttributes.last_integration_active_at).toBe(changed);
        });
    });

    describe('last_seen_at / last_login_at setters (raw assignment, no ValueObject wrapping)', () => {
        // BUG NOTA: a diferencia de casi todos los demas setters de User.js, `set last_seen_at`
        // y `set last_login_at` NO envuelven `value` en un nuevo ValueObjectTimestamp: asignan
        // el valor crudo a la propiedad privada. El getter, por tanto, deja de devolver un VO
        // con `.value` en cuanto se usa el setter una vez, y `toJson()`/`toRulesContext()`
        // (que sí esperan un VO con `.value` para poder tratarlo como ISO string) reciben el
        // valor crudo en su lugar. Se documenta el comportamiento observado, no se corrige.
        test('last_seen_at is a no-op when the incoming value matches the current VO value, and a raw overwrite otherwise', () => {
            const original = '2026-01-01T00:00:00.000Z';
            const user = new User(UsersMother.dto({ last_seen_at: original }));

            user.last_seen_at = original;
            expect(user.last_seen_at.value).toBe(original);
            expect(user.changedAttributes.last_seen_at).toBeUndefined();

            const changed = '2026-03-01T00:00:00.000Z';
            user.last_seen_at = changed;
            expect(user.last_seen_at).toBe(changed);
            expect(user.changedAttributes.last_seen_at).toBe(changed);
        });

        test('last_login_at is a no-op when the incoming value matches the current VO value, and a raw overwrite otherwise', () => {
            const original = '2026-01-01T00:00:00.000Z';
            const user = new User(UsersMother.dto({ last_login_at: original }));

            user.last_login_at = original;
            expect(user.last_login_at.value).toBe(original);
            expect(user.changedAttributes.last_login_at).toBeUndefined();

            const changed = '2026-03-01T00:00:00.000Z';
            user.last_login_at = changed;
            expect(user.last_login_at).toBe(changed);
            expect(user.changedAttributes.last_login_at).toBe(changed);
        });
    });

    describe('reference-compared setters (codigos_externos, grid, data, ips_allowed)', () => {
        test('codigos_externos: passing back the current VO instance is a no-op, a new object replaces it', () => {
            const user = new User(UsersMother.dto({ codigos_externos: { legacy: '1' } }));

            const currentVo = user.codigos_externos;
            user.codigos_externos = currentVo;
            expect(user.codigos_externos).toBe(currentVo);
            expect(user.changedAttributes.codigos_externos).toBeUndefined();

            user.codigos_externos = { legacy: '2' };
            expect(user.codigos_externos.value).toEqual({ legacy: '2' });
            expect(user.changedAttributes.codigos_externos).toEqual({ legacy: '2' });
        });

        // BUG NOTA: a diferencia de `codigos_externos`/`data`/`ips_allowed` (que envuelven el
        // valor nuevo en un ValueObjectJson), `set grid` asigna el valor crudo directamente
        // (`this.#grid = value;`) sin envolverlo. El constructor SI lo envuelve
        // (`new ValueObjectJson('grid', dto.grid, true)`), asi que el tipo real de `user.grid`
        // cambia de VO a objeto plano en cuanto se usa el setter una vez. Se documenta el
        // comportamiento observado, no se corrige.
        test('grid: passing back the current value is a no-op, a new object replaces it (raw, unwrapped)', () => {
            const user = new User(UsersMother.dto({ grid: { columns: ['a'] } }));

            const currentGrid = user.grid;
            user.grid = currentGrid;
            expect(user.grid).toBe(currentGrid);
            expect(user.changedAttributes.grid).toBeUndefined();

            const newGrid = { columns: ['b'] };
            user.grid = newGrid;
            expect(user.grid).toBe(newGrid);
            expect(user.changedAttributes.grid).toBe(newGrid);
        });

        test('data: passing back the current VO instance is a no-op, a new object replaces it', () => {
            const user = new User(UsersMother.dto({ data: { foo: 'bar' } }));

            const currentVo = user.data;
            user.data = currentVo;
            expect(user.data).toBe(currentVo);
            expect(user.changedAttributes.data).toBeUndefined();

            user.data = { foo: 'baz' };
            expect(user.data.value).toEqual({ foo: 'baz' });
            expect(user.changedAttributes.data).toEqual({ foo: 'baz' });
        });

        test('ips_allowed: passing back the current VO instance is a no-op, a new object replaces it', () => {
            const user = new User(UsersMother.dto({ ips_allowed: { allow: ['10.0.0.1'] } }));

            const currentVo = user.ips_allowed;
            user.ips_allowed = currentVo;
            expect(user.ips_allowed).toBe(currentVo);
            expect(user.changedAttributes.ips_allowed).toBeUndefined();

            user.ips_allowed = { allow: ['10.0.0.2'] };
            expect(user.ips_allowed.value).toEqual({ allow: ['10.0.0.2'] });
            expect(user.changedAttributes.ips_allowed).toEqual({ allow: ['10.0.0.2'] });
        });
    });

    describe('groups', () => {
        test('keeps the provided array', () => {
            const user = new User(UsersMother.dto());
            const groupId = uuidv4();

            user.groups = [{ id: groupId, nombre: 'Soporte' }];

            // El id concreto (y no `expect.any(String)`) es lo que hace que este assert detecte
            // cualquier transformacion del setter: es un paso a traves puro.
            expect(user.groups).toEqual([{ id: groupId, nombre: 'Soporte' }]);
        });

        test('falls back to an empty array for a nullish/falsy value', () => {
            const user = new User(UsersMother.dto());
            user.groups = [{ id: uuidv4(), nombre: 'Soporte' }];

            user.groups = null;

            expect(user.groups).toEqual([]);
        });
    });

    describe('delete()', () => {
        test('prefixes email and login with a deleted_ marker and delegates to AggregateRoot.delete', () => {
            const user = new User(UsersMother.dto({ login: 'jperez', email: 'jperez@example.com' }));

            const deletedAt = '2026-05-01T00:00:00.000Z';
            const deletedBy = uuidv4();
            user.delete({ deleted_at: deletedAt, deleted_by: deletedBy });

            expect(user.email.value.startsWith('deleted_')).toBe(true);
            expect(user.email.value.endsWith('jperez@example.com')).toBe(true);
            expect(user.login.value.startsWith('deleted_')).toBe(true);
            expect(user.login.value.endsWith('jperez')).toBe(true);
            expect(user.deleted_at.value).toBe(deletedAt);
            expect(user.deleted_by.value).toBe(deletedBy);
        });

        test('does not re-prefix an email/login that is already deleted-marked', () => {
            const user = new User(
                UsersMother.dto({ login: 'deleted_1000_jperez', email: 'deleted_1000_jperez@example.com' })
            );

            user.delete({ deleted_at: '2026-05-01T00:00:00.000Z', deleted_by: uuidv4() });

            expect(user.email.value).toBe('deleted_1000_jperez@example.com');
            expect(user.login.value).toBe('deleted_1000_jperez');
        });
    });

    describe('hasAuxiliaryPermission', () => {
        const permissionsWith = (auxiliaries) => ({ auxiliaries });

        test('strips the "aux_" prefix from the entity before matching', () => {
            const user = new User(
                UsersMother.dto({
                    permissions: permissionsWith([{ module_id: 'cases', name: 'CasesCreate', granted: true }]),
                })
            );

            expect(user.hasAuxiliaryPermission('aux_cases', 'Create')).toBe(true);
        });

        test('is false when the module_id does not match', () => {
            const user = new User(
                UsersMother.dto({
                    permissions: permissionsWith([{ module_id: 'other', name: 'CasesCreate', granted: true }]),
                })
            );

            expect(user.hasAuxiliaryPermission('cases', 'Create')).toBe(false);
        });

        test('is false when the module_id matches but the permission name does not', () => {
            const user = new User(
                UsersMother.dto({
                    permissions: permissionsWith([{ module_id: 'cases', name: 'WrongName', granted: true }]),
                })
            );

            expect(user.hasAuxiliaryPermission('cases', 'Create')).toBe(false);
        });

        test('is false when module_id and name match but granted is not exactly true', () => {
            const user = new User(
                UsersMother.dto({
                    permissions: permissionsWith([{ module_id: 'cases', name: 'CasesCreate', granted: false }]),
                })
            );

            expect(user.hasAuxiliaryPermission('cases', 'Create')).toBe(false);
        });

        test('is true when module_id, name and granted all match', () => {
            const user = new User(
                UsersMother.dto({
                    permissions: permissionsWith([{ module_id: 'cases', name: 'CasesCreate', granted: true }]),
                })
            );

            expect(user.hasAuxiliaryPermission('cases', 'Create')).toBe(true);
        });
    });

    describe('toRulesContext', () => {
        test('marks last_seen_at as "false" when there is no last_seen_at recorded', () => {
            const user = new User(UsersMother.dto({ last_seen_at: null }));

            const context = user.toRulesContext();

            expect(context.last_seen_at).toBe('false');
        });

        test('marks last_seen_at as "true" when it is within the active session limit (default 2 minutes)', () => {
            const recentTimestamp = new Date(Date.now() - 30 * 1000).toISOString();
            const user = new User(UsersMother.dto({ last_seen_at: recentTimestamp }));

            const context = user.toRulesContext();

            expect(context.last_seen_at).toBe('true');
        });

        test('marks last_seen_at as "false" when it is outside a custom active session limit', () => {
            const oldTimestamp = new Date(Date.now() - 10 * 60 * 1000).toISOString();
            const user = new User(UsersMother.dto({ last_seen_at: oldTimestamp }));

            const context = user.toRulesContext(5);

            expect(context.last_seen_at).toBe('false');
        });

        test('marks last_seen_at as "true" within a custom active session limit', () => {
            const recentTimestamp = new Date(Date.now() - 3 * 60 * 1000).toISOString();
            const user = new User(UsersMother.dto({ last_seen_at: recentTimestamp }));

            const context = user.toRulesContext(5);

            expect(context.last_seen_at).toBe('true');
        });

        test('aux_users defaults to {} when there is no data', () => {
            const user = new User(UsersMother.dto({ data: null }));

            const context = user.toRulesContext();

            expect(context.aux_users).toEqual({});
        });

        test('aux_users mirrors data when it is an object', () => {
            const user = new User(UsersMother.dto({ data: { theme: 'dark' } }));

            const context = user.toRulesContext();

            expect(context.aux_users).toEqual({ theme: 'dark' });
        });
    });

    describe('isServiceAccount', () => {
        test('returns false for default active directory user (account_type = 1)', () => {
            const user = new User(UsersMother.dto({ account_type: 1 }));
            expect(user.isServiceAccount).toBe(false);
        });

        test('returns true for service user (account_type = 2)', () => {
            const user = new User(UsersMother.dto({ account_type: 2 }));
            expect(user.isServiceAccount).toBe(true);
        });
    });
});
