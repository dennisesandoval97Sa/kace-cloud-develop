import { v4 as uuid } from 'uuid';
import { FindLoginUser } from '../../domain/FindLoginUser';
import { CognitoCredentials } from '../../domain/CognitoCredentials';
import { resolveSessionKey } from '../../domain/SessionCookieService.js';
import { AuthenticationCognitoResponse } from '../AuthenticationResponse';
import { User } from '../../../users';
import { Parameters } from '../../../shared/domain/params/Parameters';
import { ListPermissions } from '../../../role/domain/ListPermissions';
import { backfillPermissionsWithAdminSearchDefaults } from '../../../role/domain/value-object/ValueObjectPermissions.js';
import { AccountTypeEnum, ValidationFailError } from '../../../shared';
import { Crypto } from '../../../shared';
import AuthFailError from '../../../shared/errors/AuthFailError.js';
import { AUTH_SESSION_ACTIVE_ON_ANOTHER_DEVICE } from '@kace/error-codes';

export class AuthenticationUser {
    /** is initialized in the constructor*/
    #payload;
    /** @type {KnexAuthCognitoRepository} is initialized in the constructor*/
    #repository;
    #cryptoParams; /** Is initialized in the constructor */

    constructor(payload, repository, cryptoParams) {
        this.#payload = payload;
        this.#repository = repository;
        this.#cryptoParams = cryptoParams;
    }

    async execute(isOneScript = false, sessionKeyFromCookie = null) {
        const crypto = new Crypto(
            this.#cryptoParams.secret_iv,
            this.#cryptoParams.secret_key,
            this.#cryptoParams.encryption_method
        );
        const credentials = new CognitoCredentials(this.#payload);
        const findUser = new FindLoginUser(this.#repository);

        const informationUser = await findUser.find(credentials.decodeToken.sub, credentials.decodeToken.email);
        const encryptedRefreshToken = crypto.encryptData(credentials.refresh_token);

        if (!informationUser) {
            const fullName = credentials.decodeToken.email.split('@')[0].split('.');
            const id = uuid();
            const rolId = Parameters.defaultRoleId;
            const now = new Date();
            const dtoUser = {
                id: id,
                account_type: AccountTypeEnum.ACTIVE_DIRECTORY.value,
                login: credentials.decodeToken.sub,
                nombres: fullName[0],
                apellido1: fullName[1] ?? fullName[0],
                email: credentials.decodeToken.email,
                is_active: 2,
                rol_id: rolId,
                created_at: now,
                created_by: id,
                cognito_hash_data: credentials.clientFingerprint,
                session_id: credentials.hashSessionId,
                refresh_token: encryptedRefreshToken,
                password_encryption_migrated:
                    this.#cryptoParams.encryption_method.toLowerCase() === Crypto.ENCRYPTION_METHOD ? true : null,
                session_key: credentials.session_key,
                session_key_rotated_at: now.toISOString(),
            };

            const user = new User(dtoUser);
            await this.#repository.save(user);

            return new AuthenticationCognitoResponse();
        }

        let forceNewSessionKey = false;

        if (informationUser.user.account_type.value === AccountTypeEnum.ACTIVE_DIRECTORY.value) {
            const storageFingerprint = informationUser.user.cognito_hash_data.value;
            const storedSessionKey = informationUser.user.session_key?.value ?? null;
            const force = this.#payload.force === true;

            const hasActiveSession =
                storageFingerprint !== null && storageFingerprint !== undefined && storedSessionKey !== null;
            const fingerprintMatches =
                storageFingerprint !== null &&
                storageFingerprint !== undefined &&
                credentials.clientFingerprint === storageFingerprint;
            const isConflict = hasActiveSession && !fingerprintMatches;

            if (isConflict && !force) {
                throw new AuthFailError(
                    'Session is active on another device.',
                    409,
                    AUTH_SESSION_ACTIVE_ON_ANOTHER_DEVICE
                );
            }

            if (isConflict && force) {
                await this.#repository.update({
                    id: informationUser.user.id.value,
                    cognito_hash_data: null,
                    session_key: null,
                    session_id: null,
                    session_key_rotated_at: null,
                    updated_at: new Date(),
                    updated_by: informationUser.user.id.value,
                });
                forceNewSessionKey = true;
            }
        }

        const storedSessionKey = informationUser.user.session_key?.value ?? null;
        const rotatedAtRaw = informationUser.user.session_key_rotated_at?.value ?? null;
        const rotatedAt = rotatedAtRaw ? new Date(rotatedAtRaw) : null;
        const { sessionKey, rotated } = resolveSessionKey({
            existingKey: storedSessionKey,
            rotatedAt,
            now: new Date(),
            forceNew: forceNewSessionKey,
            generateNew: () => credentials.session_key,
        });
        const sessionKeyRotatedAt = rotated ? new Date().toISOString() : rotatedAtRaw;

        const updatedUser = {
            id: informationUser.user.id.value,
            nombres: informationUser.user.nombres.value,
            apellido1: informationUser.user.apellido1.value,
            email: informationUser.user.email.value,
            is_active: informationUser.user.is_active.value,
            rol_id: informationUser.user.rol_id.value,
            filters: informationUser.user.filters.value,
            login: credentials.decodeToken.sub,
            external_id: informationUser.user.external_id.value,
            cognito_hash_data: credentials.clientFingerprint,
            session_id: credentials.hashSessionId,
            session_key: sessionKey,
            session_key_rotated_at: sessionKeyRotatedAt,
            apellido2: informationUser.user.apellido2.value,
            token: informationUser.user.token.value,
            telefono: informationUser.user.telefono.value,
            movil: informationUser.user.movil.value,
            account_type: informationUser.user.account_type.value,
            codigos_externos: informationUser.user.codigos_externos.value,
            grupo_activo: informationUser.user.grupo_activo.value,
            updated_at: new Date(),
            updated_by: informationUser.user.id.value,
            refresh_token: encryptedRefreshToken,
            last_login_at: new Date(credentials.decodeToken.auth_time * 1000).toISOString(),
            password_encryption_migrated:
                this.#cryptoParams.encryption_method.toLowerCase() === Crypto.ENCRYPTION_METHOD ? true : null,
        };

        if (isOneScript) {
            delete updatedUser.session_key;
            delete updatedUser.session_key_rotated_at;
        }

        await this.#repository.update(updatedUser);

        const listPermissions = new ListPermissions().toPrimivites();
        const updatedPerms = backfillPermissionsWithAdminSearchDefaults(informationUser.permisos, listPermissions);

        const response = {
            ...informationUser,
            user: updatedUser,
            permisos: updatedPerms,
        };

        return new AuthenticationCognitoResponse(response.permisos, response.groups, response.user);
    }
}
