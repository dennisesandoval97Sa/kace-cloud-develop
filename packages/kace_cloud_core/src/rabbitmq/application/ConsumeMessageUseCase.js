export class ConsumeMessageUseCase {
    constructor({ mapperRepository, flowExecutor }) {
        this.mapperRepository = mapperRepository;
        this.flowExecutor = flowExecutor; // service to trigger rest_flow_id
    }

    async execute({ connectionId, message }) {
        const mappers = await this.mapperRepository.findByConnectionId(connectionId);
        if (!mappers || mappers.length === 0) return { executed: 0 };

        let executed = 0;
        for (const mapper of mappers) {
            const mapped = {};
            for (const rule of mapper.rules) {
                const value = rule.source_field
                    .split('.')
                    .reduce((acc, key) => (acc ? acc[key] : undefined), message);
                mapped[rule.target_field] = value;
            }

            if (this.flowExecutor && mapper.rest_flow_id) {
                await this.flowExecutor.execute({ external_code: mapper.rest_flow_id, initial_context: mapped });
                executed += 1;
            }
        }

        return { executed };
    }
}
