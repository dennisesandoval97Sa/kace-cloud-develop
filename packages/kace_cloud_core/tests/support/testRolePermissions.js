import { ListPermissions } from '../../src/role/domain/ListPermissions.js';
import { KnexRoleRepository } from '../../src/role/infrastructure/persistence/KnexRoleRepository.js';
import { ValueObjectUuid } from '../../src/shared/index.js';
import { globalRoleId } from '@kace/database/seeds/20241125105900_usuario_base.js';

/**
 * ESTE MODULO NO DEBE ENTRAR NUNCA EN `setupFilesAfterEnv`.
 *
 * Sus imports de `src/` arrastran 788 modulos (el barril `src/shared/index.js`
 * alcanza practicamente todo el dominio). Cargados desde `setupFilesAfterEnv`
 * se enlazan ANTES de que se evalue cada archivo de test, lo que deja inerte
 * cualquier `jest.unstable_mockModule` posterior sobre ellos: el consumidor ya
 * quedo enlazado contra la dependencia real. Se importa solo desde
 * `globalSetup` (templateDatabase.js), que corre en su propio proceso.
 * `tests/support/setupModuleGraph.test.js` vigila el invariante.
 */

/**
 * Construye el payload de permisos del rol global con todo concedido.
 *
 * Se expone aparte de la escritura para poder hashearlo (ver
 * `payloadFingerprint` en dbNaming.js) y derivar de ahi el nombre de la base
 * plantilla, de forma que un cambio en el catalogo la invalide.
 *
 * @returns {object} permisos primitivos con `granted: true` en agente y administrador
 */
export const buildGlobalRolePermissions = () => {
    const permissions = new ListPermissions().toPrimivites();

    permissions.agente.forEach((permission) => {
        permission.granted = true;
    });
    permissions.administrador.forEach((permission) => {
        permission.granted = true;
    });

    return permissions;
};

/**
 * Aplica los permisos del rol global que la suite asume presentes.
 * Reemplaza lo que antes hacia TestHelper.resetSchemaAndMigrate.
 *
 * Se invoca una sola vez por corrida, desde globalSetup, sobre la base
 * plantilla: todas las bases por-archivo se clonan de ella ya con los permisos
 * aplicados.
 *
 * @param {import('knex').Knex} connection
 * @param {object} [permissions] payload ya construido; si falta se construye aqui
 * @returns {Promise<void>}
 */
export const grantGlobalRolePermissions = async (connection, permissions = buildGlobalRolePermissions()) => {
    const repository = new KnexRoleRepository(connection);
    const role = await repository.find(new ValueObjectUuid('id', globalRoleId));
    role.permisos = permissions;
    await repository.update(role);
};
