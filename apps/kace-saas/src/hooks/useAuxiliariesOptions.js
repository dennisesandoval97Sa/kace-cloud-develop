import { useMemo } from "react";
import { useQuery } from "@tanstack/react-query";
import useGenericViewQuery from "./useGenericViewQuery";
import useConfigAgentData from "./useConfigAgentData";
import { URL_AND_KEYS } from "@/utils/urlAndKeys";
import { getDataByProvider } from "@/utils/main";
import { generateAuxSelectOptions } from "@/utils/generateAuxSelectOptions";
import { useTranslation } from "react-i18next";

export const fetchRulesBySchema = async (schema_id) => {
    const response = await getDataByProvider(`/schemas/${schema_id}/rules`);
    return response.data;
};

const useSchemaRules = (schema_id, enabled = true) => {
    return useQuery({
        queryKey: ["schemaRules", schema_id],
        queryFn: () => fetchRulesBySchema(schema_id),
        staleTime: 1000 * 60 * 10,
        enabled: enabled && !!schema_id,
    });
};

/**
 * Builds the auxiliary field option lists (aux_cases / aux_clients / aux_users / aux_groups).
 *
 * @param {boolean} [includeModel=true] - Whether to prefix option values with the aux model name.
 * @param {Function|Object} [filterFnOrOptions] - Optional leaf filter function or options object.
 * @param {Object} [options] - Options object when a filter function is supplied as 2nd argument.
 * @param {boolean} [options.includeArrays=true] - Whether to descend into and emit array fields.
 */
const useAuxiliariesOptions = (includeModel = true, filterFnOrOptions, options = {}) => {
    const filterFn = typeof filterFnOrOptions === "function" ? filterFnOrOptions : undefined;
    const resolvedOptions =
        typeof filterFnOrOptions === "object" && filterFnOrOptions !== null ? filterFnOrOptions : options;
    const { includeArrays = true } = resolvedOptions;

    const { t } = useTranslation();
    const { sessionTime } = useConfigAgentData();
    const { groupsConfig } = useConfigAgentData();
    const {
        data: auxiliariesList = [],
        isLoading: auxiliariesListIsLoading,
        isFetching: auxiliariesListIsFetching,
    } = useGenericViewQuery({
        url: URL_AND_KEYS.auxDefinitions.url,
        keyQuery: ["auxiliariesList"],
    });
    const schemaData = useMemo(
        () => auxiliariesList.filter((item) => item.name === "cases" || item.name === "clients"),
        [auxiliariesList],
    );

    const casesSchema = useMemo(() => schemaData.find((s) => s.name === "cases"), [schemaData]);
    const clientsSchema = useMemo(() => schemaData.find((s) => s.name === "clients"), [schemaData]);
    const userSchemaId = sessionTime?.users_schema_id;
    const groupsSchemaId = groupsConfig?.groups_schema_id;
    const casesRules = useSchemaRules(casesSchema?.schema_id, !!casesSchema);
    const clientsRules = useSchemaRules(clientsSchema?.schema_id, !!clientsSchema);
    const usersRules = useSchemaRules(userSchemaId, !!userSchemaId);
    const groupsRules = useSchemaRules(groupsSchemaId, !!groupsSchemaId);
    const rulesData = useMemo(() => {
        return {
            cases: casesRules.data ?? [],
            clients: clientsRules.data ?? [],
            users: usersRules.data ?? [],
            groups: groupsRules.data ?? [],
        };
    }, [casesRules.data, clientsRules.data, usersRules.data, groupsRules.data]);

    const isLoading = useMemo(
        () => casesRules.isLoading || clientsRules.isLoading || usersRules.isLoading || groupsRules.isLoading,
        [casesRules.isLoading, clientsRules.isLoading, usersRules.isLoading, groupsRules.isLoading],
    );
    const isError = useMemo(
        () => casesRules.isError || clientsRules.isError || usersRules.isError || groupsRules.isError,
        [casesRules.isError, clientsRules.isError, usersRules.isError, groupsRules.isError],
    );

    const auxiliariesRules = useMemo(() => {
        if ((!schemaData.length && !userSchemaId) || isLoading || isError) return [];

        const rules = [];

        if (casesRules.data && casesSchema) {
            rules.push({
                dataOrigin: "aux_cases",
                options: generateAuxSelectOptions(
                    {
                        ...casesRules.data,
                        aux_table_name: casesSchema.name,
                    },
                    t,
                    includeModel ? "aux_cases" : undefined,
                    filterFn,
                    { includeArrays },
                ),
            });
        }

        if (clientsRules.data && clientsSchema) {
            rules.push({
                dataOrigin: "aux_clients",
                options: generateAuxSelectOptions(
                    {
                        ...clientsRules.data,
                        aux_table_name: clientsSchema.name,
                    },
                    t,
                    includeModel ? "aux_clients" : undefined,
                    filterFn,
                    { includeArrays },
                ),
            });
        }

        if (usersRules.data && userSchemaId) {
            rules.push({
                dataOrigin: "aux_users",
                options: generateAuxSelectOptions(
                    {
                        ...usersRules.data,
                        aux_table_name: "users",
                    },
                    t,
                    includeModel ? "aux_users" : undefined,
                    filterFn,
                    { includeArrays },
                ),
            });
        }
        if (groupsRules.data && groupsSchemaId) {
            rules.push({
                dataOrigin: "aux_groups",
                options: generateAuxSelectOptions(
                    {
                        ...groupsRules.data,
                        aux_table_name: "groups",
                    },
                    t,
                    includeModel ? "aux_groups" : undefined,
                    filterFn,
                    { includeArrays },
                ),
            });
        }

        return rules;
    }, [
        casesRules.data,
        clientsRules.data,
        usersRules.data,
        groupsRules.data,
        casesSchema,
        clientsSchema,
        userSchemaId,
        groupsSchemaId,
        isLoading,
        isError,
        t,
        includeModel,
        filterFn,
        includeArrays,
    ]);
    return {
        auxiliariesRules,
        rulesData,
        loading: isLoading || auxiliariesListIsLoading || auxiliariesListIsFetching,
    };
};

export default useAuxiliariesOptions;
