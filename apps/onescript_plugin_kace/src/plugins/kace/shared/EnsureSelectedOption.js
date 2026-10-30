/**
 * Ensures the selected value exists in the options list.
 * Supports object options ({ value, label }), string options, and custom shapes.
 *
 * @param {Array<any>} options
 * @param {*} selectedValue
 * @param {{
 *   getValue?: (option: any) => any,
 *   createTempOption?: (value: string) => any
 * }} [config]
 * @returns {Array<any>}
 */
export const ensureSelectedOption = (options, selectedValue, config = {}) => {
  try {
    const safeOptions = Array.isArray(options) ? options : [];

    if (
      selectedValue === null ||
      selectedValue === undefined ||
      selectedValue === ''
    ) {
      return safeOptions;
    }

    const normalizedSelected = String(selectedValue);
    const getValue =
      config.getValue ||
      ((option) => {
        if (option && typeof option === 'object') {
          return option.value;
        }

        return option;
      });

    const exists = safeOptions.some((option) => {
      const optionValue = getValue(option);

      if (optionValue === null || optionValue === undefined) {
        return false;
      }

      return String(optionValue) === normalizedSelected;
    });

    if (exists) {
      return safeOptions;
    }

    const createTempOption =
      config.createTempOption ||
      ((value) => ({
        label: value,
        value,
      }));

    return [...safeOptions, createTempOption(normalizedSelected)];
  } catch {
    return Array.isArray(options) ? options : [];
  }
};
