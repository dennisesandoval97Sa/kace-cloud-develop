import { BOARDS_OPTIONS } from "@kace_v2/features/boards/constants/boards.constants";

export const optionsTypeOptions = () => {
    return Object.entries(BOARDS_OPTIONS.TYPES).map(([label, value]) => ({
        label,
        value,
    }));
};
