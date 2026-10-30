import PropTypes from "prop-types";
import { useTranslation } from "react-i18next";
import useOptionsList from "@/hooks/useOptionsList";
import SelectField from "@kace_v2/shared/ui/molecules/SelectField";

const SelectFromQuery = ({
    wasTouched = false,
    errorData = "",
    setFieldValue = () => {},
    label = "",
    value = "",
    name = "",
    url = "",
    labelField = "descripcion",
    valueField = "id",
    queryKey = ["SelectFromQuery"],
    auxiliary = null,
    filter = [],
    pageSize = 0,
    formatLabel = null,
    onSearch: onSearchOverride = null,
    onClear: onClearOverride = null,
    placeholder,
    noResultsMessage,
    noSearchResultsMessage,
    useDefault = true,
    order = null,
}) => {
    const { t } = useTranslation();
    const {
        options,
        isLoading,
        fetchNextPage,
        hasNextPage,
        isFetchingNextPage,
        onSearch: onSearchDefault,
    } = useOptionsList({
        url,
        queryKey,
        valueField,
        labelField,
        formatLabel,
        auxiliary,
        filter,
        pageSize,
        initialId: value,
        useDefault,
        order,
    });

    const onSearch = onSearchOverride ?? onSearchDefault;

    return (
        <SelectField
            label={label}
            placeholder={placeholder}
            error={wasTouched ? errorData : undefined}
            options={options}
            value={value}
            onValueChange={(newValue) => setFieldValue(name, newValue)}
            isLoading={isLoading}
            fetchNextPage={fetchNextPage}
            hasNextPage={hasNextPage}
            isFetchingNextPage={isFetchingNextPage}
            onSearch={onSearch}
            noResultsMessage={noResultsMessage ?? t("app.text.noResults")}
            noSearchResultsMessage={noSearchResultsMessage ?? t("app.text.noSearchResults")}
            clearable
            onClear={onClearOverride ?? (() => setFieldValue(name, ""))}
        />
    );
};

SelectFromQuery.propTypes = {
    errorData: PropTypes.string,
    wasTouched: PropTypes.bool,
    setFieldValue: PropTypes.func,
    label: PropTypes.string,
    value: PropTypes.string,
    name: PropTypes.string,
    url: PropTypes.string,
    labelField: PropTypes.string,
    valueField: PropTypes.string,
    queryKey: PropTypes.arrayOf(PropTypes.string),
    auxiliary: PropTypes.string,
    filter: PropTypes.array,
    pageSize: PropTypes.number,
    formatLabel: PropTypes.func,
    onSearch: PropTypes.func,
    onClear: PropTypes.func,
    placeholder: PropTypes.string,
    noResultsMessage: PropTypes.string,
    noSearchResultsMessage: PropTypes.string,
    useDefault: PropTypes.bool,
    order: PropTypes.object,
};

export default SelectFromQuery;
