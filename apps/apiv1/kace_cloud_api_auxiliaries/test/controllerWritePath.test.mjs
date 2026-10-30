import { jest } from '@jest/globals';

// Este test ejerce el Controller real de punta a punta (actionCreate/actionUpdate), a diferencia
// de schemaConversionsWritePath.test.mjs, que reconstruye a mano los parámetros que el controller
// pasa a SchemaBuilder/SchemaConversionsApplier. Sólo se mockean fronteras de I/O e identidad
// (BaseController, repositorios Knex, buscadores de aplicación); SchemaBuilder y
// SchemaConversionsApplier corren con su código real.

const auxDefinitionFinderExecute = jest.fn();
const schemaRulesExecute = jest.fn();
const auxiliaryCreatorExecute = jest.fn().mockResolvedValue(undefined);
const auxiliaryUpdaterExecute = jest.fn().mockResolvedValue(undefined);

class FakeBaseController {
    constructor(event) {
        this.event = event;
    }

    payload() {
        return this.event.payload;
    }

    pathParameters() {
        return this.event.pathParameters;
    }

    validateId() {
        return true;
    }

    get database_connection() {
        return {};
    }
}

// Identity/audit plumbing, not the schema write-path subject: pass the payload through so the
// real `HttpResponse`/`Response` chain (which needs a much larger slice of `shared/index.js`)
// never loads. It does not touch `data.value.data`, so it cannot mask the assertions below.
jest.unstable_mockModule('@kace/api-common/src/security/ObjectIdentityAuthorization.js', () => ({
    applyServerManagedFields: (payload = {}) => ({ ...payload }),
    secureObjectCreatePayload: async ({ payload = {} }) => ({ ...payload }),
    objectIdentityErrorResponse: () => null,
}));

jest.unstable_mockModule('@kace/api-common', () => ({
    BaseController: FakeBaseController,
    HttpResponse: {
        ok: (args) => ({ statusCode: 200, ...args }),
        created: (args) => ({ statusCode: 201, ...args }),
        forbidden: (args) => ({ statusCode: 403, ...args }),
        badRequest: (args) => ({ statusCode: 400, ...args }),
        validationsFail: (args) => ({ statusCode: 400, ...args }),
        internalServerError: (args) => ({ statusCode: 500, ...args }),
    },
    SearchAuthorizationError: class SearchAuthorizationError extends Error {},
    SearchAuthorizationService: jest.fn().mockImplementation(() => ({ authorize: jest.fn() })),
}));

jest.unstable_mockModule('@kace/core/src/shared/index.js', () => ({
    Helper: { logInfo: jest.fn(), logError: jest.fn(), logDebug: jest.fn() },
    ValidationFailError: class ValidationFailError extends Error {},
    ValueObjectUuid: { random: () => 'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa', isValidUuid: () => true },
}));

jest.unstable_mockModule('@kace/core/src/auxiliaries/infrastructure/persistence/KnexAuxiliariesRepository', () => ({
    KnexAuxiliariesRepository: jest.fn().mockImplementation(() => ({ connection: {} })),
}));
jest.unstable_mockModule('@kace/core/src/auxiliaries/application/create/AuxiliaryCreator', () => ({
    AuxiliaryCreator: jest.fn().mockImplementation(() => ({ execute: auxiliaryCreatorExecute })),
}));
jest.unstable_mockModule('@kace/core/src/auxiliaries/application/update/AuxiliaryUpdater', () => ({
    AuxiliaryUpdater: jest.fn().mockImplementation(() => ({ execute: auxiliaryUpdaterExecute })),
}));
jest.unstable_mockModule('@kace/core/src/auxiliaries/application/find/AuxiliaryFinder', () => ({
    AuxiliaryFinder: jest.fn(),
}));
jest.unstable_mockModule('@kace/core/src/auxiliaries/application/delete/AuxiliaryDeleter', () => ({
    AuxiliaryDeleter: jest.fn(),
}));
jest.unstable_mockModule('@kace/core/src/auxiliaries/application/delete/AuxiliaryBulkDeleter', () => ({
    AuxiliaryBulkDeleter: jest.fn(),
}));
jest.unstable_mockModule('@kace/core/src/auxiliaries/application/search/AuxiliarySearcher', () => ({
    AuxiliarySearcher: jest.fn(),
}));
jest.unstable_mockModule('@kace/api-common/src/validation/schemas/SearchSchema', () => ({
    SearchSchema: { validate: jest.fn() },
}));
jest.unstable_mockModule('@kace/core/src/shared/domain/services/SearchHistory', () => ({
    SearchHistory: jest.fn(),
}));
jest.unstable_mockModule('@kace/core/src/aux_definitions/domain/AuxDefinitionTableNameFinder', () => ({
    AuxDefinitionTableNameFinder: jest.fn().mockImplementation(() => ({ execute: auxDefinitionFinderExecute })),
}));
jest.unstable_mockModule(
    '@kace/core/src/aux_definitions/infrastructure/persitance/KnexAuxDefinitionsRepository',
    () => ({
        KnexAuxDefinitionsRepository: jest.fn().mockImplementation(() => ({})),
    })
);
jest.unstable_mockModule('@kace/core/src/schemas/application/rules/SchemaRules', () => ({
    SchemaRules: jest.fn().mockImplementation(() => ({ execute: schemaRulesExecute })),
}));
jest.unstable_mockModule('@kace/core/src/schemas/infrastructure/persistence/KnexSchemasRepository', () => ({
    KnexSchemasRepository: jest.fn().mockImplementation(() => ({})),
}));
jest.unstable_mockModule('@kace/core/src/boards/infrastructure/persistence/KnexBoardsRepository', () => ({
    KnexBoardsRepository: jest.fn().mockImplementation(() => ({})),
}));
jest.unstable_mockModule('@kace/core/src/boards/application/BoardPermissionChecker.js', () => ({
    BoardPermissionChecker: jest.fn().mockImplementation(() => ({ execute: jest.fn() })),
}));

