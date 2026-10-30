import {
    filterOptionsByLabel,
    mapRawItemsToOptions,
    sortOptionsAlphabetically,
} from "@/components/ui-shared/src/components/selectByProvider/selectByProviderOptions";

export const buildGroupSelectOptions = (groups, searchTerm = "") =>
    filterOptionsByLabel(sortOptionsAlphabetically(mapRawItemsToOptions(groups)), searchTerm);
