import PropTypes from "prop-types";
import Select from "@/componentsV2/core/Select";
import { useTranslation } from "react-i18next";
import { useMemo, useState } from "react";
import { URL_AND_KEYS } from "@/utils/urlAndKeys";
import { WS_REST_FLOWS_SERVICE } from "@/utils/URL";
import MultiSelect from "@/componentsV2/core/MultiSelect";
import useGenericSearchInfiniteQuery from "@/hooks/useGenericSearchInfiniteQuery";
import useDebounced from "@/hooks/useDebounced";
import { useFormikContext } from "formik";
import { processData } from "./MassiveExecutionSelectType";
import JSONEditor from "@/componentsV2/lib/JSONEditor";
import { filterByIsPrimary, filterByIsActive } from "@/utils/genericFilters";

const FormikMassiveExecutionSelector = ({ tab = "cases" }) => {
    const { t } = useTranslation();
    const { setFieldValue } = useFormikContext();

    const [actionType, setActionType] = useState("");
    const [selected, setSelected] = useState([]);
    const [filter, setFilter] = useState([]);

    const typeExecutionOptions = useMemo(() => {
        if (tab === "clients") {
            return [{ label: "Flujo Rest", value: "restsflow" }];
        }
        return [
            { label: "Acciones", value: "actions" },
            { label: "Flujo Rest", value: "restsflow" },
        ];
    }, [tab]);

    const {
        data = [],
        isLoading,
        fetchNextPage,
    } = useGenericSearchInfiniteQuery({
        url:
            actionType === "actions"
                ? `${URL_AND_KEYS.actions.url}/search`
                : actionType === "restsflow"
                  ? `${WS_REST_FLOWS_SERVICE}/search`
                  : "",
        keyQuery: ["formikMassiveExecutionSelectType", actionType, filter],
        filter: actionType === "restsflow" ? [...filter, filterByIsActive, filterByIsPrimary] : filter,
        enabled: Boolean(actionType),
        select: processData,
        pageSize: 10,
    });

    const onChangeHandler = (value) => {
        setActionType(value);
        setSelected([]);
        setFilter([]);
        setFieldValue("action_type", value);
        setFieldValue("restflow_id", "");
        setFieldValue("restflow_context", { properties: [] });
    };

    const handlerClear = () => {
        setActionType("");
        setSelected([]);
        setFilter([]);
        setFieldValue("action_type", "");
        setFieldValue("restflow_id", "");
        setFieldValue("restflow_context", { properties: [] });
    };

    const handlerSelect = (value) => {
        const selectedData = data.filter((item) => item.id === value);
        setSelected(selectedData);
        setFieldValue("restflow_id", value || "");
    };

    const handlerOnInputChange = useDebounced();

    return (
        <div className="grid grid-cols-2 items-center content-center gap-4 w-full py-4 border-t mt-4">
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
                    fetchNextPage={fetchNextPage}
                    onInputChange={handlerOnInputChange}
                    hiddenSelectedAll
                    single={true}
                />
            )}
            {actionType === "restsflow" && (
                <div className="col-span-2">
                    <b>{t("massiveExecution.initialRestflowContext")}:</b>
                    <JSONEditor namePrefix="restflow_context.properties" allowObjects allowArrays />
                </div>
            )}
        </div>
    );
};

FormikMassiveExecutionSelector.propTypes = {
    tab: PropTypes.oneOf(["cases", "clients"]),
};

export default FormikMassiveExecutionSelector;
