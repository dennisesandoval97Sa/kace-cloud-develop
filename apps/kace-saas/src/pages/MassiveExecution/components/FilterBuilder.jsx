import React, { useMemo, useState } from "react";
import PropTypes from "prop-types";
import { useTranslation } from "react-i18next";
import { useFormikContext, FieldArray, getIn } from "formik";
import { PlusCircle, Trash2, Pen } from "lucide-react";
import {
    Button,
    Dialog,
    DialogContent,
    DialogHeader,
    DialogTitle,
    DialogFooter
} from "@/components/ui-shared";
import { SelectField } from "@/components/core/SearchClient/SelectField";
import JSONEditor from "@/componentsV2/lib/JSONEditor";
import { transformToJSON } from "@/componentsV2/lib/JSONEditor/helpers";

const FilterBuilder = ({ name, rules }) => {
    const { t } = useTranslation();
    const { values } = useFormikContext();
    const [editingIndex, setEditingIndex] = useState(null);

    const filters = getIn(values, name) || [];

    const getFieldOperators = (fieldName) => {
        return [
            {label: "tmp operator", value: "operator"},
        ];
    };

    const handleCloseModal = () => setEditingIndex(null);

    return (
        <div>
            <FieldArray
                name={name}
                render={(arrayHelpers) => (
                    <div className="space-y-3">
                        {filters.length > 0 && filters.map((filter, index) => {
                            const propertyName = getIn(values, `${name}[${index}].property`);
                            const operatorOptions = getFieldOperators(propertyName);
                            const valueForDisplay = getIn(values, `${name}[${index}].value`);
                            const displayString = valueForDisplay ? JSON.stringify(transformToJSON(valueForDisplay)) : "()";

                            return (
                                <div key={index} className="grid grid-cols-12 gap-x-2 items-center">
                                    <div className="col-span-12 sm:col-span-3">
                                        <SelectField
                                            name={`${name}[${index}].property`}
                                            options={Object.keys(rules).map(prop => ({
                                                label: prop,
                                                value: prop,
                                            }))}
                                        />
                                    </div>

                                    <div className="col-span-12 sm:col-span-3">
                                        <SelectField
                                            name={`${name}[${index}].operator`}
                                            options={operatorOptions}
                                            disabled={!propertyName}
                                        />
                                    </div>

                                    <div className="col-span-12 sm:col-span-5 flex items-center gap-2 rounded-md border bg-muted px-3 py-2 text-sm">
                                        <p className="truncate font-mono">{displayString}</p>
                                        <Button
                                            type="button"
                                            variant="ghost"
                                            size="icon"
                                            className="ml-auto h-6 w-6"
                                            onClick={() => setEditingIndex(index)}
                                        >
                                            <Pen className="h-3 w-3" />
                                        </Button>
                                    </div>

                                    <div className="col-span-1">
                                        <Button
                                            type="button"
                                            variant="outline"
                                            size="icon"
                                            onClick={() => arrayHelpers.remove(index)}
                                        >
                                            <Trash2 className="h-4 w-4 text-red-500" />
                                        </Button>
                                    </div>
                                </div>
                            );
                        })}

                        <Button
                            type="button"
                            variant="outline"
                            onClick={() => arrayHelpers.push({ property: "", operator: "", value: [] })}
                        >
                            <PlusCircle className="mr-2 h-4 w-4" />
                            {t("filters.addFilter")}
                        </Button>
                    </div>
                )}
            />

            <Dialog open={editingIndex !== null} onOpenChange={handleCloseModal}>
                <DialogContent className="sm:max-w-2xl">
                    <DialogHeader>
                        <DialogTitle>{t("filters.editValueTitle")}</DialogTitle>
                    </DialogHeader>
                    <div className="py-4">
                        {editingIndex !== null && (
                            <JSONEditor
                                namePrefix={`${name}[${editingIndex}].value`}
                                allowObjects={true}
                                allowArrays={true}
                            />
                        )}
                    </div>
                    <DialogFooter>
                        <Button onClick={handleCloseModal}>{t("app.button.save")}</Button>
                    </DialogFooter>
                </DialogContent>
            </Dialog>
        </div>
    );
};

FilterBuilder.propTypes = {
    name: PropTypes.string.isRequired,
    rules: PropTypes.object.isRequired,
};

export default FilterBuilder;