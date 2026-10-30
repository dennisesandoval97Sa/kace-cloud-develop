import { useTranslation } from "react-i18next";
import PropTypes from "prop-types";
import { useFormikContext } from "formik";
import InputCard from "@/components/core/Cards/InputCard";
import MultiSelect from "@/componentsV2/core/MultiSelect";
import useGenericSearchInfiniteQuery from "@/hooks/useGenericSearchInfiniteQuery";
import useGenericViewQuery from "@/hooks/useGenericViewQuery";
import { URL_AND_KEYS } from "@/utils/urlAndKeys";
import { useState } from "react";
import useDebounced from "@/hooks/useDebounced";
import { useMemo } from "react";

const SchemasReferencedSchemaField = ({ namePrefix, index }) => {
    const { t } = useTranslation();
    const { values, setFieldValue } = useFormikContext();
    const [filterQuery, setFilterQuery] = useState("");

    const handleOnInputChange = useDebounced((value) => {
        setFilterQuery(value);
    }, 500);

    const capitalizeWords = (str) => {
        if (!str) return "";
        return str.replace(/\b\w/g, (char) => char.toUpperCase());
    };

    const { data, isLoading, isFetchingNextPage, fetchNextPage } = useGenericSearchInfiniteQuery({
        keyQuery: URL_AND_KEYS.schemas.key,
        url: `${URL_AND_KEYS.schemas.url}/search`,
        filter: [
            ...(!!values?.id
                ? [
                      {
                          field: "id",
                          operator: "neq",
                          value: values?.id,
                          type: "AND",
                      },
                  ]
                : []),
            {
                field: "is_active",
                operator: "eq",
                value: "true",
                type: "AND",
            },
            ...(filterQuery
                ? [
                      {
                          field: "name",
                          operator: "ilike",
                          value: filterQuery,
                          type: "AND",
                      },
                  ]
                : []),
        ],
        select: (data) => {
            try {
                const allItems = data?.data ?? data?.pages.flatMap(({ data }) => data) ?? [];

                return allItems.map((schema) => ({
                    id: schema.id,
                    label: capitalizeWords(schema?.name || ""),
                    value: schema?.name || "",
                }));
            } catch (error) {
                return [];
            }
        },
    });

    const schemaId = values?.fields?.[index]?.schema_id;

    const { data: specificSchemaData } = useGenericViewQuery({
        keyQuery: `${URL_AND_KEYS.schemas.key}_specific_${schemaId}`,
        url: `${URL_AND_KEYS.schemas.url}/${schemaId}`,
        enabled: !!schemaId && !data?.find((schema) => schema.id === schemaId),
    });

    const selectedSchema = useMemo(() => {
        if (!schemaId) return null;

        const foundInPaginated = data?.find((schema) => schema.id === schemaId);
        if (foundInPaginated) return foundInPaginated;

        if (specificSchemaData && specificSchemaData.id === schemaId) {
            return {
                id: specificSchemaData.id,
                label: capitalizeWords(specificSchemaData.name),
                value: specificSchemaData.name,
            };
        }

        return null;
    }, [data, schemaId, specificSchemaData]);

    const finalOptions = useMemo(() => {
        const result = data ? [...data] : [];
        if (selectedSchema && !result.find((s) => s.id === selectedSchema.id)) {
            result.unshift(selectedSchema);
        }
        return result;
    }, [data, selectedSchema]);

    return (
        <div className="w-full grid grid-cols-1 sm:grid-cols-2 gap-4 mt-4 p-4 border-l-4 border-gray-200">
            <InputCard className="col-span-2 sm:col-span-1">
                <span className="text-sm font-medium leading-none peer-disabled:cursor-not-allowed peer-disabled:opacity-70">
                    {t("auxSchema.form.schema")}
                </span>
                <MultiSelect
                    selectedData={selectedSchema ? [selectedSchema] : []}
                    options={finalOptions}
                    isLoading={isLoading}
                    isFetchingNextPage={isFetchingNextPage}
                    hiddenSelectedAll={true}
                    onInputChange={handleOnInputChange}
                    onSelectOption={(selectedOption) => setFieldValue(`${namePrefix}.schema_id`, selectedOption)}
                    fetchNextPage={fetchNextPage}
                    type="button"
                    single={true}
                    placeholder={selectedSchema ? selectedSchema.label : t("auxSchema.form.schema")}
                    dataTestid={`${namePrefix}_schema_id_multiselect`}
                />
            </InputCard>
        </div>
    );
};

SchemasReferencedSchemaField.propTypes = {
    namePrefix: PropTypes.string.isRequired,
    index: PropTypes.number.isRequired,
};

export default SchemasReferencedSchemaField;
