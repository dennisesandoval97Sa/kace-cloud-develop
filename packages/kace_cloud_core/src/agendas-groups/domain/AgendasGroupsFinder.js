import { ValueObjectAgendaId } from './value-objects/ValueObjectAgendaId.js';
import { ValueObjectGroupId } from './value-objects/ValueObjectGroupId.js';

export class AgendasGroupsFinder {
    /**
     * @type {KnexAgendasGroupsRepository} is initialized in the constructor
     */
    #repository;

    constructor(repository) {
        this.#repository = repository;
    }

    /**
     * Retrieve a relationship between an agenda and a group.
     *
     * @param {string} agendaId
     * @param {string} groupId
     * @param {Knex.Transaction} trx
     *
     * @return {Promise<AgendasGroups>}
     */
    async execute(agendaId, groupId, trx) {
        return this.#repository.find(
            new ValueObjectAgendaId('agenda_id', agendaId),
            new ValueObjectGroupId('group_id', groupId),
            trx
        );
    }
}
