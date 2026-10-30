import { InvalidArgumentError } from '../../shared/index.js';

/**
 * Representa un conjunto de recursos del board (consulta tabular)
 */
export class BoardResources {
  #rows;
  #total;

  /**
   * 
   * @param {Array<Object>} rows - Resultados obtenidos del query
   * @param {number} total - Total de registros
   */
  constructor(rows = [], total = 0) {
    if (!Array.isArray(rows)) {
      throw new InvalidArgumentError('Rows must be an array');
    }

    this.#rows = this.#normalizeKeys(rows);
    this.#total = total;
  }

  /**
   * Limpia las comillas dobles de los nombres de columnas

   */
  #normalizeKeys(rows) {
    return rows.map(row => {
      const normalized = {};
      for (const [key, value] of Object.entries(row)) {
        const cleanKey = key.replace(/(^")|("$)/g, '');
        normalized[cleanKey] = value;
      }
      return normalized;
    });
  }

  /**
   * Devuelve las filas procesadas
   * @returns {Array<Object>}
   */
  get rows() {
    return this.#rows;
  }

  /**
   * Devuelve la cantidad total de registros
   * @returns {number}
   */
  get total() {
    return this.#total;
  } 
}
