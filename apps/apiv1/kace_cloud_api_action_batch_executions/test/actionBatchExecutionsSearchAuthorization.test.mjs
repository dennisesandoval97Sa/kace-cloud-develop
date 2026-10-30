import { jest } from '@jest/globals';
import { production as knexConfig } from '@kace/database/knexfile';
import {
    createApiEvent,
    createAuthenticatedUser,
    permission,
} from '@kace/api-common/tests/helpers/ObjectIdentityFixtures.js';
import { Controller } from '../src/controller.mjs';

const RESTFLOW_ID = '44444444-4444-4444-8444-444444444444';
const ACTION_ID = '55555555-5555-4555-8555-555555555555';

const createNoopConnection = () => () => ({
    select: jest.fn().mockReturnThis(),
    where: jest.fn().mockReturnThis(),
    whereNull: jest.fn().mockReturnThis(),
    andWhere: jest.fn().mockReturnThis(),
    modify(callback) {
        callback?.(this);
        return this;
    },
    first: jest.fn(async () => ({ id: RESTFLOW_ID })),
});

const instantiateController = ({ body, permissions = {} } = {}) => {
    const controller = new Controller(createApiEvent({ body }), knexConfig);
    controller.user = createAuthenticatedUser({ permissions });
    controller.started_at = new Date('2026-09-24T12:00:00.000Z');
    controller.repository = {
        table: createNoopConnection(),
        find: jest.fn(async () => null),
        save: jest.fn(async (actionJob) => actionJob),
    };
    controller.actionJobProcessingValidator = {
        saveFilteredResults: jest.fn(async () => ({
            processedCount: 5,
            casesFailed: 0,
            errors: [],
        })),
        validateBatchFile: jest.fn(async () => ({
            processedCount: 5,
            casesFailed: 0,
            errors: [],
        })),
    };
    return controller;
};

const grantBaseActionJobsCreate = (extraPermissions = {}) => ({
    administrador: [
        permission('administrador', 'action-jobs', 'ActionJobsCreate'),
        ...(extraPermissions.administrador || []),
    ],
    search: [...(extraPermissions.search || [])],
    agente: [...(extraPermissions.agente || [])],
});

const auxRelationship = [
    {
        table: 'aux_clients',
        type: 'left',
        condition: { column: 'aux_clients.cliente_id', refColumn: 'clients.id' },
    },
];

const clientAuxSearchFilter = {
    relationship: auxRelationship,
    filter: [
        {
            field: 'aux_clients.data',
            operator: 'jsonContains',
            value: JSON.stringify({ vih: true }),
            type: 'AND',
        },
        { field: 'status', operator: 'eq', value: 1, type: 'AND' },
    ],
    limit: 10,
    offset: 0,
};

