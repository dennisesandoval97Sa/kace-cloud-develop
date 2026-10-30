import { CsvGenerator } from '../infrastructure/CsvGenerator';
import { Helper } from '../../shared';
import createDayjsInstance from '../../shared/factories/DayjsFactory';

const dayjs = createDayjsInstance({});

export class CsvExportViewExecutionService {
    constructor({ csvExportViewRepository, s3StorageService }) {
        this.csvExportViewRepository = csvExportViewRepository;
        this.s3StorageService = s3StorageService;
    }

    /**
     *
     * @param {import ('./CsvExportView').CsvExportView } csvExportView
     * @param {dayjs} currentDate
     * @returns
     */
    calculateNextExecution(csvExportView, currentDate = dayjs()) {
        const { frequency, interval } = csvExportView;

        if (!frequency.value || !interval.value) {
            Helper.logInfo('calculateNextExecution: Frequency or interval missing');
            return null;
        }

        const frequencyMap = {
            hours: 'hour',
            days: 'day',
            weeks: 'week',
            months: 'month',
        };

        const unit = frequencyMap[frequency.value];

        if (!unit) {
            Helper.logInfo('calculateNextExecution: Invalid frequency value', { frequency: frequency.value });
            return null;
        }

        currentDate = currentDate.startOf('hour');
        Helper.logInfo('calculateNextExecution: Next execution calculated', { currentDate: currentDate.format() });
        return currentDate.add(interval.value, unit);
    }

    /**
     *
     * @param {import ('./CsvExportView').CsvExportView } csvExportView
     * @param {boolean} isManual
     * @returns
     */
    async execute(csvExportView, isManual = false, filterDate = null) {
        const currentDate =
            filterDate && typeof filterDate === 'string'
                ? dayjs(filterDate).set('hour', 23).set('minute', 59).set('second', 59)
                : dayjs();

        Helper.logInfo('execute: Execution started', { currentDate: currentDate.format(), isManual });

        if (!isManual) {
            csvExportView.last_execution_at = currentDate.startOf('hour').toISOString();
            csvExportView.next_execution_at = this.calculateNextExecution(csvExportView, currentDate).toISOString();
            await this.csvExportViewRepository.update(csvExportView);
            Helper.logDebug('execute: Next execution calculated and updated', {
                last_execution_at: csvExportView.last_execution_at,
                next_execution_at: csvExportView.next_execution_at
            });
        }

        const views = csvExportView.views.value;
        const storagePath = csvExportView.storage_path.value ? `${csvExportView.storage_path.value}/` : '';
        const files = {};

        const config = csvExportView.details.value?.formatting;
        const csvGenerator = CsvGenerator.createWithOptions(config);

        await Promise.all(
            views.map(async (view) => {
                Helper.logInfo('execute: Processing view', { view });
                const data = await this.csvExportViewRepository.fetchViewData(
                    view,
                    csvExportView.time_filter,
                    filterDate
                );
                const tempFilePath = csvGenerator.generate(data, view);

                if (!tempFilePath) {
                    files[view] = {
                        error: `Error while querying the view: File was not generated`,
                        recordCount: 0,
                    };
                    return;
                }

                const fileName = `${currentDate.format('YYYYMMDD_HHmmss')}_${view}.csv`;
                const destinationPath = `reporting/${storagePath}${fileName}`;

                try {
                    await this.s3StorageService.uploadFile(tempFilePath, destinationPath);

                    const recordCount = data.length;
                    files[view] = {
                        s3Location: destinationPath,
                        recordCount: recordCount,
                    };
                } catch (error) {
                    files[view] = {
                        error: `Error uploading file to S3: ${error.message}`,
                        recordCount: 0,
                    };
                    Helper.logInfo('execute: S3 upload failed', { view, error: files[view].error });
                }
            })
        );

        const totalRecords = Object.values(files).reduce((sum, item) => sum + (item.recordCount || 0), 0);
        Helper.logInfo('execute: Execution completed', { totalRecords, processedViews: views });

        const result = {
            files: files,
            processedViews: views,
            totalRecords,
        };

        if (filterDate) {
            result.filterDate = currentDate.format('YYYY-MM-DD');
        }

        return result;
    }
}
