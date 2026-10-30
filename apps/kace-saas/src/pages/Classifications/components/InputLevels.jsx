import { Button, Input } from "@kace/ui-shared";
import { PropTypes } from "prop-types";
import { useState } from "react";
import { useTranslation } from "react-i18next";
import { toast } from "sonner";
import { normalizeClassificationLevelName } from "../helpers/classificationLevels";

export const InputLevels = ({ setLevels, levelList = [], setValues }) => {
    const [newLevel, setNewLevel] = useState("");
    const { t } = useTranslation();
    const handleNewLevel = () => {
        const trimmedLevel = newLevel.trim();
        const normalizedLevel = normalizeClassificationLevelName(trimmedLevel);
        const hasDuplicateLevelName = levelList.some(
            (level) => normalizeClassificationLevelName(level) === normalizedLevel,
        );
        if (hasDuplicateLevelName) {
            toast.warning(t("classification.form.alerts.sameName"));
            return;
        }
        if (levelList.length >= 10) {
            toast.warning(t("classification.form.alerts.maxmumOptions"));
            return;
        }
        if (trimmedLevel.length === 0) return;
        setLevels((prev) => [...prev, trimmedLevel]);
        setValues(`nivel${levelList.length + 1}`, trimmedLevel);
        setNewLevel("");
    };
    const handleValue = (e) => {
        setNewLevel(e.target.value);
    };
    return (
        <div className="flex gap-2">
            <Button
                type="button"
                onClick={handleNewLevel}
                id="btn_input_add_level"
                data-testid="btn_input_add_level"
                className="bg-primary/40 text-primary border border-primary"
            >
                Agregar nuevo nivel
            </Button>
            <Input
                onChange={(e) => handleValue(e)}
                className=""
                autoComplete="off"
                value={newLevel}
                data-testid="input_levels"
                placeholder={t("classification.form.placeholder.inputNewLevel")}
                name="levels"
            />
        </div>
    );
};
InputLevels.propTypes = {
    setLevels: PropTypes.func.isRequired,
    levelList: PropTypes.array.isRequired,
    setValues: PropTypes.func,
};
