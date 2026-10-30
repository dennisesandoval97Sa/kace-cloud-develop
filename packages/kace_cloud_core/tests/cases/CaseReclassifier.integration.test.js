import { jest } from '@jest/globals';
import { v4 as uuidv4 } from 'uuid';
import {
    CASE_RECLASSIFY_CASE_CLOSED,
    CASE_RECLASSIFY_CLASSIFICATION_INACTIVE,
    CASE_RECLASSIFY_CLASSIFICATION_NOT_IN_GROUP,
    CASE_RECLASSIFY_CLASSIFICATION_STALE,
    CASE_RECLASSIFY_CLASSIFICATION_WITHOUT_FORM,
    CASE_RECLASSIFY_SUBCASE_NOT_ALLOWED,
    CASE_TRANSITION_CONDITIONS_NOT_MET,
    CASE_RECLASSIFY_TRANSITION_OUT_OF_FLOW,
} from '@kace/error-codes';
import { knexConfig } from '../knexfile.js';
import {
    CaseReclassifier,
    CaseUpdater,
    ClassificationFlowStatesFinder,
    ClassificationFlowTransitionRulesFinder,
    KnexCaseRepository,
    KnexSubcaseRelationshipRepository,
    SubCaseRelationCreator,
} from '../../src/cases';
import { KnexTransitionsCaseRepository } from '../../src/cases/infrastructure/persistence/KnexTransitionsCaseRepository.js';
import { KnexTransitionRuleRepository } from '../../src/transition-rules/infrastructure/KnexTransitionRuleRepository.js';
import { KnexCommentsRepository } from '../../src/comments';
import { KnexClassificationRepository } from '../../src/classifications';
import { KnexClassificationGroupRelationshipRepository } from '../../src/classification-group-relationships';
import { KnexFlowRepository } from '../../src/flow';
import { KnexTransitionsRepository } from '../../src/transition';
import { KnexStateRepository } from '../../src/state';
import { KnexGroupsRepository } from '../../src/grupos';
import { KnexShiftManagementRepository } from '../../src/shift-management';
import { KnexClientRepository } from '../../src/clients';
import { KnexUsersRepository, User } from '../../src/users';
import FlowsMother from '../flow/domain/FlowsMother';
import { TransitionsMother } from '../transition/domain/TransitionsMother';
import { StateMother } from '../state/domain/StateMother';
import CasesMother from './domain/CasesMother';
import ClientMother from '../clients/domain/ClientMother';
import UsersMother from '../users/domain/UsersMother';
import ClassificationsMother from '../classifications/domain/ClassificationsMother';
import ClassificationGroupMother from '../classification-group-relationships/domain/ClassificationGroupMother';
import { TransitionRuleMother } from '../transition-rules/domain/TransitionRuleMother';
import { GroupsMother } from '../grupos/domain/GroupsMother';
import { CaseFolioResolver } from '../../src/cases/application/folio/CaseFolioResolver.js';
import { KnexFolioConfigurationRepository } from '../../src/folio-configurations/infrastructure/KnexFolioConfigurationRepository.js';
import { KnexFolioSequenceRepository } from '../../src/folio-configurations/infrastructure/KnexFolioSequenceRepository.js';
import { FolioConfigurationMother } from '../folio-configurations/domain/FolioConfigurationMother.js';

/**
 * QA-1 y QA-2 (MSKT-1392): el caso de uso de reclasificación y el resolutor de estados del
 * flujo destino.
 *
 * Cada validación tiene su propio test porque cada una tiene su propio código público: es lo
 * que permite al plugin decir POR QUÉ no se puede reclasificar en vez de un 400 mudo.
 */
