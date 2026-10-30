import { filterDeleted, orderFilter } from "../../../services/genericFilter";

export const filterStates = {
    filter: [
        filterDeleted,
    ],
    order: orderFilter,
};
