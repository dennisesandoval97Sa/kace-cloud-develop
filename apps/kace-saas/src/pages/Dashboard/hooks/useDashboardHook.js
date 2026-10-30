import { useEffect, useState } from "react";
import { useQuery } from "@tanstack/react-query";
import {
    COUNT_CASES_SERVICE,
    filterAllCases as filter,
} from "@kace/utils";
import { DEFAULT_CASES_STATES, FILTER_OBJECTS } from "../data/Constants";
import { genericView } from "../../../services/genericView";
import { useTranslation } from "react-i18next";
import useGenericSearchQuery from "../../../hooks/useGenericSearchQuery";
import { URL_AND_KEYS } from "../../../utils/urlAndKeys";
import { handleCountAns, handleFullName, handleState, handleStateTimer } from "../../../utils/main";
import useConfigAgentData from "@/hooks/useConfigAgentData";

const ColorsRandom = [
    "hover:bg-redCustom",
    "hover:bg-greenCustom",
    "hover:bg-yellowCustom",
    "hover:bg-blueCustom",
];

const chartColors = [
    "var(--red-custom)",
    "var(--green-custom)",
    "var(--yellow-custom)",
    "var(--blue-custom)",
];

const processData = (data) => {
    return handleStateTimer(handleCountAns(handleState(handleFullName(data.data))));
};

const useDashboardHook = () => {
    const { AgentNameFields } = useConfigAgentData();
    const [casesStates, setCasesStates] = useState(DEFAULT_CASES_STATES);
    const [allStates, setAllStates] = useState([]);
    const [searchFilter, setSearchFilter] = useState({ ...filter });
    const { t } = useTranslation();

    const { data: totalStates, isLoading: loadingTotalCases } = useQuery({
        queryKey: ["totalCasesByStates"],
        queryFn: async () => genericView(COUNT_CASES_SERVICE),
        refetchOnWindowFocus: false,
        staleTime: 1000 * 60 * 60,
        gcTime: 1000 * 60 * 60 * 2,
    });

    useGenericSearchQuery({
        url: `${URL_AND_KEYS.users.url}/search`,
        keyQuery: URL_AND_KEYS.users.key,
        select: processData,
    });

    function createArrayStates (stateCounts = []) {
        const countStatesArray = stateCounts
            .filter(state => state.count !== "0")
            .map((item, index) => {
                return {
                    name: item.nombre,
                    total: Number(item.count),
                    id: item.id,
                    color: ColorsRandom[index % ColorsRandom.length],
                    chartColor: chartColors[index % chartColors.length],
                    filter: [
                        {
                            field: AgentNameFields?.cases?.enable_custom_view ? "estado_actual" : "estados.id",
                            value: AgentNameFields?.cases?.enable_custom_view ? item.nombre : item.id,
                            type: "AND",
                            operator: "eq"
                        },
                        {
                            field: `${AgentNameFields?.cases?.enable_custom_view ? "" : "cases."}fecha_resolucion`,
                            value: "null",
                            type: "AND",
                            operator: "null"
                        }
                    ],
                };
            });
        return countStatesArray;
    }

    useEffect(() => {
        if (totalStates) {
            const { ans, states } = totalStates;
            const newData = Object.keys(ans).map((item, index) => {
                const filter = FILTER_OBJECTS.find(itemObj => itemObj.name === item);
                return {
                    id: index,
                    name: t(`text.${item}`),
                    total: ans[item],
                    filter,
                };
            });
            setCasesStates(newData);
            setAllStates(createArrayStates(states));
        }
    }, [totalStates]);
    return {
        searchFilter,
        setSearchFilter,
        casesStates,
        allStates,
        loadingTotalCases,
    };
};

export default useDashboardHook;
