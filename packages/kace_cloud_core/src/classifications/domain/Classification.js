import { AggregateRoot, ValueObjectBoolean, ValueObjectUuid } from '../../shared/index';
import { ValueObjectExternalId } from './ValueObjectExternalId';
import { ValueObjectLevel } from './ValueObjectLevel';
import { ValueObjectJsonClassificationsFlow } from './ValueObjectJsonClassificationsFlow';
import { buildClassificationLabel } from './classificationLabel.js';

export class Classification extends AggregateRoot {
    /** @type {ValueObjectLevel} is initialized in the constructor */
    #nivel1;
    /** @type {ValueObjectLevel} is initialized in the constructor */
    #nivel2;
    /** @type {ValueObjectLevel} is initialized in the constructor */
    #nivel3;
    /** @type {ValueObjectLevel} is initialized in the constructor */
    #nivel4;
    /** @type {ValueObjectLevel} is initialized in the constructor */
    #nivel5;
    /** @type {ValueObjectLevel} is initialized in the constructor */
    #nivel6;
    /** @type {ValueObjectLevel} is initialized in the constructor */
    #nivel7;
    /** @type {ValueObjectLevel} is initialized in the constructor */
    #nivel8;
    /** @type {ValueObjectLevel} is initialized in the constructor */
    #nivel9;
    /** @type {ValueObjectLevel} is initialized in the constructor */
    #nivel10;
    /** @type {ValueObjectUuid} is initialized in the constructor */
    #flujo_id;
    /** @type {ValueObjectUuid} is initialized in the constructor */
    #ans_id;
    /** @type {ValueObjectBoolean} is initialized in the constructor */
    #is_active;
    /** @type {ValueObjectUuid} is initialized in the constructor */
    #default_group_id;
    /** @type {ValueObjectUuid} is initialized in the constructor */
    #folio_config_id;
    /** @type {ValueObjectExternalId} is initialized in the constructor */
    #external_id;
    /** @type {ValueObjectBoolean} is initialized in the constructor */
    #can_start_sub_cases_flow;
    /** @type {ValueObjectJsonClassificationsFlow} is initialized in the constructor */
    #json_flujo;
    /** @type {Array[Classification]} is initialized in the constructor */
    #relations;
    /** @type {string} descripción generada automáticamente */
    #description;

