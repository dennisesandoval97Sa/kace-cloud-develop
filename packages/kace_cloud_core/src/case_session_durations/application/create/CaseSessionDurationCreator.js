import { ValidationFailError } from '@kace/core/src/shared/index.js';
import { CaseSessionDuration } from '../../domain/CaseSessionDuration.js';
import { CaseSessionDurationResponse } from '../CaseSessionDurationResponse.js';
import { ElapsedTimeCalculator } from '../../domain/ElapsedTimeCalculator.js';

export class CaseSessionDurationCreator {
    /** @type {KnexCaseSessionDurationRepository} */
    #repository;
    /** @type {KnexCaseRepository} */
    #casesRepository;

    /**
     * @param {KnexCaseSessionDurationRepository} repository
     * @param {KnexCaseRepository} casesRepository
     */
    constructor(repository, casesRepository) {
        this.#repository = repository;
        this.#casesRepository = casesRepository;
    }

    /**
     * Creates a new CaseSessionDuration and saves it in the repository.
     * @param {Object} dto - Data for entity creation.
     * @returns {Promise<CaseSessionDurationResponse>}
     */
    async execute(dto) {
        // Una sesion que nace ya terminada tiene duracion desde el primer momento. La tabla no
        // tiene disparador que la derive y hasta ahora solo la calculaba el Updater, asi que la
        // fila quedaba con elapsed_time nulo para siempre.
        const elapsedTime = dto.elapsed_time ?? ElapsedTimeCalculator.between(dto.started_at, dto.finished_at);
        const sessionDuration = CaseSessionDuration.create({ ...dto, elapsed_time: elapsedTime });

        const kase = await this.#casesRepository.find(sessionDuration.case_id);
        if (!kase) {
            throw new ValidationFailError(`Case with id ${sessionDuration.case_id.value} does not exist`, 'case_id');
        }

        const exists = await this.#repository.find(sessionDuration.id);
        if (exists) {
            throw new ValidationFailError(`Session id ${sessionDuration.id.value} already exists`, 'id');
        }

        await this.#repository.save(sessionDuration);

        return new CaseSessionDurationResponse(sessionDuration);
    }
}
