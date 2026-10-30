import { jest } from '@jest/globals';
import { Response } from '@kace/api-common/src/http_responses/Response.js';
import { CustomError } from '@kace/core/src/shared/errors/CustomError.js';
import { FolioSegmentError } from '@kace/core/src/folio-configurations/domain/FolioSegmentError.js';

const destroyed = [];

class BaseControllerStub {
    constructor(event) {
        this.event = event;
    }

    async destroyDbConnection() {
        destroyed.push('user');
    }
}

const status = (statusCode) => () => ({ statusCode });

jest.unstable_mockModule('@kace/api-common', () => ({
    BaseController: BaseControllerStub,
    Response,
    SearchAuthorizationError: class SearchAuthorizationError extends Error {},
    HttpResponse: { forbidden: status(403), internalServerError: status(500), notFound: status(404) },
}));
jest.unstable_mockModule('@kace/api-common/src/security/ObjectIdentityAuthorization.js', () => ({
    objectIdentityErrorResponse: () => null,
}));
jest.unstable_mockModule(
    '@kace/core/src/folio-configurations/infrastructure/KnexFolioConfigurationRepository.js',
    () => ({
        KnexFolioConfigurationRepository: jest.fn(() => ({ destroyConnection: async () => destroyed.push('configs') })),
    })
);
jest.unstable_mockModule('@kace/core/src/folio-configurations/infrastructure/KnexFolioSequenceRepository.js', () => ({
    KnexFolioSequenceRepository: jest.fn(() => ({ destroyConnection: async () => destroyed.push('sequences') })),
}));
jest.unstable_mockModule('@kace/core/src/shared/infrastructure/utils/Helper.js', () => ({
    Helper: { logInfo: jest.fn(), logError: jest.fn() },
}));

const { FolioBaseController } = await import('../src/folioBaseController.mjs');

const controller = () => new FolioBaseController({ tenantContext: { readerConfig: null }, headers: {} }, {});

describe('FolioBaseController', () => {
    it.each([
        ['un id inexistente', new CustomError('FolioConfiguration with ID x does not exist.', 404), 404],
        [
            'la contención del contador',
            new CustomError('El folio está en contención, reintente la operación', 409),
            409,
        ],
        ['una configuración inválida', new FolioSegmentError(2, 'field', 'no encuentra ningún valor'), 400],
    ])('responde %s con su propio código', (_, error, expected) => {
        expect(controller().fail(error).statusCode).toBe(expected);
    });

    it('lleva el mensaje del dominio como publicData para que no lo tape el genérico', () => {
        const body = JSON.parse(controller().fail(new CustomError('Detalle del dominio', 409)).toJson().body);

        expect(JSON.stringify(body)).toContain('Detalle del dominio');
    });

    it('responde 500 a un error que no es de dominio', () => {
        expect(controller().fail(new Error('boom')).statusCode).toBe(500);
    });

    it.each(['actionAdvanceSearch', 'actionHistory'])(
        '%s responde 404 en vez de la implementación heredada',
        async (action) => {
            expect((await controller()[action]()).statusCode).toBe(404);
        }
    );

    it('cierra los dos pools y el del usuario', async () => {
        destroyed.length = 0;
        await controller().destroyDbConnection();

        expect(destroyed).toEqual(['configs', 'sequences', 'user']);
    });
});
