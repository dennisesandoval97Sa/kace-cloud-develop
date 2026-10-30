import React from "react";
import PropTypes from "prop-types";
import { useTranslation } from "react-i18next";
import { getIn, useFormikContext } from "formik";
import {
    Button,
    Dialog,
    DialogContent,
    DialogFooter,
    DialogHeader,
    DialogTitle,
    InputForm as Input,
    KField,
    Label,
} from "@/components/ui-shared";
import SelectList from "@/components/ui-shared/src/components/select-list";
import { SwitchStateAdmin } from "@/components/core/switchState/SwitchStateAdmin";

const EditPropertyModal = ({
    isOpen,
    onClose,
    namePrefix,
    availableTypes,
    enablePropertyRename,
    enableTypeChange,
    enableStructureModifications,
    isRoot = false,
 }) => {
    const { t } = useTranslation();
    const { values, setFieldValue, validateForm } = useFormikContext();

    const property = getIn(values, namePrefix);
    const type = property?.type;

    const handleTypeChange = (newType) => {
        setFieldValue(`${namePrefix}.type`, newType);
        setFieldValue(`${namePrefix}.value`, undefined);

        if (newType === "object") {
            setFieldValue(`${namePrefix}.value`, []);
        } else if (newType === "array") {
            setFieldValue(`${namePrefix}.template`, []);
            setFieldValue(`${namePrefix}.items`, []);
            setFieldValue(`${namePrefix}.allowDynamicProperties`, true);
        } else if (newType === "boolean") {
            setFieldValue(`${namePrefix}.value`, false);
        } else if (newType === "number") {
            setFieldValue(`${namePrefix}.value`, null);
        } else {
            setFieldValue(`${namePrefix}.value`, "");
        }
    };

    const typeOptions = availableTypes.map(option => ({
        value: option,
        name: t(`jsonEditor.types.${option}`),
    }));

    const handleSave = () => {
        validateForm();
        onClose();
    };

    return (
        <Dialog open={isOpen} onOpenChange={onClose}>
            <DialogContent className="sm:max-w-[425px]">
                <DialogHeader>
                    <DialogTitle>{t("jsonEditor.editProperty")}</DialogTitle>
                </DialogHeader>

                <div className="flex flex-col gap-4 py-4">
                    {!isRoot && (
                        <div className="flex flex-row items-center gap-4">
                            <Label htmlFor={`${namePrefix}.name`}>
                                {t("jsonEditor.propertyName")}
                            </Label>
                            <div className="flex-grow">
                                <KField>
                                    <Input
                                        className="w-full"
                                        id={`${namePrefix}.name`}
                                        name={`${namePrefix}.name`}
                                        disabled={!enablePropertyRename}
                                    />
                                </KField>
                            </div>
                        </div>
                    )}
                    <div className="flex flex-row items-center gap-4">
                        <Label className="w-1/4">{t("jsonEditor.type")}</Label>
                        <div className="flex-grow">
                            <SelectList
                                options={typeOptions}
                                value={type}
                                defaultValue={type}
                                onChange={handleTypeChange}
                                disabled={!enableTypeChange}
                            />
                        </div>
                    </div>
                    {type === "string" && (
                        <div className="flex flex-row items-center gap-4">
                            <Label htmlFor={`${namePrefix}.value`} className="w-1/4">
                                {t("jsonEditor.value")}
                            </Label>
                            <div className="flex-grow">
                                <KField>
                                    <Input id={`${namePrefix}.value`} name={`${namePrefix}.value`} />
                                </KField>
                            </div>
                        </div>
                    )}
                    {type === "number" && (
                        <div className="flex flex-row items-center gap-4">
                            <Label htmlFor={`${namePrefix}.value`} className="w-1/4 text-right">
                                {t("jsonEditor.value")}
                            </Label>
                            <div className="flex-grow">
                                <KField>
                                    <Input id={`${namePrefix}.value`} name={`${namePrefix}.value`} type="number" />
                                </KField>
                            </div>
                        </div>
                    )}
                    {type === "boolean" && (
                         <div className="flex flex-row items-center gap-4">
                            <Label className="w-1/4 text-right">{t("jsonEditor.value")}</Label>
                            <div className="flex-grow">
                                <SwitchStateAdmin name={`${namePrefix}.value`} tipo="boolean" />
                            </div>
                        </div>
                    )}
                </div>

                <DialogFooter>
                    <Button type="button" onClick={handleSave}>
                        {t("app.button.save")}
                    </Button>
                </DialogFooter>
            </DialogContent>
        </Dialog>
    );
};

EditPropertyModal.propTypes = {
    isOpen: PropTypes.bool.isRequired,
    onClose: PropTypes.func.isRequired,
    namePrefix: PropTypes.string.isRequired,
    availableTypes: PropTypes.arrayOf(PropTypes.string).isRequired,
    isRoot: PropTypes.bool,
    enablePropertyRename: PropTypes.bool.isRequired,
    enableTypeChange: PropTypes.bool.isRequired,
    enableStructureModifications: PropTypes.bool.isRequired,
};

export default EditPropertyModal;
