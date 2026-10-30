import {
    AggregateRoot,
    Helper,
    JsonWebToken,
    StatusEnum,
    AccountTypeEnum,
    ValueObjectBoolean,
    ValueObjectCodigoExterno,
    ValueObjectEmail,
    ValueObjectEnum,
    ValueObjectInt,
    ValueObjectJson,
    ValueObjectPhoneNumber,
    ValueObjectTimestamp,
    ValueObjectUuid,
} from '../../shared';
import { ValueObjectPermissions } from '../../role/index.js';
import { ValueObjectAccountType } from './ValueObjectAccountType';
import { ValueObjectLogin } from './ValueObjectLogin';
import { ValueObjectToken } from './ValueObjectToken';
import { ValueObjectUserFilters } from './ValueObjectUserFilters';
import { ValueObjectUserName } from './ValueObjectUserName.js';
import { ValueObjectSessionId } from './ValueObjectSessionId.js';
import { ValueObjectCognitoData } from './ValueObjectCognitoData.js';
import { ValueObjectStringMaxLength } from '../../clients/domain/ValueObjectStringMaxLength.js';

export class User extends AggregateRoot {
    /** @type {ValueObjectLogin} is initialized in the constructor */
    #login;
    /** @type {ValueObjectUserName} is initialized in the constructor */
    #nombres;
    /** @type {ValueObjectUserName} is initialized in the constructor */
    #apellido1;
    /** @type {ValueObjectUserName} is initialized in the constructor */
    #apellido2;
    /** @type {ValueObjectEmail} is initialized in the constructor */
    #email;
    /** @type {ValueObjectPhoneNumber} is initialized in the constructor */
    #telefono;
    /** @type {ValueObjectPhoneNumber} is initialized in the constructor */
    #movil;
    /** @type {ValueObjectUuid} is initialized in the constructor */
    #rol_id;
    /** @type {ValueObjectTimestamp} is initialized in the constructor */
    #inactivo_desde;
    /** @type {ValueObjectTimestamp} is initialized in the constructor */
    #inactivo_hasta;
    /** @type {ValueObjectInt} is initialized in the constructor */
    #intento_login;
    /** @type {ValueObjectTimestamp} is initialized in the constructor */
    #fecha_bloqueo;
    /** @type {ValueObjectUuid} is initialized in the constructor */
    #grupo_activo;
    /** @type {Object} is initialized in the constructor */
    #codigos_externos;
    /** @type {ValueObjectCodigoExterno} is initialized in the constructor */
    #external_id;
    /** @type {Object} is initialized in the constructor */
    #grid;
    /** @type {ValueObjectEnum} is initialized in the constructor */
    #is_active;
    /** @type {ValueObjectAccountType} is initialized in the constructor */
    #account_type;
    /** @type {ValueObjectToken} is initialized in the constructor */
    #token;
    /** @type {ValueObjectToken} is initialized in the constructor */
    #refresh_token;
    /** @type {Array<{id: string, nombre: string}>} */
    #groups = [];
    /** @type {ValueObjectInt} */
    #expiredCasesCount = null;
    /** @type {ValueObjectInt} */
    #intermediateCasesCount = null;
    /** @type {ValueObjectInt} */
    #notExpiredCasesCount = null;
    /** @type {ValueObjectJson} is initialized in the constructor */
    #filters;
    /** @type {ValueObjectPermissions} is initialized in the constructor */
    #permissions;
    /** @type {ValueObjectCognitoData} is initialized in the constructor */
    #cognito_hash_data;
    /** @type {ValueObjectSessionId} is initialized in the constructor */
    #session_id;
    /** @type {ValueObjectJson} is initialized in the constructor */
    #data;
    /** @type {ValueObjectJson} is initialized in the constructor */
    #ips_allowed;
    /** @type {ValueObjectTimestamp} is initialized in the constructor */
    #last_seen_at;
    /** @type {ValueObjectTimestamp} is initialized in the constructor */
    #last_login_at;
    /** @type {ValueObjectTimestamp} is initialized in the constructor */
    #last_integration_active_at;
    /** @type {ValueObjectBoolean} is initialized in the constructor */
    #password_encryption_migrated;
    /** @type {ValueObjectBoolean} is initialized in the constructor */
    #superadmin;

