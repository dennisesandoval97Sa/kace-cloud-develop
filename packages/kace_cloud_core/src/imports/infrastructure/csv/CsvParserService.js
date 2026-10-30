import csv from 'csv-parser';
import { Readable } from 'stream';

export class CsvParserService {
    /**
     * Detecta el delimitador del archivo CSV dinámicamente.
     * @param {string|Buffer} fileData
     * @returns {string} El delimitador: ',' o ';'
     */
    static detectDelimiter(fileData) {
        const sample = fileData.slice(0, 1024).toString();
        return sample.includes(';') ? ';' : ',';
    }

    /**
     * Parsea el contenido del CSV a un array de objetos.
     * @param {string|Buffer} fileData
     * @returns {Promise<Object[]>}
     */
    static async parse(fileData) {
        return new Promise((resolve, reject) => {
            const results = [];
            const stream = Readable.from(fileData);

            stream
                .pipe(csv({ separator: this.detectDelimiter(fileData) }))
                .on('data', (row) => results.push(row))
                .on('end', () => resolve(results))
                .on('error', (error) => reject(error instanceof Error ? error : new Error(String(error))));
        });
    }
}
