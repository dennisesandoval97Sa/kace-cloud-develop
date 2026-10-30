import { QUERY_KEYS } from "@kace_v2/shared/constants/query-keys.constants";
import { fetchOneScripts } from "@kace_v2/shared/services/oneScript.service";
import useSearchableSelectOptions from "@kace_v2/shared/hooks/useSearchableSelectOptions.hook";

const ONE_SCRIPT_ORDER = { direction: "asc", field: "name" };

const mapOneScript = (item) => ({
    label: item.name,
    value: item.id,
});

const useOneScriptOptions = (initialIds = [], pageSize = 50) => {
    const result = useSearchableSelectOptions({
        queryKey: QUERY_KEYS.ONE_SCRIPT.ROOT,
        fetchFn: fetchOneScripts,
        mapItem: mapOneScript,
        searchField: "name",
        initialIds,
        pageSize,
        order: ONE_SCRIPT_ORDER,
    });

    return {
        ...result,
        data: result.options,
    };
};

export default useOneScriptOptions;
