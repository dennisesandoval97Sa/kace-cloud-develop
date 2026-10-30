import { ValidationFailError } from '../../shared/index.js';
import { CSV_EXPORT_VIEW_NOT_FOUND } from '@kace/error-codes';
import { ValueObjectViews } from './value-objects/ValueObjectViews';

export class CsvExportViewValidationService {
    /**
     * Creates an instance of the CsvExportViewValidationService.
     *
     * @param {KnexCsvExportViewRepository} viewRepository - A repository instance used to retrieve available views from the database.
     */
    constructor(viewRepository) {
        this.viewRepository = viewRepository;
    }

    /**
     * Validates that all requested view names exist in the available views.
     *
     * @param {ValueObjectViews} requestedViews - Object containing an array of view names to validate.
     * @returns {Promise<boolean>} - Resolves `true` if all views are valid.
     * @throws {ValidationFailError} - If `requestedViews` is not a `ValueObjectViews` instance, or if any view is invalid.
     */
    async execute(requestedViews) {
        if (!(requestedViews instanceof ValueObjectViews)) {
            throw new ValidationFailError(
                'Invalid views parameter: must be a ValueObjectViews instance',
                'requestedViews'
            );
        }

        const requestedViewNames = requestedViews.value;
        const availableViews = await this.viewRepository.getViews();
        const invalidViews = requestedViewNames.filter((viewName) => !availableViews.includes(viewName));

        if (invalidViews.length > 0) {
            throw new ValidationFailError(
                `The following views do not exist: ${invalidViews.join(', ')}`,
                'views',
                [],
                CSV_EXPORT_VIEW_NOT_FOUND
            );
        }

        return true;
    }
}
