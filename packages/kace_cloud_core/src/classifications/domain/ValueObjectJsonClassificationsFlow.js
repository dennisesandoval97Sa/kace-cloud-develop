import {
    Helper,
    ValidationFailError,
    ValueObjectDecimal,
    ValueObjectJson,
    ValueObjectUuid,
} from '../../shared/index.js';
import { ValueObjectBoolean } from '../../shared/domain/value-object/ValueObjectBoolean.js';
import { ValueObjectInt } from '../../shared/domain/value-object/ValueObjectInt.js';
import { ValueObjectString } from '../../shared/domain/value-object/ValueObjectString.js';

export class ValueObjectJsonClassificationsFlow extends ValueObjectJson {
    constructor(field, value, nullable = false) {
        super(field, value, nullable);

        if (!value && nullable) return;

        if (!value || typeof value !== 'object') {
            Helper.logError('El flujo debe ser un objeto válido.', field);
            throw new ValidationFailError('El flujo debe ser un objeto válido.', field);
        }

        const { nodes, edges } = value;

        value.nodes = this.#validateNodes(nodes);
        value.edges = this.#validateEdges(edges);
    }

    #validateNodes(nodes) {
        if (!Array.isArray(nodes)) {
            Helper.logError(`El flujo debe contener una propiedad 'nodes' como array.`, this.field);
            throw new ValidationFailError(`El flujo debe contener una propiedad 'nodes' como array.`, this.field);
        }

        return nodes.map((node, index) => {
            if (typeof node !== 'object' || node === null) {
                Helper.logError(`Nodo en posición ${index} debe ser un objeto válido.`, this.field);
                throw new ValidationFailError(`Nodo en posición ${index} debe ser un objeto válido.`, this.field);
            }

            const { id, data, type, width, height, style, dragging, position, selected, positionAbsolute } = node;

            try {
                new ValueObjectString(`id`, id);
                if (data && data.label) {
                    new ValueObjectString(`data.label`, data.label);
                }
                new ValueObjectString(`type`, type, true);
                if (style) {
                    new ValueObjectString(`style.color`, style.color, true);
                    new ValueObjectString(`style.border`, style.border, true);
                    new ValueObjectString(`style.background`, style.background, true);
                    new ValueObjectString(`style.fontWeight`, style.fontWeight, true);
                }
            } catch (error) {
                Helper.logError(error.message, `${this.field}.node`);
                throw new ValidationFailError(error.message, `${this.field}.node`);
            }

            try {
                new ValueObjectInt(`width`, width, true);
                new ValueObjectInt(`height`, height, true);
                new ValueObjectDecimal(`position.x`, position?.x);
                new ValueObjectDecimal(`position.y`, position?.y);
                new ValueObjectDecimal(`positionAbsolute.x`, positionAbsolute?.x, true);
                new ValueObjectDecimal(`positionAbsolute.y`, positionAbsolute?.y, true);
            } catch (error) {
                Helper.logError(error.message, `${this.field}.node`);
                throw new ValidationFailError(error.message, `${this.field}.node`);
            }

            try {
                new ValueObjectBoolean(`dragging`, dragging, true);
                new ValueObjectBoolean(`selected`, selected, true);
            } catch (error) {
                Helper.logError(error.message, `${this.field}.node`);
                throw new ValidationFailError(error.message, `${this.field}.node`);
            }

            const validatedNode = {
                id,
                data,
                type,
                width,
                height,
                dragging,
                position,
                selected,
                positionAbsolute,
            };

            if (style) {
                validatedNode.style = {
                    color: style.color,
                    border: style.border,
                    background: style.background,
                    fontWeight: style.fontWeight,
                };
            }

            return validatedNode;
        });
    }

    #validateEdges(edges) {
        if (!Array.isArray(edges)) {
            Helper.logError(`El flujo debe contener una propiedad 'edges' como array.`, this.field);
            throw new ValidationFailError(`El flujo debe contener una propiedad 'edges' como array.`, this.field);
        }

        return edges.map((edge, index) => {
            if (typeof edge !== 'object' || edge === null) {
                Helper.logError(`Conexión en posición ${index} debe ser un objeto válido.`, this.field);
                throw new ValidationFailError(`Conexión en posición ${index} debe ser un objeto válido.`, this.field);
            }

            const {
                id,
                source,
                target,
                sourceHandle,
                targetHandle,
                kace_transition,
                ans_id,
                label,
                transition_existed,
                type,
            } = edge;

            try {
                new ValueObjectString(`id`, id, true);
                new ValueObjectString(`source`, source);
                new ValueObjectString(`target`, target);
                new ValueObjectString(`sourceHandle`, sourceHandle, true);
                new ValueObjectString(`targetHandle`, targetHandle, true);
                new ValueObjectUuid(`kace_transition`, kace_transition, true);
                new ValueObjectUuid(`ans_id`, ans_id, true);
                new ValueObjectString(`label`, label, true);
                new ValueObjectString(`type`, type, true);
                new ValueObjectBoolean(`transition_existed`, transition_existed, true);
            } catch (error) {
                Helper.logError(error.message, `${this.field}.edges`);
                throw new ValidationFailError(error.message, `${this.field}.edges`);
            }

            return {
                id,
                source,
                target,
                sourceHandle,
                targetHandle,
                kace_transition,
                ans_id,
                label,
                transition_existed,
                type,
            };
        });
    }
}
