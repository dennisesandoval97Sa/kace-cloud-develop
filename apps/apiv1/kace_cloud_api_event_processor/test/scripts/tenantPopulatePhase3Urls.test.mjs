import { describe, it, expect } from '@jest/globals';
import { derivePerBcUrls } from '../../scripts/tenant-populate-phase3-urls.derive.mjs';

describe('derivePerBcUrls', () => {
    const legacyUrl = 'https://sqs.us-east-1.amazonaws.com/123456789012/DEVELOPMENT-events-queue.fifo';
    const base = 'https://sqs.us-east-1.amazonaws.com/123456789012';

    it('derives all seven per-BC queue URLs from the legacy events queue URL', () => {
        // Act
        const urls = derivePerBcUrls(legacyUrl);

        // Assert
        expect(urls).toEqual({
            cases: `${base}/DEVELOPMENT-cases-events-queue.fifo`,
            case_post_processing: `${base}/DEVELOPMENT-case-post-processing-events-queue.fifo`,
            action_jobs: `${base}/DEVELOPMENT-action-jobs-events-queue.fifo`,
            automated_actions: `${base}/DEVELOPMENT-automated-actions-events-queue.fifo`,
            ws_rest: `${base}/DEVELOPMENT-ws-rest-events-queue.fifo`,
            reports: `${base}/DEVELOPMENT-reports-events-queue.fifo`,
            imports: `${base}/DEVELOPMENT-imports-events-queue.fifo`,
        });
    });

    it('derives an imports URL matching the CDK queue-name slug', () => {
        // Act
        const urls = derivePerBcUrls(legacyUrl);

        // Assert — must mirror CDK: `${appsServiceName}-imports-events-queue.fifo`
        expect(urls.imports).toBe(`${base}/DEVELOPMENT-imports-events-queue.fifo`);
        expect(urls.imports.endsWith('-imports-events-queue.fifo')).toBe(true);
    });

    it('derives a reports URL matching the CDK queue-name slug', () => {
        // Act
        const urls = derivePerBcUrls(legacyUrl);

        // Assert — must mirror CDK: `${appsServiceName}-reports-events-queue.fifo`
        expect(urls.reports).toBe(`${base}/DEVELOPMENT-reports-events-queue.fifo`);
        expect(urls.reports.endsWith('-reports-events-queue.fifo')).toBe(true);
    });

    it('derives a case_post_processing URL matching the CDK queue-name slug', () => {
        // Act
        const urls = derivePerBcUrls(legacyUrl);

        // Assert — must mirror CDK: `${appsServiceName}-case-post-processing-events-queue.fifo`
        expect(urls.case_post_processing).toBe(`${base}/DEVELOPMENT-case-post-processing-events-queue.fifo`);
        expect(urls.case_post_processing.endsWith('-case-post-processing-events-queue.fifo')).toBe(true);
    });

    it('throws when the legacy URL does not match the expected pattern', () => {
        // Act + Assert
        expect(() => derivePerBcUrls('not-a-valid-url')).toThrow(/Cannot parse legacy queue URL/);
    });
});
