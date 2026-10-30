import { KnexCaseRepository } from '../../../../src/cases/index.js';
import { knexConfig } from '../../../knexfile.js';
import CasesMother from '../../../cases/domain/CasesMother.js';
import UsersMother from '../../../users/domain/UsersMother.js';
import RoleMother from '../../../role/domain/RoleMother.js';
import { User } from '../../../../src/users/domain/User.js';
import { CanUpdateCase } from '../../../../src/shared/domain/rules/CanUpdateCase.js';

describe('CasePermissionService Tests (CaseUpdateNotOwner only)', () => {
    const caseRepository = new KnexCaseRepository(knexConfig);

    const createUser = (withSpecialPermission = false) => {
        const permisos = RoleMother.dto().permisos;

        if (withSpecialPermission) {
            const permiso = permisos.administrador.find(
                (p) => p.module_id === 'cases' && p.name === 'CaseUpdateNotOwner'
            );
            if (permiso) permiso.granted = true;
        }

        return new User({
            permissions: permisos,
            ...UsersMother.dto(),
        });
    };

    it('should return true when user is case owner', async () => {
        const ownerUser = createUser();
        const kase = await CasesMother.createCase(caseRepository, {
            responsable_id: ownerUser.id.value,
        });

        const result = CanUpdateCase.check(ownerUser, kase);

        expect(result).toBe(true);
    });

    it('should return true when user has CaseUpdateNotOwner permission', async () => {
        const adminUser = createUser(true);
        const kase = await CasesMother.createCase(caseRepository);

        const result = CanUpdateCase.check(adminUser, kase);

        expect(result).toBe(true);
    });

    it('should return false when user is not owner and has no special permission', async () => {
        const regularUser = createUser();
        const kase = await CasesMother.createCase(caseRepository);

        const result = CanUpdateCase.check(regularUser, kase);

        expect(result).toBe(false);
    });

    it('should return false for invalid case', () => {
        const user = createUser();

        const result = CanUpdateCase.check(user, null);

        expect(result).toBe(false);
    });

    it('should return false for invalid user', async () => {
        const kase = await CasesMother.createCase(caseRepository);

        const result = CanUpdateCase.check(null, kase);

        expect(result).toBe(false);
    });
});
