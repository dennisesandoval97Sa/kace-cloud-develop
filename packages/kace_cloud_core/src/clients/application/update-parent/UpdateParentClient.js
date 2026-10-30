import { ValueObjectUuid } from '../../../shared/domain/value-object/ValueObjectUuid';
import { ValueObjectUuidNullable } from '../../../shared/domain/value-object/ValueObjectUuidNullable';
import { FindClient } from '../find';

export class UpdateParentClient {
    // SONAR-EXC: Se deja el TODO ya que es deuda tecnica que se resolverá a futuro
    // TODO: Independizar cliente natural y cliente comercial (persona fisica y persona moral)
    /** @type {KnexClientRepository} is initialized in the constructor */
    #repository;
    constructor(repository) {
        this.#repository = repository;
    }

    async execute(padreId, id) {
        id = new ValueObjectUuid(id);
        padreId = new ValueObjectUuidNullable(padreId);

        const clientFinder = await new FindClient(this.#repository).execute(id.get());
        const clientToUpdate = clientFinder.updateParent(padreId);

        return this.#repository.update(clientToUpdate.toPrimitives(), id.get());
    }
}
