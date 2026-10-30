import { useFormikContext } from "formik";
import { useMemo, useState, useEffect } from "react";
import { useTranslation } from "react-i18next";
import PropTypes from "prop-types";
import MultiSelect from "@/componentsV2/core/MultiSelect";
import useDebounced from "@/hooks/useDebounced";
import useGenericSearchInfiniteQuery from "@/hooks/useGenericSearchInfiniteQuery";
import { URL_AND_KEYS } from "@/utils/urlAndKeys";
import LiteralFieldsSelect from "./LiteralsFieldSelect";

const LiteralsSelect = ({ field, fieldIndex }) => {
    const { t } = useTranslation();
    const { values, setFieldValue } = useFormikContext();

    const [filter, setFilter] = useState("");

    const handlerOnInputChange = useDebounced((value) => {
        setFilter(value);
    }, 500);

    const {
        data: literalData = [],
        isLoading: isLoadingLiterals,
        isFetchingNextPage: isFetchingNextPageLiterals,
        fetchNextPage: fetchNextPageLiterals,
    } = useGenericSearchInfiniteQuery({
        url: `${URL_AND_KEYS.literals.url}/search`,
        keyQuery: [URL_AND_KEYS.literals.key, filter],
        filter: [
            {
                field: "tipo_literal",
                type: "AND",
                operator: "null",
                value: "null",
            },
        ].concat(
            filter
                ? [
                      {
                          field: "nombre",
                          operator: "ilike",
                          value: filter,
                          type: "AND",
                      },
                  ]
                : [],
        ),
        select: (data) => {
            const allItems = data?.data ?? data?.pages?.flatMap(({ data }) => data) ?? [];
            return allItems
                .filter((item) => item && item.id)
                .map((item) => ({ ...item, label: item.nombre, value: item.id }));
        },
        pageSize: 10,
        table: URL_AND_KEYS.literals.entity,
    });

    const [initialFieldId, setInitialFieldId] = useState(null);
    const { data: literalFieldDataRaw, isFetching: isFetchingLiteralField } = { data: null, isFetching: false };
    const literalFieldData = literalFieldDataRaw?.data ?? [];
    const [selectedLiteralId, setSelectedLiteralId] = useState(null);
    const [selectedLiteralItem, setSelectedLiteralItem] = useState(null);

    useEffect(() => {
        const sources = values.fields?.[fieldIndex]?.sources ?? {};
        const lit = sources.literalId ?? sources.literals_source;

        if (!lit) {
            setSelectedLiteralId(null);
            return;
        }

        const m = String(lit).match(/\/literals\/(.*?)\/list/);
        const extracted = m ? m[1] : lit;

        if (literalData?.length) {
            const match = literalData.find((item) => item.id === extracted);
            if (match) {
                setSelectedLiteralId(match.id);
                setInitialFieldId(null);
                return;
            }
        }

        setInitialFieldId(extracted);
    }, [values.fields, fieldIndex, literalData]);

    useEffect(() => {
        const fieldItem = literalFieldData?.[0];
        if (fieldItem) {
            const parentLiteralId = fieldItem.tipo_literal ?? null;
            if (parentLiteralId) setSelectedLiteralId(parentLiteralId);
            else setSelectedLiteralId(null);
            setInitialFieldId(null);
        }
    }, [literalFieldData]);

    const selectedLiteralFieldFromForm = useMemo(() => {
        const sources = values.fields?.[fieldIndex]?.sources ?? {};
        const lit = sources.literals_source || sources.literalId || "";
        const m = String(lit).match(/\/literals\/(.*?)\/list/);
        return m ? m[1] : null;
    }, [values.fields, fieldIndex]);

    const selectedLiteral = useMemo(() => {
        if (selectedLiteralItem && selectedLiteralItem.id === selectedLiteralId) return [selectedLiteralItem];
        const literal = literalData?.find((item) => item.id === selectedLiteralId);
        return literal ? [{ ...literal, label: literal.nombre, value: literal.id }] : [];
    }, [literalData, selectedLiteralId, selectedLiteralItem]);

    return (
        <div className="flex col-span-2 items-stretch justify-stretch gap-4">
            <div className="flex flex-1 flex-col">
                <h1>{t("auxSchema.form.literal", "Literals")}</h1>
                <MultiSelect
                    type="button"
                    className="flex flex-1"
                    placeholder={selectedLiteral?.[0]?.label ?? t("auxSchema.form.literal")}
                    single={true}
                    hiddenSelectedAll={true}
                    selectedData={selectedLiteral}
                    options={literalData ?? []}
                    isLoading={isLoadingLiterals}
                    isFetchingNextPage={isFetchingNextPageLiterals}
                    fetchNextPage={fetchNextPageLiterals}
                    onInputChange={handlerOnInputChange}
                    onSelectOption={(data) => {
                        const id = data?.id ?? data;
                        const item =
                            typeof data === "object" && data?.id
                                ? { ...data, label: data.nombre ?? data.label, value: data.id }
                                : (literalData?.find((i) => i.id === id) ?? null);
                        if (id !== selectedLiteralId) setSelectedLiteralId(id);
                        setSelectedLiteralItem(item);
                        setFieldValue(`${field}.sources.literals_source`, "");
                    }}
                />
            </div>
            <LiteralFieldsSelect
                field={field}
                fieldIndex={fieldIndex}
                literalId={selectedLiteralId}
                selectedLiteralField={selectedLiteralFieldFromForm}
                onChangeLiteralField={(fieldName) => {
                    const BASE_URL = import.meta.env.VITE_DEV_BASE_API_URL || "";
                    const current = values.fields?.[fieldIndex]?.sources?.literals_source ?? "";
                    if (fieldName) {
                        const sep = BASE_URL.endsWith("/") ? "" : "/";
                        const newVal = `${BASE_URL}${sep}literals/${fieldName}/list`;
                        if (current !== newVal) setFieldValue(`${field}.sources.literals_source`, newVal);
                    } else if (current !== "") {
                        setFieldValue(`${field}.sources.literals_source`, "");
                    }
                }}
            />
        </div>
    );
};

LiteralsSelect.propTypes = {
    field: PropTypes.string.isRequired,
    fieldIndex: PropTypes.number.isRequired,
};

export default LiteralsSelect;
