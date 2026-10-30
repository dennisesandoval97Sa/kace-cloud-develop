import { useEffect, useMemo, useState, useRef } from "react";
import { useFormikContext } from "formik";
import PropTypes from "prop-types";
import MultiSelect from "@/componentsV2/core/MultiSelect";
import useDebounced from "@/hooks/useDebounced";
import useGenericSearchInfiniteQuery from "@/hooks/useGenericSearchInfiniteQuery";
import { URL_AND_KEYS } from "@/utils/urlAndKeys";
import { useTranslation } from "react-i18next";
import { filterByIsPrimary } from "@/utils/genericFilters";

const RestFlowSelect = ({ field, fieldIndex }) => {
    const { t } = useTranslation();
    const { values, setFieldValue } = useFormikContext();
    const [filter, setFilter] = useState("");

    const handlerOnInputChange = useDebounced((value) => {
        setFilter(value);
    }, 500);

    const filters = [];
    if (filter) {
        filters.push({
            field: `${URL_AND_KEYS.restFlows.view}.description`,
            operator: "ilike",
            value: filter,
            type: "OR",
        });
    }
    filters.push(filterByIsPrimary);

    const {
        data: restFlowsData = [],
        isLoading: isLoadingRestFlows,
        isFetchingNextPage: isFetchingNextPageRestFlows,
        fetchNextPage: fetchNextPageRestFlows,
    } = useGenericSearchInfiniteQuery({
        url: `${URL_AND_KEYS.restFlows.url}/search`,
        keyQuery: [URL_AND_KEYS.restFlows.key, filter],
        filter: filters,
        select: (data) => {
            const allItems = data?.data ?? data?.pages?.flatMap(({ data }) => data) ?? [];
            return allItems
                .filter((item) => item && item.id)
                .map((item) => ({ ...item, label: item.description, value: item.id }));
        },
        pageSize: 10,
        table: URL_AND_KEYS.restFlows.entity,
    });

    const BASE_URL = import.meta.env.VITE_DEV_BASE_API_URL || "";

    const [selectedRestFlowId, setSelectedRestFlowId] = useState(null);
    const lastSetUrlRef = useRef(null);
    const currentSource =
        values.fields?.[fieldIndex]?.sources?.restflow_source ?? values.fields?.[fieldIndex]?.sources?.restFlowId;
    const initializedRef = useRef(false);
    useEffect(() => {
        if (initializedRef.current) return;
        if (currentSource === undefined || currentSource === null || currentSource === "") return;

        const m = String(currentSource).match(/(?:https?:\/\/[^/]+)?\/ws-hook-rest-flows\/([^/?#\s]+)/);
        const id = m ? m[1] : currentSource;
        setSelectedRestFlowId(String(id));
        initializedRef.current = true;
    }, [currentSource]);

    useEffect(() => {
        const newUrl = selectedRestFlowId ? `${BASE_URL}ws-hook-rest-flows/${selectedRestFlowId}` : "";
        if (lastSetUrlRef.current !== newUrl) {
            setFieldValue(`${field}.sources.restflow_source`, newUrl);
            lastSetUrlRef.current = newUrl;
        }
    }, [selectedRestFlowId, BASE_URL, field, setFieldValue]);

    const selectedRestFlow = useMemo(() => {
        const selected = restFlowsData?.find(
            (item) => String(item.id) === String(selectedRestFlowId) || String(item.url) === String(selectedRestFlowId),
        );
        return selected ? [{ ...selected, label: selected.description }] : [];
    }, [restFlowsData, selectedRestFlowId]);

    return (
        <div className="flex flex-col justify-stretch">
            <h1>{t("auxSchema.form.restFlow", "Rest Flow")}</h1>
            <MultiSelect
                type="button"
                placeholder={selectedRestFlow?.[0]?.label ?? t("auxSchema.form.restFlow")}
                single={true}
                hiddenSelectedAll={true}
                selectedData={selectedRestFlow}
                options={restFlowsData ?? []}
                isLoading={isLoadingRestFlows}
                isFetchingNextPage={isFetchingNextPageRestFlows}
                fetchNextPage={fetchNextPageRestFlows}
                onInputChange={handlerOnInputChange}
                onSelectOption={(data) => {
                    let id = data?.id ?? data;
                    if (typeof id === "string") {
                        const m = id.match(/(?:https?:\/\/[^/]+)?\/ws-hook-rest-flows\/([^/?#\s]+)/);
                        if (m) id = m[1];
                    }
                    setSelectedRestFlowId(id !== undefined && id !== null ? String(id) : id);
                }}
            />
        </div>
    );
};

RestFlowSelect.propTypes = {
    field: PropTypes.string.isRequired,
    fieldIndex: PropTypes.number.isRequired,
};

export default RestFlowSelect;