describe('ActionBatchExecutions Search Authorization in actionCreate', () => {
    describe('type: filter_clients', () => {
        it('denies execution with 403 when user lacks auxiliary client permissions and attempts to join/filter aux_clients', async () => {
            const controller = instantiateController({
                body: {
                    type: 'filter_clients',
                    restflow_id: RESTFLOW_ID,
                    search_filter: clientAuxSearchFilter,
                },
                permissions: grantBaseActionJobsCreate(),
            });

            const response = await controller.actionCreate();

            expect(response.statusCode).toBe(403);
            expect(response.message).toBe('Advanced Search query is not allowed for this role.');
            expect(controller.actionJobProcessingValidator.saveFilteredResults).not.toHaveBeenCalled();
            expect(controller.repository.save).not.toHaveBeenCalled();
        });

        it('authorizes execution and calls saveFilteredResults when user has administrador/aux-clients/AuxClientRead', async () => {
            const controller = instantiateController({
                body: {
                    type: 'filter_clients',
                    restflow_id: RESTFLOW_ID,
                    search_filter: clientAuxSearchFilter,
                },
                permissions: grantBaseActionJobsCreate({
                    administrador: [permission('administrador', 'aux-clients', 'AuxClientRead')],
                }),
            });

            const response = await controller.actionCreate();

            expect(response.statusCode).toBe(201);
            expect(controller.actionJobProcessingValidator.saveFilteredResults).toHaveBeenCalledTimes(1);
            expect(controller.actionJobProcessingValidator.saveFilteredResults).toHaveBeenCalledWith(
                expect.objectContaining({
                    type: 'filter_clients',
                    restflow_id: RESTFLOW_ID,
                    search_filter: clientAuxSearchFilter,
                })
            );
            expect(controller.repository.save).toHaveBeenCalledTimes(1);
        });

        it('authorizes execution and calls saveFilteredResults when user has search/aux-clients/AuxClientsSearchAdvanced', async () => {
            const controller = instantiateController({
                body: {
                    type: 'filter_clients',
                    restflow_id: RESTFLOW_ID,
                    search_filter: clientAuxSearchFilter,
                },
                permissions: grantBaseActionJobsCreate({
                    search: [permission('search', 'aux-clients', 'AuxClientsSearchAdvanced')],
                }),
            });

            const response = await controller.actionCreate();

            expect(response.statusCode).toBe(201);
            expect(controller.actionJobProcessingValidator.saveFilteredResults).toHaveBeenCalledTimes(1);
            expect(controller.repository.save).toHaveBeenCalledTimes(1);
        });

        it('authorizes execution in advanced mode when user has search/clients/ClientsSearchAdvanced', async () => {
            const controller = instantiateController({
                body: {
                    type: 'filter_clients',
                    restflow_id: RESTFLOW_ID,
                    search_filter: clientAuxSearchFilter,
                },
                permissions: grantBaseActionJobsCreate({
                    search: [permission('search', 'clients', 'ClientsSearchAdvanced')],
                }),
            });

            const response = await controller.actionCreate();

            expect(response.statusCode).toBe(201);
            expect(controller.actionJobProcessingValidator.saveFilteredResults).toHaveBeenCalledTimes(1);
            expect(controller.repository.save).toHaveBeenCalledTimes(1);
        });
    });

    describe('type: filter (cases)', () => {
        const disallowedCaseSearchFilter = {
            filter: [
                {
                    field: 'unauthorized_case_field',
                    operator: 'eq',
                    value: 'test',
                    type: 'AND',
                },
            ],
            limit: 10,
            offset: 0,
        };

        it('denies execution with 403 when user lacks CasesSearchAdvanced and submits a disallowed filter', async () => {
            const controller = instantiateController({
                body: {
                    type: 'filter',
                    action_id: ACTION_ID,
                    search_filter: disallowedCaseSearchFilter,
                },
                permissions: grantBaseActionJobsCreate(),
            });

            const response = await controller.actionCreate();

            expect(response.statusCode).toBe(403);
            expect(response.message).toBe('Advanced Search query is not allowed for this role.');
            expect(controller.actionJobProcessingValidator.saveFilteredResults).not.toHaveBeenCalled();
            expect(controller.repository.save).not.toHaveBeenCalled();
        });

        it('authorizes execution when user has search/cases/CasesSearchAdvanced', async () => {
            const controller = instantiateController({
                body: {
                    type: 'filter',
                    action_id: ACTION_ID,
                    search_filter: disallowedCaseSearchFilter,
                },
                permissions: grantBaseActionJobsCreate({
                    search: [permission('search', 'cases', 'CasesSearchAdvanced')],
                }),
            });

            const response = await controller.actionCreate();

            expect(response.statusCode).toBe(201);
            expect(controller.actionJobProcessingValidator.saveFilteredResults).toHaveBeenCalledTimes(1);
            expect(controller.actionJobProcessingValidator.saveFilteredResults).toHaveBeenCalledWith(
                expect.objectContaining({
                    type: 'filter',
                    action_id: ACTION_ID,
                    search_filter: disallowedCaseSearchFilter,
                })
            );
            expect(controller.repository.save).toHaveBeenCalledTimes(1);
        });
    });
});