    constructor({
        id,
        nivel1,
        nivel2,
        nivel3,
        nivel4,
        nivel5,
        nivel6,
        nivel7,
        nivel8,
        nivel9,
        nivel10,
        flujo_id,
        ans_id,
        is_active,
        updated_at,
        updated_by,
        created_at,
        created_by,
        deleted_at,
        deleted_by,
        default_group_id,
        folio_config_id,
        external_id,
        can_start_sub_cases_flow,
        json_flujo,
        relations,
        description,
    }) {
        super(id);
        this.#nivel1 = new ValueObjectLevel('nivel1', nivel1 ?? 'default');
        this.#nivel2 = new ValueObjectLevel('nivel2', nivel2, true);
        this.#nivel3 = new ValueObjectLevel('nivel3', nivel3, true);
        this.#nivel4 = new ValueObjectLevel('nivel4', nivel4, true);
        this.#nivel5 = new ValueObjectLevel('nivel5', nivel5, true);
        this.#nivel6 = new ValueObjectLevel('nivel6', nivel6, true);
        this.#nivel7 = new ValueObjectLevel('nivel7', nivel7, true);
        this.#nivel8 = new ValueObjectLevel('nivel8', nivel8, true);
        this.#nivel9 = new ValueObjectLevel('nivel9', nivel9, true);
        this.#nivel10 = new ValueObjectLevel('nivel10', nivel10, true);
        this.#flujo_id = new ValueObjectUuid('flujo_id', flujo_id);
        this.#ans_id = new ValueObjectUuid('ans_id', ans_id);
        this.#is_active = new ValueObjectBoolean('is_active', is_active ?? false);
        this.#default_group_id = new ValueObjectUuid('default_group_id', default_group_id, true);
        this.#folio_config_id = new ValueObjectUuid('folio_config_id', folio_config_id || null, true);
        this.#external_id = new ValueObjectExternalId('external_id', external_id, true);
        this.#can_start_sub_cases_flow = new ValueObjectBoolean(
            'can_start_sub_cases_flow',
            can_start_sub_cases_flow ?? true
        );
        this.#json_flujo = new ValueObjectJsonClassificationsFlow('json flujo', json_flujo, true);
        this.#description = description;
        this.#relations = relations;
        this.created_at = created_at;
        this.updated_at = updated_at;
        this.deleted_at = deleted_at;
        this.created_by = created_by;
        this.updated_by = updated_by;
        this.deleted_by = deleted_by;
    }

    /**
     * Nombre legible de la clasificación: sus niveles unidos en una ruta.
     *
     * @returns {string}
     */
    get label() {
        return buildClassificationLabel(this);
    }

    get nivel1() {
        return this.#nivel1;
    }

    set nivel1(value) {
        if (this.#nivel1.value !== value) {
            this.#nivel1 = new ValueObjectLevel('nivel1', value);
            this.changedAttributes.nivel1 = value;
        }
    }

    get nivel2() {
        return this.#nivel2;
    }

    set nivel2(value) {
        if (this.#nivel2.value !== value) {
            this.#nivel2 = new ValueObjectLevel('nivel2', value, true);
            this.changedAttributes.nivel2 = value;
        }
    }

    get nivel3() {
        return this.#nivel3;
    }

    set nivel3(value) {
        if (this.#nivel3.value !== value) {
            this.#nivel3 = new ValueObjectLevel('nivel3', value, true);
            this.changedAttributes.nivel3 = value;
        }
    }

    get nivel4() {
        return this.#nivel4;
    }

    set nivel4(value) {
        if (this.#nivel4.value !== value) {
            this.#nivel4 = new ValueObjectLevel('nivel4', value, true);
            this.changedAttributes.nivel4 = value;
        }
    }

    get nivel5() {
        return this.#nivel5;
    }

    set nivel5(value) {
        if (this.#nivel5.value !== value) {
            this.#nivel5 = new ValueObjectLevel('nivel5', value, true);
            this.changedAttributes.nivel5 = value;
        }
    }

    get nivel6() {
        return this.#nivel6;
    }

    set nivel6(value) {
        if (this.#nivel6.value !== value) {
            this.#nivel6 = new ValueObjectLevel('nivel6', value, true);
            this.changedAttributes.nivel6 = value;
        }
    }

    get nivel7() {
        return this.#nivel7;
    }

    set nivel7(value) {
        if (this.#nivel7.value !== value) {
            this.#nivel7 = new ValueObjectLevel('nivel7', value, true);
            this.changedAttributes.nivel7 = value;
        }
    }

    get nivel8() {
        return this.#nivel8;
    }

    set nivel8(value) {
        if (this.#nivel8.value !== value) {
            this.#nivel8 = new ValueObjectLevel('nivel8', value, true);
            this.changedAttributes.nivel8 = value;
        }
    }

    get nivel9() {
        return this.#nivel9;
    }

    set nivel9(value) {
        if (this.#nivel9.value !== value) {
            this.#nivel9 = new ValueObjectLevel('nivel9', value, true);
            this.changedAttributes.nivel9 = value;
        }
    }

    get nivel10() {
        return this.#nivel10;
    }

    set nivel10(value) {
        if (this.#nivel10.value !== value) {
            this.#nivel10 = new ValueObjectLevel('nivel10', value, true);
            this.changedAttributes.nivel10 = value;
        }
    }

    get flujo_id() {
        return this.#flujo_id;
    }

    set flujo_id(value) {
        if (this.#flujo_id.value !== value) {
            this.#flujo_id = new ValueObjectUuid('flujo_id', value);
            this.changedAttributes.flujo_id = value;
        }
    }

    get description() {
        return this.#description;
    }

    set description(value) {
        if (this.#description !== value) {
            this.#description = value;
            this.changedAttributes.description = value;
        }
    }
    get is_active() {
        return this.#is_active;
    }

    set is_active(value) {
        if (this.#is_active.value !== value) {
            this.#is_active = new ValueObjectBoolean('is_active', value);
            this.changedAttributes.is_active = value;
        }
    }

    get ans_id() {
        return this.#ans_id;
    }

    set ans_id(value) {
        if (this.#ans_id.value !== value) {
            this.#ans_id = new ValueObjectUuid('ans_id', value);
            this.changedAttributes.ans_id = value;
        }
    }

    get default_group_id() {
        return this.#default_group_id;
    }

    set default_group_id(value) {
        if (this.#default_group_id.value !== value) {
            this.#default_group_id = new ValueObjectUuid('default_group_id', value);
            this.changedAttributes.default_group_id = value;
        }
    }

    get folio_config_id() {
        return this.#folio_config_id;
    }

    // The form sends '' to mean "no configuration"; normalising to null keeps the column
    // NULL, which is what findByClassificationId and the folio_configurations join expect.
    set folio_config_id(value) {
        const normalized = value || null;
        if (this.#folio_config_id.value !== normalized) {
            this.#folio_config_id = new ValueObjectUuid('folio_config_id', normalized, true);
            this.changedAttributes.folio_config_id = normalized;
        }
    }

    get external_id() {
        return this.#external_id;
    }

    set external_id(value) {
        if (this.#external_id.value !== value) {
            this.#external_id = new ValueObjectExternalId('external_id', value);
            this.changedAttributes.external_id = value;
        }
    }

    get can_start_sub_cases_flow() {
        return this.#can_start_sub_cases_flow;
    }

    set can_start_sub_cases_flow(value) {
        if (this.#can_start_sub_cases_flow.value !== value) {
            this.#can_start_sub_cases_flow = new ValueObjectBoolean('can_start_sub_cases_flow', value);
            this.changedAttributes.can_start_sub_cases_flow = value;
        }
    }

    get json_flujo() {
        return this.#json_flujo;
    }

    set json_flujo(value) {
        this.#json_flujo = new ValueObjectJsonClassificationsFlow('Json flujo', value);
        this.changedAttributes.json_flujo = this.#json_flujo.value;
    }

    get relations() {
        return this.#relations;
    }

    set relations(value) {
        this.#relations = value;
    }
    /**
     * Creates a new Classification object from the provided data transfer object (DTO).
     *
     * @param {Object} dto - The data transfer object containing the properties for the Classification object.
     * @returns {Classification} A new instance of the Classification class.
     */
    static create(dto) {
        return new Classification(dto);
    }

    /**
     * Devuelve los IDs únicos de todos los nodos involucrados en el flujo.
     * @returns {string[]}
     */
    getClassificationsIds() {
        const json = this.#json_flujo.value;
        if (!json || !Array.isArray(json.edges)) return [];

        const ids = new Set();

        for (const edge of json.edges) {
            if (edge.source && edge.source !== this.id.value) ids.add(edge.source);
            if (edge.target && edge.target !== this.id.value) ids.add(edge.target);
        }

        return Array.from(ids);
    }

    /**
     * Devuelve las relaciones entre clasificaciones y subclasificaciones
     * representadas en el flujo.
     *
     * Cada relación corresponde a un edge:
     * [
     *   { classification_id: 'A', sub_classification_id: 'B' },
     *   { classification_id: 'B', sub_classification_id: 'C' },
     *   ...
     * ]
     *
     * @returns {{ classification_id: string, sub_classification_id: string }[]}
     */
    getClassificationRelations() {
        const json = this.#json_flujo.value;
        if (!json || !Array.isArray(json.edges)) return [];

        return json.edges
            .filter((edge) => edge.source && edge.target)
            .map((edge) => ({
                classification_id: edge.source,
                sub_classification_id: edge.target,
            }));
    }
}
