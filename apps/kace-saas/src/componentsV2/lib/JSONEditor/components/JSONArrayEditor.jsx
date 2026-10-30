import React from "react";
import PropTypes from "prop-types";
import { useTranslation } from "react-i18next";
import { FieldArray, useFormikContext, getIn } from "formik";
import { cloneDeep } from "lodash";
import { Uuid } from "@kace/plugins";
import { Button } from "@/components/ui-shared";
import { PlusCircle, Trash2 } from "lucide-react";
import JSONEditor from "..";

const JSONArrayEditor = ({
    namePrefix,
    template,
    enableStructureModifications=true,
}) => {
    const { t } = useTranslation();
    const { values } = useFormikContext();
    const items = getIn(values, namePrefix) || [];

    const handleAddItem = (arrayHelpers) => {
        const newItem = cloneDeep(template).map(prop => ({ ...prop, id: Uuid() }));
        arrayHelpers.push(newItem);
    };

    return (
        <div className="mt-2">
            <FieldArray
                name={namePrefix}
                render={(arrayHelpers) => (
                    <div className="space-y-3">
                        {items.map((item, index) => (
                            <div key={index} className="flex items-start gap-2 p-2 border bg-white rounded-md">
                                <span className="pt-2 font-mono text-sm text-gray-500">{index}:</span>
                                <div className="flex-grow">
                                    <JSONEditor
                                        namePrefix={`${namePrefix}[${index}]`}
                                        enableAddingProperty={false}
                                        enablePropertyRename={false}
                                        enableTypeChange={false}
                                        enableStructureModifications={false}
                                    />
                                </div>
                                <Button
                                    type="button"
                                    variant="ghost"
                                    size="icon"
                                    onClick={() => arrayHelpers.remove(index)}
                                >
                                    <Trash2 className="h-4 w-4 text-red-500" />
                                </Button>
                            </div>
                        ))}
                         <Button type="button" variant="outline" onClick={() => handleAddItem(arrayHelpers)}>
                            <PlusCircle className="h-4 w-4 mr-2" />
                            {t("jsonEditor.addItem")}
                        </Button>
                    </div>
                )}
            />
        </div>
    );
};

JSONArrayEditor.propTypes = {
    namePrefix: PropTypes.string.isRequired,
    template: PropTypes.array.isRequired,
    enableStructureModifications: PropTypes.bool,
};

export default JSONArrayEditor;
