export class ProcessWorkspacePriorityReorderOnRequested {
    #processor;

    constructor(processor) {
        this.#processor = processor;
    }

    async handle(event) {
        return this.#processor.execute(event.payload.operationId);
    }
}
