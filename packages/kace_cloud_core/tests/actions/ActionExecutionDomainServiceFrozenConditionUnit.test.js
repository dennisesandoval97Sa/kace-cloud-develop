import { jest } from '@jest/globals';
import { ActionExecutionDomainService } from '../../src/actions/domain/ActionExecutionDomainService.js';
import { Action } from '../../src/actions/domain/Action.js';
import ActionMother from './domain/ActionMother.js';

const CASE_ID = 'a1b2c3d4-e5f6-7890-abcd-ef1234567890';
const FLAG = 'ACTION_FROZEN_CONDITION_CONTEXT_ENABLED';

// Acción entity='case' cuya condición exige cases.estado === 'iniciado'.
const makeEstadoIniciadoAction = () => {
    const dto = ActionMother.dto({ entity: 'case' });
    dto.conditions = {
        id: 'c',
        combinator: 'and',
        rules: [{ id: 'r1', field: 'cases.estado', operator: '=', value: 'iniciado', value_type: 'text' }],
    };
    return Action.create(dto);
};

// Case falso mínimo: satisface entity.id.value y toJson().
const makeFakeCase = (id = CASE_ID) => ({
    id: { value: id },
    toJson: () => ({ cases: { id, estado: 'iniciado' } }),
});

const ctxIniciado = { cases: { id: CASE_ID, estado: 'iniciado' } };
const ctxGestionando = { cases: { id: CASE_ID, estado: 'gestionando' } };

const buildService = ({ getCasoInfoMock, actions, refreshedCase }) => {
    const actionRepository = {
        getCasoInfo: getCasoInfoMock,
        search: jest.fn().mockResolvedValue(actions),
    };
    const actionExecutor = { execute: jest.fn().mockResolvedValue(undefined) };
    const caseRepository = { find: jest.fn().mockResolvedValue(refreshedCase) };
    const service = new ActionExecutionDomainService(actionRepository, actionExecutor, caseRepository);
    return { service, actionExecutor, getCasoInfoMock };
};

afterEach(() => {
    delete process.env[FLAG];
    jest.clearAllMocks();
});

describe('ActionExecutionDomainService – frozen condition context', () => {
    it('flag ON: ejecuta las 3 acciones aunque un cambio externo mute el estado a media secuencia', async () => {
        process.env[FLAG] = 'true';
        const actions = [makeEstadoIniciadoAction(), makeEstadoIniciadoAction(), makeEstadoIniciadoAction()];
        // preload='iniciado'; cualquier refresh posterior simula la escritura externa => 'gestionando'
        const getCasoInfoMock = jest.fn().mockResolvedValueOnce(ctxIniciado).mockResolvedValue(ctxGestionando);
        const { service, actionExecutor } = buildService({
            getCasoInfoMock,
            actions,
            refreshedCase: makeFakeCase(),
        });

        await service.execute('crear_caso', makeFakeCase());

        // Condición congelada en 'iniciado' => las 3 pasan y se ejecutan.
        expect(actionExecutor.execute).toHaveBeenCalledTimes(3);
    });

    it('flag OFF: comportamiento legacy — la 3ra acción se salta tras la mutación externa', async () => {
        // sin flag => default OFF
        const actions = [makeEstadoIniciadoAction(), makeEstadoIniciadoAction(), makeEstadoIniciadoAction()];
        const getCasoInfoMock = jest.fn().mockResolvedValueOnce(ctxIniciado).mockResolvedValue(ctxGestionando);
        const { service, actionExecutor } = buildService({
            getCasoInfoMock,
            actions,
            refreshedCase: makeFakeCase(),
        });

        await service.execute('crear_caso', makeFakeCase());

        // action1 pasa (iniciado) -> refresh a 'gestionando' -> action2 y action3 fallan.
        expect(actionExecutor.execute).toHaveBeenCalledTimes(1);
    });

    it('flag ON: la EJECUCIÓN recibe el dato vivo refrescado, no el congelado', async () => {
        process.env[FLAG] = 'true';
        const original = makeFakeCase();
        const refreshed = makeFakeCase();
        const actions = [makeEstadoIniciadoAction(), makeEstadoIniciadoAction()];
        const getCasoInfoMock = jest.fn().mockResolvedValueOnce(ctxIniciado).mockResolvedValue(ctxGestionando);
        const { service, actionExecutor } = buildService({
            getCasoInfoMock,
            actions,
            refreshedCase: refreshed,
        });

        await service.execute('crear_caso', original);

        // 1ra ejecución: dato original. 2da ejecución: dato refrescado (liveEntity).
        expect(actionExecutor.execute).toHaveBeenCalledTimes(2);
        expect(actionExecutor.execute.mock.calls[0][1]).toBe(original);
        expect(actionExecutor.execute.mock.calls[1][1]).toBe(refreshed);
    });

    it('seam B: si se pasa { conditionContext }, no se llama getCasoInfo para el preload', async () => {
        process.env[FLAG] = 'true';
        const actions = [makeEstadoIniciadoAction()];
        // Solo debería invocarse en el refresh post-acción, NO en el preload.
        const getCasoInfoMock = jest.fn().mockResolvedValue(ctxGestionando);
        const { service, actionExecutor } = buildService({
            getCasoInfoMock,
            actions,
            refreshedCase: makeFakeCase(),
        });

        await service.execute('crear_caso', makeFakeCase(), { conditionContext: ctxIniciado });

        // preload omitido (condición usa el contexto provisto) => 1 sola llamada (el refresh).
        expect(getCasoInfoMock).toHaveBeenCalledTimes(1);
        expect(actionExecutor.execute).toHaveBeenCalledTimes(1);
    });
});
