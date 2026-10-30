import PropTypes from "prop-types";
import { useEffect, useMemo, useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { useFormikContext } from "formik";
import { KField } from "@kace/ui-shared";
import useSelectByProviderQuery from "@/hooks/useSelectByProviderQuery";
import { Select } from "./Select/Select";
import {
    appendUniqueOptions,
    mapRawItemsToOptions,
    seedOptionFromInitialValue,
} from "./selectByProvider/selectByProviderOptions";
import { genericSearch } from "../../../../services/genericSearch";

const SelectByProviderLegacy = ({
    name,
    label,
    url,
    valueFrom = "id",
    labelFrom = "nombre",
    disabled = false,
    initialValue = {},
    body = {},
    className = "",
    validateDocument = false,
    onLoadingChange,
    onChange,
    handlerOptionsTypes = null,
    dataOptions = null,
    showInputErrors = true,
    queryLimit = 20,
    filters = [],
    processData = (data) => data,
    ...props
}) => {
    const [options, setOptions] = useState([]);
    const [firstPageValues, setFirstPageValues] = useState(() => new Set());
    const [page, setPage] = useState(0);
    const { data: dataQuery, isLoading } = useQuery({
        queryKey: [name, url, page],
        queryFn: () =>
            genericSearch(`${url}/search`, filters, {
                limit: queryLimit,
                offset: page * queryLimit,
            }),
        refetchOnWindowFocus: false,
        retry: 1,
        enabled: !dataOptions,
        select: (data) => processData(data),
    });

    const { values, setFieldValue } = useFormikContext();
    const handlerOptions = (data, isFirstPage) => {
        if (handlerOptionsTypes) {
            handlerOptionsTypes(data, setOptions, name);
        } else {
            if (Array.isArray(data)) {
                const items = mapRawItemsToOptions(data, { valueFrom, labelFrom });
                if (isFirstPage) {
                    setFirstPageValues(new Set(items.map((option) => String(option.value))));
                }
                setOptions((previous) => (isFirstPage ? items : appendUniqueOptions(previous, items)));
            }
        }
    };
    const handleChangeTypeDocument = (value) => {
        setFieldValue(name, value);
        if (values.tipo_documento && validateDocument) {
            value === "CC" ? setFieldValue("tipo_cliente", "Natural") : setFieldValue("tipo_cliente", "Comercial");
        }
        onChange && onChange(value);
    };
    /*
     * The saved value is offered even when it is not in the results. It is derived on every render,
     * never stored, so a new `initialValue` replaces the previous one; one without a value or a label
     * (e.g. a deleted schedule) is skipped instead of becoming a blank option. Unless the first page
     * lists it, it stays on top, also after a later page brings it, so it does not jump while scrolling.
     */
    const seed = seedOptionFromInitialValue(initialValue, { valueFrom, labelFrom });
    const seedValue = seed?.value;
    const seedLabel = seed?.label;
    const renderedOptions = useMemo(() => {
        if (handlerOptionsTypes || seedValue === undefined || firstPageValues.has(String(seedValue))) {
            return options;
        }
        const others = options.filter((option) => String(option.value) !== String(seedValue));
        return [{ value: seedValue, label: seedLabel }, ...others];
    }, [options, firstPageValues, handlerOptionsTypes, seedValue, seedLabel]);

    useEffect(() => {
        if (dataOptions) {
            handlerOptions(dataOptions, true);
        }
        if (dataQuery) {
            handlerOptions(dataQuery.data, page === 0);
        }
    }, [dataOptions, dataQuery, page]);

    useEffect(() => {
        if (onLoadingChange) {
            onLoadingChange(isLoading);
        }
    }, [isLoading]);

    const pageItems = Array.isArray(dataQuery?.data) ? dataQuery.data : [];
    const hasNextPage = !dataOptions && pageItems.length >= queryLimit;

    return (
        <KField>
            <Select
                name={name}
                label={label}
                options={renderedOptions}
                disabled={disabled}
                handle={handleChangeTypeDocument}
                className={className}
                isLoading={isLoading}
                id={`select_${name}`}
                data-testid={`select_${name}`}
                showInputErrors={showInputErrors}
                fetchNextPage={() => setPage((previous) => previous + 1)}
                hasNextPage={hasNextPage}
                isFetchingNextPage={isLoading && page > 0}
                {...props}
            />
        </KField>
    );
};

const SelectByProviderEnhanced = ({
    name,
    label,
    url,
    valueFrom = "id",
    labelFrom = "nombre",
    disabled = false,
    initialValue = {},
    body = {},
    className = "",
    validateDocument = false,
    onLoadingChange,
    onChange,
    handlerOptionsTypes = null,
    dataOptions = null,
    showInputErrors = true,
    queryLimit = 20,
    filters = [],
    processData = (data) => data,
    enableSearch = false,
    enableInfiniteScroll = false,
    enableAlphabeticalOrder = false,
    searchField,
    orderField,
    clearable = false,
    ...props
}) => {
    const { values, setFieldValue } = useFormikContext();
    const query = useSelectByProviderQuery({
        name,
        url,
        filters,
        queryLimit,
        valueFrom,
        labelFrom,
        searchField,
        orderField,
        enableSearch,
        enableInfiniteScroll,
        enableAlphabeticalOrder,
        dataOptions,
        processData,
        selectedValue: values[name],
        initialValue,
    });

    const handleChangeTypeDocument = (value) => {
        setFieldValue(name, value);
        if (values.tipo_documento && validateDocument) {
            value === "CC" ? setFieldValue("tipo_cliente", "Natural") : setFieldValue("tipo_cliente", "Comercial");
        }
        onChange && onChange(value);
    };

    useEffect(() => {
        if (onLoadingChange) {
            onLoadingChange(query.isLoading);
        }
    }, [onLoadingChange, query.isLoading]);

    return (
        <KField>
            <Select
                name={name}
                label={label}
                options={query.options}
                disabled={disabled}
                handle={handleChangeTypeDocument}
                className={className}
                isLoading={query.isLoading}
                id={`select_${name}`}
                data-testid={`select_${name}`}
                showInputErrors={showInputErrors}
                fetchNextPage={enableInfiniteScroll ? query.fetchNextPage : undefined}
                hasNextPage={enableInfiniteScroll ? query.hasNextPage : false}
                isFetchingNextPage={query.isFetchingNextPage}
                onSearchChange={enableSearch ? query.setSearchTerm : undefined}
                clearable={clearable}
                disableUntilReady
                {...props}
            />
        </KField>
    );
};

export const SelectByProvider = ({
    enableSearch = false,
    enableInfiniteScroll = false,
    enableAlphabeticalOrder = false,
    searchField,
    orderField,
    handlerOptionsTypes = null,
    clearable = false,
    ...props
}) => {
    const enhanced = (enableSearch || enableInfiniteScroll || enableAlphabeticalOrder) && !handlerOptionsTypes;

    if (enhanced) {
        return (
            <SelectByProviderEnhanced
                {...props}
                clearable={clearable}
                enableSearch={enableSearch}
                enableInfiniteScroll={enableInfiniteScroll}
                enableAlphabeticalOrder={enableAlphabeticalOrder}
                searchField={searchField}
                orderField={orderField}
            />
        );
    }

    return <SelectByProviderLegacy {...props} handlerOptionsTypes={handlerOptionsTypes} />;
};

const selectByProviderPropTypes = {
    name: PropTypes.string.isRequired,
    label: PropTypes.string,
    url: PropTypes.string.isRequired,
    valueFrom: PropTypes.string,
    labelFrom: PropTypes.oneOfType([PropTypes.string, PropTypes.array]),
    disabled: PropTypes.bool,
    initialValue: PropTypes.object,
    body: PropTypes.object,
    className: PropTypes.string,
    validateDocument: PropTypes.bool,
    onLoadingChange: PropTypes.func,
    onChange: PropTypes.func,
    handlerOptionsTypes: PropTypes.func,
    filters: PropTypes.array,
    showInputErrors: PropTypes.bool,
    dataOptions: PropTypes.any,
    queryLimit: PropTypes.number,
    processData: PropTypes.func,
    enableSearch: PropTypes.bool,
    enableInfiniteScroll: PropTypes.bool,
    enableAlphabeticalOrder: PropTypes.bool,
    searchField: PropTypes.string,
    orderField: PropTypes.string,
    clearable: PropTypes.bool,
};

SelectByProviderLegacy.propTypes = selectByProviderPropTypes;
SelectByProviderEnhanced.propTypes = selectByProviderPropTypes;
SelectByProvider.propTypes = selectByProviderPropTypes;
