import { jest } from '@jest/globals';
import { FolioConfiguration } from '@kace/core/src/folio-configurations/domain/FolioConfiguration.js';

const SAVED_ID = '6d9a3c1e-2b4f-4c8a-9e1d-7f3b5a2c8d40';
const DRAFT = {
    segments: [
        { type: 'literal', value: 'RAD-' },
        { type: 'sequence', length: 5, pad_char: '0' },
    ],
    reset_policy: 'never',
    start_value: 1,
    overflow_policy: 'fail',
};

const saved = FolioConfiguration.create({
    ...DRAFT,
    id: SAVED_ID,
    nombre: 'Radicado',
    segments: [
        { type: 'literal', value: 'RAD-' },
        { type: 'sequence', length: 4, pad_char: '0' },
    ],
    status: 1,
    created_at: new Date(),
    created_by: SAVED_ID,
});

const previewed = [];

class BaseControllerStub {
    constructor(event) {
        this.event = event;
    }
}

const status = (statusCode) => (args) => ({ statusCode, ...args });

jest.unstable_mockModule('@kace/api-common', () => ({
    BaseController: BaseControllerStub,
    Response: class Response {},
    SearchAuthorizationError: class SearchAuthorizationError extends Error {},
    HttpResponse: {
        ok: status(200),
        forbidden: status(403),
        validationsFail: status(400),
        internalServerError: status(500),
    },
}));
jest.unstable_mockModule('@kace/api-common/src/security/ObjectIdentityAuthorization.js', () => ({
    objectIdentityErrorResponse: () => null,
}));
jest.unstable_mockModule(
    '@kace/core/src/folio-configurations/infrastructure/KnexFolioConfigurationRepository.js',
    () => ({ KnexFolioConfigurationRepository: jest.fn(() => ({})) })
);
jest.unstable_mockModule('@kace/core/src/folio-configurations/infrastructure/KnexFolioSequenceRepository.js', () => ({
    KnexFolioSequenceRepository: jest.fn(() => ({})),
}));
jest.unstable_mockModule('@kace/core/src/folio-configurations/application/find/FolioConfigurationFinder.js', () => ({
    FolioConfigurationFinder: jest.fn(() => ({ execute: async () => saved })),
}));
jest.unstable_mockModule('@kace/core/src/cases/application/folio/CaseFolioResolver.js', () => ({
    CaseFolioResolver: jest.fn(() => ({
        preview: async (configuration) => {
            previewed.push(configuration);
            return 'RAD-0004';
        },
    })),
}));
jest.unstable_mockModule('@kace/core/src/shared/infrastructure/utils/Helper.js', () => ({
    Helper: { logInfo: jest.fn(), logError: jest.fn() },
}));

const { ControllerPreview } = await import('../src/controllerPreview.mjs');

const preview = async (payload) => {
    const controller = new ControllerPreview({ tenantContext: { readerConfig: null }, headers: {} }, {});
    controller.user = { hasPermission: () => true, id: { value: SAVED_ID } };
    controller.payload = () => payload;
    const response = await controller.actionCreate();
    return { response, configuration: previewed.at(-1) };
};

describe('ControllerPreview', () => {
    beforeEach(() => {
        previewed.length = 0;
    });

    it('al editar una configuración guardada usa la estructura del borrador y el contador de su id', async () => {
        const { response, configuration } = await preview({ ...DRAFT, id: SAVED_ID });

        expect(response.statusCode).toBe(200);
        expect(configuration.id.value).toBe(SAVED_ID);
        expect(configuration.segments.value[1].length).toBe(5);
    });

    it('un borrador sin id lee un contador que no existe, así que muestra start_value', async () => {
        const { configuration } = await preview(DRAFT);

        expect(configuration.id.value).not.toBe(SAVED_ID);
        expect(configuration.segments.value[1].length).toBe(5);
    });

    it('con solo el id previsualiza la configuración guardada', async () => {
        const { configuration } = await preview({ id: SAVED_ID });

        expect(configuration).toBe(saved);
    });
});
