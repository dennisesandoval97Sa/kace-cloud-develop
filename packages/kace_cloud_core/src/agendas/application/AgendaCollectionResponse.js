import { AgendaResponse } from './AgendaResponse';

export class AgendaCollectionResponse {
    /**
     * @type {Agenda[]}
     * is initialized in the constructor
     */
    #agendas;

    /**
     * @type {number}
     * is initialized in the constructor
     */
    #count;

    constructor(agendas, count) {
        this.#agendas = agendas;
        this.#count = count;
    }

    /**
     * Converts the collection of Agenda objects to a JSON format.
     *
     * @returns {Object} The collection of Agenda objects in JSON format.
     */
    toJson() {
        return {
            data: {
                items: this.#agendas.map((agenda) => new AgendaResponse(agenda).toJson().data),
            },
            metadata: {
                count: this.#count,
            },
        };
    }
}
