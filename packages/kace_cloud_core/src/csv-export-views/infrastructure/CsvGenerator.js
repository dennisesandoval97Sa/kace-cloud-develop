import fs from 'fs';
import { Helper, ValidationFailError } from '../../shared';
import { ValueObjectCsvFormatting } from '../domain/value-objects/ValueObjectCsvFormatting';

export class CsvGenerator {
    /** @type {Object} is initialized in the constructor */
    #config;

    /**
     * Constructor de la clase CsvGenerator
     * @param {Object} options - Opciones de configuración
     */
    constructor(options = {}) {
        this.#config = new ValueObjectCsvFormatting(options).value;
    }

    /**
     * Configura opciones específicas después de la instanciación
     * @param {Object} options - Opciones de configuración a actualizar
     * @returns {CsvGenerator} - Instancia actual para encadenar métodos
     */
    setOptions(options = {}) {
        this.#config = new ValueObjectCsvFormatting(options).value;
        return this;
    }

    /**
     * Obtiene la configuración actual
     * @returns {Object} Configuración actual
     */
    getConfig() {
        return { ...this.#config };
    }

    /**
     * Genera un archivo CSV a partir de un conjunto de datos
     * @param {Array<Object>} data - Datos a incluir en el CSV
     * @param {string} fileName - Nombre del archivo a generar (sin extensión)
     * @param {string} [outputDir='/tmp'] - Directorio de salida para el archivo
     * @returns {string} Ruta del archivo generado
     */
    generate(data, fileName, outputDir = '/tmp') {
        if (!fileName || typeof fileName !== 'string') {
            throw new ValidationFailError(`"Filename" is required`, 'fileName');
        }

        const filePath = `${outputDir}/${fileName}.csv`;

        if (!Array.isArray(data) || data.length === 0) {
            this.#writeFile(filePath, '');
            Helper.logInfo(`Archivo CSV vacío generado para ${fileName} en: ${filePath}`);
            return filePath;
        }

        const fileContent = this.generateCsvContent(data);

        this.#writeFile(filePath, fileContent);
        return filePath;
    }

    /**
     * Escribe el contenido en un archivo
     * @param {string} filePath - Ruta completa del archivo
     * @param {string} content - Contenido a escribir
     * @private
     */
    #writeFile(filePath, content) {
        try {
            fs.writeFileSync(filePath, content, { encoding: this.#config.encoding });
            Helper.logInfo(`Archivo CSV generado en: ${filePath}`);
        } catch (error) {
            const errorMessage = error instanceof Error ? error.message : String(error);
            Helper.logError(`Error al escribir el archivo CSV: ${errorMessage}`);
            throw new Error(`No se pudo escribir el archivo CSV: ${errorMessage}`);
        }
    }

    /**
     * Genera el contenido del archivo CSV sin escribirlo a disco
     * @param {Array<Object>} data - Datos a procesar
     * @returns {string} Contenido del archivo CSV
     */
    generateCsvContent(data) {
        if (!Array.isArray(data) || data.length === 0) {
            return '';
        }

        const headers = Object.keys(data[0]);

        const lines = [];

        if (this.#config.includeHeader) {
            lines.push(this.#processHeaders(headers));
        }

        for (const row of data) {
            lines.push(this.#processRow(row, headers));
        }

        return lines.join(this.#config.lineTerminator);
    }

    /**
     * Procesa los encabezados del CSV
     * @param {Array<string>} headers - Lista de encabezados
     * @returns {string} Línea de encabezados formateada
     * @private
     */
    #processHeaders(headers) {
        return headers
            .map((header) => {
                if (
                    header.includes('"') ||
                    header.includes(this.#config.separator) ||
                    header.includes('\n') ||
                    header.includes('\r')
                ) {
                    header = header.replace(/"/g, '""');
                    return `"${header}"`;
                }

                if (this.#config.headerQuotes) {
                    header = header.replace(/"/g, '""');
                    return `"${header}"`;
                }

                return header;
            })
            .join(this.#config.separator);
    }

    /**
     * Procesa una fila de datos
     * @param {Object} row - Objeto con los datos de la fila
     * @param {Array<string>} headers - Lista de encabezados para mantener el orden
     * @returns {string} Línea formateada para el CSV
     * @private
     */
    #processRow(row, headers) {
        return headers
            .map((header) => {
                const rawValue = row[header];
                const value = this.#formatValue(rawValue);

                if (this.#config.valueQuotes) {
                    return this.#quoteValue(value);
                }
                return value;
            })
            .join(this.#config.separator);
    }

    /**
     * Formatea un valor para el CSV
     * @param {any} value - Valor a formatear
     * @returns {string} Valor formateado como string
     * @private
     */
    #formatValue(value) {
        if (value === null || value === undefined) {
            return this.#config.nullValue;
        }
        return String(value);
    }

    /**
     * Pone comillas alrededor de un valor si es necesario
     * @param {string} value - Valor a entrecomillar
     * @returns {string} Valor entrecomillado si es necesario
     * @private
     */
    #quoteValue(value) {
        if (
            value.includes('"') ||
            value.includes(this.#config.separator) ||
            value.includes('\n') ||
            value.includes('\r')
        ) {
            value = value.replace(/"/g, '""');
            return `"${value}"`;
        }

        if (this.#config.valueQuotes || this.#config.headerQuotes) {
            value = value.replace(/"/g, '""');
            return `"${value}"`;
        }

        return value;
    }

    /**
     * Método estático para crear una instancia con la configuración por defecto
     * @returns {CsvGenerator} Nueva instancia de CsvGenerator
     */
    static create() {
        return new CsvGenerator();
    }

    /**
     * Método estático para crear una instancia con configuración personalizada
     * @param {Object} options - Opciones de configuración
     * @returns {CsvGenerator} Nueva instancia de CsvGenerator
     */
    static createWithOptions(options) {
        return new CsvGenerator(options);
    }
}
