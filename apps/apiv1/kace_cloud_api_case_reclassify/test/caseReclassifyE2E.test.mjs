import { v4 as uuidv4 } from 'uuid';
import { KnexCaseRepository } from '@kace/core/src/cases';
import { AuxCases, KnexAuxCasesRepository } from '@kace/core/src/aux_casos';
import {
    ClassificationGroupRelationship,
    KnexClassificationGroupRelationshipRepository,
} from '@kace/core/src/classification-group-relationships';
import { production as knexConfig } from '@kace/database/knexfile';
import { TestHelper } from '@kace/api-common';
import { CASE_RECLASSIFY_CLASSIFICATION_NOT_IN_GROUP, CASE_RECLASSIFY_TRANSITION_OUT_OF_FLOW } from '@kace/error-codes';

import { CaseFactory } from '@kace/core/src/factories/CaseFactory';
import { ClassificationFactory } from '@kace/core/src/factories/ClassificationFactory';
import { OneScriptFactory } from '@kace/core/src/factories/OneScriptFactory';
import { TransitionFactory } from '@kace/core/src/factories/TransitionFactory';

/**
 * QA-3 (MSKT-1392) — E2E de `POST /case-reclassification/{id}` y de su precheck.
 *
 * ENTORNO: exige el SAM local de AMBOS servicios (60061 y 60103) y la base local migrada. Si
 * falta la migración de `cases.estado_id`, esto revienta en la factoría de casos y no en el
 * assert, así que el mensaje no dirá la verdad.
 *
 * Y exige algo que no es evidente: que `DB_TEST_*` —de donde el Lambda saca su tenant local—
 * apunte a la MISMA base y esquema que `DB_*`, que es por donde este test siembra. Además el
 * host debe ser alcanzable DESDE el contenedor (`db-postgres16-3`, no `localhost`) y en el
 * puerto interno de la red (5432, no el 5434 publicado en el host). Si no coinciden, el test
 * siembra en un sitio y el Lambda busca en otro, y el síntoma es un 404 o un 500 que no tiene
 * nada que ver con lo que se está probando.
 *
 * Lo que NO se cubre aquí, y dónde sí está:
 *  - 403 sin permiso: `controllerPermission.test.mjs`. El usuario del E2E recibe TODOS los
 *    permisos en `resetSchemaAndMigrate`, así que probarlo aquí obligaría a manipular el rol
 *    global y a restaurarlo, con el riesgo de dejar el esquema contaminado si el test falla.
 *  - Publicación de `CaseUpdated`: `CaseReclassifier.integration.test.js`. El evento sale por
 *    SQS y no deja rastro en base de datos, así que un E2E no puede observarlo.
 *  - Compatibilidad de subcasos: `CaseReclassifier.integration.test.js` y
 *    `SubcaseReclassificationRule.unit.test.js`, que cubren las dos direcciones de la regla.
 */
