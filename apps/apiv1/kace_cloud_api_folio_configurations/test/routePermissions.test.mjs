import { jest } from '@jest/globals';

const status = (statusCode) => () => ({ statusCode });

class BaseControllerStub {
    constructor(event) {
        this.event = event;
    }
}

jest.unstable_mockModule('@kace/api-common', () => ({
    BaseController: BaseControllerStub,
    Response: class Response {},
    SearchAuthorizationError: class SearchAuthorizationError extends Error {},
    SearchAuthorizationService: { authorize: jest.fn() },
    HttpResponse: {
        forbidden: status(403),
        notFound: status(404),
        internalServerError: status(500),
        badRequest: status(400),
        validationsFail: status(400),
        ok: status(200),
        created: status(201),
    },
}));
jest.unstable_mockModule('@kace/api-common/src/security/ObjectIdentityAuthorization.js', () => ({
    objectIdentityErrorResponse: () => null,
    secureObjectCreatePayload: jest.fn(),
}));
jest.unstable_mockModule(
    '@kace/core/src/folio-configurations/infrastructure/KnexFolioConfigurationRepository.js',
    () => ({ KnexFolioConfigurationRepository: jest.fn(() => ({})) })
);
jest.unstable_mockModule('@kace/core/src/folio-configurations/infrastructure/KnexFolioSequenceRepository.js', () => ({
    KnexFolioSequenceRepository: jest.fn(() => ({})),
}));
jest.unstable_mockModule('@kace/core/src/shared/infrastructure/utils/Helper.js', () => ({
    Helper: { logInfo: jest.fn(), logError: jest.fn() },
}));

const { Controller } = await import('../src/controller.mjs');
const { ControllerPreview } = await import('../src/controllerPreview.mjs');
const { ControllerClassifications } = await import('../src/controllerClassifications.mjs');

/**
 * Every route API Gateway mounts for this service: the ones setDefaultResources registers
 * (KApiStack) plus the stack's own, with the controller and action handler.mjs and
 * BaseController.run() send it to.
 */
const ROUTES = [
    ['GET /', Controller, 'actionIndex', 403],
    ['POST /', Controller, 'actionCreate', 403],
    ['GET /{id}', Controller, 'actionRead', 403],
    ['POST /{id}', Controller, 'actionUpdate', 403],
    ['GET /{id}/delete', Controller, 'actionDelete', 403],
    ['POST /search', Controller, 'actionSearch', 403],
    ['POST /advance-search', Controller, 'actionAdvanceSearch', 404],
    ['POST /{id}/history', Controller, 'actionHistory', 404],
    ['POST /preview', ControllerPreview, 'actionCreate', 403],
    ['GET /{id}/classifications', ControllerClassifications, 'actionRead', 403],
];

const build = (ControllerClass, hasPermission) => {
    const controller = new ControllerClass({ tenantContext: { readerConfig: null }, headers: {} }, {});
    controller.user = { hasPermission: jest.fn(() => hasPermission), id: { value: 'user-1' } };
    return controller;
};

describe('Permisos de cada ruta de folio-configurations', () => {
    it.each(ROUTES)('%s sin permisos de folio responde %s', async (_route, ControllerClass, action, expected) => {
        const controller = build(ControllerClass, false);

        expect((await controller[action]()).statusCode).toBe(expected);
    });

    it.each(ROUTES.filter(([, , , expected]) => expected === 403))(
        '%s solo consulta permisos del módulo folio-configurations',
        async (_route, ControllerClass, action) => {
            const controller = build(ControllerClass, false);
            await controller[action]();

            const modules = controller.user.hasPermission.mock.calls.map(([, module]) => module);
            expect(modules.length).toBeGreaterThan(0);
            expect(new Set(modules)).toEqual(new Set(['folio-configurations']));
        }
    );

    it('las rutas heredadas responden 404 incluso con todos los permisos', async () => {
        const controller = build(Controller, true);

        expect((await controller.actionAdvanceSearch()).statusCode).toBe(404);
        expect((await controller.actionHistory()).statusCode).toBe(404);
    });
});
