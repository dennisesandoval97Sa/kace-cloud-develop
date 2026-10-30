import {
    CASE_RECLASSIFY_PERMISSION_NAMESPACES,
    hasCaseReclassifyPermission,
} from '../../src/security/CaseReclassifyPermission.js';

describe('hasCaseReclassifyPermission', () => {
    const userWith = (granted) => ({
        hasPermission: (namespace, moduleId, name) =>
            granted.includes(namespace) && moduleId === 'cases' && name === 'CaseReclassify',
    });

    it.each(CASE_RECLASSIFY_PERMISSION_NAMESPACES)('acepta el permiso concedido como %s', (namespace) => {
        expect(hasCaseReclassifyPermission(userWith([namespace]))).toBe(true);
    });

    it('rechaza a quien no lo tiene en ningún namespace', () => {
        expect(hasCaseReclassifyPermission(userWith([]))).toBe(false);
    });

    it('no acepta el mismo permiso en otro módulo', () => {
        const user = {
            hasPermission: (_namespace, moduleId, name) => moduleId === 'users' && name === 'CaseReclassify',
        };

        expect(hasCaseReclassifyPermission(user)).toBe(false);
    });

    /**
     * `ValueObjectPermissions.hasPermission` lanza cuando el usuario no tiene ese rol. No tenerlo
     * es una respuesta válida —no lo tiene concedido—, no un error que deba tumbar la petición.
     */
    it('niega el permiso cuando el usuario no tiene alguno de los roles, sin propagar el error', () => {
        const user = {
            hasPermission: (namespace) => {
                if (namespace !== 'administrador') throw new Error(`Role '${namespace}' not found`);
                return false;
            },
        };

        expect(() => hasCaseReclassifyPermission(user)).not.toThrow();
        expect(hasCaseReclassifyPermission(user)).toBe(false);
    });

    it('concede el permiso desde un rol aunque otro no exista en el usuario', () => {
        const user = {
            hasPermission: (namespace, moduleId, name) => {
                if (namespace !== 'agente') throw new Error(`Role '${namespace}' not found`);
                return moduleId === 'cases' && name === 'CaseReclassify';
            },
        };

        expect(hasCaseReclassifyPermission(user)).toBe(true);
    });

    it('rechaza a un usuario que no sabe responder por permisos', () => {
        expect(hasCaseReclassifyPermission(null)).toBe(false);
        expect(hasCaseReclassifyPermission({})).toBe(false);
    });

    it('no acepta otro permiso del módulo cases', () => {
        const user = {
            hasPermission: (_namespace, moduleId, name) => moduleId === 'cases' && name === 'CasesRead',
        };

        expect(hasCaseReclassifyPermission(user)).toBe(false);
    });
});
