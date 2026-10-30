import { useFormikContext } from "formik";
import { PropTypes } from "prop-types";
import { useTranslation } from "react-i18next";

import {
    Button,
    Dialog,
    DialogContent,
    DialogDescription,
    DialogFooter,
    DialogHeader,
    DialogTitle,
    InputForm as Input,
    KField,
    Label,
    Tabs,
    TabsContent,
    TabsList,
    TabsTrigger,
} from "@/components/ui-shared";
import SelectList from "@/components/ui-shared/src/components/select-list";
import { SwitchStateAdmin } from "@/components/core/switchState/SwitchStateAdmin";

import SchemasFields from "./SchemasFields";
import { dataTypeOptions, INITIAL_SCHEMA_FIELD_VALUES } from "../data/constants";
import { useCallback, useMemo, useRef } from "react";
import UIForm from "./UIForm";
import SourcesTab from "./SourcesTab/SourcesTab";
import Select from "@/componentsV2/core/Select";

const EditFieldModal = ({ isOpen, onClose, onSave, index = null }) => {
    const { t } = useTranslation();
    const { values, validateForm, setFieldValue, setFieldTouched } = useFormikContext();
    const savedRef = useRef(false);

    const field = useMemo(() => values?.fields?.[index], [values, isOpen]);

    const handleTypeChanged = useCallback(
        (type) => {
            const prev = field ?? {};
            const preservedUi =
                prev.ui && typeof prev.ui === "object" && !Array.isArray(prev.ui) ? { ...prev.ui } : null;
            const preservedSources =
                prev.sources && typeof prev.sources === "object" && !Array.isArray(prev.sources)
                    ? { ...prev.sources }
                    : null;

            const baseField = {
                name: prev.name ?? "",
                required: prev.required,
                unique: prev.unique,
                type,
                ...(type === "number" || type === "integer" ? { numberSign: prev.numberSign ?? "positive" } : {}),
                ...(type === "object" || type === "array" || type === "calculated" ? {} : { default: null }),
            };
            const typeDefaults = INITIAL_SCHEMA_FIELD_VALUES[type];
            let next = typeDefaults ? { ...baseField, ...typeDefaults } : baseField;
            if (preservedUi) {
                next = { ...next, ui: preservedUi };
            }
            if (preservedSources) {
                next = { ...next, sources: preservedSources };
            }
            setFieldValue(`fields[${index}]`, next);
        },
        [field, index, setFieldValue],
    );

    const schemaFields = useMemo(
        () => values?.fields?.map((f) => ({ value: f.name, label: f.name }))?.filter((_, i) => i !== index) ?? [],
        [values?.fields, index],
    );

    if (!isOpen || Number.isNaN(index)) return null;

    const handleDialogClose = (open) => {
        if (!open) {
            if (!savedRef.current) {
                onClose(false);
            }
            savedRef.current = false;
        }
    };

    return (
        <Dialog open={isOpen} onOpenChange={handleDialogClose}>
            <DialogContent className="sm:max-w-[768px] max-h-[calc(100vh-2rem)] overflow-auto">
                <DialogHeader>
                    <DialogTitle>{t("auxSchema.fieldDetails")}</DialogTitle>
                </DialogHeader>
                <DialogDescription>{t("auxSchema.form.description")}</DialogDescription>

                <div className="flex flex-col justify-stretch gap-2">
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-4 mb-4">
                        <KField>
                            <Input
                                name={`fields[${index}].name`}
                                label={t("auxSchema.form.fieldName")}
                                type="text"
                                className="flex flex-col items-start justify-start text-start"
                            />
                        </KField>
                        <div className="flex flex-col items-start justify-start text-start">
                            <Label className="mb-2">{t("auxSchema.form.dataType")}</Label>
                            <SelectList
                                options={dataTypeOptions}
                                value={field?.type ?? ""}
                                defaultValue={field?.type ?? ""}
                                onChange={handleTypeChanged}
                            />
                        </div>
                    </div>
                    <SwitchStateAdmin
                        name={`fields[${index}].required`}
                        title={t("auxSchema.form.required")}
                        tipo="boolean"
                    />
                    <SwitchStateAdmin
                        name={`fields[${index}].unique`}
                        title={t("auxSchema.form.unique")}
                        tipo="boolean"
                    />
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                        <SwitchStateAdmin
                            name={`fields[${index}].dependency`}
                            title={t("auxSchema.form.dependency")}
                            tipo="boolean"
                        />
                        {values.fields?.[index]?.dependency && (
                            <div className="my-2">
                                {schemaFields?.length ? (
                                    <Select
                                        t={t}
                                        options={schemaFields}
                                        label={t("auxSchema.form.dependencyField")}
                                        value={values?.fields[index]?.dependsOn ?? ""}
                                        onChangeHandler={(selected) =>
                                            setFieldValue(`fields[${index}].dependsOn`, selected)
                                        }
                                        handlerClear={() => setFieldValue(`fields[${index}].dependsOn`, null)}
                                    />
                                ) : (
                                    <p>{t("auxSchema.form.noFields")}</p>
                                )}
                            </div>
                        )}
                    </div>
                    {values.fields?.[index]?.dependency && !!values.fields?.[index]?.dependsOn && (
                        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                            <SwitchStateAdmin
                                name={`fields[${index}].dependencyValueValidation`}
                                title={t("auxSchema.form.dependencyValueValidation")}
                                tipo="boolean"
                            />
                            {values.fields?.[index]?.dependencyValueValidation && (
                                <KField>
                                    <Input
                                        name={`fields[${index}].dependencyValue`}
                                        label={t("auxSchema.form.dependencyValue")}
                                        type="text"
                                        className="flex flex-col items-start justify-start text-start"
                                    />
                                </KField>
                            )}
                        </div>
                    )}

                    <hr className="my-4" />

                    <Tabs defaultValue="structure" className="w-full">
                        <TabsList className="relative !z-[99] w-full">
                            <TabsTrigger value="structure" data-testid="btn_structure_tab">
                                {t("auxSchema.form.title.structure")}
                            </TabsTrigger>
                            <TabsTrigger value="ui" data-testid="btn_ui_tab">
                                {t("auxSchema.form.title.ui")}
                            </TabsTrigger>
                            <TabsTrigger value="sources" data-testid="btn_sources_tab">
                                {t("auxSchema.form.title.sources")}
                            </TabsTrigger>
                        </TabsList>
                        <TabsContent value="structure" className="flex w-full" data-testid="structure_tab_content">
                            <SchemasFields
                                type={values?.fields?.[index]?.type}
                                namePrefix={`fields[${index}]`}
                                index={index}
                            />
                        </TabsContent>
                        <TabsContent value="ui" className="flex w-full" data-testid="ui_tab_content">
                            <UIForm index={index} field={`fields[${index}]`} />
                        </TabsContent>
                        <TabsContent value="sources" className="flex w-full" data-testid="sources_tab_content">
                            <SourcesTab fieldIndex={index} field={`fields[${index}]`} />
                        </TabsContent>
                    </Tabs>
                </div>

                <DialogFooter>
                    <Button
                        type="button"
                        onClick={async () => {
                            const currentField = values?.fields?.[index];
                            if (currentField) {
                                await Promise.all(
                                    Object.keys(currentField).map((key) =>
                                        setFieldTouched(`fields[${index}].${key}`, true, false),
                                    ),
                                );
                            }
                            const validationErrors = await validateForm();
                            if (!validationErrors?.fields || validationErrors?.fields?.length === 0) {
                                savedRef.current = true;
                                if (onSave) {
                                    onSave();
                                } else {
                                    onClose(true);
                                }
                            }
                        }}
                        id="btn_edit_field_save"
                        data-testid="btn_edit_field_save"
                    >
                        {t("button.save")}
                    </Button>
                </DialogFooter>
            </DialogContent>
        </Dialog>
    );
};

EditFieldModal.propTypes = {
    isOpen: PropTypes.bool.isRequired,
    onClose: PropTypes.func.isRequired,
    onSave: PropTypes.func,
    index: PropTypes.number,
};

export default EditFieldModal;
