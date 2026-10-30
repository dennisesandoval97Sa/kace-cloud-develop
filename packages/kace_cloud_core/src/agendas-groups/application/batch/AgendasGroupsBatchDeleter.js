import { ValidationFailError } from '../../../shared';
import { AgendasGroups } from '../../domain/AgendasGroups';
import { AgendasGroupsBatchBase } from './AgendasGroupsBatchBase';

export class AgendasGroupsBatchDeleter extends AgendasGroupsBatchBase {
    /**
     * @override AgendasGroupsBatchBase.processRelationship method to delete a
     * relationship between an agenda and a group.
     *
     * @param {Object} relationship - The relationship to process.
     * @param {Knex.Transaction} trx - The transaction to use.
     *
     * @throws {ValidationFailError} - If the relationship doesn't exists.
     *
     * @returns {Promise<void>} - Promise that resolves when the operation is completed.
     */
    async processRelationship(relationship, trx) {
        const agendasGroups = AgendasGroups.create(relationship);
        const { agenda_id, group_id } = agendasGroups;

        if (!(await this.relationExists(agenda_id.value, group_id.value, trx))) {
            throw new ValidationFailError(
                `Agenda ${agenda_id.value} and group ${group_id.value} relationship doesn't exists`,
                'data'
            );
        }

        await this.delete(agendasGroups, trx);
    }
}
