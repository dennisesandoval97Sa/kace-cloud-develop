import { Mapper } from '../../domain/Mapper.js';
import { MapperRule } from '../../domain/MapperRule.js';
import { DomainMapperFinder } from '../../domain/DomainMapperFinder.js';
import { ValidationService } from '../../domain/ValidationService.js';
import { CustomError, ValueObjectUuid, Helper } from '../../../shared/index.js';

export class MapperCreator {
    /** @type {KnexMapperRepository} repository */
    #repository;

    /** @type {ValidationService} */
    #validationService;

    /** @type {DomainMapperFinder} */
    #mapperFinder;

    /**
     * @param {KnexMapperRepository} repository - repository implementing create, findById, findByName, saveHistory
     */
    constructor(repository) {
        this.#repository = repository;
        this.#validationService = new ValidationService(repository);
        this.#mapperFinder = new DomainMapperFinder(repository);
    }

    /**
     * Create a new Mapper with its rules and persist it.
     * Validates mapper and each rule using domain value objects.
     * @param {Object} dto
     */
    async execute(dto) {
        const mapper = Mapper.create(dto);
        const mapperId = mapper.id ? mapper.id : ValueObjectUuid.random();

        if (mapper.id) {
            const found = await this.#mapperFinder.execute(mapper.id);
            if (found) throw new CustomError(`Mapper with id ${mapper.id} already exists`, 400);
        }

        await this.#validationService.validateMapperNameUnique(mapper.name);

        const validatedRules = [];
        for (const r of dto.rules || []) {
            const ruleDto = { ...r, mapper_id: mapperId, id: r.id ?? ValueObjectUuid.random() };
            const rule = MapperRule.create(ruleDto);
            validatedRules.push(rule);
        }

        const dtoToCreate = { ...dto, id: mapperId, rules: validatedRules };

        const result = await this.#repository.create(dtoToCreate);

        if (this.#repository.saveHistory) {
            try {
                await this.#repository.saveHistory(mapper);
            } catch (e) {
                Helper.logError(e);
                // ignore history save failures for now
            }
        }

        return result;
    }
}
