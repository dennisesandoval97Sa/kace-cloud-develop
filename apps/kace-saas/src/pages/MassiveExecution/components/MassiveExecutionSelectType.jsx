import PropTypes from "prop-types";
import Select from "@/componentsV2/core/Select";
import { useTranslation } from "react-i18next";
import { useEffect, useMemo, useState } from "react";
import { URL_AND_KEYS } from "@/utils/urlAndKeys";
import { WS_REST_FLOWS_SERVICE } from "@/utils/URL";
import MultiSelect from "@/componentsV2/core/MultiSelect";
import useGenericSearchInfiniteQuery from "@/hooks/useGenericSearchInfiniteQuery";
import useDebounced from "@/hooks/useDebounced";
import JSONEditor from "@/componentsV2/lib/JSONEditor";
import { Formik, useFormikContext } from "formik";
import { transformToJSON } from "@/componentsV2/lib/JSONEditor/helpers";
import { filterByIsPrimary, filterByIsActive } from "@/utils/genericFilters";

const JSONEditorWrapper = ({ onContextChange }) => {
    const { values } = useFormikContext();
    useEffect(() => {
        const jsonData = transformToJSON(values.properties);
        onContextChange(jsonData);
    }, [values.properties, onContextChange]);
    return <JSONEditor namePrefix="properties" allowObjects allowArrays />;
};

JSONEditorWrapper.propTypes = {
    onContextChange: PropTypes.func.isRequired,
};

const capitalizeWords = (text) => {
    return text
        .toLowerCase()
        .split(" ")
        .map((word) => word.charAt(0).toUpperCase() + word.slice(1))
        .join(" ");
};

export const processData = (data) => {
    try {
        const allItems = data?.data ?? data?.pages.flatMap(({ data }) => data) ?? [];
        return allItems.map((item) => ({
            id: item.id,
            label: capitalizeWords(item.description),
            value: capitalizeWords(item.description),
        }));
    } catch (error) {
        return [];
    }
};

const MassiveExecutionSelectType = ({
    handler,
    tab = "cases",
    onContextChange = () => {},
    onRestFlowChange = () => {},
    onActionChange = () => {},
}) => {
    const { t } = useTranslation();

    const [actionType, setActionType] = useState("");
    const [selected, setSelected] = useState([]);
    const [filter, setFilter] = useState([]);

    const typeExecutionOptions = useMemo(() => {
        if (tab === "clients") {
            return [{ label: "Flujo Rest", value: "restflow_id" }];
        }
        return [
            { label: "Acciones", value: "action_id" },
            { label: "Flujo Rest", value: "restflow_id" },
        ];
    }, [tab]);

    const {
        data = [],
        isLoading,
        isFetchingNextPage,
        fetchNextPage,
    } = useGenericSearchInfiniteQuery({
        url:
            actionType === "action_id"
                ? `${URL_AND_KEYS.actions.url}/search`
                : actionType === "restflow_id"
                  ? `${WS_REST_FLOWS_SERVICE}/search`
                  : "",
        keyQuery: ["massiveExecutionSelectType", actionType, filter],
        filter: actionType === "restflow_id" ? [...filter, filterByIsActive, filterByIsPrimary] : filter,
        enabled: Boolean(actionType),
        select: processData,
        pageSize: 10,
    });

    const onChangeHandler = (value) => {
        setSelected([]);
        setFilter([]);
        setActionType(value);
        handler(value ?? "");
        onContextChange({});
        onRestFlowChange(null);
        onActionChange(null);
    };

    const handlerClear = () => {
        setSelected([]);
        setFilter([]);
        setActionType("");
        handler("");
        onRestFlowChange(null);
        onActionChange(null);
    };

    const handlerSelect = (value) => {
        const selectedData = data.filter((item) => item.id === value);
        setSelected(selectedData);

        if (actionType === "restflow_id") {
            onRestFlowChange(value || null);
            onActionChange(null);
        } else if (actionType === "action_id") {
            onActionChange(value || null);
            onRestFlowChange(null);
        }
    };

    const handlerOnInputChange = useDebounced((value) => {
        if (!value) {
            setFilter([]);
            return;
        }
        setFilter([{ field: "description", operator: "ilike", value, type: "AND" }]);
    }, 500);

    return (
        <div className="grid grid-cols-2 items-center content-cente4r gap-4 w-full py-6">
            <Select
                t={t}
                options={typeExecutionOptions}
                onChangeHandler={onChangeHandler}
                handlerClear={handlerClear}
                value={actionType}
            />

            {actionType && (
                <MultiSelect
                    type="input"
                    selectedData={selected}
                    options={data}
                    isLoading={isLoading}
                    onSelectOption={handlerSelect}
                    isFetchingNextPage={isFetchingNextPage}
                    fetchNextPage={fetchNextPage}
                    onInputChange={handlerOnInputChange}
                    hiddenSelectedAll
                    single
                />
            )}
            {actionType === "restflow_id" && (
                <div className="col-span-2">
                    <Formik initialValues={{ properties: [] }} onSubmit={() => {}}>
                        <JSONEditorWrapper onContextChange={onContextChange} />
                    </Formik>
                </div>
            )}
        </div>
    );
};

MassiveExecutionSelectType.propTypes = {
    handler: PropTypes.func.isRequired,
    tab: PropTypes.oneOf(["cases", "clients"]),
    onContextChange: PropTypes.func,
    onRestFlowChange: PropTypes.func,
    onActionChange: PropTypes.func,
};

export default MassiveExecutionSelectType;
