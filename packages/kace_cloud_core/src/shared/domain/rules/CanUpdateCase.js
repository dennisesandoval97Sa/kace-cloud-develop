import { User } from '../../../users/domain/User.js';
import { Case } from '../../../cases/domain/Case.js';
import {Helper} from "../../infrastructure/utils/Helper.js";

export class CanUpdateCase {
    /**
     * Verifica si un usuario tiene permisos para actualizar un caso
     * @param {User} user - Usuario autenticado
     * @param {Case|null} caseToUpdate - Caso a actualizar
     * @returns {boolean} - True si tiene permisos de actualización
     */
    static check(user, caseToUpdate) {
        if (!(caseToUpdate instanceof Case)) {
            Helper.logError('CanUpdateCase::check', 'Case is not an instance of Case');
            return false;
        }
        if (!(user instanceof User)) {
            Helper.logError('CanUpdateCase::check', 'User is not an instance of User');
            return false;
        }

        const isOwner = caseToUpdate.responsable_id.value === user.id.value;
        const hasSpecialPermission = user.hasPermission('administrador', 'cases', 'CaseUpdateNotOwner');
        Helper.logDebug('CanUpdateCase::check',
            `User: ${user.id.value} - Case: ${caseToUpdate.id.value} - Owner: ${caseToUpdate.responsable_id.value} - Permission: ${hasSpecialPermission}`)

        return isOwner || hasSpecialPermission;
    }
}
