import { Helper } from '../../infrastructure/utils/Helper';
import { ArrayMerger } from '../utilities/ArrayMerger';
import { NestedValueManager } from '../utilities/NestedValueManager';

export class GlobalContext {
    #globalContext;

    constructor() {
        this.#globalContext = {
            context: {},
        };
    }

    get() {
        return this.#globalContext;
    }

    getByFilterInput(filterInput) {
        try {
            return this.#findByFilterInput(filterInput, this.#globalContext.context);
        } catch (error) {
            Helper.logError('failed to process data with filter input', error);
            throw new Error(`Fail to process data with filter input`);
        }
    }

    addDataProcessedToGlobalContext(contextPosition, data) {
        try {
            Helper.logDebug('Context position:', contextPosition);
            Helper.logDebug('Data to add:', data);
            // Fix: se usaba `!data` que descartaba valores falsy válidos (null, 0, false, "").
            // Solo se debe ignorar cuando el dato es genuinamente inexistente (undefined).
            if (data === undefined) return;
            let context = this.#globalContext.context;
            const value = NestedValueManager.getValue(context, contextPosition);
            if (Array.isArray(value)) {
                data = ArrayMerger.addOrMerge(value, data);
            }
            NestedValueManager.setValue(context, contextPosition, data);
        } catch (error) {
            Helper.logError('Failed to add data to Global Context', error);
        }
    }

    processDataReceived(filterInput, context_position, data) {
        try {
            const { dataProcessed } = this.#findByFilterInput(filterInput, data);

            this.addDataProcessedToGlobalContext(context_position, dataProcessed);
        } catch (error) {
            Helper.logError('Failed to processed data httpResponse to Global Context', error);
            throw new Error(`Fail to process data`);
        }
    }

    #updateProcessedData(acc, outputKey, value) {
        value = value === null || typeof value !== 'object' ? value : JSON.parse(JSON.stringify(value));

        if (!acc.dataProcessed || Object.keys(acc.dataProcessed).length === 0) {
            acc.dataProcessed =
                Array.isArray(value) || (value && typeof value === 'object') ? value : { [outputKey]: value };
            return;
        }

        if (typeof acc.dataProcessed !== 'object' || Array.isArray(acc.dataProcessed)) {
            acc.dataProcessed = { [outputKey]: value };
            return;
        }

        if (acc.dataProcessed.hasOwnProperty(outputKey)) {
            const existingValue = acc.dataProcessed[outputKey];
            if (Array.isArray(existingValue)) {
                acc.dataProcessed[outputKey].push(value);
            } else {
                acc.dataProcessed[outputKey] = [existingValue, value];
            }
        } else {
            acc.dataProcessed[outputKey] = value;
        }
    }

    #findByFilterInput(filterInput, data) {
        return filterInput.reduce(
            (acc, path) => {
                const segments = path.split('.');

                const value = segments.reduce((dataAcc, segment) => {
                    if (!dataAcc || typeof dataAcc !== 'object') {
                        return dataAcc;
                    }
                    const arrayMatch = segment.match(/^(\w+)\[(\d+)\]$/);

                    if (arrayMatch) {
                        const [, prop, index] = arrayMatch;
                        if (Array.isArray(dataAcc[prop])) {
                            return dataAcc[prop][parseInt(index)] || undefined;
                        } else {
                            return dataAcc[prop]?.data?.[parseInt(index)] || undefined;
                        }
                    }

                    return dataAcc[segment];
                }, data);

                let outputKey = path
                    .split('.')
                    .at(-1)
                    .replace(/\[\d+\]$/, '');

                if (value !== undefined) {
                    this.#updateProcessedData(acc, outputKey, value);
                    acc.resolved = true;
                }

                return acc;
            },
            { dataProcessed: {}, resolved: false }
        );
    }
}
