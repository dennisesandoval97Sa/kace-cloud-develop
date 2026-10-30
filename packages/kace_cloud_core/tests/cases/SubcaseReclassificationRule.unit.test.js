import { v4 as uuidv4 } from 'uuid';
import { CASE_RECLASSIFY_SUBCASE_NOT_ALLOWED } from '@kace/error-codes';
import { SubcaseReclassificationRule } from '../../src/cases/domain/SubcaseReclassificationRule.js';
import { Classification } from '../../src/classifications/domain/Classification.js';

/**
 * CORE-2 (MSKT-1392). La regla es pura, así que se prueba sin base de datos: basta con
 * construir clasificaciones con el `json_flujo` que declara sus subclasificaciones.
 */
describe('SubcaseReclassificationRule', () => {
    /**
     * Construye una clasificación cuyo flujo declara `childIds` como subclasificaciones.
     */
    function makeClassification({ id = uuidv4(), childIds = [], canStartSubCasesFlow = true } = {}) {
        return Classification.create({
            id,
            nivel1: 'nivel1',
            flujo_id: uuidv4(),
            ans_id: uuidv4(),
            is_active: true,
            can_start_sub_cases_flow: canStartSubCasesFlow,
            json_flujo: {
                nodes: [id, ...childIds].map((nodeId) => ({ id: nodeId, position: { x: 0, y: 0 } })),
                edges: childIds.map((childId) => ({ id: `edge-${childId}`, source: id, target: childId })),
            },
            created_at: new Date().toISOString(),
            created_by: uuidv4(),
        });
    }

    it('un caso suelto siempre es compatible', () => {
        const verdict = SubcaseReclassificationRule.evaluate({ targetClassification: makeClassification() });

        expect(verdict).toEqual({ compatible: true, code: null, message: null });
    });

    describe('el caso es un subcaso', () => {
        it('es compatible cuando el padre declara la clasificación destino', () => {
            const target = makeClassification();
            const parent = makeClassification({ childIds: [target.id.value] });

            const verdict = SubcaseReclassificationRule.evaluate({
                targetClassification: target,
                parentClassification: parent,
            });

            expect(verdict.compatible).toBe(true);
        });

        it('bloquea cuando el padre no declara la clasificación destino', () => {
            const target = makeClassification();
            const parent = makeClassification({ childIds: [uuidv4()] });

            const verdict = SubcaseReclassificationRule.evaluate({
                targetClassification: target,
                parentClassification: parent,
            });

            expect(verdict.compatible).toBe(false);
            expect(verdict.code).toBe(CASE_RECLASSIFY_SUBCASE_NOT_ALLOWED);
            expect(verdict.message).toMatch(/subclassifications declared by the parent/);
        });
    });

    describe('el caso es un padre con subcasos', () => {
        it('bloquea cuando la clasificación destino no puede abrir flujo de subcasos', () => {
            const childClassificationId = uuidv4();
            const target = makeClassification({
                childIds: [childClassificationId],
                canStartSubCasesFlow: false,
            });

            const verdict = SubcaseReclassificationRule.evaluate({
                targetClassification: target,
                childClassificationIds: [childClassificationId],
            });

            expect(verdict.compatible).toBe(false);
            expect(verdict.code).toBe(CASE_RECLASSIFY_SUBCASE_NOT_ALLOWED);
            expect(verdict.message).toMatch(/cannot start a subcases flow/);
        });

        it('bloquea cuando la clasificación destino no declara la clasificación de un hijo vivo', () => {
            const target = makeClassification({ childIds: [uuidv4()] });

            const verdict = SubcaseReclassificationRule.evaluate({
                targetClassification: target,
                childClassificationIds: [uuidv4()],
            });

            expect(verdict.compatible).toBe(false);
            expect(verdict.message).toMatch(/does not declare the classifications of the existing subcases/);
        });

        it('es compatible cuando la clasificación destino declara a todos los hijos', () => {
            const firstChild = uuidv4();
            const secondChild = uuidv4();
            const target = makeClassification({ childIds: [firstChild, secondChild] });

            const verdict = SubcaseReclassificationRule.evaluate({
                targetClassification: target,
                childClassificationIds: [firstChild, secondChild, firstChild],
            });

            expect(verdict.compatible).toBe(true);
        });
    });

    it('aplica las dos reglas a la vez cuando el caso es hijo y padre', () => {
        const childClassificationId = uuidv4();
        const target = makeClassification({ childIds: [childClassificationId] });
        const parent = makeClassification({ childIds: [uuidv4()] });

        const verdict = SubcaseReclassificationRule.evaluate({
            targetClassification: target,
            parentClassification: parent,
            childClassificationIds: [childClassificationId],
        });

        expect(verdict.compatible).toBe(false);
        expect(verdict.message).toMatch(/parent/);
    });
});
