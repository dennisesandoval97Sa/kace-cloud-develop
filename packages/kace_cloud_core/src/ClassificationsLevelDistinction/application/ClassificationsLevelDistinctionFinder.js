import ClassificationsLevelDistinctionResponse from './ClassificationsLevelDistinctionResponse.js';
import { ValidationFailError } from '../../shared/index.js';

export default class ClassificationsLevelDistinctionFinder {
    /** @type {Array} is initialized in the constructor */
    #repository;

    constructor(repository) {
        this.#repository = repository;
    }

    async execute(level) {
        const allowedLevels = [
            'nivel1',
            'nivel2',
            'nivel3',
            'nivel4',
            'nivel5',
            'nivel6',
            'nivel7',
            'nivel8',
            'nivel9',
            'nivel10',
        ];

        if (!allowedLevels.includes(level)) {
            throw new ValidationFailError('Invalid level', 'level');
        }

        const collection = await this.#repository.find(level);
        return new ClassificationsLevelDistinctionResponse(collection);
    }
}
