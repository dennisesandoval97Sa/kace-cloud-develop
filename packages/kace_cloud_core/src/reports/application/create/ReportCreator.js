import path from 'node:path';
import { PassThrough } from 'node:stream';
import { Helper, TenantContext } from '../../../shared/index.js';
import createDayjsInstance from '../../../shared/factories/DayjsFactory.js';
import { S3Client, GetObjectCommand } from '@aws-sdk/client-s3';
import { GetPresignedUrl } from '../../../s3-files/application/get-presigned-url/GetPresignedUrl.js';

const dayjs = createDayjsInstance({});

/**
 * ReportCreator
 * - streams data from a DB view using a repository that exposes `streamViewDataWithConditions(report, period, conditions)`
 * - streams an Excel workbook via an ExcelExporter instance directly into a multipart S3 upload
 * - no local temp file and no full-dataset buffering: memory stays flat regardless of report size
 */
export class ReportCreator {
    /**
     * @param {{ reportViewRepository: any, excelExporter: any, s3StorageService: any }} deps
     */
    constructor({ reportViewRepository, excelExporter, s3StorageService }) {
        this.reportViewRepository = reportViewRepository;
        this.excelExporter = excelExporter;
        this.s3StorageService = s3StorageService;
    }

    /**
     * Execute report generation for a single view
     * @param {Object} dto - Report DTO with structure: { report: string, period: { field, initialDate, endDate }, conditions: Array }
     * @param {string} dto.report - DB view name to query
     * @param {Object} dto.period - Period filter with field, initialDate, endDate
     * @param {Array} dto.conditions - Array of conditions with { field, operator, value, type }
     * @param {string} storagePathPrefix - optional prefix for S3 destination
     * @param {Object} exportOptions - { title, columns } optional export overrides
     */
    async execute({ report, period, conditions = [] } = {}, storagePathPrefix = '', exportOptions = {}) {
        Helper.logInfo('ReportCreator.execute: Start', { report, period, conditions });

        try {
            // Stream rows from the view; peek the first row (if any) to infer columns the
            // same way the old buffered path did, without holding the full result set.
            const rowStream = this.reportViewRepository.streamViewDataWithConditions(report, period, conditions);
            const iterator = rowStream[Symbol.asyncIterator]();
            const firstResult = await iterator.next();

            let columns = exportOptions.columns;
            if (!columns || !Array.isArray(columns) || columns.length === 0) {
                let keys = [];

                if (!firstResult.done) {
                    keys = Object.keys(firstResult.value);
                    Helper.logInfo('ReportCreator: using columns inferred from first row', { report, keys });
                } else {
                    try {
                        Helper.logInfo('ReportCreator: no rows found, attempting getViewColumns', { report });
                        keys = await this.reportViewRepository.getViewColumns(report);
                        Helper.logInfo('ReportCreator: getViewColumns result', { report, keys });
                    } catch (e) {
                        Helper.logInfo('ReportCreator: getViewColumns failed', { report, error: e?.message ?? e });
                        keys = [];
                    }
                }

                columns = keys.map((k) => ({ key: k, header: k }));
            }

            columns = columns.filter((c) => {
                const key = String(c?.key ?? '');
                return !key.startsWith('filter_') && !key.startsWith('reporting_');
            });

            const title = exportOptions.title || `${report} ${dayjs().format('YYYY-MM-DD HH:mm:ss')}`;

            // Re-attach the already-consumed first row so no row is lost.
            const rows = (async function* () {
                try {
                    if (!firstResult.done) yield firstResult.value;
                    while (true) {
                        const next = await iterator.next();
                        if (next.done) return;
                        yield next.value;
                    }
                } finally {
                    await iterator.return?.();
                }
            })();

            // Prepare destination path
            const timestamp = dayjs().format('YYYYMMDD_HHmmss');
            const fileName = `${timestamp}_${report}.xlsx`;
            const storagePath = storagePathPrefix ? `${storagePathPrefix.replace(/\/$/, '')}/` : '';
            const destinationPath = `reporting/${storagePath}${fileName}`;

            // Wire the Excel stream writer directly into the S3 multipart upload (request
            // object caducity of 7 days) — no intermediate buffer or temp file.
            const passThrough = new PassThrough();
            const uploadPromise = this.s3StorageService.uploadStream(passThrough, destinationPath, {
                expiresInDays: 7,
                skipTagging: true,
            });
            uploadPromise.catch((err) => passThrough.destroy(err));

            let recordCount;
            let s3Location;
            try {
                ({ recordCount } = await this.excelExporter.generateStream({ columns, rows, title }, passThrough));
                s3Location = await uploadPromise;
            } catch (error) {
                passThrough.destroy(error);
                throw error;
            }

            // Prepare presigned URL for the uploaded object
            let presignedUrl = typeof s3Location === 'string' && s3Location.length ? s3Location : null;
            try {
                const tenant = TenantContext.getTenant();
                if (tenant) {
                    const s3Client = new S3Client({
                        region: tenant.aws_s3_region.value,
                        credentials: {
                            accessKeyId: tenant.aws_s3_access_key_id.value,
                            secretAccessKey: tenant.aws_s3_secret_access_key.value,
                        },
                    });

                    // Derive bucket and key from s3Location (expected format: s3://bucket/key)
                    let bucket = tenant.aws_s3_bucket.value;
                    let key = destinationPath;
                    if (typeof s3Location === 'string' && s3Location.startsWith('s3://')) {
                        const withoutPrefix = s3Location.replace('s3://', '');
                        const idx = withoutPrefix.indexOf('/');
                        if (idx > -1) {
                            bucket = withoutPrefix.substring(0, idx);
                            key = withoutPrefix.substring(idx + 1);
                        } else {
                            bucket = withoutPrefix;
                            key = '';
                        }
                    }

                    const getParams = { Bucket: bucket, Key: key };

                    try {
                        const ext = path.extname(destinationPath || '').toLowerCase();
                        const baseName = path.basename(destinationPath || fileName || key || 'file');
                        let responseContentType = 'application/octet-stream';
                        if (ext === '.xlsx') {
                            responseContentType = 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet';
                        } else if (ext === '.xls') {
                            responseContentType = 'application/vnd.ms-excel';
                        } else if (ext === '.csv') {
                            responseContentType = 'text/csv';
                        } else if (ext === '.pdf') {
                            responseContentType = 'application/pdf';
                        }
                        getParams.ResponseContentType = responseContentType;
                        getParams.ResponseContentDisposition = `attachment; filename="${baseName}"`;
                    } catch (e) {
                        Helper.logError(e);
                    }

                    const command = new GetObjectCommand(getParams);
                    const presigned = await new GetPresignedUrl(s3Client, command).execute();
                    presignedUrl = presigned?.uploadUrl ?? presignedUrl;
                }
            } catch (e) {
                Helper.logInfo('ReportCreator.execute: Could not generate presigned URL, using s3Location', {
                    error: e?.message,
                });
            }

            const result = {
                s3Location,
                presignedUrl,
                recordCount,
                destinationPath,
            };

            Helper.logInfo('ReportCreator.execute: Completed', result);

            return {
                ...result,
            };
        } catch (error) {
            Helper.logError('ReportCreator.execute: Error', error);
            throw error;
        }
    }
}

export default ReportCreator;
