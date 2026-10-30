export class FindAllCases {
    constructor(repository) {
        this.repository = repository;
    }

    execute() {
        return this.repository.findAll();
    }
}
