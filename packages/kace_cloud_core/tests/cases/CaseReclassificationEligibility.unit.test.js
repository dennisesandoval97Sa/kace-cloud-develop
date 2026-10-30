import { jest } from '@jest/globals';
import { v4 as uuidv4 } from 'uuid';
import {
    CASE_RECLASSIFY_CASE_CLOSED,
    CASE_RECLASSIFY_CLASSIFICATION_INACTIVE,
    CASE_RECLASSIFY_CLASSIFICATION_NOT_IN_GROUP,
    CASE_RECLASSIFY_CLASSIFICATION_STALE,
    CASE_RECLASSIFY_CLASSIFICATION_WITHOUT_FORM,
    CASE_RECLASSIFY_DISABLED,
    CASE_RECLASSIFY_PARENT_UNVERIFIABLE,
    CASE_RECLASSIFY_SUBCASE_NOT_ALLOWED,
    CASE_RECLASSIFY_TRANSITION_OUT_OF_FLOW,
} from '@kace/error-codes';
import { CaseReclassificationEligibility } from '../../src/cases/application/reclassify/CaseReclassificationEligibility.js';
import { Classification } from '../../src/classifications/domain/Classification.js';

describe('CaseReclassificationEligibility', () => {
    const CASE_ID = uuidv4();

    const makeClassification = ({ id = uuidv4(), flujoId = uuidv4(), isActive = true, childIds = [] } = {}) =>
        Classification.create({
            id,
            nivel1: 'nivel1',
            flujo_id: flujoId,
            ans_id: uuidv4(),
            is_active: isActive,
            can_start_sub_cases_flow: true,
            json_flujo: {
                nodes: [id, ...childIds].map((nodeId) => ({ id: nodeId, position: { x: 0, y: 0 } })),
                edges: childIds.map((childId) => ({ id: `edge-${childId}`, source: id, target: childId })),
            },
            created_at: new Date().toISOString(),
            created_by: uuidv4(),
        });

    /**
     * Doble del agregado Case reducido a los tres atributos que lee el colaborador.
     */
    const makeCase = ({ clasificacionId = uuidv4(), grupoId = uuidv4(), fechaResolucion = null } = {}) => ({
        clasificacion_id: { value: clasificacionId },
        grupo_id: { value: grupoId },
        fecha_resolucion: { value: fechaResolucion },
    });

    /**
     * Repositorios falsos. `cases` y `classifications` resuelven por id para que el camino de
     * subcasos (que vuelve a pedir el caso padre y su clasificación) funcione sin ramas especiales.
     */
    const buildDependencies = ({
        cases = {},
        classifications = [],
        relationship = { form: { value: uuidv4() } },
        transition = undefined,
        parentCaseId = null,
        childClassificationIds = [],
        replicaSafeCaseRead,
        allowCaseReclassification = true,
    } = {}) => {
        const classificationsById = new Map(classifications.map((item) => [item.id.value, item]));
        const readCase = async (id) => cases[id.value] ?? null;

        const spies = {
            findCase: jest.fn(readCase),
            findCaseReadOnly: jest.fn(readCase),
            findRelationship: jest.fn(async () => relationship),
            findTransition: jest.fn(async () => transition ?? null),
            findParentCaseId: jest.fn(async () => parentCaseId),
            findOpenChildClassificationIds: jest.fn(async () => childClassificationIds),
            findClassification: jest.fn(async (id) => classificationsById.get(id.value) ?? null),
            getGlobalConfig: jest.fn(async () => ({
                settings: {
                    behaviors: { getConfig: () => ({ allow_case_reclassification: allowCaseReclassification }) },
                },
            })),
        };

        const eligibility = new CaseReclassificationEligibility({
            caseRepository: { find: spies.findCase, findReadOnly: spies.findCaseReadOnly },
            classificationsRepository: { find: spies.findClassification },
            classificationGroupRelationshipRepository: { find: spies.findRelationship },
            transitionsCaseRepository: { findById: spies.findTransition },
            subcaseRelationshipRepository: {
                findParentCaseId: spies.findParentCaseId,
                findOpenChildClassificationIds: spies.findOpenChildClassificationIds,
            },
            getGlobalConfig: spies.getGlobalConfig,
            ...(replicaSafeCaseRead === undefined ? {} : { replicaSafeCaseRead }),
        });

        return { eligibility, spies };
    };

    /**
     * Escenario feliz: caso abierto cuyo destino existe, está activo y está habilitado para su grupo.
     */
    const buildEligibleScenario = (overrides = {}) => {
        const target = overrides.target ?? makeClassification();
        const kase = makeCase(overrides.kase);

        return {
            target,
            kase,
            ...buildDependencies({
                cases: { [CASE_ID]: kase },
                classifications: [target],
                ...overrides.dependencies,
            }),
        };
    };

    describe('flag global allow_case_reclassification', () => {
        it('bloquea con 403 y no lee el caso cuando el tenant no permite reclasificar', async () => {
            const target = makeClassification();
            const { eligibility, spies } = buildEligibleScenario({
                target,
                dependencies: { allowCaseReclassification: false },
            });

            const verdict = await eligibility.evaluate(CASE_ID, { clasificacionId: target.id.value });

            expect(verdict.eligible).toBe(false);
            expect(verdict.blocker).toEqual({
                message: 'Case reclassification is disabled in the global configuration.',
                statusCode: 403,
                code: CASE_RECLASSIFY_DISABLED,
            });
            expect(spies.findCase).not.toHaveBeenCalled();
        });

        it('exige la fuente de configuración global al construirse', () => {
            expect(() => new CaseReclassificationEligibility({})).toThrow(
                'CaseReclassificationEligibility: getGlobalConfig is required'
            );
        });
    });

    describe('sin transicionId (el modo en que pregunta el precheck)', () => {
        it('no consulta las transiciones y declara elegible el destino', async () => {
            const { eligibility, spies, target, kase } = buildEligibleScenario();

            const verdict = await eligibility.evaluate(CASE_ID, { clasificacionId: target.id.value });

            expect(verdict.eligible).toBe(true);
            expect(verdict.blocker).toBeNull();
            expect(spies.findTransition).not.toHaveBeenCalled();
            expect(verdict.kase).toBe(kase);
            expect(verdict.classification).toBe(target);
        });
    });

    describe('origen de la lectura del caso', () => {
        it('lee del escritor por defecto, que es lo que necesita el POST antes de escribir', async () => {
            const target = makeClassification();
            const { eligibility, spies } = buildEligibleScenario({ target });

            await eligibility.evaluate(CASE_ID, { clasificacionId: target.id.value });

            expect(spies.findCase).toHaveBeenCalledTimes(1);
            expect(spies.findCaseReadOnly).not.toHaveBeenCalled();
        });

        it('lee de la réplica cuando el consumidor declara que no escribe (precheck)', async () => {
            const target = makeClassification();
            const { eligibility, spies } = buildEligibleScenario({
                target,
                dependencies: { replicaSafeCaseRead: true },
            });

            await eligibility.evaluate(CASE_ID, { clasificacionId: target.id.value });

            expect(spies.findCaseReadOnly).toHaveBeenCalledTimes(1);
            expect(spies.findCase).not.toHaveBeenCalled();
        });

        it('también lee el caso padre por la réplica en modo precheck', async () => {
            const target = makeClassification();
            const parentClassification = makeClassification({ childIds: [target.id.value] });
            const parentCaseId = uuidv4();
            const { eligibility, spies } = buildDependencies({
                cases: {
                    [CASE_ID]: makeCase(),
                    [parentCaseId]: makeCase({ clasificacionId: parentClassification.id.value }),
                },
                classifications: [target, parentClassification],
                parentCaseId,
                replicaSafeCaseRead: true,
            });

            await eligibility.evaluate(CASE_ID, { clasificacionId: target.id.value });

            expect(spies.findCaseReadOnly).toHaveBeenCalledTimes(2);
            expect(spies.findCase).not.toHaveBeenCalled();
        });
    });

    describe('con transicionId (el modo en que pregunta el POST)', () => {
        it('bloquea una transición que no pertenece al flujo destino', async () => {
            const target = makeClassification();
            const { eligibility } = buildEligibleScenario({
                target,
                dependencies: { transition: { id: 'tr-1', flujo_id: uuidv4() } },
            });

            const verdict = await eligibility.evaluate(CASE_ID, {
                clasificacionId: target.id.value,
                transicionId: 'tr-1',
            });

            expect(verdict.eligible).toBe(false);
            expect(verdict.blocker).toEqual({
                message: 'The provided transition does not belong to the target classification flow.',
                statusCode: 400,
                code: CASE_RECLASSIFY_TRANSITION_OUT_OF_FLOW,
            });
        });

        it('acepta una transición del flujo destino', async () => {
            const target = makeClassification();
            const { eligibility, spies } = buildEligibleScenario({
                target,
                dependencies: { transition: { id: 'tr-1', flujo_id: target.flujo_id.value } },
            });

            const verdict = await eligibility.evaluate(CASE_ID, {
                clasificacionId: target.id.value,
                transicionId: 'tr-1',
            });

            expect(verdict.eligible).toBe(true);
            expect(spies.findTransition).toHaveBeenCalledWith('tr-1');
        });

        it('responde 404 sin código público cuando la transición no existe', async () => {
            const target = makeClassification();
            const { eligibility } = buildEligibleScenario({ target, dependencies: { transition: null } });

            const verdict = await eligibility.evaluate(CASE_ID, {
                clasificacionId: target.id.value,
                transicionId: 'tr-1',
            });

            expect(verdict.blocker).toEqual({ message: 'Transition not found', statusCode: 404, code: null });
        });
    });

    describe('estado del caso', () => {
        it('responde 404 cuando el caso no existe', async () => {
            const { eligibility } = buildDependencies();

            const verdict = await eligibility.evaluate(CASE_ID, { clasificacionId: uuidv4() });

            expect(verdict).toEqual({
                eligible: false,
                blocker: {
                    message: 'The Case you are trying to reclassify does not exist',
                    statusCode: 404,
                    code: null,
                },
                kase: null,
                classification: null,
            });
        });

        it('bloquea un caso ya resuelto antes de mirar la clasificación destino', async () => {
            const target = makeClassification();
            const { eligibility } = buildEligibleScenario({
                target,
                kase: { fechaResolucion: new Date().toISOString() },
            });

            const verdict = await eligibility.evaluate(CASE_ID, { clasificacionId: target.id.value });

            expect(verdict.blocker).toMatchObject({ statusCode: 409, code: CASE_RECLASSIFY_CASE_CLOSED });
            expect(verdict.classification).toBeNull();
        });
    });

    describe('snapshot de concurrencia', () => {
        it('bloquea cuando la clasificación cambió desde que se cargó el formulario', async () => {
            const target = makeClassification();
            const { eligibility } = buildEligibleScenario({ target, kase: { clasificacionId: uuidv4() } });

            const verdict = await eligibility.evaluate(CASE_ID, {
                clasificacionId: target.id.value,
                clasificacionSnapshot: uuidv4(),
            });

            expect(verdict.blocker).toMatchObject({
                statusCode: 409,
                code: CASE_RECLASSIFY_CLASSIFICATION_STALE,
            });
        });

        it('deja pasar el snapshot que coincide con la clasificación actual', async () => {
            const currentClassificationId = uuidv4();
            const target = makeClassification();
            const { eligibility } = buildEligibleScenario({
                target,
                kase: { clasificacionId: currentClassificationId },
            });

            const verdict = await eligibility.evaluate(CASE_ID, {
                clasificacionId: target.id.value,
                clasificacionSnapshot: currentClassificationId,
            });

            expect(verdict.eligible).toBe(true);
        });

        it('omite la comprobación cuando el payload no trae snapshot', async () => {
            const target = makeClassification();
            const { eligibility } = buildEligibleScenario({ target, kase: { clasificacionId: uuidv4() } });

            const verdict = await eligibility.evaluate(CASE_ID, { clasificacionId: target.id.value });

            expect(verdict.eligible).toBe(true);
        });

        // `current_clasificacion_id: null` lo permite el esquema y significa «no traigo
        // snapshot»; tratarlo como uno real chocaría siempre contra la clasificación persistida.
        it('omite la comprobación cuando el snapshot llega como null', async () => {
            const target = makeClassification();
            const { eligibility } = buildEligibleScenario({ target, kase: { clasificacionId: uuidv4() } });

            const verdict = await eligibility.evaluate(CASE_ID, {
                clasificacionId: target.id.value,
                clasificacionSnapshot: null,
            });

            expect(verdict.eligible).toBe(true);
        });
    });

    describe('clasificación destino', () => {
        it('responde 404 cuando no existe', async () => {
            const { eligibility } = buildEligibleScenario();

            const verdict = await eligibility.evaluate(CASE_ID, { clasificacionId: uuidv4() });

            expect(verdict.blocker).toEqual({ message: 'Classification not found', statusCode: 404, code: null });
        });

        /**
         * `is_active` decide si el destino se concede, y el caché de clasificaciones sirve datos de
         * hasta 60 s: una clasificación recién desactivada seguiría aceptándose durante ese rato.
         */
        it('lee la clasificación destino sin pasar por el caché', async () => {
            const { eligibility, spies, target } = buildEligibleScenario();

            await eligibility.evaluate(CASE_ID, { clasificacionId: target.id.value });

            expect(spies.findClassification).toHaveBeenCalledWith(expect.objectContaining({ value: target.id.value }), {
                skipCache: true,
            });
        });

        it('bloquea una clasificación inactiva', async () => {
            const target = makeClassification({ isActive: false });
            const { eligibility } = buildEligibleScenario({ target });

            const verdict = await eligibility.evaluate(CASE_ID, { clasificacionId: target.id.value });

            expect(verdict.blocker).toMatchObject({
                statusCode: 400,
                code: CASE_RECLASSIFY_CLASSIFICATION_INACTIVE,
            });
            expect(verdict.classification).toBe(target);
        });
    });

    describe('disponibilidad para el grupo', () => {
        it('bloquea cuando la clasificación no está relacionada con el grupo', async () => {
            const target = makeClassification();
            const { eligibility } = buildEligibleScenario({ target, dependencies: { relationship: null } });

            const verdict = await eligibility.evaluate(CASE_ID, { clasificacionId: target.id.value });

            expect(verdict.blocker).toMatchObject({
                statusCode: 400,
                code: CASE_RECLASSIFY_CLASSIFICATION_NOT_IN_GROUP,
            });
        });

        it('bloquea cuando la relación existe pero no tiene formulario', async () => {
            const target = makeClassification();
            const { eligibility } = buildEligibleScenario({
                target,
                dependencies: { relationship: { form: { value: null } } },
            });

            const verdict = await eligibility.evaluate(CASE_ID, { clasificacionId: target.id.value });

            expect(verdict.blocker).toMatchObject({
                statusCode: 400,
                code: CASE_RECLASSIFY_CLASSIFICATION_WITHOUT_FORM,
            });
        });

        it('prefiere el grupo recibido sobre el del caso', async () => {
            const target = makeClassification();
            const grupoId = uuidv4();
            const { eligibility, spies } = buildEligibleScenario({ target });

            await eligibility.evaluate(CASE_ID, { clasificacionId: target.id.value, grupoId });

            expect(spies.findRelationship).toHaveBeenCalledWith(target.id, expect.objectContaining({ value: grupoId }));
        });

        it('usa el grupo del caso cuando no se recibe ninguno', async () => {
            const target = makeClassification();
            const grupoId = uuidv4();
            const { eligibility, spies } = buildEligibleScenario({ target, kase: { grupoId } });

            await eligibility.evaluate(CASE_ID, { clasificacionId: target.id.value });

            expect(spies.findRelationship).toHaveBeenCalledWith(target.id, expect.objectContaining({ value: grupoId }));
        });

        /**
         * El esquema del POST declara `grupo_id: Joi.string().uuid().allow('')`, así que la
         * cadena vacía llega hasta aquí. Construir un `ValueObjectUuid` con ella lanza un `Error`
         * plano —que sale como 500— en vez de evaluar el grupo que el caso ya tiene.
         */
        it('cae al grupo del caso cuando el recibido es la cadena vacía que acepta el esquema', async () => {
            const target = makeClassification();
            const grupoId = uuidv4();
            const { eligibility, spies } = buildEligibleScenario({ target, kase: { grupoId } });

            const verdict = await eligibility.evaluate(CASE_ID, { clasificacionId: target.id.value, grupoId: '' });

            expect(verdict.eligible).toBe(true);
            expect(spies.findRelationship).toHaveBeenCalledWith(target.id, expect.objectContaining({ value: grupoId }));
        });
    });

    describe('compatibilidad de subcasos', () => {
        it('bloquea un subcaso cuyo padre no declara la clasificación destino', async () => {
            const target = makeClassification();
            const parentClassification = makeClassification({ childIds: [uuidv4()] });
            const parentCaseId = uuidv4();
            const kase = makeCase();
            const parentCase = makeCase({ clasificacionId: parentClassification.id.value });
            const { eligibility } = buildDependencies({
                cases: { [CASE_ID]: kase, [parentCaseId]: parentCase },
                classifications: [target, parentClassification],
                parentCaseId,
            });

            const verdict = await eligibility.evaluate(CASE_ID, { clasificacionId: target.id.value });

            expect(verdict.blocker).toMatchObject({
                statusCode: 400,
                code: CASE_RECLASSIFY_SUBCASE_NOT_ALLOWED,
            });
        });

        it('acepta un subcaso cuya clasificación destino sí declara el padre', async () => {
            const target = makeClassification();
            const parentClassification = makeClassification({ childIds: [target.id.value] });
            const parentCaseId = uuidv4();
            const { eligibility } = buildDependencies({
                cases: {
                    [CASE_ID]: makeCase(),
                    [parentCaseId]: makeCase({ clasificacionId: parentClassification.id.value }),
                },
                classifications: [target, parentClassification],
                parentCaseId,
            });

            const verdict = await eligibility.evaluate(CASE_ID, { clasificacionId: target.id.value });

            expect(verdict.eligible).toBe(true);
        });

        /**
         * El caso ES subcaso pero el padre no se puede leer (réplica con retraso, jerarquía
         * huérfana). Sin fail-closed la regla del padre ni se evalúa y el subcaso se va a
         * CUALQUIER destino: el bloqueo tiene que venir de no poder verificar, no de la regla.
         */
        it('bloquea cuando el caso es subcaso y el padre no es legible', async () => {
            const target = makeClassification();
            const { eligibility } = buildDependencies({
                cases: { [CASE_ID]: makeCase() },
                classifications: [target],
                parentCaseId: uuidv4(),
            });

            const verdict = await eligibility.evaluate(CASE_ID, { clasificacionId: target.id.value });

            expect(verdict.eligible).toBe(false);
            expect(verdict.blocker).toMatchObject({
                statusCode: 409,
                code: CASE_RECLASSIFY_PARENT_UNVERIFIABLE,
            });
        });

        it('bloquea cuando el padre es legible pero su clasificación no existe', async () => {
            const target = makeClassification();
            const parentCaseId = uuidv4();
            const { eligibility } = buildDependencies({
                cases: {
                    [CASE_ID]: makeCase(),
                    [parentCaseId]: makeCase({ clasificacionId: uuidv4() }),
                },
                classifications: [target],
                parentCaseId,
            });

            const verdict = await eligibility.evaluate(CASE_ID, { clasificacionId: target.id.value });

            expect(verdict.blocker).toMatchObject({ code: CASE_RECLASSIFY_PARENT_UNVERIFIABLE });
        });

        /**
         * El caché de clasificaciones guarda también el `null`, 60 s y por instancia Lambda. Si
         * esta lectura pasara por él, el escenario que dispara el bloqueo —la réplica atrasada—
         * dejaría el `null` fijado y el reintento que promete el mensaje volvería a fallar contra
         * el caché en vez de contra la base.
         */
        it('lee la clasificación del padre sin pasar por el caché', async () => {
            const target = makeClassification();
            const parentClassification = makeClassification();
            const parentCaseId = uuidv4();
            const { eligibility, spies } = buildDependencies({
                cases: {
                    [CASE_ID]: makeCase(),
                    [parentCaseId]: makeCase({ clasificacionId: parentClassification.id.value }),
                },
                classifications: [target, parentClassification],
                parentCaseId,
            });

            await eligibility.evaluate(CASE_ID, { clasificacionId: target.id.value });

            expect(spies.findClassification).toHaveBeenCalledWith(
                expect.objectContaining({ value: parentClassification.id.value }),
                { skipCache: true }
            );
        });
    });
});
