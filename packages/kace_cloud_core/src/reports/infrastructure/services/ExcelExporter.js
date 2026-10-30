import ExcelJS from 'exceljs';
import fs from 'node:fs';
import { Helper } from '@kace/core/src/shared/index.js';

/**
 * Simple Excel exporter using exceljs.
 *
 * Usage:
 * const exporter = new ExcelExporter({ sheetName: 'MyReport' });
 * const buffer = await exporter.generateBuffer({ columns, rows, title });
 * await exporter.saveToFile(buffer, '/tmp/report.xlsx');
 */
export class ExcelExporter {
    constructor({ sheetName = 'Report', creator = 'kace' } = {}) {
        this.sheetName = sheetName;
        this.creator = creator;
    }

    /**
     * Build a workbook from columns and rows and return a Buffer.
     * @param {{columns: Array<{key:string,header?:string,width?:number}>, rows: Array<Object>, title?:string}} options
     * @returns {Promise<Buffer>} xlsx buffer
     */
    async generateBuffer({ columns = [], rows = [], title = null } = {}) {
        try {
            const workbook = new ExcelJS.Workbook();
            workbook.creator = this.creator;
            workbook.created = new Date();

            const sheet = workbook.addWorksheet(this.sheetName);

            // We do not render a separate title row so headers always appear on the first row.
            const startRow = 1;

            // Setup header columns
            sheet.columns = columns.map((c) => ({ header: c.header || c.key, key: c.key, width: c.width || 20 }));

            // Add rows
            if (rows && rows.length) {
                sheet.addRows(rows);
            }

            // Style header
            const headerRow = sheet.getRow(startRow);
            headerRow.font = { bold: true };
            headerRow.alignment = { vertical: 'middle', horizontal: 'center' };
            headerRow.eachCell((cell) => {
                cell.fill = {
                    type: 'pattern',
                    pattern: 'solid',
                    fgColor: { argb: 'FFEEEEEE' },
                };
                cell.border = {
                    top: { style: 'thin' },
                    left: { style: 'thin' },
                    bottom: { style: 'thin' },
                    right: { style: 'thin' },
                };
            });

            // Auto-fit columns (simple approach)
            sheet.columns.forEach((column) => {
                let maxLength = 10;
                column.eachCell({ includeEmpty: true }, (cell) => {
                    const value = cell.value;
                    const len = value ? String(value).length : 0;
                    if (len > maxLength) maxLength = len;
                });
                column.width = Math.min(Math.max(column.width || 10, maxLength + 2), 50);
            });

            const buffer = await workbook.xlsx.writeBuffer();
            return Buffer.from(buffer);
        } catch (error) {
            Helper.logError('ExcelExporter.generateBuffer error', error);
            throw error;
        }
    }

    /**
     * Generate a workbook by streaming rows directly into `outputStream`, without ever
     * holding the full workbook or dataset in memory. `rows` may be any async iterable
     * (e.g. a knex `.stream()` Readable, or a plain array). Returns once the workbook has
     * been fully committed to the stream.
     *
     * Note: unlike generateBuffer, column auto-fit is based on a sample of the first 100 rows
     * (not the full dataset), since streaming can't buffer every row before writing the header.
     * @param {{columns: Array<{key:string,header?:string,width?:number}>, rows: AsyncIterable<Object>|Iterable<Object>, title?:string}} options
     * @param {import('stream').Writable} outputStream
     * @returns {Promise<{recordCount: number}>}
     */
    async generateStream({ columns = [], rows = [], title = null } = {}, outputStream) {
        const iterator = rows[Symbol.asyncIterator] ? rows[Symbol.asyncIterator]() : rows[Symbol.iterator]();
        try {
            const workbook = new ExcelJS.stream.xlsx.WorkbookWriter({
                stream: outputStream,
                useStyles: true,
                // Lower memory than the default (rows can use arbitrarily many distinct strings
                // without growing an in-memory shared-strings table), at the cost of file size.
                useSharedStrings: false,
            });
            workbook.creator = this.creator;
            workbook.created = new Date();

            const sheet = workbook.addWorksheet(this.sheetName);
            sheet.columns = columns.map((c) => ({ header: c.header || c.key, key: c.key, width: c.width || 20 }));

            const maxLengths = {};
            columns.forEach((c) => {
                maxLengths[c.key] = (c.header || c.key).length;
            });

            // Sample the first N rows to estimate column widths before the header row is
            // committed — exceljs writes <cols> to the stream at that point, so widths set
            // afterwards (i.e. after seeing all rows) have no effect in streaming mode.
            const SAMPLE_SIZE = 100;
            const sampledRows = [];
            for (let i = 0; i < SAMPLE_SIZE; i++) {
                const { value, done } = await iterator.next();
                if (done) break;
                sampledRows.push(value);
                columns.forEach((c) => {
                    const len = value[c.key] ? String(value[c.key]).length : 0;
                    if (len > maxLengths[c.key]) maxLengths[c.key] = len;
                });
            }

            columns.forEach((c, index) => {
                const col = sheet.getColumn(index + 1);
                col.width = Math.min(Math.max(c.width || 20, maxLengths[c.key] + 2), 50);
            });

            const headerRow = sheet.getRow(1);
            headerRow.font = { bold: true };
            headerRow.alignment = { vertical: 'middle', horizontal: 'center' };
            headerRow.eachCell((cell) => {
                cell.fill = {
                    type: 'pattern',
                    pattern: 'solid',
                    fgColor: { argb: 'FFEEEEEE' },
                };
                cell.border = {
                    top: { style: 'thin' },
                    left: { style: 'thin' },
                    bottom: { style: 'thin' },
                    right: { style: 'thin' },
                };
            });
            headerRow.commit();

            let recordCount = 0;
            for (const row of sampledRows) {
                sheet.addRow(row).commit();
                recordCount++;
            }
            while (true) {
                const { value, done } = await iterator.next();
                if (done) break;
                sheet.addRow(value).commit();
                recordCount++;
            }

            sheet.commit();
            await workbook.commit();

            return { recordCount };
        } catch (error) {
            outputStream.destroy(error);
            Helper.logError('ExcelExporter.generateStream error', error);
            throw error;
        } finally {
            await iterator.return?.();
        }
    }

    /**
     * Save buffer to file path
     * @param {Buffer} buffer
     * @param {string} filePath
     * @returns {Promise<void>}
     */
    async saveToFile(buffer, filePath) {
        try {
            await fs.promises.writeFile(filePath, buffer);
        } catch (error) {
            Helper.logError('ExcelExporter.saveToFile error', error);
            throw error;
        }
    }

    /**
     * Convenience method: generate and write to file
     */
    async generateToFile({ columns = [], rows = [], title = null } = {}, filePath) {
        const buffer = await this.generateBuffer({ columns, rows, title });
        await this.saveToFile(buffer, filePath);
        return filePath;
    }
}

export default ExcelExporter;
