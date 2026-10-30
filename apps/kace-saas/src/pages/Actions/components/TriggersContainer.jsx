import { Checkbox, Label } from "@kace/ui-shared";
import { PropTypes } from "prop-types";
import { useLocation } from "react-router-dom";
import { useTranslation } from "react-i18next";
import { useMemo } from "react";
import { useFormikContext } from "formik";

const TRIGGERS = {
    case: [
        { value: "crear_caso", label: "actions.labels.create_case" },
        { value: "editar_caso", label: "actions.labels.update_case" },
        { value: "cambio_estado", label: "actions.labels.change_state" },
        { value: "cron_job", label: "actions.labels.cron_job" },
    ],
    user: [
        { value: "create_user", label: "actions.labels.create_user" },
        { value: "update_user", label: "actions.labels.update_user" },
        { value: "delete_user", label: "actions.labels.delete_user" },
        { value: "cron_job", label: "actions.labels.cron_job" },
    ],
    group: [
        { value: "create_group", label: "actions.labels.create_group" },
        { value: "update_group", label: "actions.labels.update_group" },
        { value: "delete_group", label: "actions.labels.delete_group" },
        { value: "cron_job", label: "actions.labels.cron_job" },
    ],
};

export const TriggersContainer = ({ setFieldValue, valueField = [], name = "" }) => {
    const { t } = useTranslation();
    const location = useLocation();
    const { title } = location.state || {};

    const { values } = useFormikContext();

    const handleCheckedChange = (value, itemValue) => {
        if (value) {
            setFieldValue(name, [...valueField, itemValue]);
        } else {
            setFieldValue(
                name,
                valueField.filter((item) => item !== itemValue),
            );
        }
    };

    const allTriggers = useMemo(() => {
        return TRIGGERS[values?.entity || "case"];
    }, [TRIGGERS, title, values?.entity]);

    return (
        <div className="p-2 border-t border-input">
            <h3 className="text-lg">{t("actions.labels.triggers")}</h3>
            {allTriggers.map((item) => (
                <div key={item.value} className="flex gap-2 mt-2">
                    <Checkbox
                        id={item.value}
                        onCheckedChange={(value) => {
                            handleCheckedChange(value, item.value);
                        }}
                        checked={valueField.includes(item.value)}
                        data-testid={`chekbox_triggers_${item.value}`}
                    />
                    <Label htmlFor={t(item.value)}>{t(item.label)}</Label>
                </div>
            ))}
        </div>
    );
};

TriggersContainer.propTypes = {
    setFieldValue: PropTypes.func,
    valueField: PropTypes.array,
    name: PropTypes.string,
};
