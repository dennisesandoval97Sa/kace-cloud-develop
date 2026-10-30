import React, { useState, useMemo } from "react";
import PropTypes from "prop-types";
import { useFormikContext, getIn } from "formik";
import { Pen, Trash2, ChevronRight, ChevronDown } from "lucide-react";
import { useTranslation } from "react-i18next";
import { Button } from "@/components/ui-shared";
import EditPropertyModal from "./EditPropertyModal";
import JSONEditor from "..";
import JSONArrayEditor from "./JSONArrayEditor";

const DEFAULT_COLLAPSE_THRESHOLD = 5;

const JSONProperty = ({
    namePrefix,
    allowObjects,
    allowArrays,
    onRemove,
    isRoot,
    enableStructureModifications,
}) => {
    const { t } = useTranslation();
    const { values } = useFormikContext();
    const [isEditing, setIsEditing] = useState(false);
    const [arrayView, setArrayView] = useState("items");

    const property = getIn(values, namePrefix);

    const isComplexType = property?.type === "object" || property?.type === "array";

    const [isCollapsed, setIsCollapsed] = useState(() => {
        if (!isComplexType) return false;
        const count = property.type === 'object' ? property.value?.length : property.items?.length;
        return (count || 0) > DEFAULT_COLLAPSE_THRESHOLD;
    });

    const availableTypes = useMemo(() => {
        const types = ["string", "number", "boolean"];
        if (allowObjects) types.push("object");
        if (allowArrays) types.push("array");
        return types;
    }, [allowObjects, allowArrays]);

    const isNestedStructureEditable = (property?.type === 'object' || property?.allowDynamicProperties) && enableStructureModifications;

    const displayValue = useMemo(() => {
        if (property?.type === "array") {
            const count = property.items?.length || 0;
            const itemLabel = t(count === 1 ? "jsonEditor.item" : "jsonEditor.items");
            return `(${count} ${itemLabel})`;
        }
        if (property?.type === "object") {
            const count = property.value?.length || 0;
            const itemLabel = t(count === 1 ? "jsonEditor.property" : "jsonEditor.properties");
            return `(${count} ${itemLabel})`;
        }
        if (typeof property?.value === "boolean") {
            return property.value.toString();
        }
        if (property?.value === null || property?.value === undefined || property?.value === "") {
            return <span className="italic text-gray-400">({t("jsonEditor.empty")})</span>;
        }
        return `"${property?.value}"`;
    }, [property, t]);

    if (!property) {
        return null;
    }

    return (
        <>
            <div className="flex flex-col">
                <div className="flex items-center justify-between py-1 px-2 bg-white rounded-lg hover:bg-gray-50">
                    {isComplexType ? (
                        <button
                            type="button"
                            className="flex items-center space-x-2 truncate flex-grow cursor-pointer text-left"
                            onClick={() => setIsCollapsed(prev => !prev)}
                            aria-expanded={!isCollapsed}
                        >
                            {isCollapsed ? <ChevronRight className="h-4 w-4" /> : <ChevronDown className="h-4 w-4" />}
                            {!isRoot && <strong className="font-mono text-gray-900">{property.name}:</strong>}
                            <span className="text-gray-600 truncate">{displayValue}</span>
                        </button>
                    ) : (
                        <div className="flex items-center space-x-2 truncate flex-grow">
                            {!isRoot && <strong className="font-mono text-gray-900">{property.name}:</strong>}
                            <span className="text-gray-600 truncate">{displayValue}</span>
                        </div>
                    )}
                    <div className="flex items-center space-x-1 flex-shrink-0">
                        <Button size="icon" type="button" onClick={() => setIsEditing(true)}>
                            <Pen className="h-4 w-4" />
                        </Button>
                        {!isRoot && enableStructureModifications && (
                            <Button variant="outline" size="icon" onClick={onRemove}>
                                <Trash2 className="h-4 w-4 text-red-500" />
                            </Button>
                        )}
                    </div>
                </div>
                {isComplexType && !isCollapsed && (
                    <div className="pl-6 border-l-2 border-gray-200 ml-2">
                        {property.type === "object" && (
                             <JSONEditor
                                namePrefix={`${namePrefix}.value`}
                                allowObjects={allowObjects}
                                allowArrays={allowArrays}
                                enableAddingProperty={isNestedStructureEditable}
                                enablePropertyRename={isNestedStructureEditable}
                                enableTypeChange={isNestedStructureEditable}
                                enableStructureModifications={enableStructureModifications}
                            />
                        )}
                        {property.type === "array" && (
                            <div>
                                {enableStructureModifications && (
                                    <div className="flex items-center gap-1 my-2">
                                        <Button size="sm" variant={arrayView === 'items' ? 'default' : 'outline'} onClick={() => setArrayView('items')}>{t('jsonEditor.items')}</Button>
                                        <Button size="sm" variant={arrayView === 'template' ? 'default' : 'outline'} onClick={() => setArrayView('template')}>{t('jsonEditor.template')}</Button>
                                    </div>
                                )}
                                {arrayView === "items" && (
                                    <JSONArrayEditor
                                        namePrefix={`${namePrefix}.items`}
                                        template={property.template}
                                        enableStructureModifications={enableStructureModifications}
                                    />
                                )}
                                {arrayView === "template" && (
                                    <JSONEditor
                                        namePrefix={`${namePrefix}.template`}
                                        allowObjects={allowObjects}
                                        allowArrays={allowArrays}
                                        enableAddingProperty={isNestedStructureEditable}
                                        enablePropertyRename={isNestedStructureEditable}
                                        enableTypeChange={isNestedStructureEditable}
                                        enableStructureModifications={enableStructureModifications}
                                    />
                                )}
                            </div>
                        )}
                    </div>
                )}
            </div>
            <EditPropertyModal
                isOpen={isEditing}
                onClose={() => setIsEditing(false)}
                namePrefix={namePrefix}
                availableTypes={availableTypes}
                isRoot={isRoot}
                enablePropertyRename={enableStructureModifications}
                enableTypeChange={enableStructureModifications}
                enableStructureModifications={enableStructureModifications}
            />
        </>
    );
};

JSONProperty.propTypes = {
    namePrefix: PropTypes.string.isRequired,
    onRemove: PropTypes.func,
    allowObjects: PropTypes.bool.isRequired,
    allowArrays: PropTypes.bool.isRequired,
    isRoot: PropTypes.bool,
    enableStructureModifications: PropTypes.bool.isRequired,
};

JSONProperty.defaultProps = {
    onRemove: () => {},
    isRoot: false,
};

export default JSONProperty;
