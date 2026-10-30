import { v4 as uuidv4 } from 'uuid';
import { State } from '../../../src/state';
import Chance from 'chance';
import {
    SHARED_VISUAL_COLOR_ALLOWLIST,
    SHARED_VISUAL_ICON_ALLOWLIST,
} from '../../../src/shared/visual-options/sharedVisualOptions.js';

export class StateMother {
    /**
     * Generates a Data Transfer Object (DTO) for the `State` entity.
     *
     * @returns {Object} The DTO containing the properties for an `State` entity.
     */
    static dto(override = {}) {
        return {
            id: uuidv4(),
            nombre: 'En proceso',
            tipo_id: null,
            descripcion: 'Test en proceso',
            icon_class: SHARED_VISUAL_ICON_ALLOWLIST[SHARED_VISUAL_ICON_ALLOWLIST.length - 1],
            status: 1,
            color: SHARED_VISUAL_COLOR_ALLOWLIST[2],
            require_observation: false,
            created_by: uuidv4(),
            created_at: new Date().toISOString(),
            ...override,
        };
    }

    /**
     * Creates an `State` instance and saves it to the repository.
     *
     * @param {KnexStateRepository} repository - The repository to save the `State` instance.
     * @returns {Promise<State>} The created `State` instance.
     */
    static async createState(repository, override) {
        const state = State.create(StateMother.dto(override));
        await repository.save(state);
        return state;
    }

    /**
     * Generates a random Data Transfer Object (DTO) for the `State` entity.
     *
     * @returns {Object} The DTO containing random properties for an `State` entity.
     */
    static randomDto() {
        const chance = new Chance();
        return {
            id: uuidv4(),
            nombre: 'Estado de prueba',
            descripcion: 'Descripcion de prueba',
            icon_class: chance.pickone(SHARED_VISUAL_ICON_ALLOWLIST),
            status: chance.integer({ min: 1, max: 2 }),
            color: chance.pickone(SHARED_VISUAL_COLOR_ALLOWLIST),
            require_observation: false,
            created_by: uuidv4(),
            created_at: new Date().toISOString(),
        };
    }

    /**
     * Creates an `State` instance with random properties and saves it to the repository.
     *
     * @param {KnexStateRepository} repository - The repository to save the `State` instance.
     * @returns {Promise<State>} The created `State` instance.
     */
    static async createRandomState(repository) {
        const state = State.create(StateMother.randomDto());
        await repository.save(state);
        return state;
    }
}
