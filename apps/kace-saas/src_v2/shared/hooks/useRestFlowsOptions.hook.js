import { QUERY_KEYS } from "@kace_v2/shared/constants/query-keys.constants";
import { fetchRestFlows } from "@kace_v2/shared/services/restflows.service";
import { filterByIsPrimary } from "@/utils/genericFilters";
import useSearchableSelectOptions from "@kace_v2/shared/hooks/useSearchableSelectOptions.hook";

const REST_FLOW_EXTRA_FILTERS = [filterByIsPrimary];
const REST_FLOW_ORDER = { direction: "asc", field: "description" };

const mapRestFlow = (item) => ({
    label: item.description,
    value: item.id,
});

const useRestFlowsOptions = (initialIds = [], pageSize = 50) =>
    useSearchableSelectOptions({
        queryKey: QUERY_KEYS.REST_FLOWS.ROOT,
        fetchFn: fetchRestFlows,
        mapItem: mapRestFlow,
        extraFilters: REST_FLOW_EXTRA_FILTERS,
        searchField: "description",
        initialIds,
        pageSize,
        order: REST_FLOW_ORDER,
    });

export default useRestFlowsOptions;
