export class GetDocTypes {
    /** @type {KnexClientRepository} is initialized in the constructor */
    #repository;
    constructor(repository) {
        this.#repository = repository;
    }

    execute() {
        // SONAR-EXC: Se deja el TODO ya que es deuda tecnica que se resolverá a futuro
        return this.#repository.getDocTypes(); // TODO: tipar ejemplo DocTypesResponse
    }
}
