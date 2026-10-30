import { useEffect, useMemo, useState } from "react";
import PropTypes from "prop-types";
import { useTranslation } from "react-i18next";
import MultiSelect from "@/componentsV2/core/MultiSelect";
import useDebounced from "@/hooks/useDebounced";
import useGenericSearchInfiniteQuery from "@/hooks/useGenericSearchInfiniteQuery";
import { URL_AND_KEYS } from "@/utils/urlAndKeys";

const LiteralsFieldSelect = ({ field, fieldIndex, literalId, selectedLiteralField: propSelectedLiteralField, onChangeLiteralField }) => {
    const { t } = useTranslation();

    const selectedLiteralId = literalId ?? null;

    const [filter, setFilter] = useState("");

    const handlerOnInputChange = useDebounced((value) => {
        setFilter(value);
    }, 500);

    const {
        data: literalFieldsData = [],
        isLoading: isLoadingLiteralFields,
        isFetchingNextPage: isFetchingNextPageLiteralFields,
        fetchNextPage: fetchNextPageLiteralFields,
    } = useGenericSearchInfiniteQuery({
        url: `${URL_AND_KEYS.literals.url}/search`,
        keyQuery: [URL_AND_KEYS.literals.key, selectedLiteralId, filter],
        enabled: !!selectedLiteralId,
        filter: [
            {
                field: "tipo_literal",
                type: "AND",
                operator: "eq",
                value: selectedLiteralId,
            }
        ].concat(filter ? [
            {
                field: "nombre",
                operator: "ilike",
                value: filter,
                type: "AND",
            }
        ] : []),
        select: (data) => {
            const allItems = data?.data ?? data?.pages?.flatMap(({ data }) => data) ?? [];
            return allItems
                .filter((item) => item && item.id)
                .map((item) => ({ ...item, label: item.nombre, value: item.id }));
        },
        pageSize: 10,
        table: URL_AND_KEYS.literals.entity,
    });
    const [selectedLiteralField, setSelectedLiteralField] = useState(propSelectedLiteralField ?? null);
    const [selectedLiteralFieldItem, setSelectedLiteralFieldItem] = useState(null);

    useEffect(() => {
        if (propSelectedLiteralField !== undefined) {
            setSelectedLiteralField(propSelectedLiteralField ?? null);
            const found = literalFieldsData?.find(item => item.id === (propSelectedLiteralField ?? null)) ?? null;
            setSelectedLiteralFieldItem(found ? { ...found, label: found.nombre ?? found.label ?? found.id, value: found.id } : null);
        }
    }, [propSelectedLiteralField]);

    useEffect(() => {
        if (onChangeLiteralField) onChangeLiteralField(selectedLiteralField);
    }, [selectedLiteralField, onChangeLiteralField]);

    const selectedLiteralFieldMemo = useMemo(() => {
        if (selectedLiteralFieldItem && selectedLiteralFieldItem.id === selectedLiteralField) return [selectedLiteralFieldItem];
        const fieldName = selectedLiteralField;
        const fieldData = literalFieldsData?.find(item => item.id === fieldName);
        return fieldData ? [{ ...fieldData, label: fieldData.nombre ?? fieldData.label ?? fieldData.id, value: fieldData.id }] : [];
    }, [literalFieldsData, selectedLiteralField, selectedLiteralFieldItem]);

    if (!selectedLiteralId) return null;

    return (
        <div className="flex flex-col flex-1 justify-stretch">
            <h1>{t("schemas.form.title.literalField", "Literal Field")}</h1>
            <MultiSelect
                type="button"
                placeholder={selectedLiteralFieldMemo?.[0]?.label ?? t("auxSchema.form.literalField")}
                single={true}
                hiddenSelectedAll={true}
                className="w-full"
                selectedData={selectedLiteralFieldMemo}
                options={literalFieldsData ?? []}
                isLoading={isLoadingLiteralFields}
                isFetchingNextPage={isFetchingNextPageLiteralFields}
                fetchNextPage={fetchNextPageLiteralFields}
                onInputChange={handlerOnInputChange}
                onSelectOption={(data) => {
                    const id = data?.id ?? data;
                    const item = typeof data === 'object' && data?.id ? { ...data, label: data.nombre ?? data.label, value: data.id } : (literalFieldsData?.find(i => i.id === id) ?? null);
                    setSelectedLiteralField(id);
                    setSelectedLiteralFieldItem(item);
                }}
            />
        </div>
    );
};

LiteralsFieldSelect.propTypes = {
    field: PropTypes.string.isRequired,
    fieldIndex: PropTypes.number.isRequired,
    literalId: PropTypes.oneOfType([PropTypes.string, PropTypes.number]),
    selectedLiteralField: PropTypes.oneOfType([PropTypes.string, PropTypes.number]),
    onChangeLiteralField: PropTypes.func,
};

export default LiteralsFieldSelect;
