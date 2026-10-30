import useConfigAgentData from "@kace/hooks/useConfigAgentData";
import { useFormikContext } from "formik";
import { useCallback, useEffect, useMemo, useState } from "react";
import useAdminCaseCacheData from "../../../hooks/useAdminCaseCacheData";
import useAdminCasesUserInfo from "../../../hooks/useAdminCaseUserInfo";
import {
    createOptions,
    findOptionByValue,
    getCurrentOptions,
} from "../helpers/AdminCaseClassificationsHelpers";
import useAdminCaseClassificationSelectObject from "./useAdminCaseClassificationSelectObject";
import useAdminCaseCurrentClassifications
    from "@/pages/Cases/components/AdminCase/components/AdminCaseClassifications/hooks/useAdminCaseCurrentClassifications";
import useAdminCaseRawClassifications
    from "@/pages/Cases/components/AdminCase/components/AdminCaseClassifications/hooks/useAdminCaseRawClassifications";
import { useLocation } from "react-router-dom";
import useGenericViewQuery from "@/hooks/useGenericViewQuery";
import { URL_AND_KEYS } from "@/utils/urlAndKeys";

const useClassifications = (handleStatus) => {
    const { setFieldValue } = useFormikContext();
    const { classificationSelectObject, IsLoadingClassificationSelectObject } =
        useAdminCaseClassificationSelectObject();
    const [selectedOptions, setSelectedOptions] = useState({});
    const { caseCacheData } = useAdminCaseCacheData();
    const { selectedGroup } = useAdminCasesUserInfo();
    const { AgentNameFields } = useConfigAgentData();

    const location = useLocation();
    const casesParentData = location.state;

    const groupId = useMemo(() => selectedGroup || caseCacheData?.grupo_id || "", [caseCacheData?.grupo_id, selectedGroup]);

    const { rawCurrentData, isLoadingRawCurrentData } = useAdminCaseCurrentClassifications(caseCacheData?.clasificacion_id);
    
    const { data: parentClassificationData } = useGenericViewQuery({
        keyQuery: [URL_AND_KEYS.cases.byCaseId, caseCacheData.parent_id],
        searchById: caseCacheData.parent_id,
        url: `${URL_AND_KEYS.cases.url}/${caseCacheData.parent_id}`,
        enabled: !!caseCacheData?.parent_id,
    });
    
    const { rawData, isLoadingRawData } = useAdminCaseRawClassifications({
        groupId,
        classification_parent_id: caseCacheData.parent_id ? parentClassificationData?.clasificacion_id : casesParentData?.clasificacion_id
    });

    const classificationsData = useMemo(
        () => createOptions([...(rawData ?? []), ...rawCurrentData]),
        [rawData, rawCurrentData],
    );
    
    const levelKeys = useMemo(() => {
        if (!rawData.length) return [];
        const classificationsNamesFields = AgentNameFields?.classifications;
        const classificationsLevels = {};
        Object.keys(rawData[0])
            .filter((k) => k.startsWith("nivel"))
            .forEach(
                (level, index) => {
                    const label = classificationsNamesFields?.[`label_${index + 1}`] || level.replace("nivel", "Nivel ");
                    classificationsLevels[`label_${index + 1}`] = label;
                },
            );
        return classificationsLevels;
    }, [rawData]);

    const handleSelectClassification = useCallback(
        (level, selectedValue, clearStates = false) => {
            if (clearStates) {
                setFieldValue("flujo_id", "", false);
                setFieldValue("transicion_id", "", false);
            }
            setFieldValue(level, selectedValue, false);
            setSelectedOptions((prev) => {
                const newSelectedOptions = { ...prev, [level]: selectedValue };
                Object.keys(newSelectedOptions)
                    .filter(
                        (key) =>
                            parseInt(key.replace("nivel", "")) >
                            parseInt(level.replace("nivel", "")),
                    )
                    .forEach((key) => {
                        delete newSelectedOptions[key];
                    });
                return newSelectedOptions;
            });
        },
        [setFieldValue],
    );

    useEffect(() => {
        if (!classificationSelectObject || !classificationsData.length) return;

        const initialSelectedOptions = {};

        Object.keys(classificationSelectObject)
            .filter((key) => key.startsWith("nivel"))
            .sort()
            .forEach((key) => {
                const nivel = key;
                const value = classificationSelectObject[key];

                const matchingOption = classificationsData.find((opt) =>
                    findOptionByValue(opt, value, nivel),
                );

                if (matchingOption) {
                    initialSelectedOptions[nivel] = value;
                    setFieldValue(nivel, value, false);
                }
            });

        if (Object.keys(initialSelectedOptions).length > 0) {
            setSelectedOptions(initialSelectedOptions);
        }
        handleStatus();
    }, [classificationSelectObject]);

    useEffect(() => {
        if (
            !classificationsData?.length ||
            !Object.keys(selectedOptions).length
        ) {
            return;
        }

        Object.keys(selectedOptions).forEach((nivel) => {
            const currentOptions = getCurrentOptions(
                nivel,
                classificationsData,
                selectedOptions,
            );

            if (currentOptions?.length && selectedOptions[nivel]) {
                const selectedOpt = currentOptions.find(
                    (opt) => opt.value === selectedOptions[nivel],
                );

                if (
                    selectedOpt &&
                    (!selectedOpt.options || selectedOpt.options.length === 0)
                ) {
                    setFieldValue("flujo_id", selectedOpt.flujo_id, true);
                    setFieldValue(
                        "clasificacion_id",
                        selectedOpt.clasificacion_id,
                        true,
                    );
                    handleStatus();
                }
            }
        });
    }, [selectedOptions]);

    return {
        classificationsData,
        selectedOptions,
        levelKeys,
        isLoadingClassifications:
            IsLoadingClassificationSelectObject || isLoadingRawCurrentData || isLoadingRawData,
        handleSelectClassification,
    };
};

export default useClassifications;
