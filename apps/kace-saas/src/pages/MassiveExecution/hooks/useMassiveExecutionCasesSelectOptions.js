import { URL_AND_KEYS } from "../../../utils/urlAndKeys";
import useGenericSearchQuery from "../../../hooks/useGenericSearchQuery";

const processActionsData = (data) => {
    return data.data.map(({ id, description }) => ({
        id,
        value: description,
        label: description,
    }));
};

const useMassiveExecutionCasesSelectOptions = () => {
    const { data: actionsData, isLoading: actionsLoading } =
        useGenericSearchQuery({
            url: `${URL_AND_KEYS.actions.url}/search`,
            keyQuery: URL_AND_KEYS.actions.key,
            select: processActionsData,
        });

    return { actionsData, actionsLoading };
};

export default useMassiveExecutionCasesSelectOptions;
