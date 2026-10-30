import { jest } from '@jest/globals';

/**
 * Comprueba que cada accion del CRUD invoca la comprobacion de acceso al tablero, y que la
 * invoca ANTES de escribir. La politica esta probada en aislamiento en
 * `packages/kace_cloud_core/tests/boards/BoardAccessPolicy.test.js`; lo que aqui se fija es
 * su cableado: sin estos tests, borrar la llamada a `findAccessibleBoard` de `actionUpdate`
 * no rompe ninguna suite.
 *
 * Los casos de denegacion son los que cumplen ese papel: si se elimina la comprobacion, la
 * accion deja de responder 403 y el caso de uso llega a ejecutarse.
 */

const TENANT = {
    id: { value: 'tenant-1' },
    aws_cognito_user_pool_id: { value: 'us-east-1_test0000' },
    aws_cognito_app_client_id: { value: '1example23456789client0000' },
};

const BOARD_ID = '11111111-1111-4111-8111-111111111111';
const OWNER_ID = '22222222-2222-4222-8222-222222222222';
const OUTSIDER_ID = '33333333-3333-4333-8333-333333333333';
const OUTSIDER_GROUP_ID = '44444444-4444-4444-8444-444444444444';

/** Board expone value objects; la politica solo lee `.value`. */
const boardOwnedBy = (createdBy) => ({
    id: { value: BOARD_ID },
    access_users: { value: [] },
    access_groups: { value: [] },
    created_by: { value: createdBy },
});

const findBoardMock = jest.fn();
const updaterExecuteMock = jest.fn();
const deleterExecuteMock = jest.fn();

jest.unstable_mockModule('@kace/core/src/boards/infrastructure/persistence/KnexBoardsRepository', () => ({
    KnexBoardsRepository: class {},
}));

jest.unstable_mockModule('@kace/core/src/boards/domain/BoardFinder', () => ({
    BoardFinder: class {
        execute = findBoardMock;
    },
}));

jest.unstable_mockModule('@kace/core/src/boards/application/update/BoardUpdater', () => ({
    BoardUpdater: class {
        execute = updaterExecuteMock;
    },
}));

jest.unstable_mockModule('@kace/core/src/boards/application/delete/BoardDeleter', () => ({
    BoardDeleter: class {
        execute = deleterExecuteMock;
    },
}));

const { Controller } = await import('../src/controller.mjs');
const { User } = await import('@kace/core/src/users/index.js');

const MODULE_PERMISSIONS = ['BoardsRead', 'BoardsUpdate', 'BoardsDelete'].map((name) => ({
    role: 'administrador',
    module_id: 'boards',
    name,
}));

const BOARDS_ACCESS_ALL_PERMISSION = { role: 'administrador', module_id: 'boards', name: 'BoardsAccessAll' };

/*
 * El permiso que abre el panel de administracion. Lo tiene todo el que puede llegar al
 * listado, asi que no vale como llave maestra: mientras lo fue, el recorte por acceso no se
 * aplicaba a nadie.
 */
const PANEL_ACCESS_PERMISSION = { role: 'administrador', module_id: 'access-admin', name: 'Access' };

/**
 * `BaseController.set user` exige un `instanceof User`, y el constructor real pide un DTO
 * completo que no aporta nada a esta prueba. Se parte del prototipo y se definen como
 * propiedades propias solo lo que el controlador consulta, que sombrean los getters.
 */
const userWith = (permissions) => {
    const user = Object.create(User.prototype);

    Object.defineProperties(user, {
        id: { value: { value: OUTSIDER_ID } },
        grupo_activo: { value: { value: OUTSIDER_GROUP_ID } },
        hasPermission: {
            value: (role, moduleId, name) =>
                permissions.some(
                    (permission) =>
                        permission.role === role && permission.module_id === moduleId && permission.name === name
                ),
        },
    });

    return user;
};

const buildController = ({ isBoardAdmin = false, extraPermissions = [] } = {}) => {
    const event = {
        headers: {},
        tenantContext: { tenant: TENANT },
        requestContext: {},
    };

    const controller = new Controller(event, { client: 'pg', connection: { host: 'localhost' } });

    controller.user = userWith([
        ...MODULE_PERMISSIONS,
        ...(isBoardAdmin ? [BOARDS_ACCESS_ALL_PERMISSION] : []),
        ...extraPermissions,
    ]);
    controller.pathParameters = () => ({ id: BOARD_ID });
    controller.payload = () => ({ name: 'Tablero renombrado' });

    return controller;
};

describe('Controller de boards - guarda de acceso al tablero', () => {
    beforeEach(() => {
        jest.clearAllMocks();
        // Tablero ajeno: otro creador y listas de acceso vacias.
        findBoardMock.mockResolvedValue(boardOwnedBy(OWNER_ID));
    });

    describe.each([
        ['actionRead', (controller) => controller.actionRead()],
        ['actionUpdate', (controller) => controller.actionUpdate()],
        ['actionDelete', (controller) => controller.actionDelete()],
    ])('%s', (_name, run) => {
        it('responde 403 sobre un tablero ajeno pese a tener el permiso de modulo', async () => {
            const response = await run(buildController());

            expect(response.statusCode).toBe(403);
        });

        it('concede acceso a la llave maestra administrativa', async () => {
            const response = await run(buildController({ isBoardAdmin: true }));

            expect(response.statusCode).not.toBe(403);
        });

        it('no toma el acceso al panel de administracion por llave maestra', async () => {
            /*
             * La regresion que dejaba el listado sin recortar: `access-admin.Access` lo
             * tiene todo el que puede abrir el modulo, asi que relevar del recorte a quien
             * lo tenga equivale a no recortar a nadie.
             */
            const response = await run(buildController({ extraPermissions: [PANEL_ACCESS_PERMISSION] }));

            expect(response.statusCode).toBe(403);
        });

        it('responde 404 cuando el tablero no existe, sin filtrar si es ajeno', async () => {
            findBoardMock.mockResolvedValue(null);

            const response = await run(buildController());

            expect(response.statusCode).toBe(404);
        });
    });

    it('actionUpdate comprueba el acceso antes de escribir', async () => {
        const response = await buildController().actionUpdate();

        expect(response.statusCode).toBe(403);
        expect(updaterExecuteMock).not.toHaveBeenCalled();
    });

    it('actionDelete comprueba el acceso antes de borrar', async () => {
        const response = await buildController().actionDelete();

        expect(response.statusCode).toBe(403);
        expect(deleterExecuteMock).not.toHaveBeenCalled();
    });
});
