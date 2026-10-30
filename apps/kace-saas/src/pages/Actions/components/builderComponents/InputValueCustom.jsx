import { ComboBox, Input } from "@kace/ui-shared";
import { PropTypes } from "prop-types";
import { useCallback, useEffect, useMemo, useState } from "react";
import useActionsData from "../../hooks/useActionsData";
import { useTranslation } from "react-i18next";
import { FieldSelectorCustom } from "./FieldSelectorCustom";
import {
    BUILDER_PAGE_SIZE,
    COMPARISON_TYPE_OPTIONS,
    FUNCTION_OPTIONS,
    VALUE_TYPE_OPTIONS,
    VALUELESS_OPERATORS,
} from "../../data/constants";
import ActionsDefaultSelect from "./ActionsDefaultSelect";
import { useFormikContext } from "formik";
import { useInfiniteQuery, useQuery } from "@tanstack/react-query";
import { genericSearch } from "@/services/genericSearch";
import { genericView } from "@/services/genericView";
import Select from "@kace_v2/shared/ui/molecules/Select";
import { useBuilderEntitySearch } from "../../hooks/useBuilderEntitySearch";
import { resolveBuilderEntityConfig } from "../../data/builderEntityConfig";

export const InputValueCustom = ({ ...props }) => {
    const [comparisonTypeOptions, setComparisonTypeOptions] = useState(COMPARISON_TYPE_OPTIONS);
    const [comparisonTypeSelected, setComparisonTypeSelected] = useState(props?.rule?.type);
    const [valueTypeSelected, setValueTypeSelected] = useState(props?.rule?.value_type);
    const [isDisabled, setIsDisabled] = useState(false);
    const [currentField, setCurrentField] = useState(null);
    const [currentData, setCurrentData] = useState([]);
    const { handleOnChange, value, field, rule, operator } = props;
    const { t } = useTranslation();
    const { arrayAllLevels, levelsSelect, loadingLevelsData } = useActionsData();

    const selectConfig = useMemo(() => {
        if (!levelsSelect.some((f) => f.name === field)) return null;
        return resolveBuilderEntityConfig(field);
    }, [field, levelsSelect]);

    const {
        data: builderData,
        fetchNextPage,
        hasNextPage,
        isFetchingNextPage,
        isLoading: selectLoading,
    } = useInfiniteQuery({
        queryKey: selectConfig?.keyQuery ?? ["builder_noop"],
        queryFn: async ({ pageParam = 0 }) =>
            genericSearch(`${selectConfig.url}/search`, selectConfig.baseFilter ?? [], {
                limit: BUILDER_PAGE_SIZE,
                offset: pageParam * BUILDER_PAGE_SIZE,
            }),
        getNextPageParam: (lastPage, pages) => {
            if ((lastPage?.data?.length || 0) < BUILDER_PAGE_SIZE) return undefined;
            return pages.length;
        },
        enabled: !!selectConfig,
        keepPreviousData: true,
    });

    const { data: initialItemData } = useQuery({
        queryKey: [...(selectConfig?.keyQuery ?? ["builder_noop"]), "initial", value],
        queryFn: () => genericView(`${selectConfig.url}/${value}`),
        enabled: !!selectConfig && !!value,
        staleTime: Infinity,
    });

    const getBuilderLabel = useCallback(
        (item) => (selectConfig?.formatLabel ? selectConfig.formatLabel(item) : (item[selectConfig?.labelField] ?? "")),
        [selectConfig],
    );

    const selectOptions = useMemo(() => {
        const baseOptions = (builderData?.pages?.flatMap((p) => p?.data || []) || [])
            .map((item) => ({ value: item.id, label: getBuilderLabel(item) }))
            .filter((opt) => opt.value);

        if (initialItemData && value) {
            const alreadyPresent = baseOptions.some((opt) => String(opt.value) === String(value));
            if (!alreadyPresent) {
                const seedOption = { value: initialItemData.id, label: getBuilderLabel(initialItemData) };
                if (seedOption.value) return [seedOption, ...baseOptions];
            }
        }
        return baseOptions;
    }, [builderData, initialItemData, value, getBuilderLabel]);

    const onBuilderSearch = useBuilderEntitySearch({
        selectConfig,
        getLabel: getBuilderLabel,
        pageSize: BUILDER_PAGE_SIZE,
    });

    const { values } = useFormikContext();

    const selectedEntity = useMemo(() => values?.entity, [values?.entity]);

    const handlerChange = useCallback(
        (event) => {
            const value = event?.target?.value ?? event ?? null;
            handleOnChange({ type: comparisonTypeSelected, value, value_type: valueTypeSelected });
        },
        [comparisonTypeSelected, valueTypeSelected, handleOnChange],
    );

    useEffect(() => {
        if (!rule) return;

        setComparisonTypeSelected(rule.type ?? "");
        setValueTypeSelected(rule.value_type ?? "");
    }, [rule]);

    useEffect(() => {
        const filterField = levelsSelect.find((f) => f.name === field);
        if (!filterField) {
            setCurrentField(null);
            return;
        }
        setCurrentField(filterField.type);
        if (!selectConfig && filterField.data === "classifications") {
            const filterLevels = arrayAllLevels.filter((level) => level.level === field.split(".")[1]);
            setCurrentData(filterLevels);
        }
    }, [field, levelsSelect, arrayAllLevels, selectConfig]);

    useEffect(() => {
        setComparisonTypeOptions((prev) => {
            let newArray = [...prev];

            const exists = newArray.some((item) => item.value === "options_list");

            if (currentField === "list" && !exists) {
                newArray.push({ label: "actions.labels.optionsList", value: "options_list" });
            }

            if (currentField !== "list") {
                newArray = newArray.filter((item) => item.value !== "options_list");
            }

            return newArray;
        });
    }, [currentField, setComparisonTypeOptions]);

    useEffect(() => {
        if (!rule?.type && rule.value) {
            if (!currentField) {
                setComparisonTypeSelected("manual_input");
            } else {
                setComparisonTypeSelected("options_list");
            }
            setValueTypeSelected("text");
        }

        if (rule) {
            const activeOperator = operator ?? rule.operator;
            const isValuelessOperator = VALUELESS_OPERATORS.includes(activeOperator);
            setIsDisabled(rule.field === "" || isValuelessOperator);
            rule.field === "" && setComparisonTypeSelected("");
        }
    }, [rule, operator, currentField, setComparisonTypeSelected, setValueTypeSelected, setIsDisabled]);

    return (
        <div
            className="flex gap-2 justify-start items-center w-full flex-col lg:flex-row lg:max-w-[60%]"
            id="input_value_custom"
            data-testid="input_value_custom"
        >
            <ActionsDefaultSelect
                selectedValue={comparisonTypeSelected}
                options={comparisonTypeOptions}
                placeholder="actions.placeholder.comparisonType"
                disabled={isDisabled}
                handler={(value) => {
                    if (value) {
                        setComparisonTypeSelected(value);
                    }
                }}
            />
            {comparisonTypeSelected === "options_list" &&
                (selectConfig ? (
                    <Select
                        options={selectOptions}
                        value={value ?? ""}
                        onValueChange={(val) => handlerChange(val)}
                        isLoading={selectLoading}
                        fetchNextPage={fetchNextPage}
                        hasNextPage={hasNextPage}
                        isFetchingNextPage={isFetchingNextPage}
                        onSearch={onBuilderSearch}
                        disabled={isDisabled}
                        clearable
                        onClear={() => handlerChange("")}
                        position="popper"
                        noSearchResultsMessage={t("actions.querybuilder.noSearchResults")}
                        searchPlaceholder={
                            selectConfig.searchPlaceholder ? t(selectConfig.searchPlaceholder) : undefined
                        }
                    />
                ) : (
                    <ComboBox
                        data={currentData}
                        className="w-full lg:max-w-72 truncate"
                        classNamePopover="min-w-[400px]"
                        loading={loadingLevelsData}
                        handleOnChange={handlerChange}
                        defaultValue={value}
                        placeholder={t("actions.querybuilder.searchPlaceholder")}
                        showClearButton={false}
                        disabled={isDisabled}
                    />
                ))}
            {comparisonTypeSelected === "manual_input" && (
                <Input
                    className="lg:max-w-72"
                    onChange={handlerChange}
                    value={value}
                    data-testid="input_value_custom_manual"
                    name="custom_manual"
                    disabled={isDisabled}
                />
            )}
            {comparisonTypeSelected === "entity" && (
                <FieldSelectorCustom handleOnChange={handlerChange} value={value} disabled={isDisabled} />
            )}
            {comparisonTypeSelected === "function" && (
                <ActionsDefaultSelect
                    selectedValue={value}
                    options={FUNCTION_OPTIONS}
                    placeholder="actions.placeholder.function"
                    disabled={isDisabled}
                    handler={handlerChange}
                />
            )}
            {comparisonTypeSelected && (
                <ActionsDefaultSelect
                    selectedValue={valueTypeSelected}
                    options={VALUE_TYPE_OPTIONS}
                    placeholder="actions.placeholder.valueType"
                    disabled={isDisabled}
                    handler={(event) => {
                        if (event) {
                            setValueTypeSelected(event);
                            handleOnChange({ type: comparisonTypeSelected, value, value_type: event });
                        }
                    }}
                />
            )}
        </div>
    );
};

InputValueCustom.propTypes = {
    handleOnChange: PropTypes.func.isRequired,
    value: PropTypes.string.isRequired,
    field: PropTypes.string,
};
