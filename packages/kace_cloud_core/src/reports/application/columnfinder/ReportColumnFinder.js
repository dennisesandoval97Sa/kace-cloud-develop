
import { CustomError, Helper } from '../../../shared/index.js';
import { KnexReportsViewRepository } from '../../infrastructure/persistence/KnexReportsViewRepository.js';
import { ReportColumnResponse } from '../ReportColumnResponse.js';

export class ReportColumnFinder {
	/** @type {KnexReportsViewRepository} */
	#reportViewRepository;

	/**
	 * @param {object} reportViewRepository - Repository able to fetch view columns (has `getViewColumns(report)`)
	 */
	constructor(reportViewRepository) {
		this.#reportViewRepository = reportViewRepository;
	}

	/**
	 * Executes column finding for a given report definition.
	 *
	 * @param {object} report - Report descriptor passed to repository (usually contains `vista` or view name)
	 * @returns {Promise<ReportColumnResponse>} response containing `columns: string[]`
	 */
	async execute(report) {
		if (!report) {
			throw new CustomError('Report payload is required', 400);
		}

		const columns = await this.#reportViewRepository.getViewColumns(report);		
		// Normalize to array even if repository returns null
		return new ReportColumnResponse(Array.isArray(columns) ? columns : (columns || []));
	}
}
