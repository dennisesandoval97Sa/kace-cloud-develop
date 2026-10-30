/* eslint-disable no-console */

/**
 * Writes a line to stdout.
 *
 * @param {string} message - The message to print.
 * @returns {void}
 */
export const logInfo = (message) => console.log(message);

/**
 * Writes a line to stderr.
 *
 * @param {string} message - The message to print.
 * @returns {void}
 */
export const logError = (message) => console.error(message);