const { Controller } = await import('../src/controller.mjs');

// Un string con trim+uppercase, y defaults de los tres tipos primitivos que el editor de Esquemas
// soporta. `documento_confirmado` depende de `documento` (que sí se envía): `buildPartial` lo mete
// en el esquema parcial del update aunque el patch no lo mencione, así que es el único campo capaz
// de delatar si el update reactiva `materializeDefaults` (los defaults sueltos de sede/activo/
// prioridad ni siquiera entran al esquema parcial cuando no se envían, con o sin el flag).
const dataStructure = {
    documento: { type: 'string', required: false, empty: true, trim: true, transform: true, uppercase: true },
    activo: { type: 'boolean', required: false, default: false },
    sede: { type: 'string', required: false, empty: true, default: 'principal' },
    prioridad: { type: 'number', required: false, default: 1 },
    ingreso: { type: 'date', required: false, timezoneFormat: 'withoutTimezone', timezone: 'America/Bogota' },
    documento_confirmado: {
        type: 'boolean',
        required: false,
        dependency: true,
        dependsOn: 'documento',
        default: true,
    },
};

const buildEvent = ({ pathParameters, payload }) => ({
    pathParameters,
    payload,
    queryStringParameters: {},
});

const createController = ({ pathParameters, payload }) => {
    const controller = new Controller(buildEvent({ pathParameters, payload }), {});
    controller.user = { id: { value: 'user-1' }, hasAuxiliaryPermission: () => true };
    return controller;
};

describe('auxiliaries Controller: camino real de escritura del data_structure', () => {
    beforeEach(() => {
        jest.clearAllMocks();
        auxDefinitionFinderExecute.mockResolvedValue({ schema_id: { value: 'schema-1' } });
        schemaRulesExecute.mockResolvedValue({ toJson: () => ({ data: { data_structure: dataStructure } }) });
        auxiliaryCreatorExecute.mockResolvedValue(undefined);
        auxiliaryUpdaterExecute.mockResolvedValue(undefined);
    });

    it('actionCreate: normaliza el string enviado y materializa los defaults string/boolean/number omitidos', async () => {
        const controller = createController({
            pathParameters: { entity: 'cases_test' },
            payload: { data: { documento: '  ab-12  ', ingreso: '2026-01-15T10:00:00' } },
        });

        const response = await controller.actionCreate();

        expect(response.statusCode).toBe(201);
        const written = auxiliaryCreatorExecute.mock.calls[0][0].data;
        expect(written).toMatchObject({
            documento: 'AB-12',
            activo: false,
            sede: 'principal',
            prioridad: 1,
            ingreso: '2026-01-15T10:00:00',
        });
    });

    it('actionUpdate: normaliza el string enviado pero NO materializa ningún default, incluido el dependiente', async () => {
        const controller = createController({
            pathParameters: { entity: 'cases_test', id: 'a1b2c3d4-e5f6-4000-8000-000000000000' },
            payload: { data: { documento: '  ab-12  ', ingreso: '2026-01-15T10:00:00' } },
        });

        const response = await controller.actionUpdate();

        expect(response.statusCode).toBe(200);
        const written = auxiliaryUpdaterExecute.mock.calls[0][1].data;
        expect(written).toEqual({ documento: 'AB-12', ingreso: '2026-01-15T10:00:00' });
    });

    it('actionCreate: una fecha withoutTimezone+timezone persiste lo enviado, no la forma que Joi convierte', async () => {
        const controller = createController({
            pathParameters: { entity: 'cases_test' },
            payload: { data: { ingreso: '2026-01-15T10:00:00' } },
        });

        const response = await controller.actionCreate();

        expect(response.statusCode).toBe(201);
        const written = auxiliaryCreatorExecute.mock.calls[0][0].data;
        expect(written.ingreso).toBe('2026-01-15T10:00:00');
    });
});
