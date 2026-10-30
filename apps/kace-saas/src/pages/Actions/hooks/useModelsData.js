import { useCallback, useEffect, useMemo, useState } from "react";
import { allowedKeysData, optionsBuilderObject } from "../data/constants";
import { useTranslation } from "react-i18next";
import useAuxiliariesOptions from "@/hooks/useAuxiliariesOptions";
import { URL_AND_KEYS } from "@/utils/urlAndKeys";
import useSchemaFields from "@/hooks/useSchemaFields";

/**
 * Aggregates the Actions builder field catalog (base entities + auxiliaries).
 * Array-derived auxiliary paths are excluded by design (includeArrays: false):
 * actions operate on scalar fields. Saved configs pointing at array paths
 * resolve to a legacy entry showing the saved value in the selectors.
 *
 * @param {Object} [params] - Named options.
 * @param {boolean} [params.includeModel=true] - Whether to prefix values with the model name.
 * @param {Array|null} [params.allowedKeys=null] - Column allow-list for base entities.
 * @param {boolean} [params.includeStatus=true] - Whether to append the status field.
 * @param {boolean} [params.includeArrays=false] - Whether to include array-derived auxiliary paths.
 */
const useModelsData = ({ includeModel = true, allowedKeys = null, includeStatus = true, includeArrays = false }) => {
    const { t } = useTranslation();
    const { getSchemaField } = useSchemaFields();
    const { auxiliariesRules, loading } = useAuxiliariesOptions(includeModel, undefined, { includeArrays });
    const [opcionesBuilder, setOpcionesBuilder] = useState(optionsBuilderObject);

    const schemaFields = useMemo(() => {
        return {
            classifications: getSchemaField(URL_AND_KEYS.classification.entity),
            cases: getSchemaField("cases"),
            clients: getSchemaField(URL_AND_KEYS.clients.entity),
            users: getSchemaField(URL_AND_KEYS.users.entity),
            groups: getSchemaField(URL_AND_KEYS.groups.entity),
        };
    }, []);

    const currentAllowedKey = useMemo(() => allowedKeys ?? allowedKeysData, [allowedKeys, allowedKeysData]);

    const processData = useCallback(
        (data, prefix, extraOptions = []) => {
            const opciones = data
                .filter((item) => currentAllowedKey.includes(item.column_name))
                .map((item, index) => ({
                    value: includeModel ? `${prefix}.${item.column_name}` : item.column_name,
                    label: t(`actions.form.${item.label}`, item.label),
                    id: index + 1,
                }));

            return [...opciones, ...extraOptions];
        },
        [currentAllowedKey, includeModel, t],
    );

    const updateOpcionesBuilder = useCallback((index, options) => {
        setOpcionesBuilder((prevState) => {
            if (prevState.length > index) {
                const item = prevState[index];
                return [...prevState.slice(0, index), { ...item, options }, ...prevState.slice(index + 1)];
            }
            return prevState;
        });
    }, []);

    useEffect(() => {
        if (schemaFields.classifications) {
            const opciones = processData(schemaFields.classifications, "clasificaciones", [
                {
                    value: "clasificaciones.id",
                    label: "ID",
                    id: 11,
                },
                {
                    value: "clasificaciones.description",
                    label: t("actions.form.description"),
                    id: 12,
                },
            ]);
            updateOpcionesBuilder(0, opciones);
        }
    }, [schemaFields.classifications, processData, updateOpcionesBuilder, t]);

    useEffect(() => {
        if (schemaFields.cases) {
            const opciones = processData(
                schemaFields.cases,
                "cases",
                includeStatus
                    ? [
                          {
                              value: "cases.estadoActual",
                              label: t("actions.form.status"),
                              id: 8,
                          },
                      ]
                    : [],
            );
            updateOpcionesBuilder(1, opciones);
        }
    }, [schemaFields.cases, processData, updateOpcionesBuilder, includeStatus, t]);

    useEffect(() => {
        if (schemaFields.clients) {
            const opciones = processData(schemaFields.clients, "clients");
            updateOpcionesBuilder(2, opciones);
        }
    }, [schemaFields.clients, processData, updateOpcionesBuilder]);

    useEffect(() => {
        if (schemaFields.users) {
            const opciones = processData(schemaFields.users, "usuarios");
            updateOpcionesBuilder(3, opciones);
        }
    }, [schemaFields.users, processData, updateOpcionesBuilder]);

    useEffect(() => {
        if (schemaFields.groups) {
            const opciones = processData(schemaFields.groups, "grupos");
            updateOpcionesBuilder(4, opciones);
        }
    }, [schemaFields.groups, processData, updateOpcionesBuilder]);

    useEffect(() => {
        setOpcionesBuilder((prev) => {
            const prevOrigins = prev.map((item) => item.dataOrigin);
            const toAdd = auxiliariesRules.filter((item) => !prevOrigins.includes(item.dataOrigin));
            return toAdd.length === 0 ? prev : [...prev, ...toAdd];
        });
    }, [auxiliariesRules]);

    return {
        opcionesBuilder,
        loading,
    };
};

export default useModelsData;
