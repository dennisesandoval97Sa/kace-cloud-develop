import { forwardRef, useEffect, useMemo, useState } from "react";
import { useTranslation } from "react-i18next";
import { useQuery } from "@tanstack/react-query";
import PropTypes from "prop-types";

import { apiService, CLASSIFICATION_LEVELS_SERVICE } from "@kace/utils";
import { Select, SelectContent, SelectGroup, SelectItem, SelectLabel, SelectTrigger, SelectValue } from "./ui/select";
import { ComboBox } from "./ComboBox";

const NIVEL_REGEX = /nivel([1-9]|10)/i;
const VALID_LEVEL_REGEX = /^nivel([1-9]|10)$/i;
const INNER_NIVEL_REGEX = /^nivel(?:[1-9]|10)\/(.*)$/i;
const STALE_TIME_24H = 1000 * 60 * 60 * 24;

/**
 * Normaliza cualquier formato de valor de clasificación hacia { level, classification }.
 *
 * Entradas soportadas:
 *   - string  "clasificaciones.nivel1/MEXICO"  →  { level: "nivel1", classification: "MEXICO" }
 *   - string  "nivel2/"                        →  { level: "nivel2", classification: "" }
 *   - object  { field: "...", value: "..." }   →  idem
 *   - falsy                                    →  { level: "", classification: "" }
 *
 * NOTA: El regex elimina agresivamente un prefijo "nivelN/" anidado dentro del valor (ej.
 * { field: "clasificaciones.nivel1", value: "nivel1/TEST" } → { level: "nivel1", classification: "TEST" }).
 * Se asume que los valores reales de clasificación devueltos por el backend no comienzan con "nivelN/".
 * Si un valor legítimo tuviera este formato, se truncaría incorrectamente.
 */
export const parseClassificationValue = (raw) => {
    if (!raw) return { level: "", classification: "" };

    let rawField = "";
    let rawVal = "";

    if (typeof raw === "object") {
        rawField = raw.field ?? raw.level ?? "";
        rawVal = raw.value ?? "";
    } else if (typeof raw === "string") {
        if (raw.includes("/")) {
            const [head, ...rest] = raw.split("/");
            rawField = head;
            rawVal = rest.join("/");
        } else {
            rawField = raw;
        }
    }

    const nivelMatch = String(rawField).match(NIVEL_REGEX);
    const level = nivelMatch ? `nivel${nivelMatch[1]}`.toLowerCase() : "";

    let classification = String(rawVal ?? "").trim();

    if (classification === "null" || classification === "undefined") {
        classification = "";
    }

    const innerMatch = classification.match(INNER_NIVEL_REGEX);
    if (innerMatch) {
        classification = innerMatch[1] === "null" ? "" : innerMatch[1];
    }

    return { level, classification };
};

/*
 * Kept as a local default (not imported from the Cases layer's
 * classificationLevels.util) to keep this ui-shared component decoupled from
 * that domain. Callers in Cases pass their own maxLevel explicitly.
 */
const MAX_CLASSIFICATION_LEVELS = 10;

export const SelectByListLevels = forwardRef(({ value, onChange, maxLevel = MAX_CLASSIFICATION_LEVELS }, ref) => {
    const { t } = useTranslation();

    const { level: parsedLevel, classification: parsedClassification } = useMemo(
        () => parseClassificationValue(value),
        [value],
    );

    const [selectedLevel, setSelectedLevel] = useState(parsedLevel);
    const [selectedOption, setSelectedOption] = useState(parsedClassification);

    useEffect(() => {
        setSelectedLevel(parsedLevel);
        setSelectedOption(parsedClassification);
    }, [parsedLevel, parsedClassification]);

    const isLevelValid = !!selectedLevel && VALID_LEVEL_REGEX.test(selectedLevel);

    const { data: levelData, isLoading } = useQuery({
        queryKey: ["listLevelsFor", selectedLevel],
        queryFn: () =>
            apiService.get(`${CLASSIFICATION_LEVELS_SERVICE}/${selectedLevel}`, {
                limit: 0,
                offset: 0,
            }),
        refetchOnWindowFocus: false,
        staleTime: STALE_TIME_24H,
        enabled: isLevelValid,
    });

    const menuOptions = useMemo(() => {
        const items = levelData?.data?.data?.items;
        if (!items) return [];

        return items
            .filter((item) => item !== null && item !== "")
            .map((item, index) => ({ id: index, label: item, value: item }));
    }, [levelData]);

    const handleLevelChange = (level) => {
        setSelectedLevel(level);
        setSelectedOption("");
        onChange?.(`${level}/`);
    };

    const handleOptionChange = (option) => {
        setSelectedOption(option);
        if (selectedLevel) {
            onChange?.(`${selectedLevel}/${option || ""}`);
        } else {
            onChange?.("");
        }
    };

    return (
        <div className="grid grid-cols-5">
            <Select
                value={selectedLevel}
                onValueChange={handleLevelChange}
                data-testid="select_categories"
                id="select_categories"
            >
                <SelectTrigger
                    className="col-span-2 flex gap-2 rounded-e-none"
                    id="btn_select_levels"
                    data-testid="btn_select_levels"
                >
                    <SelectValue
                        ref={ref}
                        placeholder={t("app.text.selectLevel")}
                        id="select_list_categories"
                        data-testid="select_list_categories"
                    />
                </SelectTrigger>

                <SelectContent scrollable id="select_lis_content" data-testid="select_list_content">
                    <SelectGroup id="select_group" data-testid="select_group">
                        <SelectLabel id="select_label_options" data-testid="select_label_options">
                            {t("app.text.options")}
                        </SelectLabel>
                        {Array.from({ length: Math.max(0, maxLevel) }, (_, index) => index + 1).map((level) => (
                            <SelectItem
                                key={`nivel${level}`}
                                value={`nivel${level}`}
                                data-testid={`select_item_nivel${level}`}
                                id={`select_item_nivel${level}`}
                            >
                                {t(`globalConfigLabels.clasificaciones.nivel${level}`)}
                            </SelectItem>
                        ))}
                    </SelectGroup>
                </SelectContent>
            </Select>

            <ComboBox
                id="select_list_levels_opt"
                dataTestId="select_list_levels_opt"
                className="col-span-3 flex gap-2 rounded-s-none"
                placeholder={t("app.text.optionsPlaceholder")}
                data={menuOptions}
                defaultValue={selectedOption}
                loading={isLoading}
                handleOnChange={handleOptionChange}
            />
        </div>
    );
});

SelectByListLevels.displayName = "SelectByListLevels";

SelectByListLevels.propTypes = {
    value: PropTypes.oneOfType([PropTypes.string, PropTypes.object]),
    onChange: PropTypes.func,
    setValueOfLevel: PropTypes.func,
    maxLevel: PropTypes.number,
};
