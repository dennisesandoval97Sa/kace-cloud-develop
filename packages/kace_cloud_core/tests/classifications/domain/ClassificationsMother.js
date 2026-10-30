import { v4 as uuidv4 } from 'uuid';
import { Classification } from '../../../src/classifications';
import Chance from 'chance';
import { Flow } from '../../../src/flow/index.js';
import { ensureParentRows } from '../../support/ensureParentRow.js';
import AnsMother from '../../ans/domain/AnsMother.js';

export default class ClassificationsMother {
    /**
     * Garantiza que las filas padre referenciadas por las claves foraneas de
     * `clasificaciones` (flujo_id, ans_id) existan antes de guardar. Postgres
     * las exige y sqlite nunca lo hizo -por eso el fallo llegaba enmascarado
     * como "Transaction failed: error saving data", ya que
     * `KnexClassificationsRepository.save` no imprime el error real.
     * Se garantiza SIEMPRE, tambien cuando el llamador fijo el id: `ensureParentRow`
     * es idempotente (`onConflict('id').ignore()`), asi que respaldar una fila que
     * ya existe no cuesta nada, mientras que saltarsela deja el insert al borde de
     * una violacion de clave foranea. Una version anterior filtraba por
     * `overrides` asumiendo que quien fija el id ya creo la fila; esa asuncion es
     * justo la que fallaba.
     *
     * El tercer parametro con los `overrides` que tenia esta firma era el resto
     * de aquel filtro: ya no lo miraba nadie, y dejarlo invitaba a creer que la
     * decision segun quien fijo el id seguia viva.
     *
     * @param {import('knex').Knex} connection - `repository.connection`.
     * @param {Object} dto - DTO ya resuelto.
     * @returns {Promise<void>}
     */
    static async ensureRelations(connection, dto) {
        // La fila de `ans` no puede llevar solo el id: `Ans` construye
        // `medicion_ans_id` sin valor por defecto, y `KnexCaseRepository`
        // filtra por esa columna en `findUnresolvedByMeasurementType*`.
        await ensureParentRows(connection, [
            { table: 'flujos', id: dto.flujo_id },
            { table: 'ans', id: dto.ans_id, extra: AnsMother.dto({ id: dto.ans_id }) },
        ]);
    }

    /**
     * Generates a Data Transfer Object (DTO) for the `Classifications` entity.
     *
     * @returns {Object} The DTO containing the properties for an `Classifications` entity.
     */
    static dto({
        id,
        flujo_id,
        ans_id,
        created_by,
        default_group_id,
        external_id,
        sub_classification_ids,
        ...rest
    } = {}) {
        const classification_id = id ?? uuidv4();
        return {
            id: classification_id,
            nivel1: 'Level 1',
            nivel2: 'Level 2',
            nivel3: 'Level 3',
            nivel4: 'Level 4',
            nivel5: 'Level 5',
            nivel6: 'Level 6',
            nivel7: 'Level 7',
            nivel8: 'Level 8',
            nivel9: 'Level 9',
            nivel10: 'Level 10',
            flujo_id: flujo_id ?? uuidv4(),
            ans_id: ans_id ?? uuidv4(),
            is_active: true,
            created_at: new Date().toISOString(),
            created_by: created_by ?? uuidv4(),
            default_group_id: default_group_id ?? uuidv4(),
            external_id: external_id ?? uuidv4(),
            can_start_sub_cases_flow: true,
            json_flujo: this.dtoJsonFlow(classification_id, sub_classification_ids),
            ...rest,
        };
    }

    /**
     * Creates an `Classifications` instance and saves it to the repository.
     *
     * @param {KnexClassificationsRepository} repository - The repository to save the `Classifications` instance.
     * @returns {Classification} The created `Classifications` instance.
     */
    static async createClassification(repository, data = {}) {
        const dto = ClassificationsMother.dto(data);
        await ClassificationsMother.ensureRelations(repository.connection, dto);
        const classification = Classification.create(dto);
        await repository.save(classification);
        return classification;
    }

    static genericClassificationData(customData = {}) {
        const classification_id = customData.id ?? uuidv4();
        return {
            // El mismo id que la raiz de `json_flujo`: si son distintos, el nodo raiz queda como
            // una clasificacion relacionada mas y `getClassificationsIds()` devuelve una de sobra.
            id: classification_id,
            nivel1: 'Valor Nivel 1',
            nivel2: 'Valor Nivel 2',
            nivel3: 'Valor Nivel 3',
            nivel4: 'Valor Nivel 4',
            nivel5: 'Valor Nivel 5',
            nivel6: 'Valor Nivel 6',
            nivel7: 'Valor Nivel 7',
            nivel8: 'Valor Nivel 8',
            nivel9: 'Valor Nivel 9',
            nivel10: 'Valor Nivel 10',
            is_active: true,
            ans_id: uuidv4(),
            flujo_id: uuidv4(),
            created_at: new Date(),
            created_by: uuidv4(),
            defalut_group_id: uuidv4(),
            external_id: uuidv4(),
            can_start_sub_cases_flow: true,
            json_flujo: this.dtoJsonFlow(classification_id, customData.sub_classification_ids),
            ...customData,
        };
    }