describe('CaseReclassifyController test', () => {
    const repository = new KnexCaseRepository(knexConfig);
    // Una sola conexión para todo: cada repositorio o factoría construido desde `knexConfig` abre
    // su propio pool —de `max: 1`— y no lo cierra, así que sembrar siete escenarios agota las
    // conexiones y los últimos tests fallan al crear el caso, no en su aserción.
    const db = repository.connection;
    const auxCasesRepository = new KnexAuxCasesRepository(db);
    const classificationGroupRelationshipRepository = new KnexClassificationGroupRelationshipRepository(db);

    const localUrl = (port) => `http://127.0.0.1:${port}`;
    const isStaging = process.env.APPS_ENVIRONMENT === 'staging';
    const stagingUrl = (basePath) => `https://${process.env.APPS_API_SUBDOMAIN}.${process.env.APPS_DOMAIN}/${basePath}`;

    const baseUrl = isStaging ? stagingUrl('case-reclassification') : localUrl(60061);
    const precheckUrl = isStaging ? stagingUrl('case-reclassification-precheck') : localUrl(60103);

    afterAll(async () => {
        try {
            repository.connection.destroy();
        } catch (error) {
            console.log(error);
        }
    });

    /**
     * Un destino reclasificable: clasificación activa con flujo propio, RELACIONADA con el grupo
     * del caso y con formulario. Sin esa relación la elegibilidad rechaza con
     * `CLASSIFICATION_NOT_IN_GROUP`, que es justo lo que comprueba el test de abajo.
     */
    async function seedReclassifiableTarget(kase) {
        const classification = await new ClassificationFactory(db).create();
        // `status` explícito: la factoría lo sortea entre activo e inactivo, y la lista de
        // estados del flujo solo devuelve transiciones activas.
        const transition = await new TransitionFactory(db).create({
            flujo_id: classification.flujo_id.value,
            status: 1,
        });
        const form = await new OneScriptFactory(db).create();

        await classificationGroupRelationshipRepository.save(
            ClassificationGroupRelationship.create({
                classification_id: classification.id.value,
                group_id: kase.grupo_id.value,
                form: form.id.value,
            })
        );

        return { classification, transition };
    }

    const readCase = (id) =>
        repository
            .table()
            .select(['transicion_id', 'clasificacion_id', 'estado_id', 'cambio_clasificacion'])
            .where({ id })
            .first();

    it('can reclasify a Case', async () => {
        const kase = await new CaseFactory(db).create();
        const { classification, transition } = await seedReclassifiableTarget(kase);

        const response = await TestHelper.postRequest(`${baseUrl}/${kase.id.value}`, {
            transicion_id: transition.id.value,
            clasificacion_id: classification.id.value,
            comment: { descripcion: 'Motivo de la reclasificación' },
        });

        const reclassifyCase = await readCase(kase.id.value);

        expect(response.status).toBe(200);
        expect(reclassifyCase.transicion_id).toEqual(transition.id.value);
        expect(reclassifyCase.clasificacion_id).toEqual(classification.id.value);
        expect(reclassifyCase.transicion_id).not.toEqual(kase.transicion_id.value);
        expect(reclassifyCase.clasificacion_id).not.toEqual(kase.clasificacion_id.value);
    });

    /**
     * Regresión del bug de API-1: `controller.mjs` pasaba `body` en vez de `dataUpdate` al
     * `CaseUpdater`, con lo que `cambio_clasificacion` nunca llegaba a persistirse.
     */
    it('persists cambio_clasificacion and keeps the state in sync with the transition', async () => {
        const kase = await new CaseFactory(db).create();
        const { classification, transition } = await seedReclassifiableTarget(kase);

        await TestHelper.postRequest(`${baseUrl}/${kase.id.value}`, {
            transicion_id: transition.id.value,
            clasificacion_id: classification.id.value,
            comment: { descripcion: 'Motivo de la reclasificación' },
        });

        const reclassifyCase = await readCase(kase.id.value);

        expect(reclassifyCase.cambio_clasificacion).toBe(true);
        expect(reclassifyCase.estado_id).toEqual(transition.siguiente_estado_id.value);
    });

    /**
     * Reclasificar cambia el formulario, no el histórico: los datos de la clasificación anterior
     * siguen en `aux_cases` para que el asesor no pierda lo ya diligenciado.
     */
    it('leaves the auxiliary data of the previous classification untouched', async () => {
        const kase = await new CaseFactory(db).create();
        const auxData = { motivo: 'venta no efectiva', intentos: 2 };
        const auxCase = await auxCasesRepository.save(
            new AuxCases({
                id: uuidv4(),
                caso_id: kase.id.value,
                data: auxData,
                created_at: new Date().toISOString(),
                created_by: kase.created_by.value,
            })
        );
        const { classification, transition } = await seedReclassifiableTarget(kase);

        const response = await TestHelper.postRequest(`${baseUrl}/${kase.id.value}`, {
            transicion_id: transition.id.value,
            clasificacion_id: classification.id.value,
            comment: { descripcion: 'Motivo de la reclasificación' },
        });

        // Sin esta aserción el test pasaría en verde con el servicio caído: si la reclasificación
        // nunca ocurre, los datos siguen intactos por omisión y no se prueba nada.
        expect(response.status).toBe(200);

        const stored = await auxCasesRepository.table().select('data').where({ id: auxCase.id.value }).first();
        expect(stored.data).toEqual(auxData);
    });

    it('rejects a transition that does not belong to the destination flow', async () => {
        const kase = await new CaseFactory(db).create();
        const { classification } = await seedReclassifiableTarget(kase);
        const foreignTransition = await new TransitionFactory(db).create();

        const response = await TestHelper.postRequest(`${baseUrl}/${kase.id.value}`, {
            transicion_id: foreignTransition.id.value,
            clasificacion_id: classification.id.value,
            comment: { descripcion: 'Motivo de la reclasificación' },
        });

        expect(response.response.status).toBe(400);
        expect(response.response.data.data.code).toBe(CASE_RECLASSIFY_TRANSITION_OUT_OF_FLOW);

        const untouched = await readCase(kase.id.value);
        expect(untouched.clasificacion_id).toEqual(kase.clasificacion_id.value);
    });

    it('rejects a classification that is not available for the group of the case', async () => {
        const kase = await new CaseFactory(db).create();
        const classification = await new ClassificationFactory(db).create();
        const transition = await new TransitionFactory(db).create({
            flujo_id: classification.flujo_id.value,
            status: 1,
        });

        const response = await TestHelper.postRequest(`${baseUrl}/${kase.id.value}`, {
            transicion_id: transition.id.value,
            clasificacion_id: classification.id.value,
            comment: { descripcion: 'Motivo de la reclasificación' },
        });

        expect(response.response.status).toBe(400);
        expect(response.response.data.data.code).toBe(CASE_RECLASSIFY_CLASSIFICATION_NOT_IN_GROUP);
    });

    /**
     * El precheck responde la MISMA regla que el POST, sin efectos secundarios: un bloqueo de
     * negocio es un 200 con `eligible: false` y el código, no una excepción, porque el plugin
     * necesita leer el motivo para mostrarlo.
     */
    describe('precheck', () => {
        it('answers with the states and rules of the destination flow when the case is eligible', async () => {
            const kase = await new CaseFactory(db).create();
            const { classification, transition } = await seedReclassifiableTarget(kase);

            const response = await TestHelper.getRequest(
                `${precheckUrl}/${kase.id.value}?clasificacion_id=${classification.id.value}`
            );

            expect(response.status).toBe(200);
            expect(response.data.data.eligible).toBe(true);
            expect(response.data.data.blocker).toBeNull();
            expect(response.data.data.states.map((state) => state.transition.id)).toContain(transition.id.value);
            expect(Array.isArray(response.data.data.transition_rules)).toBe(true);
        });

        it('reports the same blocker the POST would, without touching the case', async () => {
            const kase = await new CaseFactory(db).create();
            const classification = await new ClassificationFactory(db).create();

            const response = await TestHelper.getRequest(
                `${precheckUrl}/${kase.id.value}?clasificacion_id=${classification.id.value}`
            );

            expect(response.status).toBe(200);
            expect(response.data.data.eligible).toBe(false);
            expect(response.data.data.blocker.code).toBe(CASE_RECLASSIFY_CLASSIFICATION_NOT_IN_GROUP);
            expect(response.data.data.states).toEqual([]);

            const untouched = await readCase(kase.id.value);
            expect(untouched.clasificacion_id).toEqual(kase.clasificacion_id.value);
        });
    });
});