describe('CaseReclassifier', () => {
    const repository = new KnexCaseRepository(knexConfig);
    const classificationsRepository = new KnexClassificationRepository(repository.connection);
    const classificationGroupRelationshipRepository = new KnexClassificationGroupRelationshipRepository(
        repository.connection
    );
    const transitionsCaseRepository = new KnexTransitionsCaseRepository(repository.connection);
    const subcaseRelationshipRepository = new KnexSubcaseRelationshipRepository(repository.connection);
    const commentsRepository = new KnexCommentsRepository(repository.connection);
    const flowRepo = new KnexFlowRepository(repository.connection);
    const stateRepo = new KnexStateRepository(repository.connection);
    const transitionRepo = new KnexTransitionsRepository(repository.connection);
    const groupsRepository = new KnexGroupsRepository(repository.connection);
    const shiftManagementRepository = new KnexShiftManagementRepository(repository.connection);
    const clientRepository = new KnexClientRepository(repository.connection);
    const usersRepository = new KnexUsersRepository(repository.connection);

    /** `CaseReclassify` es el permiso que este caso de uso exige; sin él el dominio responde 403. */
    const makeUser = (reclassifyGranted) =>
        new User({
            permissions: {
                administrador: [
                    { module_id: 'cases', name: 'CaseUpdateNotOwner', granted: true },
                    { module_id: 'cases', name: 'CaseReclassify', granted: reclassifyGranted },
                ],
            },
            ...UsersMother.dto(),
        });

    const currentUser = makeUser(true);
    const eventPublisherMock = { publishAll: jest.fn(async () => true) };
    const tenant = { id: { value: 'tenant-1' } };

    function makeReclassifier(user = currentUser) {
        return new CaseReclassifier({
            caseRepository: repository,
            classificationsRepository,
            classificationGroupRelationshipRepository,
            transitionsCaseRepository,
            subcaseRelationshipRepository,
            getGlobalConfig: async () => ({
                settings: { behaviors: { getConfig: () => ({ allow_case_reclassification: true }) } },
            }),
            caseUpdater: new CaseUpdater(repository, null, user, eventPublisherMock, tenant),
            commentsRepository,
        });
    }

    /**
     * Siembra un flujo de estados completo (A → B) y devuelve su transición.
     */
    async function seedFlowWithTransition() {
        const from = await StateMother.createState(stateRepo);
        const to = await StateMother.createState(stateRepo);
        const flow = await FlowsMother.createFlow(flowRepo);
        const transition = await TransitionsMother.createTransition(transitionRepo, from, flow, to);
        return { flow, transition, states: { from, to } };
    }

    /**
     * Escenario base: un caso abierto en su clasificación de origen, y una clasificación
     * destino válida —activa, con flujo propio, relacionada con el grupo del caso y con
     * formulario—.
     */
    async function seedReclassifiableCase({ targetClassificationOverrides = {}, relationshipForm } = {}) {
        const group = await GroupsMother.createGroup(groupsRepository, shiftManagementRepository);
        const client = await ClientMother.createClient(clientRepository);
        const responsible = await UsersMother.createUser(usersRepository);

        const origin = await seedFlowWithTransition();
        const originClassification = await ClassificationsMother.createClassification(classificationsRepository, {
            flujo_id: origin.flow.id.value,
        });

        const target = await seedFlowWithTransition();
        const targetClassification = await ClassificationsMother.createClassification(classificationsRepository, {
            flujo_id: target.flow.id.value,
            ...targetClassificationOverrides,
        });
        await ClassificationGroupMother.create(classificationGroupRelationshipRepository, {
            classification_id: targetClassification.id.value,
            group_id: group.id.value,
            form: relationshipForm === undefined ? uuidv4() : relationshipForm,
        });

        const kase = await CasesMother.createCase(repository, {
            cliente_id: client.id.value,
            grupo_id: group.id.value,
            responsable_id: responsible.id.value,
            clasificacion_id: originClassification.id.value,
            transicion_id: origin.transition.id.value,
        });

        return { kase, group, origin, originClassification, target, targetClassification };
    }

    function reclassifyDto(scenario) {
        return {
            clasificacion_id: scenario.targetClassification.id.value,
            transicion_id: scenario.target.transition.id.value,
            updated_at: new Date(),
            updated_by: currentUser.id.value,
        };
    }

    async function expectPublicErrorCode(promise, code) {
        await expect(promise).rejects.toMatchObject({ publicErrorCode: code });
    }

    /**
     * Defensa en profundidad: el Lambda ya comprueba `CaseReclassify` antes de llegar aquí, pero
     * el dominio no puede quedarse sin gate propio — cualquier consumidor futuro heredaría el
     * vacío.
     */
    it('responde 403 y no toca el caso cuando el usuario no tiene CaseReclassify', async () => {
        const scenario = await seedReclassifiableCase();
        const sinPermiso = makeUser(false);

        await expect(
            makeReclassifier(sinPermiso).execute(scenario.kase.id.value, reclassifyDto(scenario))
        ).rejects.toMatchObject({ statusCode: 403 });

        const row = await repository
            .connection('cases')
            .first('clasificacion_id', 'cambio_clasificacion')
            .where({ id: scenario.kase.id.value });

        expect(row.clasificacion_id).toBe(scenario.originClassification.id.value);
    });

    it('reclasifica el caso y marca cambio_clasificacion', async () => {
        const scenario = await seedReclassifiableCase();

        await makeReclassifier().execute(scenario.kase.id.value, reclassifyDto(scenario));

        const row = await repository
            .connection('cases')
            .first('clasificacion_id', 'transicion_id', 'estado_id', 'cambio_clasificacion')
            .where({ id: scenario.kase.id.value });

        expect(row).toMatchObject({
            clasificacion_id: scenario.targetClassification.id.value,
            transicion_id: scenario.target.transition.id.value,
            estado_id: scenario.target.states.to.id.value,
            cambio_clasificacion: true,
        });
    });

    /**
     * QA-3 (MSKT-1392): la red de la Decisión 2.
     *
     * `CaseUpdated` es lo que hace correr las acciones automatizadas de la clasificación destino,
     * y `CaseUpdater` se traga cualquier fallo al publicarlo: sin esta prueba, volver a construir
     * el `CaseUpdater` sin `eventPublisher` —como hace `ModelValueSaver`— dejaría todo en verde y
     * las acciones dejarían de dispararse en silencio. El E2E no puede verlo: el evento sale por
     * SQS y no deja rastro en base de datos.
     */
    it('publica CaseUpdated para que corran las acciones automatizadas de la clasificación destino', async () => {
        const scenario = await seedReclassifiableCase();
        eventPublisherMock.publishAll.mockClear();

        await makeReclassifier().execute(scenario.kase.id.value, reclassifyDto(scenario));

        expect(eventPublisherMock.publishAll).toHaveBeenCalledTimes(1);
        const [publishedEvents] = eventPublisherMock.publishAll.mock.calls[0];
        expect(publishedEvents).toEqual([
            expect.objectContaining({
                eventName: 'kace.core.case.updated',
                aggregateId: scenario.kase.id.value,
            }),
        ]);
    });

    it('registra el evento case.reclassified con la clasificación anterior y la nueva', async () => {
        const scenario = await seedReclassifiableCase();

        await makeReclassifier().execute(scenario.kase.id.value, reclassifyDto(scenario));

        const event = await repository
            .connection('event_logs')
            .first('event_name', 'body', 'old_data')
            .where({ case_id: scenario.kase.id.value, event_name: 'case.reclassified' });

        expect(event).toBeDefined();
        expect(event.body).toMatchObject({ clasificacion_id: scenario.targetClassification.id.value });
        expect(event.old_data).toMatchObject({ clasificacion_id: scenario.originClassification.id.value });
    });

    /**
     * AUD-1 (MSKT-1392): el id solo no sirve en la bitácora. `EventLogger` resuelve
     * `transicion_id -> state` y `responsable_id -> responsable`, pero no sabe de clasificaciones,
     * así que la etiqueta se registra aquí. Queda congelada en el evento a propósito: un renombre
     * posterior de la clasificación no debe reescribir lo que el asesor vio al reclasificar.
     */
    it('el evento lleva la etiqueta de ambas clasificaciones, no solo sus ids', async () => {
        const scenario = await seedReclassifiableCase();

        await makeReclassifier().execute(scenario.kase.id.value, reclassifyDto(scenario));

        const event = await repository
            .connection('event_logs')
            .first('body', 'old_data')
            .where({ case_id: scenario.kase.id.value, event_name: 'case.reclassified' });

        expect(event.body.clasificacion).toEqual({
            id: scenario.targetClassification.id.value,
            label: scenario.targetClassification.label,
        });
        expect(event.old_data.clasificacion).toEqual({
            id: scenario.originClassification.id.value,
            label: scenario.originClassification.label,
        });
    });

    /**
     * OS-6 (MSKT-1392): el motivo tiene que quedar donde el timeline de transiciones pueda leerlo.
     * Ese timeline se arma desde `history_cases`, así que un comentario que solo lleve `caso_id`
     * —sin que el caso lo enlace— es invisible: existe en base de datos y no lo ve nadie.
     */
    describe('motivo de la reclasificación', () => {
        it('crea el comentario y lo enlaza desde el caso', async () => {
            const scenario = await seedReclassifiableCase();

            await makeReclassifier().execute(scenario.kase.id.value, reclassifyDto(scenario), {
                comment: { descripcion: 'El cliente confirmó la compra' },
            });

            const row = await repository
                .connection('cases')
                .first('cambio_estado_comentario_id')
                .where({ id: scenario.kase.id.value });

            expect(row.cambio_estado_comentario_id).toEqual(expect.any(String));

            const comment = await repository
                .connection('comentarios')
                .first('descripcion', 'caso_id')
                .where({ id: row.cambio_estado_comentario_id });

            expect(comment).toMatchObject({
                descripcion: 'El cliente confirmó la compra',
                caso_id: scenario.kase.id.value,
            });
        });

        it('deja el enlace en history_cases, que es de donde lee el timeline', async () => {
            const scenario = await seedReclassifiableCase();

            await makeReclassifier().execute(scenario.kase.id.value, reclassifyDto(scenario), {
                comment: { descripcion: 'Reclasificado tras validar con el proveedor' },
            });

            const history = await repository
                .connection('history_cases')
                .select('changed_attributes')
                .where({ entity_id: scenario.kase.id.value })
                .orderBy('created_at', 'asc');

            const changed = history.map((row) =>
                typeof row.changed_attributes === 'string' ? JSON.parse(row.changed_attributes) : row.changed_attributes
            );

            expect(changed.some((attrs) => attrs.cambio_estado_comentario_id != null)).toBe(true);
        });

        /**
         * Red de la escritura con CAS: la clasificación ya NO viaja en el dto que `kase.update`
         * consume —se escribe con `updateColumnIfSnapshotMatches`—, así que si el agregado no la
         * recogiera antes de `saveHistory`, el timeline perdería en silencio el cambio que da
         * nombre a toda la operación. El resto de la suite seguiría en verde.
         */
        it('el historial registra el cambio de clasificación, que se escribe fuera del dto', async () => {
            const scenario = await seedReclassifiableCase();

            await makeReclassifier().execute(scenario.kase.id.value, reclassifyDto(scenario));

            const history = await repository
                .connection('history_cases')
                .select('changed_attributes')
                .where({ entity_id: scenario.kase.id.value })
                .orderBy('created_at', 'asc');

            const changed = history.map((row) =>
                typeof row.changed_attributes === 'string' ? JSON.parse(row.changed_attributes) : row.changed_attributes
            );

            expect(
                changed.some((attrs) => String(attrs.clasificacion_id ?? '') === scenario.targetClassification.id.value)
            ).toBe(true);
        });

        /**
         * AUD-1b (MSKT-1392): el timeline tiene que distinguir la reclasificación de un cambio de
         * estado corriente y mostrar su motivo.
         *
         * OJO con la señal: `new_attributes` guarda el snapshot COMPLETO del caso y
         * `cambio_clasificacion` nunca vuelve a false, así que mirarlo ahí marcaría como
         * reclasificación todas las transiciones posteriores. El diff es `changed_attributes`.
         */
        it('marca la línea del timeline como reclasificación, con su motivo', async () => {
            const scenario = await seedReclassifiableCase();

            await makeReclassifier().execute(scenario.kase.id.value, reclassifyDto(scenario), {
                comment: { descripcion: 'Reclasificado tras validar con el proveedor' },
            });

            const transitions = await repository.findTransitionsByCaseId(scenario.kase.id);

            const reclassification = transitions.filter((transition) => transition.es_reclasificacion);
            expect(reclassification).toHaveLength(1);
            expect(reclassification[0].motivo_reclasificacion).toBe('Reclasificado tras validar con el proveedor');
            expect(reclassification[0].responsable).toBeDefined();
        });

        /**
         * Los motivos se leen en UNA consulta para todo el timeline. Resolverlos dentro de
         * `CaseTransitions` costaba una consulta por tramo, y un caso movido varias veces las
         * multiplica.
         */
        it('resuelve los motivos de todo el timeline en una sola consulta', async () => {
            const scenario = await seedReclassifiableCase();
            // El timeline usa la primera fila de histórico como origen y descarta sus metadatos,
            // así que sin una fila previa la primera reclasificación no llega a pintarse.
            const seeded = await repository.find(scenario.kase.id);
            await repository.saveHistory(seeded, seeded.toJson());

            await makeReclassifier().execute(scenario.kase.id.value, reclassifyDto(scenario), {
                comment: { descripcion: 'Primer motivo' },
            });
            // Vuelta a la clasificación de origen: hay que habilitarla para el grupo, porque el
            // escenario base solo relaciona la de destino.
            await ClassificationGroupMother.create(classificationGroupRelationshipRepository, {
                classification_id: scenario.originClassification.id.value,
                group_id: scenario.group.id.value,
                form: uuidv4(),
            });
            await makeReclassifier().execute(
                scenario.kase.id.value,
                {
                    ...reclassifyDto(scenario),
                    clasificacion_id: scenario.originClassification.id.value,
                    transicion_id: scenario.origin.transition.id.value,
                },
                { comment: { descripcion: 'Segundo motivo' } }
            );

            let commentQueries = 0;
            const countCommentQueries = ({ sql }) => {
                if (sql.includes('comentarios')) commentQueries += 1;
            };
            repository.connection.on('query', countCommentQueries);

            let transitions;
            try {
                transitions = await repository.findTransitionsByCaseId(scenario.kase.id);
            } finally {
                repository.connection.off('query', countCommentQueries);
            }

            const motivos = transitions
                .filter((transition) => transition.es_reclasificacion)
                .map((transition) => transition.motivo_reclasificacion);

            expect(motivos).toEqual(expect.arrayContaining(['Primer motivo', 'Segundo motivo']));
            expect(commentQueries).toBe(1);
        });

        it('una transición corriente no queda marcada como reclasificación', async () => {
            const scenario = await seedReclassifiableCase();

            const transitions = await repository.findTransitionsByCaseId(scenario.kase.id);

            expect(transitions.every((transition) => !transition.es_reclasificacion)).toBe(true);
        });

        /**
         * BUG-1/3 (reporte de agente 2026-09-21): `#transformHistoryToTransitions` solo abría un
         * tramo del timeline cuando la fila de historial cambiaba `transicion_id`. Reclasificar
         * dentro del MISMO flujo destino —sin cambiar de estado— no toca esa columna, así que la
         * fila entera se descartaba y el nodo de reclasificación desaparecía en silencio.
         */
        it('reclasificar sin cambiar de estado igual deja el nodo en el timeline, con su motivo', async () => {
            const scenario = await seedReclassifiableCase();
            const sameFlowClassification = await ClassificationsMother.createClassification(classificationsRepository, {
                flujo_id: scenario.origin.flow.id.value,
            });
            await ClassificationGroupMother.create(classificationGroupRelationshipRepository, {
                classification_id: sameFlowClassification.id.value,
                group_id: scenario.group.id.value,
                form: uuidv4(),
            });

            await makeReclassifier().execute(
                scenario.kase.id.value,
                {
                    clasificacion_id: sameFlowClassification.id.value,
                    // La misma transición que el caso ya tenía: el flujo destino es el mismo que
                    // el de origen, así que no hay cambio de estado que acompañe la reclasificación.
                    transicion_id: scenario.origin.transition.id.value,
                    updated_at: new Date(),
                    updated_by: currentUser.id.value,
                },
                { comment: { descripcion: 'Reclasificado sin mover el estado' } }
            );

            const transitions = await repository.findTransitionsByCaseId(scenario.kase.id);

            const reclassification = transitions.filter((transition) => transition.es_reclasificacion);
            expect(reclassification).toHaveLength(1);
            expect(reclassification[0].motivo_reclasificacion).toBe('Reclasificado sin mover el estado');
        });

        /**
         * BUG-3 (reporte de agente 2026-09-21): una transición de estado corriente inmediatamente
         * posterior a una reclasificación no debe "reemplazar" su nodo del timeline; ambos eventos
         * tienen que coexistir.
         */
        it('una transición posterior no borra el nodo de la reclasificación anterior', async () => {
            const scenario = await seedReclassifiableCase();
            const extraState = await StateMother.createState(stateRepo);
            const secondTransition = await TransitionsMother.createTransition(
                transitionRepo,
                scenario.target.states.to,
                scenario.target.flow,
                extraState
            );

            await makeReclassifier().execute(scenario.kase.id.value, reclassifyDto(scenario), {
                comment: { descripcion: 'Motivo de la reclasificación' },
            });

            const caseUpdater = new CaseUpdater(repository, null, currentUser, eventPublisherMock, tenant);
            await caseUpdater.execute(scenario.kase.id.value, {
                transicion_id: secondTransition.id.value,
                updated_at: new Date(),
                updated_by: currentUser.id.value,
            });

            const transitions = await repository.findTransitionsByCaseId(scenario.kase.id);

            const reclassification = transitions.filter((transition) => transition.es_reclasificacion);
            expect(reclassification).toHaveLength(1);
            expect(reclassification[0].motivo_reclasificacion).toBe('Motivo de la reclasificación');

            const plainTransitions = transitions.filter((transition) => !transition.es_reclasificacion);
            expect(plainTransitions.length).toBeGreaterThan(0);
        });

        /**
         * BUG (reporte 2026-09-21, Andrés): cuando reclasificar y cambiar de estado ocurren en el
         * MISMO guardado (el caso normal: OS-11 confirma la reclasificación y guarda el estado
         * del flujo destino en una sola escritura), el timeline mostraba UN solo nodo con
         * "State: Rechazado" y "Reclassification: motivo" juntos, como si fueran el mismo hecho.
         * Ahora esa escritura se parte en dos entradas: una de reclasificación —sin estado, para
         * no mezclarla con el cambio— y otra normal con el estado resultante.
         */
        it('reclasificar y cambiar de estado en el mismo guardado deja dos nodos, no uno mezclado', async () => {
            const scenario = await seedReclassifiableCase();

            await makeReclassifier().execute(scenario.kase.id.value, reclassifyDto(scenario), {
                comment: { descripcion: 'Reclasificado y movido de estado' },
            });

            const transitions = await repository.findTransitionsByCaseId(scenario.kase.id);

            const reclassification = transitions.filter((transition) => transition.es_reclasificacion);
            expect(reclassification).toHaveLength(1);
            expect(reclassification[0].motivo_reclasificacion).toBe('Reclasificado y movido de estado');
            // Sin etiqueta de estado: no debe leerse como si fuera también un cambio de estado.
            expect(reclassification[0].estado_siguiente).toBeNull();

            // El nodo del cambio de estado se identifica por su transición, no por el nombre del
            // estado: los estados de la semilla comparten nombre por defecto ('En proceso').
            const stateChange = transitions.find(
                (transition) => transition.transicion_id === scenario.target.transition.id.value
            );
            expect(stateChange).toBeDefined();
            expect(stateChange.es_reclasificacion).toBe(false);
            expect(stateChange.motivo_reclasificacion).toBeNull();
            expect(stateChange.estado_siguiente).toBe(scenario.target.states.to.nombre.value);
        });

        it('sin motivo la línea queda marcada, pero sin texto de motivo', async () => {
            const scenario = await seedReclassifiableCase();

            await makeReclassifier().execute(scenario.kase.id.value, reclassifyDto(scenario));

            const transitions = await repository.findTransitionsByCaseId(scenario.kase.id);

            const reclassification = transitions.filter((transition) => transition.es_reclasificacion);
            expect(reclassification).toHaveLength(1);
            expect(reclassification[0].motivo_reclasificacion).toBeNull();
        });

        it('sin motivo no toca cambio_estado_comentario_id', async () => {
            const scenario = await seedReclassifiableCase();

            await makeReclassifier().execute(scenario.kase.id.value, reclassifyDto(scenario));

            const row = await repository
                .connection('cases')
                .first('cambio_estado_comentario_id')
                .where({ id: scenario.kase.id.value });

            expect(row.cambio_estado_comentario_id).toBeNull();
        });

        /**
         * El motivo y el caso se escriben en la MISMA transacción. Antes el comentario se
         * insertaba antes de abrirla, así que un fallo en la escritura del caso dejaba una fila
         * en `comentarios` a la que nada apuntaba: ruido permanente en la bitácora de un caso
         * que nunca se reclasificó.
         */
        it('no deja el motivo escrito si la escritura del caso falla', async () => {
            const scenario = await seedReclassifiableCase();
            const update = jest.spyOn(repository, 'update').mockRejectedValueOnce(new Error('fallo al escribir'));

            try {
                await expect(
                    makeReclassifier().execute(scenario.kase.id.value, reclassifyDto(scenario), {
                        comment: { descripcion: 'Motivo que no debe sobrevivir' },
                    })
                ).rejects.toThrow('fallo al escribir');
            } finally {
                update.mockRestore();
            }

            const orphan = await repository
                .connection('comentarios')
                .first('id')
                .where({ caso_id: scenario.kase.id.value });

            expect(orphan).toBeUndefined();
        });

        it('el evento case.reclassified referencia el motivo', async () => {
            const scenario = await seedReclassifiableCase();

            await makeReclassifier().execute(scenario.kase.id.value, reclassifyDto(scenario), {
                comment: { descripcion: 'Motivo auditable' },
            });

            const [caseRow, event] = await Promise.all([
                repository
                    .connection('cases')
                    .first('cambio_estado_comentario_id')
                    .where({ id: scenario.kase.id.value }),
                repository
                    .connection('event_logs')
                    .first('body')
                    .where({ case_id: scenario.kase.id.value, event_name: 'case.reclassified' }),
            ]);

            expect(event.body).toMatchObject({
                cambio_estado_comentario_id: caseRow.cambio_estado_comentario_id,
            });
        });
    });

    it('rechaza un caso inexistente con 404', async () => {
        const scenario = await seedReclassifiableCase();

        await expect(makeReclassifier().execute(uuidv4(), reclassifyDto(scenario))).rejects.toMatchObject({
            statusCode: 404,
        });
    });

    it('rechaza un caso cerrado', async () => {
        const scenario = await seedReclassifiableCase();
        await repository
            .connection('cases')
            .update({ fecha_resolucion: new Date() })
            .where({ id: scenario.kase.id.value });

        await expectPublicErrorCode(
            makeReclassifier().execute(scenario.kase.id.value, reclassifyDto(scenario)),
            CASE_RECLASSIFY_CASE_CLOSED
        );
    });

    it('un snapshot de clasificación obsoleto es error, no warning', async () => {
        const scenario = await seedReclassifiableCase();

        await expectPublicErrorCode(
            makeReclassifier().execute(scenario.kase.id.value, reclassifyDto(scenario), {
                clasificacionSnapshot: uuidv4(),
            }),
            CASE_RECLASSIFY_CLASSIFICATION_STALE
        );

        const row = await repository
            .connection('cases')
            .first('clasificacion_id')
            .where({ id: scenario.kase.id.value });
        expect(row.clasificacion_id).toBe(scenario.originClassification.id.value);
    });

    /**
     * QA-CAS (MSKT-1392, ronda 2): la carrera que el snapshot del cliente NO cubre.
     *
     * El pre-check de elegibilidad lee la clasificación y la escritura ocurre después: entre
     * ambas cabe otra reclasificación del mismo caso. Sin bloqueo optimista las dos pasan el
     * pre-check y la segunda pisa a la primera en silencio.
     *
     * La carrera se inyecta dentro de la MISMA transacción —no desde otra conexión, que se
     * quedaría esperando el lock de fila— justo después del `update` del caso y antes del CAS:
     * es exactamente el instante en el que la fila deja de tener el valor leído.
     */
    it('aborta la reclasificación entera si otra escritura cambió la clasificación entre la lectura y el guardado', async () => {
        const scenario = await seedReclassifiableCase();
        const competingClassification = await ClassificationsMother.createClassification(classificationsRepository, {
            flujo_id: scenario.origin.flow.id.value,
        });
        const originalUpdate = repository.update.bind(repository);
        const updateSpy = jest.spyOn(repository, 'update').mockImplementationOnce(async (kase, trx) => {
            const result = await originalUpdate(kase, trx);
            await repository
                .trxTable(trx)
                .where({ id: scenario.kase.id.value })
                .update({ clasificacion_id: competingClassification.id.value });
            return result;
        });

        try {
            await expectPublicErrorCode(
                makeReclassifier().execute(scenario.kase.id.value, reclassifyDto(scenario)),
                CASE_RECLASSIFY_CLASSIFICATION_STALE
            );
        } finally {
            updateSpy.mockRestore();
        }

        // El rollback deshace la transacción completa: ni la clasificación destino ni —lo que de
        // verdad importa— la transición del flujo destino quedan escritas sobre la clasificación
        // que ya no es la que se validó.
        const row = await repository
            .connection('cases')
            .first('clasificacion_id', 'transicion_id', 'estado_id')
            .where({ id: scenario.kase.id.value });
        expect(row).toMatchObject({
            clasificacion_id: scenario.originClassification.id.value,
            transicion_id: scenario.origin.transition.id.value,
            estado_id: scenario.origin.states.to.id.value,
        });
    });

    it('no deja el motivo escrito cuando la reclasificación se aborta por concurrencia', async () => {
        const scenario = await seedReclassifiableCase();
        const competingClassification = await ClassificationsMother.createClassification(classificationsRepository, {
            flujo_id: scenario.origin.flow.id.value,
        });
        const originalUpdate = repository.update.bind(repository);
        const updateSpy = jest.spyOn(repository, 'update').mockImplementationOnce(async (kase, trx) => {
            const result = await originalUpdate(kase, trx);
            await repository
                .trxTable(trx)
                .where({ id: scenario.kase.id.value })
                .update({ clasificacion_id: competingClassification.id.value });
            return result;
        });

        try {
            await expect(
                makeReclassifier().execute(scenario.kase.id.value, reclassifyDto(scenario), {
                    comment: { descripcion: 'Motivo de una reclasificación que perdió la carrera' },
                })
            ).rejects.toBeDefined();
        } finally {
            updateSpy.mockRestore();
        }

        const comments = await repository.connection('comentarios').where({ caso_id: scenario.kase.id.value });
        expect(comments).toHaveLength(0);
    });

    it('acepta el snapshot cuando coincide con la clasificación persistida', async () => {
        const scenario = await seedReclassifiableCase();

        await makeReclassifier().execute(scenario.kase.id.value, reclassifyDto(scenario), {
            clasificacionSnapshot: scenario.originClassification.id.value,
        });

        const row = await repository
            .connection('cases')
            .first('clasificacion_id')
            .where({ id: scenario.kase.id.value });
        expect(row.clasificacion_id).toBe(scenario.targetClassification.id.value);
    });

    it('rechaza una clasificación destino inactiva', async () => {
        const scenario = await seedReclassifiableCase({ targetClassificationOverrides: { is_active: false } });

        await expectPublicErrorCode(
            makeReclassifier().execute(scenario.kase.id.value, reclassifyDto(scenario)),
            CASE_RECLASSIFY_CLASSIFICATION_INACTIVE
        );
    });

    it('rechaza una clasificación que no está relacionada con el grupo del caso', async () => {
        const scenario = await seedReclassifiableCase();
        const otherGroup = await GroupsMother.createGroup(groupsRepository, shiftManagementRepository);

        await expectPublicErrorCode(
            makeReclassifier().execute(scenario.kase.id.value, {
                ...reclassifyDto(scenario),
                grupo_id: otherGroup.id.value,
            }),
            CASE_RECLASSIFY_CLASSIFICATION_NOT_IN_GROUP
        );
    });

    it('rechaza una clasificación sin formulario para el grupo', async () => {
        const scenario = await seedReclassifiableCase();
        // `classification_group_relationships.form` es nullable y la factoría siempre lo
        // rellena, así que la relación sin formulario se produce vaciando la columna.
        await repository
            .connection('classification_group_relationships')
            .update({ form: null })
            .where({ classification_id: scenario.targetClassification.id.value, group_id: scenario.group.id.value });

        await expectPublicErrorCode(
            makeReclassifier().execute(scenario.kase.id.value, reclassifyDto(scenario)),
            CASE_RECLASSIFY_CLASSIFICATION_WITHOUT_FORM
        );
    });

    it('rechaza una transición que no pertenece al flujo de la clasificación destino', async () => {
        const scenario = await seedReclassifiableCase();

        await expectPublicErrorCode(
            makeReclassifier().execute(scenario.kase.id.value, {
                ...reclassifyDto(scenario),
                transicion_id: scenario.origin.transition.id.value,
            }),
            CASE_RECLASSIFY_TRANSITION_OUT_OF_FLOW
        );
    });

    describe('regla de transición del flujo destino', () => {
        const ruleRepository = new KnexTransitionRuleRepository(repository.connection);

        /** Como lo arma el Lambda: con los repositorios de reglas, que son los que las hacen cumplir. */
        function makeRuleEnforcingReclassifier() {
            return new CaseReclassifier({
                caseRepository: repository,
                classificationsRepository,
                classificationGroupRelationshipRepository,
                transitionsCaseRepository,
                subcaseRelationshipRepository,
                getGlobalConfig: async () => ({
                    settings: { behaviors: { getConfig: () => ({ allow_case_reclassification: true }) } },
                }),
                caseUpdater: new CaseUpdater(
                    repository,
                    null,
                    currentUser,
                    eventPublisherMock,
                    tenant,
                    ruleRepository,
                    transitionsCaseRepository
                ),
                commentsRepository,
            });
        }

        async function requireResponsable(transition, user) {
            const rule = await TransitionRuleMother.create(ruleRepository, {
                conditions: {
                    combinator: 'and',
                    rules: [
                        { field: 'cases.responsable_id', operator: '=', value: user.id.value, type: 'manual_input' },
                    ],
                },
            });
            await repository
                .connection(repository.qualifiedName('transiciones'))
                .update({ rule_id: rule.id.value })
                .where({ id: transition.id.value });
        }

        async function seedCaseWithResponsableRule() {
            const scenario = await seedReclassifiableCase();
            const camilo = await UsersMother.createUser(usersRepository, {
                nombres: 'Camilo',
                apellido1: 'Londoño',
                apellido2: '',
            });
            await requireResponsable(scenario.target.transition, camilo);
            return { scenario, camilo };
        }

        it('rechaza la reclasificación y nombra al responsable que la regla exige', async () => {
            const { scenario, camilo } = await seedCaseWithResponsableRule();

            const error = await makeRuleEnforcingReclassifier()
                .execute(scenario.kase.id.value, reclassifyDto(scenario))
                .catch((thrown) => thrown);

            expect(error.publicErrorCode).toBe(CASE_TRANSITION_CONDITIONS_NOT_MET);
            expect(error.toPublicData().conditions.failed).toEqual([
                expect.objectContaining({
                    field: 'cases.responsable_id',
                    expected: camilo.id.value,
                    expected_label: 'Camilo Londoño',
                    actual: scenario.kase.responsable_id.value,
                    actual_label: expect.any(String),
                }),
            ]);

            const row = await repository
                .connection('cases')
                .first('clasificacion_id')
                .where({ id: scenario.kase.id.value });
            expect(row.clasificacion_id).toBe(scenario.originClassification.id.value);
        });

        it('reclasifica cuando el mismo guardado asigna al responsable que la regla exige', async () => {
            const { scenario, camilo } = await seedCaseWithResponsableRule();

            await makeRuleEnforcingReclassifier().execute(scenario.kase.id.value, {
                ...reclassifyDto(scenario),
                responsable_id: camilo.id.value,
            });

            const row = await repository
                .connection('cases')
                .first('clasificacion_id', 'responsable_id')
                .where({ id: scenario.kase.id.value });
            expect(row).toEqual({
                clasificacion_id: scenario.targetClassification.id.value,
                responsable_id: camilo.id.value,
            });
        });
    });

    it('rechaza cuando el caso es un subcaso y el padre no declara la clasificación destino', async () => {
        const scenario = await seedReclassifiableCase();
        // El padre necesita una clasificación REAL: la regla carga su flujo de
        // clasificaciones para saber qué subclasificaciones declara.
        const parentFlow = await seedFlowWithTransition();
        const parentClassification = await ClassificationsMother.createClassification(classificationsRepository, {
            flujo_id: parentFlow.flow.id.value,
        });
        const parentCase = await CasesMother.createCase(repository, {
            grupo_id: scenario.group.id.value,
            clasificacion_id: parentClassification.id.value,
            transicion_id: parentFlow.transition.id.value,
        });
        await new SubCaseRelationCreator(subcaseRelationshipRepository).execute(
            parentCase.id.value,
            scenario.kase.id.value,
            currentUser.id.value
        );

        await expectPublicErrorCode(
            makeReclassifier().execute(scenario.kase.id.value, reclassifyDto(scenario)),
            CASE_RECLASSIFY_SUBCASE_NOT_ALLOWED
        );
    });

    it('permite reclasificar un subcaso a una clasificación que el padre sí declara', async () => {
        const scenario = await seedReclassifiableCase();
        const parentFlow = await seedFlowWithTransition();
        const parentClassification = await ClassificationsMother.createClassification(classificationsRepository, {
            flujo_id: parentFlow.flow.id.value,
            sub_classification_ids: [scenario.targetClassification.id.value],
        });
        const parentCase = await CasesMother.createCase(repository, {
            grupo_id: scenario.group.id.value,
            clasificacion_id: parentClassification.id.value,
            transicion_id: parentFlow.transition.id.value,
        });
        await new SubCaseRelationCreator(subcaseRelationshipRepository).execute(
            parentCase.id.value,
            scenario.kase.id.value,
            currentUser.id.value
        );

        await makeReclassifier().execute(scenario.kase.id.value, reclassifyDto(scenario));

        const row = await repository
            .connection('cases')
            .first('clasificacion_id')
            .where({ id: scenario.kase.id.value });
        expect(row.clasificacion_id).toBe(scenario.targetClassification.id.value);
    });

    describe('ClassificationFlowStatesFinder (CORE-4)', () => {
        it('devuelve la lista completa del flujo destino con los nombres resueltos', async () => {
            const scenario = await seedReclassifiableCase();

            const response = await new ClassificationFlowStatesFinder(
                classificationsRepository,
                transitionsCaseRepository
            ).execute(scenario.targetClassification.id.value);

            const items = response.toJson().data.items;
            expect(items).toHaveLength(1);
            expect(items[0].transition.id).toBe(scenario.target.transition.id.value);
            expect(items[0].estado_siguiente).toMatchObject({
                id: scenario.target.states.to.id.value,
                nombre: scenario.target.states.to.nombre.value,
            });
        });

        it('no depende del estado actual del caso: responde el flujo entero', async () => {
            const scenario = await seedReclassifiableCase();
            const extraState = await StateMother.createState(stateRepo);
            await TransitionsMother.createTransition(
                transitionRepo,
                scenario.target.states.to,
                scenario.target.flow,
                extraState
            );

            const response = await new ClassificationFlowStatesFinder(
                classificationsRepository,
                transitionsCaseRepository
            ).execute(scenario.targetClassification.id.value);

            const reachableStateIds = response.toJson().data.items.map((item) => item.estado_siguiente.id);
            expect(reachableStateIds).toEqual(
                expect.arrayContaining([scenario.target.states.to.id.value, extraState.id.value])
            );
        });

        it('rechaza una clasificación inexistente con 404', async () => {
            await expect(
                new ClassificationFlowStatesFinder(classificationsRepository, transitionsCaseRepository).execute(
                    uuidv4()
                )
            ).rejects.toMatchObject({ statusCode: 404 });
        });
    });

    /**
     * API-RULES (MSKT-1392): las reglas del flujo destino, para que el plugin avise del bloqueo
     * antes de que el asesor elija un estado que la regla va a rechazar.
     */
    describe('ClassificationFlowTransitionRulesFinder (API-RULES)', () => {
        const ruleRepository = new KnexTransitionRuleRepository(repository.connection);

        const findRules = (classification) =>
            new ClassificationFlowTransitionRulesFinder(transitionsCaseRepository).executeForClassification(
                classification
            );

        async function attachRuleTo(transition) {
            const rule = await TransitionRuleMother.create(ruleRepository, {
                conditions: {
                    combinator: 'and',
                    rules: [{ field: 'aux_cases.monto', operator: '>=', value: '100', type: 'manual_input' }],
                },
            });
            await repository
                .connection(repository.qualifiedName('transiciones'))
                .update({ rule_id: rule.id.value })
                .where({ id: transition.id.value });
            return rule;
        }

        /**
         * Solo el nombre de la regla. El árbol de condiciones —campos y valores que configuró el
         * administrador del tenant— no se publica: esta respuesta viaja al plugin, de ahí al
         * evento `kaceCaseReclassified` y acaba persistida en localStorage.
         */
        it('devuelve la regla de cada transición condicionada, sin el árbol de condiciones', async () => {
            const scenario = await seedReclassifiableCase();
            const rule = await attachRuleTo(scenario.target.transition);

            const rules = await findRules(scenario.targetClassification);

            expect(rules).toEqual([
                {
                    transicion_id: scenario.target.transition.id.value,
                    rule_id: rule.id.value,
                    nombre: rule.nombre.value,
                },
            ]);
            expect(JSON.stringify(rules)).not.toContain('aux_cases.monto');
        });

        it('omite las transiciones sin regla: no hay nada que anticipar en ellas', async () => {
            const scenario = await seedReclassifiableCase();

            await expect(findRules(scenario.targetClassification)).resolves.toEqual([]);
        });

        it('describe solo las transiciones que la lista de estados ofrece', async () => {
            const scenario = await seedReclassifiableCase();
            await attachRuleTo(scenario.target.transition);
            const otherFlowScenario = await seedFlowWithTransition();
            await attachRuleTo(otherFlowScenario.transition);

            const rules = await findRules(scenario.targetClassification);

            expect(rules.map((entry) => entry.transicion_id)).toEqual([scenario.target.transition.id.value]);
        });
    });

    /*
     * La clasificación con CAS no está todavía en el agregado cuando CaseUpdater resuelve el
     * folio: si se leyera de ahí, el radicado saldría de la clasificación que el caso abandona.
     */
    describe('folio al reclasificar', () => {
        const folioConfigurations = new KnexFolioConfigurationRepository(repository.connection);
        const folioSequences = new KnexFolioSequenceRepository(repository.connection);

        function makeReclassifierWithFolio({ auxCasesFinderByCase } = {}) {
            return new CaseReclassifier({
                caseRepository: repository,
                classificationsRepository,
                classificationGroupRelationshipRepository,
                transitionsCaseRepository,
                subcaseRelationshipRepository,
                getGlobalConfig: async () => ({
                    settings: { behaviors: { getConfig: () => ({ allow_case_reclassification: true }) } },
                }),
                caseUpdater: new CaseUpdater(repository, null, currentUser, eventPublisherMock, tenant),
                commentsRepository,
                folioResolver: new CaseFolioResolver(folioConfigurations, folioSequences),
                auxCasesFinderByCase,
            });
        }

        async function attachFolioConfiguration(classification) {
            const prefix = `R${uuidv4().slice(0, 6)}-`;
            const configuration = await FolioConfigurationMother.create(folioConfigurations, {
                segments: [
                    { type: 'literal', value: prefix },
                    { type: 'sequence', length: 4, pad_char: '0' },
                ],
                start_value: 1,
            });
            await repository
                .connection('clasificaciones')
                .where({ id: classification.id.value })
                .update({ folio_config_id: configuration.id.value });
            return { configuration, prefix };
        }

        const folioOf = async (kase) =>
            (await repository.connection('cases').first('folio').where({ id: kase.id.value })).folio;

        it('asigna el folio de la clasificación de destino', async () => {
            const scenario = await seedReclassifiableCase();
            const { prefix } = await attachFolioConfiguration(scenario.targetClassification);

            await makeReclassifierWithFolio().execute(scenario.kase.id.value, reclassifyDto(scenario));

            expect(await folioOf(scenario.kase)).toBe(`${prefix}0001`);
        });

        /*
         * Edición con auxiliar: el auxiliar se guarda DESPUÉS de reclasificar, así que el folio
         * tiene que salir de lo que envía la petición y no del auxiliar ya guardado (ni de la
         * caché). Un radicado no se regenera.
         */
        describe('con un segmento del auxiliar', () => {
            async function attachCityConfiguration(classification) {
                const prefix = `C${uuidv4().slice(0, 6)}-`;
                const configuration = await FolioConfigurationMother.create(folioConfigurations, {
                    segments: [
                        { type: 'literal', value: prefix },
                        { type: 'field', path: 'aux_cases.f.ciudad' },
                        { type: 'literal', value: '-' },
                        { type: 'sequence', length: 4, pad_char: '0' },
                    ],
                    start_value: 1,
                });
                await repository
                    .connection('clasificaciones')
                    .where({ id: classification.id.value })
                    .update({ folio_config_id: configuration.id.value });
                return prefix;
            }

            const storedAuxiliary = (data) => ({ execute: jest.fn(async () => ({ data: { value: data } })) });

            it('usa el valor que la petición va a guardar, no el ya guardado', async () => {
                const scenario = await seedReclassifiableCase();
                const prefix = await attachCityConfiguration(scenario.targetClassification);
                const auxCasesFinderByCase = storedAuxiliary({ f: { ciudad: 'BOG', barrio: 'Centro' } });

                await makeReclassifierWithFolio({ auxCasesFinderByCase }).execute(
                    scenario.kase.id.value,
                    reclassifyDto(scenario),
                    { pendingAuxData: { f: { ciudad: 'MED' } } }
                );

                expect(await folioOf(scenario.kase)).toBe(`${prefix}MED-0001`);
                expect(auxCasesFinderByCase.execute).toHaveBeenCalledWith(scenario.kase.id.value, { skipCache: true });
            });

            it('no responde 400 cuando el valor solo llega en la petición', async () => {
                const scenario = await seedReclassifiableCase();
                const prefix = await attachCityConfiguration(scenario.targetClassification);

                await makeReclassifierWithFolio({ auxCasesFinderByCase: storedAuxiliary({ f: {} }) }).execute(
                    scenario.kase.id.value,
                    reclassifyDto(scenario),
                    { pendingAuxData: { f: { ciudad: 'MED' } } }
                );

                expect(await folioOf(scenario.kase)).toBe(`${prefix}MED-0001`);
            });

            it('sin cambios en la petición usa el auxiliar guardado', async () => {
                const scenario = await seedReclassifiableCase();
                const prefix = await attachCityConfiguration(scenario.targetClassification);

                await makeReclassifierWithFolio({
                    auxCasesFinderByCase: storedAuxiliary({ f: { ciudad: 'BOG' } }),
                }).execute(scenario.kase.id.value, reclassifyDto(scenario));

                expect(await folioOf(scenario.kase)).toBe(`${prefix}BOG-0001`);
            });
        });

        it('no asigna el folio de la clasificación que abandona ni consume su consecutivo', async () => {
            const scenario = await seedReclassifiableCase();
            const { configuration } = await attachFolioConfiguration(scenario.originClassification);

            await makeReclassifierWithFolio().execute(scenario.kase.id.value, reclassifyDto(scenario));

            expect(await folioOf(scenario.kase)).toBeNull();
            expect(await folioSequences.peek(configuration.id.value, '')).toBeNull();
        });
    });
});
