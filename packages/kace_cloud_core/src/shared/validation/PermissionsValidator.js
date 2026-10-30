import { CustomError } from '../errors/CustomError';

export class PermissionsValidator {
    /**
     * Valida si un usuario tiene un permiso específico.
     *
     * @param {Object} permissions - Objeto con los permisos para cada rol.
     * @param {string} role - El rol que estamos validando.
     * @param {string} permissionToValidate - El nombre del permiso a validar.
     * @returns {boolean} - Devuelve 'true' si el permiso está concedido, de lo contrario 'false'.
     * @throws {Error} Si el permiso no se encuentra.
     */
    execute(permissions, role, permissionToValidate) {
        const permission = permissions[role].find((item) => item.name === permissionToValidate);
        if (!permission) {
            throw new CustomError(`El permiso "${permissionToValidate}" no existe para el rol "${role}".`, 400);
        }

        return permission.granted;
    }
}