    /**
     *
     * @param {KnexClassificationRepository} repository
     * @param {object} customData
     */
    static async create(repository, customData = {}) {
        const data = ClassificationsMother.genericClassificationData(customData);
        await ClassificationsMother.ensureRelations(repository.connection, data);

        const classification = new Classification(data);

        await repository.save(classification);

        return classification;
    }

    /**
     * Generates a random DTO with the same structure as `dto()`
     */
    static randomDto() {
        const chance = new Chance();
        return {
            id: uuidv4(),
            nivel1: chance.word(),
            nivel2: chance.word(),
            nivel3: chance.word(),
            nivel4: chance.word(),
            nivel5: chance.word(),
            nivel6: chance.word(),
            nivel7: chance.word(),
            nivel8: chance.word(),
            nivel9: chance.word(),
            nivel10: chance.word(),
            flujo_id: uuidv4(),
            ans_id: uuidv4(),
            is_active: chance.bool(),
            created_at: new Date().toISOString(),
            created_by: uuidv4(),
            default_group_id: uuidv4(),
            external_id: uuidv4(),
            can_start_sub_cases_flow: chance.bool(),
        };
    }

    /**
     * Generates a Data Transfer Object (DTO) for the `ClassificationsFlows` entity.
     *
     * @returns {Object} The DTO containing the properties for an `ClassificationsFlows` entity.
     */
    static dtoJsonFlow(classification_id = uuidv4(), sub_classification_ids = [uuidv4(), uuidv4(), uuidv4()]) {
        const edges = [];

        edges.push({
            id: `edge-${uuidv4()}`,
            type: 'custom',
            label: null,
            ans_id: null,
            source: classification_id,
            target: sub_classification_ids[0],
            sourceHandle: null,
            targetHandle: 'top',
        });

        for (let i = 0; i < sub_classification_ids.length; i++) {
            const randomTarget = sub_classification_ids[Math.floor(Math.random() * sub_classification_ids.length)];
            if (randomTarget !== sub_classification_ids[i]) {
                edges.push({
                    id: `edge-${uuidv4()}`,
                    type: 'custom',
                    source: sub_classification_ids[i],
                    target: randomTarget,
                    sourceHandle: null,
                    targetHandle: 'top',
                });
            }
        }

        const nodes = [
            {
                id: classification_id,
                data: { label: 'Clasificación principal' },
                type: 'input',
                width: 150,
                height: 40,
                position: { x: 300, y: 0 },
            },
            ...sub_classification_ids.map((id, index) => ({
                id,
                data: { label: `Subclasificación` },
                type: 'custom',
                style: {
                    color: '#A100C2',
                    border: '2px solid #A100C2',
                    background: 'rgba(208, 192, 247, 0.5)',
                    fontWeight: 'bold',
                },
                width: 4,
                height: 4,
                position: { x: 300 + index * 100, y: 100 + index * 80 },
            })),
        ];

        return {
            edges,
            nodes,
        };
    }

    static dtoWithoutFlow(override = {}) {
        return {
            id: uuidv4(),
            nivel1: 'Level 1',
            nivel2: 'Level 2',
            nivel3: 'Level 3',
            nivel4: 'Level 4',
            nivel5: 'Level 5',
            nivel6: 'Level 6',
            nivel7: 'Level 7',
            nivel8: 'Level 8',
            nivel9: 'Level 9',
            nivel10: 'Level 10',
            flujo_id: uuidv4(),
            ans_id: uuidv4(),
            is_active: true,
            created_at: new Date().toISOString(),
            created_by: uuidv4(),
            default_group_id: uuidv4(),
            external_id: uuidv4(),
            can_start_sub_cases_flow: true,
            json_flujo: null,
            description: 'descripcion',
            ...override,
        };
    }

    static async createClassificationWithoutFlow(repository, override = {}) {
        const dto = ClassificationsMother.dtoWithoutFlow(override);
        await ClassificationsMother.ensureRelations(repository.connection, dto);
        const classification = Classification.create(dto);
        await repository.save(classification);
        return classification;
    }
}
