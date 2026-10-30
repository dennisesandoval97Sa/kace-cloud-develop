export const QUICK_ANS_FILTER_LEVELS = [1, 2, 3];

export const QUICK_ANS_FILTER_LABEL_MAX_LENGTH = 50;

export const QUICK_ANS_FILTER_HEX_COLOR_REGEX = /^#[0-9a-fA-F]{6}$/;

export const QUICK_ANS_FILTER_DEFAULT_VALUE = Object.freeze({
    enabled: false,
    ans_column_alias: '',
    labels: { 1: '', 2: '', 3: '' },
    use_default_colors: true,
    colors: { 1: '', 2: '', 3: '' },
});
