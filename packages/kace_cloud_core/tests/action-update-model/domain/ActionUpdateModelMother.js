import { v4 as uuidV4 } from 'uuid';
import Chance from 'chance';
import { ActionUpdateModel, Aggregates, Formulas, Types } from '../../../src/action-update-model';
import TestHelper from '../../TestHelper.js';

const chance = new Chance();

export default class ActionUpdateModelMother {
    /**
     * Generates a Data Transfer Object (DTO) for the `ActionUpdateModel` entity.
     *
     * @param {Object} params - Optional parameters to override default values.
     * @returns {Object} The DTO containing properties for the `ActionUpdateModel` entity.
     */
    static dto({ id, description, aggregate, field, type, value, formula, created_at, created_by } = {}) {
        return {
            id: id ?? uuidV4(),
            description: description ?? TestHelper.generateSafeValue(() => chance.word({ length: 10 })),
            aggregate: aggregate ?? Aggregates.CASOS.value,
            field: field ?? 'fecha_resolucion',
            type: type ?? Types.FORMULA.value,
            value: value ?? null,
            formula: formula ?? Formulas.FECHA_ACTUAL.value,
            created_at: created_at ?? new Date().toISOString(),
            created_by: created_by ?? uuidV4(),
        };
    }

    /**
     * Creates an instance of `ActionUpdateModel` and saves it to the repository.
     *
     * @param {Object} repository - The repository to save the `ActionUpdateModel` instance.
     * @param {Object} data - Optional data to override default values.
     * @returns {Promise<ActionUpdateModel>} The created `ActionUpdateModel` instance.
     */
    static async create(repository, data = {}) {
        const dto = ActionUpdateModelMother.dto(data);
        const modelUpdate = ActionUpdateModel.create(dto);
        await repository.save(modelUpdate);
        return modelUpdate;
    }
}
