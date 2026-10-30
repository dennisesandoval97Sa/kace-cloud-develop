import { Helper } from '../../infrastructure/utils/Helper.js';

/**
 * Permiso que habilita reclasificar un caso, como dato y no como código.
 *
 * Es la SSOT: `@kace/api-common` lo reexporta para el gate de los Lambdas y `CaseUpdater` lo
 * recibe en `options.requiredPermission` para comprobarlo otra vez dentro del dominio. Dos capas
 * que preguntan lo mismo a la misma definición, no dos listas que pueden divergir.
 *
 * @type {Readonly<{ namespaces: readonly string[], moduleId: string, name: string }>}
 */
export const CASE_RECLASSIFY_PERMISSION = Object.freeze({
    namespaces: Object.freeze(['administrador', 'agente']),
    moduleId: 'cases',
    name: 'CaseReclassify',
});

/**
 * Comprueba una especificación de permiso namespaced contra el usuario autenticado.
 *
 * `CanUpdateCase` responde «este usuario puede tocar ESTE caso» (propiedad del caso). Esta regla
 * responde otra pregunta: «este usuario tiene la capacidad», sin mirar el caso. Los casos de uso
 * que no exigen ser responsable —reclasificar— necesitan la segunda, y necesitan que el dominio la
 * haga cumplir por su cuenta en vez de confiar en que la capa de transporte no se equivoque nunca.
 *
 * Deliberadamente genérica (no ata su lógica a `CaseReclassify`): es la implementación canónica de
 * este dominio para «¿tiene el usuario este permiso namespaced, sin lanzar si le falta el rol?».
 * Antes de escribir otra copia de este mismo patrón (ya duplicado, con formas ligeramente
 * distintas, en `interactions` y `boards`), reutilizar esta.
 */
export class CanUseCapability {
    /**
     * @param {import('../../../users/domain/User.js').User|null} user
     * @param {{ namespaces: readonly string[], moduleId: string, name: string }} permission
     * @returns {boolean}
     */
    static check(user, permission) {
        if (!user || typeof user.hasPermission !== 'function') {
            Helper.logError('CanUseCapability::check', 'User cannot be asked for permissions');
            return false;
        }

        const { namespaces, moduleId, name } = permission ?? {};
        if (!Array.isArray(namespaces) || namespaces.length === 0 || !moduleId || !name) {
            Helper.logError('CanUseCapability::check', 'Malformed permission specification');
            return false;
        }

        // `ValueObjectPermissions.hasPermission` LANZA cuando el usuario no tiene ese rol, en vez
        // de responder `false`. Aquí la pregunta es «¿lo tiene concedido?», y no tenerlo por no
        // tener el rol es una respuesta válida: un rol ausente no puede tumbar el guardado ni,
        // peor, colarse como excepción que alguien atrape más arriba como si fuera otra cosa.
        return namespaces.some((namespace) => {
            try {
                return user.hasPermission(namespace, moduleId, name) === true;
            } catch {
                return false;
            }
        });
    }

    /**
     * Comprueba que una especificación de permiso tenga la forma esperada, sin decidir nada sobre
     * el usuario. Un `requiredPermission` mal armado es un error del llamador (typo, refactor a
     * medias), no una denegación de autorización: `check()` lo trataría igual que "no tiene el
     * permiso" y devolvería `false`, indistinguible de un 403 legítimo. Los llamadores que quieran
     * fallar alto ante ese error de programación —en vez de un 403 que oculta el bug— usan esto.
     * @param {unknown} permission
     * @returns {boolean}
     */
    static isWellFormed(permission) {
        const { namespaces, moduleId, name } = permission ?? {};
        return Array.isArray(namespaces) && namespaces.length > 0 && Boolean(moduleId) && Boolean(name);
    }
}
