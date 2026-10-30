import { URL_AND_KEYS } from "@/utils/urlAndKeys";
import { apiService } from "@kace/utils";

export const parseCustomListData = async (data) => {
    const aux_entity = data?.aux_entity || null;
    let schema_id;
    let aux_definition_id;
    const aux_items = data?.aux_items?.map((item) => ({
        id: item?.literal || "",
        literal: item?.literal || "",
        name: item?.literal || "",
        order: item?.order || 1,
    }));

    if (aux_entity) {
        // Try to resolve by tablename first, then fallback to name
        const searchBody = {
            filter: [
                {
                    field: "tablename",
                    operator: "eq",
                    type: "AND",
                    value: aux_entity,
                },
                {
                    field: "name",
                    operator: "eq",
                    type: "OR",
                    value: aux_entity,
                },
            ],
            limit: 0,
            offset: 0,
            relationship: null,
        };

        const { data: searchResponse } = await apiService.post(`${URL_AND_KEYS.auxDefinitions.url}/search`, searchBody);
        const items = searchResponse?.data?.items || [];
        // Validate exact match on tablename or name before assigning
        const auxDefinition = items.find((item) => item?.tablename === aux_entity) || items.find((item) => item?.name === aux_entity);
        schema_id = auxDefinition?.schema_id || "";
        aux_definition_id = auxDefinition?.id || "";
    }

    return {
        id: data?.id || "",
        name: data?.name || "",
        is_active: Boolean(data?.is_active),
        aux_entity,
        aux_items,
        groups: data?.groups || [],
        schema_id,
        aux_definition_id,
    };
};
