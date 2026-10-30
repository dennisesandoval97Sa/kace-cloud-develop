import { FORMATS_TYPE } from "@kace_v2/shared/constants/formats.constants";

export const getFormatOptions = (type) => {
    const formats = FORMATS_TYPE[type];
    if (!formats) return [];

    return Object.entries(formats).map(([label, value]) => ({ label, value }));
};
