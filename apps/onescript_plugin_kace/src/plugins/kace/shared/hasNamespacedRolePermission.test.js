import { describe, expect, it } from 'vitest';
import { hasNamespacedRolePermission } from './hasNamespacedRolePermission.js';

describe('hasNamespacedRolePermission', () => {
  it('concede cuando el primer namespace tiene el permiso otorgado', () => {
    const userData = {
      permisions: {
        administrador: [{ name: 'CaseReclassify', granted: true }],
      },
    };
    expect(
      hasNamespacedRolePermission(userData, {
        namespaces: ['administrador', 'agente'],
        permissionName: 'CaseReclassify',
      })
    ).toBe(true);
  });

  it('concede cuando solo el segundo namespace tiene el permiso otorgado', () => {
    const userData = {
      permisions: {
        administrador: [],
        agente: [{ name: 'CaseReclassify', granted: true }],
      },
    };
    expect(
      hasNamespacedRolePermission(userData, {
        namespaces: ['administrador', 'agente'],
        permissionName: 'CaseReclassify',
      })
    ).toBe(true);
  });

  it('no concede cuando el permiso existe pero no está otorgado', () => {
    const userData = {
      permisions: {
        administrador: [{ name: 'CaseReclassify', granted: false }],
      },
    };
    expect(
      hasNamespacedRolePermission(userData, {
        namespaces: ['administrador'],
        permissionName: 'CaseReclassify',
      })
    ).toBe(false);
  });

  it('no concede cuando no hay datos de usuario', () => {
    expect(
      hasNamespacedRolePermission(null, {
        namespaces: ['administrador'],
        permissionName: 'CaseReclassify',
      })
    ).toBe(false);
  });

  it('no concede cuando el nombre del permiso no coincide', () => {
    const userData = {
      permisions: { administrador: [{ name: 'OtroPermiso', granted: true }] },
    };
    expect(
      hasNamespacedRolePermission(userData, {
        namespaces: ['administrador'],
        permissionName: 'CaseReclassify',
      })
    ).toBe(false);
  });
});
