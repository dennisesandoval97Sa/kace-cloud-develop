import { useTranslation } from "react-i18next";
import { Form, FieldArray, useFormikContext, getIn } from "formik";
import { PlusCircle } from "lucide-react";
import { Uuid } from "@kace/plugins";
import { Button } from "@/components/ui-shared";
import PropTypes from "prop-types";
import JSONProperty from "./components/JSONProperty";

const JSONEditor = ({
    namePrefix = "properties",
    allowObjects = false,
    allowArrays = false,
    enablePropertyRename = true,
    enableTypeChange = true,
    enableAddingProperty = true,
    enableStructureModifications = true,
}) => {
    const { t } = useTranslation();
    const { values } = useFormikContext();
    const properties = getIn(values, namePrefix) || [];

    return (
        <div className="w-full">
            <Form autoComplete="off">
                <FieldArray
                    name={namePrefix}
                    render={(arrayHelpers) => (
                        <div className="space-y-2 p-2 bg-gray-50 rounded-lg border border-gray-200">
                            {properties.length > 0 ? (
                                properties.map((property, index) => (
                                    <JSONProperty
                                        key={property.id}
                                        namePrefix={`${namePrefix}[${index}]`}
                                        onRemove={() => arrayHelpers.remove(index)}
                                        enablePropertyRename={enablePropertyRename}
                                        enableTypeChange={enableTypeChange}
                                        allowObjects={allowObjects}
                                        allowArrays={allowArrays}
                                        isRoot={false}
                                        enableStructureModifications={enableStructureModifications}
                                    />
                                ))
                            ) : (
                                <div className="text-center text-gray-400 py-4">
                                    {t(`jsonEditor.noProperties${enableStructureModifications ? "Dynamic" : ""}`)}
                                </div>
                            )}
                            {enableAddingProperty && enableStructureModifications && (
                                <div className="pt-2">
                                    <Button
                                        type="button"
                                        onClick={() => arrayHelpers.push({
                                            id: Uuid(),
                                            name: `${t("jsonEditor.newProperty")}${properties.length}`,
                                            type: "string",
                                            value: ""
                                        })}
                                    >
                                        <PlusCircle className="h-4 w-4 mr-2" />
                                        <span>{t("jsonEditor.addProperty")}</span>
                                    </Button>
                                </div>
                            )}
                        </div>
                    )}
                />
            </Form>
        </div>
    );
};

JSONEditor.propTypes = {
    namePrefix: PropTypes.string.isRequired,
    allowObjects: PropTypes.bool,
    allowArrays: PropTypes.bool,
    enablePropertyRename: PropTypes.bool,
    enableTypeChange: PropTypes.bool,
    enableAddingProperty: PropTypes.bool,
    enableStructureModifications: PropTypes.bool,
};

export default JSONEditor;
