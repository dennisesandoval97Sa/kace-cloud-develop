import { v4 as uuidv4 } from 'uuid';
import { Ans, Types } from '../../../src/ans/index.js';
import Chance from 'chance';
import {
    DEFAULT_ANS_VISUAL_COLORS,
    SHARED_VISUAL_COLOR_ALLOWLIST,
} from '../../../src/shared/visual-options/sharedVisualOptions.js';

export default class AnsMother {
    /**
     * Generates a Data Transfer Object (DTO) for the `Ans` entity.
     *
     * @returns {Object} The DTO containing the properties for an `Ans` entity.
     */
    static dto(override = {}) {
        return {
            id: uuidv4(),
            nombre: 'Ans Oro',
            intermedio: 5,
            vencido: 10,
            color_ans_inicial: DEFAULT_ANS_VISUAL_COLORS.initial,
            color_ans_intermedio: DEFAULT_ANS_VISUAL_COLORS.intermediate,
            color_ans_final: DEFAULT_ANS_VISUAL_COLORS.final,
            status: 1,
            medicion_ans_id: Types.DAYS.value,
            created_at: new Date().toISOString(),
            created_by: uuidv4(),
            ...override,
        };
    }

    static diasIntermedio5Vencido10() {
        return {
            id: uuidv4(),
            nombre: 'Dias Intermedio 5 Vencido 10',
            intermedio: 5,
            vencido: 10,
            color_ans_inicial: DEFAULT_ANS_VISUAL_COLORS.initial,
            color_ans_intermedio: DEFAULT_ANS_VISUAL_COLORS.intermediate,
            color_ans_final: DEFAULT_ANS_VISUAL_COLORS.final,
            status: 1,
            medicion_ans_id: Types.DAYS.value,
            created_at: new Date().toISOString(),
            created_by: uuidv4(),
        };
    }

    /**
     * Creates an `Ans` instance and saves it to the repository.
     *
     * @param {KnexAnsRepository} repository - The repository to save the `Ans` instance.
     * @returns {Ans} The created `Ans` instance.
     */
    static async createAns(repository, overrides = {}) {
        const ans = Ans.create(AnsMother.dto(overrides));
        await repository.save(ans);
        return ans;
    }

    /**
     * Generates a random Data Transfer Object (DTO) for the `Ans` entity.
     *
     * @returns {Object} The DTO containing random properties for an `Ans` entity.
     */
    static randomDto() {
        const chance = new Chance();
        return {
            id: uuidv4(),
            nombre: chance.string({ length: 8, alpha: true }),
            intermedio: chance.integer({ min: 5, max: 10 }),
            vencido: chance.integer({ min: 11, max: 20 }),
            color_ans_inicial: chance.pickone(SHARED_VISUAL_COLOR_ALLOWLIST),
            color_ans_intermedio: chance.pickone(SHARED_VISUAL_COLOR_ALLOWLIST),
            color_ans_final: chance.pickone(SHARED_VISUAL_COLOR_ALLOWLIST),
            status: chance.integer({ min: 1, max: 2 }),
            medicion_ans_id: Types.DAYS.value,
            created_at: new Date().toISOString(),
            created_by: uuidv4(),
        };
    }

    /**
     * Creates an `Ans` instance with random properties and saves it to the repository.
     *
     * @param {KnexAnsRepository} repository - The repository to save the `Ans` instance.
     * @returns {Ans} The created `Ans` instance.
     */
    static async createRandomAns(repository) {
        const ans = Ans.create(AnsMother.randomDto());
        await repository.save(ans);
        return ans;
    }
}
