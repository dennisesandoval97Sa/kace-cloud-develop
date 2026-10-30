import { jest } from '@jest/globals';

const built = [];
const controllerModule = (name) => ({
    [name]: jest.fn().mockImplementation((event) => {
        built.push({ name, resource: event.resource });
        return { run: async () => ({ toJson: () => ({ controller: name }) }) };
    }),
});

jest.unstable_mockModule('@kace/api-common', () => ({ withTenantContext: (handler) => handler }));
jest.unstable_mockModule('../src/controller.mjs', () => controllerModule('Controller'));
jest.unstable_mockModule('../src/controllerPreview.mjs', () => controllerModule('ControllerPreview'));
jest.unstable_mockModule('../src/controllerClassifications.mjs', () => controllerModule('ControllerClassifications'));

const { handler } = await import('../src/handler.mjs');

const invoke = (resource, httpMethod) => handler({ resource, httpMethod, tenantContext: { knexConfig: {} } });

describe('handler de folio-configurations', () => {
    beforeEach(() => {
        built.length = 0;
    });

    it.each([
        ['/preview', 'POST', 'ControllerPreview', '/'],
        ['/{id}/classifications', 'GET', 'ControllerClassifications', '/{id}'],
        ['/{id}', 'POST', 'Controller', '/{id}'],
        ['/search', 'POST', 'Controller', '/search'],
        ['/{id}/delete', 'GET', 'Controller', '/{id}/delete'],
    ])('%s %s lo atiende %s como %s y termina en run()', async (resource, method, name, rewritten) => {
        const response = await invoke(resource, method);

        expect(built).toEqual([{ name, resource: rewritten }]);
        expect(response).toEqual({ controller: name });
    });
});
