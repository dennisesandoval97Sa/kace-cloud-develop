import os from 'node:os';
import path from 'node:path';
import fs from 'node:fs';
import { PassThrough } from 'node:stream';
import ExcelJS from 'exceljs';
import ExcelExporter from '../../src/reports/infrastructure/services/ExcelExporter.js';

describe('ExcelExporter', () => {
    test('generateBuffer returns a non-empty Buffer and generateToFile writes a file', async () => {
        const exporter = new ExcelExporter({ sheetName: 'TestSheet', creator: 'unit-test' });

        const columns = [
            { key: 'id', header: 'ID' },
            { key: 'name', header: 'Name' },
        ];
        const rows = [
            { id: 1, name: 'Alice' },
            { id: 2, name: 'Bob' },
        ];

        const buffer = await exporter.generateBuffer({ columns, rows, title: 'Test Report' });
        expect(Buffer.isBuffer(buffer)).toBe(true);
        expect(buffer.length).toBeGreaterThan(0);

        const tmpDir = os.tmpdir();
        const fileName = `test_excel_${Date.now()}.xlsx`;
        const filePath = path.join(tmpDir, fileName);

        await exporter.generateToFile({ columns, rows, title: 'Test Report' }, filePath);

        const exists = fs.existsSync(filePath);
        expect(exists).toBe(true);

        const stats = fs.statSync(filePath);
        expect(stats.size).toBeGreaterThan(0);

        // cleanup
        try {
            fs.unlinkSync(filePath);
        } catch (err) {
            // ignore
        }
    });

    test('generateStream writes a valid workbook incrementally and returns the row count', async () => {
        const exporter = new ExcelExporter({ sheetName: 'StreamSheet', creator: 'unit-test' });

        const columns = [
            { key: 'id', header: 'ID' },
            { key: 'name', header: 'Name' },
        ];
        const rows = [
            { id: 1, name: 'Alice' },
            { id: 2, name: 'Bob' },
            { id: 3, name: 'Carol' },
        ];

        async function* rowGenerator() {
            for (const row of rows) yield row;
        }

        const passThrough = new PassThrough();
        const chunks = [];
        passThrough.on('data', (chunk) => chunks.push(chunk));

        const result = await exporter.generateStream(
            { columns, rows: rowGenerator(), title: 'Stream Report' },
            passThrough
        );

        expect(result.recordCount).toBe(rows.length);

        const buffer = Buffer.concat(chunks);
        expect(buffer.length).toBeGreaterThan(0);

        const reader = new ExcelJS.Workbook();
        await reader.xlsx.load(buffer);
        const sheet = reader.worksheets[0];

        expect(sheet.name).toBe('StreamSheet');
        expect(sheet.rowCount).toBe(rows.length + 1); // + header row
        expect(sheet.getRow(1).getCell(1).value).toBe('ID');
        expect(sheet.getRow(1).getCell(2).value).toBe('Name');
        expect(sheet.getRow(2).getCell(1).value).toBe(1);
        expect(sheet.getRow(2).getCell(2).value).toBe('Alice');
        expect(sheet.getRow(4).getCell(2).value).toBe('Carol');
    });

    test('generateStream auto-fits column width to sampled row content', async () => {
        const exporter = new ExcelExporter({ sheetName: 'WidthSheet', creator: 'unit-test' });

        const columns = [
            { key: 'id', header: 'ID' },
            { key: 'name', header: 'Name' },
        ];
        const rows = [
            { id: 1, name: 'a'.repeat(35) },
            { id: 2, name: 'bb' },
        ];

        async function* rowGenerator() {
            for (const row of rows) yield row;
        }

        const passThrough = new PassThrough();
        const chunks = [];
        passThrough.on('data', (chunk) => chunks.push(chunk));

        await exporter.generateStream({ columns, rows: rowGenerator(), title: 'Width Report' }, passThrough);

        const buffer = Buffer.concat(chunks);
        const reader = new ExcelJS.Workbook();
        await reader.xlsx.load(buffer);
        const sheet = reader.worksheets[0];

        expect(sheet.getColumn(1).width).toBe(20);
        expect(sheet.getColumn(2).width).toBe(37);
    });
});
