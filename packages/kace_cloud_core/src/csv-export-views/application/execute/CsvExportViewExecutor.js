import createDayjsInstance from '../../../shared/factories/DayjsFactory';

const dayjs = createDayjsInstance({});

export class CsvExportViewExecutor {
    constructor({ executionService, csvExportViewRepository }) {
        this.executionService = executionService;
        this.repository = csvExportViewRepository;
    }

    async execute(currentDate = dayjs()) {
        const pendingExports = await this.repository.findByNextExecutionAt(currentDate);

        const results = [];
        for (const exportView of pendingExports) {
            if (!exportView.isActive()) {
                continue;
            }
            const result = await this.executionService.execute(exportView);
            results.push({ id: exportView.id.value, ...result });
        }

        return results;
    }
}
