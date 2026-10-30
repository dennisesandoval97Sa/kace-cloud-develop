import { QUERY_KEYS } from "@kace_v2/shared/constants/query-keys.constants";
import { fetchActions } from "@kace_v2/shared/services/actions.service";
import useSearchableSelectOptions from "@kace_v2/shared/hooks/useSearchableSelectOptions.hook";

const ACTION_ORDER = { direction: "asc", field: "description" };

const mapAction = (item) => ({
    label: item.description,
    value: item.id,
});

const useActionsOptions = (initialIds = [], pageSize = 50) =>
    useSearchableSelectOptions({
        queryKey: QUERY_KEYS.ACTIONS.ROOT,
        fetchFn: fetchActions,
        mapItem: mapAction,
        searchField: "description",
        initialIds,
        pageSize,
        order: ACTION_ORDER,
    });

export default useActionsOptions;
