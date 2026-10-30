import { v4 as uuidv4 } from 'uuid';
import { knexConfig } from '../knexfile.js';
import { StatusEnum } from '../../src/shared';
import { CustomError } from '../../src/shared/errors/CustomError';
import {
    Flow,
    FlowCollectionResponse,
    FlowCounter,
    FlowCreator,
    FlowDeleter,
    FlowFinder,
    FlowResponse,
    FlowSearcher,
    FlowUpdater,
    FlowWithTransitionsOrchestrator,
    KnexFlowRepository,
} from '../../src/flow';
import FlowsMother from './domain/FlowsMother';
import { QueryDBError } from '../../src/shared/errors/QueryDBError.js';
import { TransitionsMother } from '../transition/domain/TransitionsMother.js';
import { KnexTransitionsRepository } from '../../src/transition/index.js';
import { ensureParentRow } from '../support/ensureParentRow.js';

describe('Flows Test', () => {
    const repository = new KnexFlowRepository(knexConfig);
    const transitionRepository = new KnexTransitionsRepository(knexConfig);

    it('creates a new Flow instance', async () => {
        const dto = FlowsMother.dto();
        const flowCreator = new FlowCreator(repository);

        await flowCreator.execute(dto);

        const result = await repository.connection('flujos').select('*').where('id', dto.id);

        expect(result.length).toBe(1);
    });

    it('should not create a new flow instance when null dto', async () => {
        const flowCreator = new FlowCreator(repository);

        await expect(flowCreator.execute(null)).rejects.toThrow(Error);
    });

    it('finds an existing Flow instance by id', async () => {
        const flow = await FlowsMother.createFlow(repository);
        const flowFinder = new FlowFinder(repository);

        const flowResult = await flowFinder.execute(flow.id.value);

        expect(flowResult).not.toBeNull();
        expect(flowResult).toBeInstanceOf(FlowResponse);
    });

    it('return null if not found a record', async () => {
        const flowFinder = new FlowFinder(repository);

        const flowResponse = await flowFinder.execute(uuidv4());

        expect(flowResponse).toBeNull();
    });

    it('updates an existing Flow instance', async () => {
        const flow = await FlowsMother.createFlow(repository);
        const flowUpdater = new FlowUpdater(repository);

        const dtoUpdate = {
            nombre: 'name updated',
            updated_at: new Date().toISOString(),
            updated_by: uuidv4(),
        };

        await flowUpdater.execute(dtoUpdate, flow.id.value);

        const result = await repository.find(flow.id);
        expect(result).toBeInstanceOf(Flow);
        expect(result.nombre.value).toBe(dtoUpdate.nombre);
    });

    it('should return an error when update a non-existent Flow instance', async () => {
        await FlowsMother.createFlow(repository);
        const flowUpdater = new FlowUpdater(repository);

        await expect(flowUpdater.execute({ status: StatusEnum.ACTIVE.value }, uuidv4())).rejects.toThrow(CustomError);
    });

    it('should allow update an in use Flow', async () => {
        const flow = await FlowsMother.createRelationshipWithCase(repository);
        const flowUpdater = new FlowUpdater(repository);

        await flowUpdater.execute({ status: StatusEnum.INACTIVE.value }, flow.id.value);

        const flowUpdated = await repository.find(flow.id);

        expect(flowUpdated.status.value).toBe(StatusEnum.INACTIVE.value);
    });

    it('deletes an existing Flow instance by id', async () => {
        const flow = await FlowsMother.createFlow(repository);
        const flowDeleter = new FlowDeleter(repository);

        const deleteDto = {
            deleted_at: new Date().toISOString(),
            deleted_by: uuidv4(),
        };

        await flowDeleter.execute(flow.id.value, deleteDto);

        // Sin filtrar por id, `first()` devolvia el flujo que deja la semilla.
        const flowUpdated = await repository
            .connection(repository.tableName)
            .select('*')
            .where({ id: flow.id.value })
            .first();

        // `flujos.deleted_at` es un timestamp: postgres lo devuelve como `Date`.
        expect(new Date(flowUpdated.deleted_at).toISOString()).toBe(deleteDto.deleted_at);
        expect(flowUpdated.deleted_by).toBe(deleteDto.deleted_by);
    });

    it('should return an error when delete an in use Flow', async () => {
        const flow = await FlowsMother.createRelationshipWithCase(repository);
        const flowDeleter = new FlowDeleter(repository);

        const deleteDto = {
            deleted_at: new Date().toISOString(),
            deleted_by: uuidv4(),
        };

        await expect(flowDeleter.execute(flow.id.value, deleteDto)).rejects.toThrow(CustomError);
    });

    it('should return an error when delete a non-existent Flow instance', async () => {
        await FlowsMother.createFlow(repository);
        const flowDeleter = new FlowDeleter(repository);

        const deleteDto = {
            deleted_at: new Date().toISOString(),
            deleted_by: uuidv4(),
        };

        await expect(flowDeleter.execute(uuidv4(), deleteDto)).rejects.toThrow(CustomError);
    });

    it('searches for Flow instances with given criteria', async () => {
        for (let i = 0; i < 10; i++) {
            await FlowsMother.createRandomFlow(repository);
        }
        const dtoCriteria = {
            filter: undefined,
            relationship: undefined,
            limit: 10,
            offset: 0,
            order: { field: 'created_at', direction: 'asc' },
        };
        const flowSearcher = new FlowSearcher(repository);

        const flowResult = await flowSearcher.execute(dtoCriteria);

        expect(flowResult).toBeInstanceOf(FlowCollectionResponse);
    });

    it('should return an error when not exist field is filtered', async () => {
        for (let i = 0; i < 10; i++) {
            await FlowsMother.createRandomFlow(repository);
        }
        const dtoCriteria = {
            filter: [
                {
                    field: 'not_exist',
                    operator: 'eq',
                    value: 'value',
                    type: 'AND',
                },
            ],
            relationship: undefined,
            limit: 10,
            offset: 0,
            order: { field: 'created_at', direction: 'asc' },
        };

        await expect(new FlowSearcher(repository).execute(dtoCriteria)).rejects.toThrow(QueryDBError);
    });

    it('counts the total number of Flows instances', async () => {
        const dtoCriteria = {
            filter: undefined,
            relationship: undefined,
            limit: 10,
            offset: 0,
            order: { field: 'created_at', direction: 'asc' },
        };

        const flowCounter = new FlowCounter(repository);
        // La semilla deja flujos en la tabla: se cuenta el incremento.
        const initialCount = Number((await flowCounter.execute(dtoCriteria)).count);

        for (let i = 0; i < 10; i++) {
            await FlowsMother.createRandomFlow(repository);
        }

        const flowResponse = await flowCounter.execute(dtoCriteria);

        expect(Number(flowResponse.count)).toBe(initialCount + 10);
    });

    it('should return a cero for not found criteria', async () => {
        for (let i = 0; i < 10; i++) {
            await FlowsMother.createRandomFlow(repository);
        }

        const dtoCriteria = {
            filter: [
                {
                    field: 'status',
                    operator: 'eq',
                    value: '10',
                    type: 'AND',
                },
            ],
            relationship: undefined,
            limit: 10,
            offset: 0,
            order: { field: 'created_at', direction: 'asc' },
        };

        const flowCounter = new FlowCounter(repository);

        const flowResult = await flowCounter.execute(dtoCriteria);

        expect(Number(flowResult.count)).toBe(0);
    });

    it('should throw an error when creating a Flow with a duplicate nombre', async () => {
        const dto1 = FlowsMother.dto();
        const dto2 = FlowsMother.dto();
        dto2.nombre = dto1.nombre;

        const flowCreator = new FlowCreator(repository);
        await flowCreator.execute(dto1);

        await expect(flowCreator.execute(dto2)).rejects.toThrow(
            new CustomError(`The following value(s) already exist: nombre '${dto1.nombre}'.`)
        );
    });

    it('should throw an error when updating a Flow to have a duplicate nombre', async () => {
        const flow1 = await FlowsMother.createFlow(repository);
        const flow2 = await FlowsMother.createFlow(repository);

        const flowUpdater = new FlowUpdater(repository);
        await expect(flowUpdater.execute({ nombre: flow1.nombre.value }, flow2.id.value)).rejects.toThrow(
            new CustomError(`The following value(s) already exist: nombre '${flow1.nombre.value}'.`)
        );
    });

    it('sets status=1 for edges present in DTO and status=2 for the rest', async () => {
        const flow = await FlowsMother.createRandomFlow(repository);
        const userId = uuidv4();
        const now = new Date().toISOString();

        // Los nodos del diagrama hacen de estados en `transiciones`, tanto en el
        // insert de abajo como en el que hace el orquestador. Postgres exige que
        // esas filas de `estados` existan; el nodo "0" es el inicio y no es estado.
        for (const node of flow.json_flujo.value.nodes) {
            if (node.id !== '0') {
                await ensureParentRow(transitionRepository.connection, 'estados', node.id);
            }
        }

        for (const edge of flow.json_flujo.value.edges) {
            edge.kace_transition = uuidv4();
            const estadoActualId = edge.source === '0' ? null : edge.source;
            await transitionRepository.connection('transiciones').insert({
                id: edge.kace_transition,
                estado_actual_id: estadoActualId,
                siguiente_estado_id: edge.target,
                flujo_id: flow.id.value,
                status: 1,
                ans_id: null,
                rule_id: null,
                is_visible: true,
                created_at: now,
                created_by: userId,
            });
        }

        const activeEdges = flow.json_flujo.value.edges.slice(0, 2);
        const dto = {
            json_flujo: {
                nodes: flow.json_flujo.value.nodes,
                edges: activeEdges,
            },
        };

        const flowUpdater = new FlowUpdater(repository);
        await flowUpdater.execute(dto, flow.id.value);

        const orchestrator = new FlowWithTransitionsOrchestrator({
            flowRepo: repository,
            transitionRepo: transitionRepository,
        });
        await orchestrator.executeUpdate({ ...dto, id: flow.id.value }, { userId, now });

        const rows = await repository
            .connection('transiciones')
            .select('id', 'status')
            .where({ flujo_id: flow.id.value })
            .orderBy('id');
        const statusById = Object.fromEntries(rows.map((r) => [r.id, r.status]));
        expect(statusById[flow.json_flujo.value.edges[0].kace_transition]).toBe(1);
        expect(statusById[flow.json_flujo.value.edges[1].kace_transition]).toBe(1);
        expect(statusById[flow.json_flujo.value.edges[2].kace_transition]).toBe(2);
    });
});