    /** @type {ValueObjectStringMaxLength} is initialized in the constructor */
    #session_key;

    /** @type {ValueObjectTimestamp} is initialized in the constructor */
    #session_key_rotated_at;

    get session_key() {
        return this.#session_key;
    }

    set session_key(value) {
        if (this.#session_key.value !== value) {
            this.#session_key = new ValueObjectStringMaxLength('session_key', value, 255, true);
            this.changedAttributes.session_key = value;
        }
    }

    get session_key_rotated_at() {
        return this.#session_key_rotated_at;
    }

    set session_key_rotated_at(value) {
        if (this.#session_key_rotated_at?.value !== value) {
            this.#session_key_rotated_at = new ValueObjectTimestamp('session_key_rotated_at', value, true);
            this.changedAttributes.session_key_rotated_at = value;
        }
    }

    constructor(dto) {
        super(dto.id);
        this.#login = new ValueObjectLogin('login', dto.login ?? 'default');
        this.#nombres = new ValueObjectUserName('nombres', dto.nombres ?? 'default');
        this.#apellido1 = new ValueObjectUserName('apellido1', dto.apellido1, true);
        this.#apellido2 = new ValueObjectUserName('apellido2', dto.apellido2, true);
        this.#email = new ValueObjectEmail('email', dto.email ?? 'default@default.com');
        this.#telefono = new ValueObjectPhoneNumber('telefono', dto.telefono, true);
        this.#movil = new ValueObjectPhoneNumber('movil', dto.movil, true);
        this.#is_active = new ValueObjectEnum('is_active', dto.is_active, Object.values(StatusEnum.toJson()));
        this.#rol_id = new ValueObjectUuid('rol_id', dto.rol_id);
        this.#inactivo_desde = new ValueObjectTimestamp('inactivo_desde', dto.inactivo_desde, true);
        this.#inactivo_hasta = new ValueObjectTimestamp('inactivo_hasta', dto.inactivo_hasta, true);
        this.#intento_login = new ValueObjectInt('intento_login', dto.intento_login, true);
        this.#fecha_bloqueo = new ValueObjectTimestamp('fecha_bloqueo', dto.fecha_bloqueo, true);
        this.#grupo_activo = new ValueObjectUuid('grupo_activo', dto.grupo_activo, true);
        this.#codigos_externos = new ValueObjectJson('codigos_externos', dto.codigos_externos, true);
        this.#external_id = new ValueObjectCodigoExterno('external_id', dto.external_id, true);
        this.#grid = new ValueObjectJson('grid', dto.grid, true);
        this.#account_type = new ValueObjectAccountType('Account type', dto.account_type ?? 1);
        this.#token = new ValueObjectToken('token', dto.token, true);
        this.#refresh_token = new ValueObjectToken('refresh_token', dto.refresh_token, true);
        this.#filters = new ValueObjectUserFilters('filters', dto.filters, true);
        this.#expiredCasesCount = new ValueObjectInt('expired_cases', dto.expiredCasesCount ?? 0, true);
        this.#intermediateCasesCount = new ValueObjectInt('expired_cases', dto.intermediateCasesCount ?? 0, true);
        this.#notExpiredCasesCount = new ValueObjectInt('expired_cases', dto.notExpiredCasesCount ?? 0, true);
        this.#permissions = new ValueObjectPermissions(dto.permissions ?? {});
        this.created_at = dto.created_at;
        this.created_by = dto.created_by;
        this.updated_at = dto.updated_at;
        this.updated_by = dto.updated_by;
        this.deleted_at = dto.deleted_at;
        this.deleted_by = dto.deleted_by;
        this.#last_seen_at = new ValueObjectTimestamp('last_seen_at', dto.last_seen_at, true);
        this.#last_login_at = new ValueObjectTimestamp('last_login_at', dto.last_login_at, true);
        this.#last_integration_active_at = new ValueObjectTimestamp(
            'last_integration_active_at',
            dto.last_integration_active_at,
            true
        );
        this.#cognito_hash_data = new ValueObjectCognitoData(dto.cognito_hash_data, true);
        this.#session_id = new ValueObjectSessionId(dto.session_id, true);
        this.#data = new ValueObjectJson('data', dto.data, true);
        this.#ips_allowed = new ValueObjectJson('ips_allowed', dto.ips_allowed, true);
        this.#password_encryption_migrated = new ValueObjectBoolean(
            'password_encryption_migrated',
            dto.password_encryption_migrated,
            true
        );
        this.#session_key = new ValueObjectStringMaxLength('session_key', dto.session_key, 255, true);
        this.#session_key_rotated_at = new ValueObjectTimestamp(
            'session_key_rotated_at',
            dto.session_key_rotated_at,
            true
        );
        this.#superadmin = new ValueObjectBoolean('superadmin', dto.superadmin ?? false, true);
    }

    get session_id() {
        return this.#session_id;
    }

    set session_id(value) {
        if (this.#session_id.value !== value) {
            this.#session_id = new ValueObjectSessionId('session_id', value);
            this.changedAttributes.session_id = value;
        }
    }

    get cognito_hash_data() {
        return this.#cognito_hash_data;
    }

    set cognito_hash_data(value) {
        if (this.#cognito_hash_data.value !== value) {
            this.#cognito_hash_data = new ValueObjectCognitoData('cognito_hash_data', value);
            this.changedAttributes.cognito_hash_data = value;
        }
    }

    get login() {
        return this.#login;
    }

    set login(value) {
        if (this.#login.value !== value) {
            this.#login = new ValueObjectLogin('login', value);
            this.changedAttributes.login = value;
        }
    }

    get nombres() {
        return this.#nombres;
    }

    set nombres(value) {
        if (this.#nombres.value !== value) {
            this.#nombres = new ValueObjectUserName('nombres', value);
            this.changedAttributes.nombres = value;
        }
    }

    get apellido1() {
        return this.#apellido1;
    }

    set apellido1(value) {
        if (this.#apellido1.value !== value) {
            this.#apellido1 = new ValueObjectUserName('apellido1', value);
            this.changedAttributes.apellido1 = value;
        }
    }

    get apellido2() {
        return this.#apellido2;
    }

    set apellido2(value) {
        if (this.#apellido2.value !== value) {
            this.#apellido2 = new ValueObjectUserName('apellido2', value);
            this.changedAttributes.apellido2 = value;
        }
    }

    get email() {
        return this.#email;
    }

    set email(value) {
        if (this.#email.value !== value) {
            this.#email = new ValueObjectEmail('email', value);
            this.changedAttributes.email = value;
        }
    }

    get telefono() {
        return this.#telefono;
    }

    set telefono(value) {
        if (this.#telefono.value !== value) {
            this.#telefono = new ValueObjectPhoneNumber('telefono', value, true);
            this.changedAttributes.telefono = value;
        }
    }

    get movil() {
        return this.#movil;
    }

    set movil(value) {
        if (this.#movil.value !== value) {
            this.#movil = new ValueObjectPhoneNumber('movil', value, true);
            this.changedAttributes.movil = value;
        }
    }

    get rol_id() {
        return this.#rol_id;
    }

    set rol_id(value) {
        if (this.#rol_id.value !== value) {
            this.#rol_id = new ValueObjectUuid('rol_id', value);
            this.changedAttributes.rol_id = value;
        }
    }

    get inactivo_desde() {
        return this.#inactivo_desde;
    }

    set inactivo_desde(value) {
        // SONAR-EXC: Se quiere hacer comparaciones estrictas
        if (this.#inactivo_desde.value !== value) {
            this.#inactivo_desde = new ValueObjectTimestamp('inactivo_desde', value, true);
            this.changedAttributes.inactivo_desde = value;
        }
    }

    get inactivo_hasta() {
        return this.#inactivo_hasta;
    }

    set inactivo_hasta(value) {
        // SONAR-EXC: Se quiere hacer comparaciones estrictas
        if (this.#inactivo_hasta.value !== value) {
            this.#inactivo_hasta = new ValueObjectTimestamp('inactivo_hasta', value, true);
            this.changedAttributes.inactivo_hasta = value;
        }
    }

    get intento_login() {
        return this.#intento_login;
    }

    set intento_login(value) {
        if (this.#intento_login.value !== value) {
            this.#intento_login = new ValueObjectInt('intento_login', value);
            this.changedAttributes.intento_login = value;
        }
    }

    get fecha_bloqueo() {
        return this.#fecha_bloqueo;
    }

    set fecha_bloqueo(value) {
        // SONAR-EXC: Se quiere hacer comparaciones estrictas
        if (this.#fecha_bloqueo.value !== value) {
            this.#fecha_bloqueo = new ValueObjectTimestamp('fecha_bloqueo', value, true);
            this.changedAttributes.fecha_bloqueo = value;
        }
    }

    get grupo_activo() {
        return this.#grupo_activo;
    }

    set grupo_activo(value) {
        if (this.#grupo_activo.value !== value) {
            this.#grupo_activo = new ValueObjectUuid('grupo_activo', value, true);
            this.changedAttributes.grupo_activo = value;
        }
    }

    get codigos_externos() {
        return this.#codigos_externos;
    }

    set codigos_externos(value) {
        if (this.#codigos_externos !== value) {
            this.#codigos_externos = new ValueObjectJson('codigos_externos', value);
            this.changedAttributes.codigos_externos = value;
        }
    }

    get external_id() {
        return this.#external_id;
    }

    set external_id(value) {
        // Vaciar el campo desde el formulario llega como '', se normaliza a null para que la columna
        // quede en NULL y no en cadena vacía.
        const normalized = value === '' ? null : value;
        if (this.#external_id.value !== normalized) {
            this.#external_id = new ValueObjectCodigoExterno('external_id', normalized, true);
            this.changedAttributes.external_id = normalized;
        }
    }

    get grid() {
        return this.#grid;
    }

    set grid(value) {
        if (this.#grid !== value) {
            this.#grid = value;
            this.changedAttributes.grid = value;
        }
    }

    get is_active() {
        return this.#is_active;
    }

    set is_active(value) {
        // SONAR-EXC: Se quiere hacer comparaciones estrictas
        if (this.#is_active.value !== value) {
            this.#is_active = new ValueObjectEnum('is_active', value, Object.values(StatusEnum.toJson()));
            this.changedAttributes.is_active = value;
        }
    }

    get account_type() {
        return this.#account_type;
    }

    set account_type(value) {
        this.#account_type = new ValueObjectAccountType('Account type', value);
        this.changedAttributes.account_type = value;
    }

    get isServiceAccount() {
        return Number(this.#account_type?.value) === AccountTypeEnum.SERVICE.value;
    }

    get token() {
        return this.#token;
    }

    get refresh_token() {
        return this.#refresh_token;
    }

    set token(value) {
        this.#token = new ValueObjectToken('token', value);
        this.changedAttributes.token = value;
    }

    set refresh_token(value) {
        this.#refresh_token = new ValueObjectToken('refresh_token', value, true);
        this.changedAttributes.refresh_token = value;
    }

    get groups() {
        return this.#groups;
    }

    set groups(value) {
        this.#groups = value || [];
    }

    get expiredCasesCount() {
        return this.#expiredCasesCount;
    }

    set expiredCasesCount(value) {
        this.#expiredCasesCount = new ValueObjectJson('expired_cases', value, true);
        this.changedAttributes.expiredCasesCount = this.#expiredCasesCount.value;
    }

    get intermediateCasesCount() {
        return this.#intermediateCasesCount;
    }

    set intermediateCasesCount(value) {
        this.#intermediateCasesCount = new ValueObjectJson('intermediate_cases', value, true);
        this.changedAttributes.intermediateCasesCount = this.#intermediateCasesCount.value;
    }

    get notExpiredCasesCount() {
        return this.#notExpiredCasesCount;
    }

    set notExpiredCasesCount(value) {
        this.#notExpiredCasesCount = new ValueObjectJson('not_expired_cases', value, true);
        this.changedAttributes.notExpiredCasesCount = this.#notExpiredCasesCount.value;
    }

    get filters() {
        return this.#filters;
    }

    set filters(value) {
        this.#filters = new ValueObjectUserFilters('filters', value);
        this.changedAttributes.filters = JSON.stringify(value);
    }

    get permissions() {
        return this.#permissions;
    }

    get last_seen_at() {
        return this.#last_seen_at;
    }

    set last_seen_at(value) {
        if (this.#last_seen_at?.value !== value) {
            this.#last_seen_at = value;
            this.changedAttributes.last_seen_at = value;
        }
    }

    get last_login_at() {
        return this.#last_login_at;
    }

    set last_login_at(value) {
        if (this.#last_login_at?.value !== value) {
            this.#last_login_at = value;
            this.changedAttributes.last_login_at = value;
        }
    }

    get last_integration_active_at() {
        return this.#last_integration_active_at;
    }

    set last_integration_active_at(value) {
        if (this.#last_integration_active_at?.value !== value) {
            this.#last_integration_active_at = new ValueObjectTimestamp('last_integration_active_at', value, true);
            this.changedAttributes.last_integration_active_at = value;
        }
    }

    get data() {
        return this.#data;
    }

    set data(value) {
        if (this.#data !== value) {
            this.#data = new ValueObjectJson('data', value, true);
            this.changedAttributes.data = value;
        }
    }

    get ips_allowed() {
        return this.#ips_allowed;
    }

    set ips_allowed(value) {
        if (this.#ips_allowed !== value) {
            this.#ips_allowed = new ValueObjectJson('ips_allowed', value, true);
            this.changedAttributes.ips_allowed = value;
        }
    }

    get password_encryption_migrated() {
        return this.#password_encryption_migrated;
    }

    set password_encryption_migrated(value) {
        this.#password_encryption_migrated = new ValueObjectBoolean('password_encryption_migrated', value, true);
        this.changedAttributes.password_encryption_migrated = this.#password_encryption_migrated.value;
    }

    /**
     * Read-only flag. Intentionally has NO setter so it can only be modified
     * directly in the database, never through the API/UI update flow.
     * @returns {ValueObjectBoolean}
     */
    get superadmin() {
        return this.#superadmin;
    }

    /**
     * Creates a new User object from the provided data transfer object (DTO).
     *
     * @param {Object} dto - The data transfer object containing the properties for the User object.
     * @returns {User} A new instance of the User class.
     */
    static create(dto) {
        return new User(dto);
    }

    /**
     * Overrides the base `delete()` to also mutate `email` and `login` with a
     * `deleted_{timestamp}_` prefix before soft-deleting the record.
     *
     * Mutating both fields allows a future user to be created with the same
     * email or login without collisions.
     *
     * Both mutations go through their respective setters (`set login` /
     * `set email`), which construct new ValueObjects and register the change
     * in `changedAttributes`. The original value is truncated if necessary to
     * keep the prefixed result within the column limits (login: 100 chars via
     * `ValueObjectLogin`, email: 200 chars via DB `varchar(200)`).
     *
     * @param {Object} dto - DTO with `deleted_at` and `deleted_by`.
     * @returns {void}
     */
    delete(dto) {
        const prefix = `deleted_${Date.now()}_`;

        const rawEmail = this.#email.value ?? '';
        if (!rawEmail.startsWith('deleted_')) {
            const maxEmailLen = 200 - prefix.length;
            this.email = `${prefix}${rawEmail.slice(0, maxEmailLen)}`;
        }

        const rawLogin = this.#login.value ?? '';
        if (!rawLogin.startsWith('deleted_')) {
            const maxLoginLen = 100 - prefix.length;
            this.login = `${prefix}${rawLogin.slice(0, maxLoginLen)}`;
        }

        super.delete(dto);
    }

    /**
     * Checks if the user is active.
     * @returns {boolean}
     */
    isActive() {
        if (this.deleted_at?.value || this.deleted_by?.value) {
            return false;
        }

        return Number(this.is_active?.value) === StatusEnum.ACTIVE.value;
    }

    authenticate(secretKey) {
        const jwt = new JsonWebToken(secretKey);
        return jwt.generateToken({
            id: this.id.value,
            name: this.nombres.value,
            rol: this.#rol_id,
        });
    }
    /**
     * Checks if the user has the specified permission for a given module and action.
     *
     * @param {string} role - The role of the user (e.g., "admin", "agente").
     * @param {string} moduleId - The ID of the module in which the permission is being checked (e.g., "user").
     * @param {string} action - The specific action to check permission for (e.g., "AnsCreate", "AnsUpdate").
     * @returns {boolean} - Returns `true` if the user has the permission for the specified action in the given module,
     *                      otherwise returns `false`.
     */
    hasPermission(role, moduleId, action) {
        return this.#permissions.hasPermission(role, moduleId, action);
    }

    hasSearchPermission(moduleId, permissionName) {
        return this.#permissions.hasSearchPermission(moduleId, permissionName);
    }

    /**
     * Checks whether the user has a specific auxiliary permission for a given entity and action.
     *
     * @param {string} entity - The name of the entity. If it starts with "aux_", the prefix will be removed.
     * @param {string} actionName - The name of the action to check (e.g., "Create", "Read", "Update").
     * @returns {boolean} Returns true if the auxiliary permission exists and is granted; otherwise, false.
     */
    hasAuxiliaryPermission(entity, actionName) {
        const normalizedEntity = entity?.startsWith('aux_') ? entity?.slice(4) : entity;

        const pascalEntity = normalizedEntity
            .replace(/-/g, '_')
            .split('_')
            .map((part) => part.charAt(0).toUpperCase() + part.slice(1))
            .join('');
        const requiredPermission = `${pascalEntity}${actionName}`;

        const permissionsValue =
            typeof this.#permissions?.value === 'string'
                ? JSON.parse(this.#permissions.value)
                : this.#permissions?.value;

        const auxPermissions = Array.isArray(permissionsValue?.auxiliaries) ? permissionsValue?.auxiliaries : [];
        Helper.logDebug(`User::hasPermission auxPermisions ${JSON.stringify(auxPermissions)}`);
        Helper.logDebug(`User::hasPermission normalized ${normalizedEntity}`);
        Helper.logDebug(`User::hasPermission requiredPermisison ${requiredPermission}`);
        return auxPermissions?.some((permission) =>
            this.#isPermissionMatch(permission, normalizedEntity, requiredPermission)
        );
    }
    /**
     * Private method to check if a given permission matches the required entity and permission name.
     * @param {Object} permission - The permission object to check.
     * @param {string} entity - The normalized name of the entity.
     * @param {string} requiredName - The required permission name.
     * @returns {boolean} - Returns true if the permission matches and is granted.
     */
    #isPermissionMatch(permission, entity, requiredName) {
        const normalizeEntity = entity.replace(/-/g, '_');

        return (
            permission?.module_id === normalizeEntity &&
            permission?.name === requiredName &&
            permission?.granted === true
        );
    }

    /**
     * Returns a JSON representation of the user with computed fields
     * resolved for rule evaluation purposes.
     * last_seen_at is transformed to 'true' if the user has been seen
     * within the active session limit, 'false' otherwise.
     * @param {number} activeSessionLimit - Minutes to consider a session active (default 2)
     * @returns {Object}
     */
    toRulesContext(activeSessionLimit = 2) {
        const json = super.toJson();

        const lastSeen = json.last_seen_at;
        if (!lastSeen) {
            json.last_seen_at = 'false';
        } else {
            const diffMinutes = (Date.now() - new Date(lastSeen).getTime()) / (1000 * 60);
            json.last_seen_at = diffMinutes <= activeSessionLimit ? 'true' : 'false';
        }

        json.aux_users = json.data && typeof json.data === 'object' ? json.data : {};

        return json;
    }
}
