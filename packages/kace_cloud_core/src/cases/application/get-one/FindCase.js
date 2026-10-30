import { ValueObjectUuid } from '../../../shared/domain/value-object/ValueObjectUuid';

export class FindCase {
    constructor(repository) {
        this.repository = repository;
    }

    async execute(id) {
        id = new ValueObjectUuid(id).get();
        return this.repository.find(id);
    }
}
