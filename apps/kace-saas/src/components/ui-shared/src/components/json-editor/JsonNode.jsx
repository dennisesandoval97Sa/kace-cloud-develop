import { useState, useCallback, memo } from "react";
import { ChevronRight, ChevronDown, Trash2, Plus, GripVertical } from "lucide-react";
import { Button } from "../ui/button";
import { Input } from "../ui/input";
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuTrigger } from "../ui/dropdown-menu";
import { cn } from "../../lib/utils";
import PropTypes from "prop-types";

function getValueType(value) {
    if (value === null) return "null";
    if (Array.isArray(value)) return "array";
    return typeof value;
}

const TYPE_COLORS = {
    string: "text-green-600",
    number: "text-blue-600",
    boolean: "text-purple-600",
    null: "text-gray-500",
    object: "text-orange-600",
    array: "text-amber-600",
};

const TYPE_BADGE_COLORS = {
    string: "bg-green-100 text-green-700",
    number: "bg-blue-100 text-blue-700",
    boolean: "bg-purple-100 text-purple-700",
    null: "bg-gray-100 text-gray-600",
    object: "bg-orange-100 text-orange-700",
    array: "bg-amber-100 text-amber-700",
};

const DEFAULT_VALUES = {
    string: "",
    number: 0,
    boolean: false,
    null: null,
    object: {},
    array: [],
};

function getTypeColor(type) {
    return TYPE_COLORS[type] || "text-gray-900";
}

function getTypeBadgeColor(type) {
    return TYPE_BADGE_COLORS[type] || "bg-gray-100 text-gray-600";
}

const JsonNodeInternal = memo(({
    nodeKey,
    value,
    path,
    depth,
    onChange,
    onDelete,
    onRename,
    onAddProperty,
    isArrayItem = false,
}) => {
    const [isExpanded, setIsExpanded] = useState(false);
    const [isEditingKey, setIsEditingKey] = useState(false);
    const [editingKeyValue, setEditingKeyValue] = useState(nodeKey);
    const [isHovered, setIsHovered] = useState(false);

    const valueType = getValueType(value);
    const isExpandable = valueType === "object" || valueType === "array";

    const handleKeySubmit = useCallback(() => {
        if (editingKeyValue !== nodeKey && editingKeyValue.trim()) {
            onRename(path, editingKeyValue.trim());
        }
        setIsEditingKey(false);
    }, [editingKeyValue, nodeKey, onRename, path]);

    const handleValueChange = useCallback((newValue) => {
        let parsedValue = newValue;

        if (newValue === "true") parsedValue = true;
        else if (newValue === "false") parsedValue = false;
        else if (newValue === "null") parsedValue = null;
        else if (!isNaN(Number(newValue)) && newValue.trim() !== "") {
            parsedValue = Number(newValue);
        }

        onChange(path, parsedValue);
    }, [onChange, path]);

    const handleAddNewProperty = useCallback((type) => {
        const defaultValue = DEFAULT_VALUES[type] !== undefined ? DEFAULT_VALUES[type] : "";

        if (valueType === "array") {
            onAddProperty(path, String(value.length), defaultValue);
        } else {
            const newKey = `newKey${Object.keys(value).length}`;
            onAddProperty(path, newKey, defaultValue);
        }
        setIsExpanded(true);
    }, [valueType, value, onAddProperty, path]);

    const renderValue = () => {
        if (isExpandable) {
            const count = Array.isArray(value) ? value.length : Object.keys(value).length;

            return (
                <span className={cn("text-xs font-mono", getTypeColor(valueType))}>
                    {valueType === "array" ? `[${count}]` : `{${count}}`}
                </span>
            );
        }

        if (valueType === "boolean") {
            return (
                <Button
                    type="button"
                    variant="ghost"
                    size="sm"
                    className={cn("h-7 px-2 font-mono text-xs", getTypeColor(valueType))}
                    onClick={() => onChange(path, !value)}
                >
                    {String(value)}
                </Button>
            );
        }

        if (valueType === "null") {
            return <span className={cn("px-2 font-mono text-xs", getTypeColor(valueType))}>null</span>;
        }

        return (
            <Input
                value={String(value)}
                onChange={(e) => handleValueChange(e.target.value)}
                className={cn(
                    "h-7 w-auto min-w-[100px] max-w-[300px] font-mono text-xs",
                    getTypeColor(valueType)
                )}
            />
        );
    };

    return (
        <div
            className={cn("group rounded-md", depth > 0 && "ml-4 border-l border-border pl-3")}
            onMouseEnter={() => setIsHovered(true)}
            onMouseLeave={() => setIsHovered(false)}
        >
            <div className="flex items-center gap-1 py-1">
                <div className="flex w-5 items-center justify-center">
                    {isExpandable ? (
                        <Button
                            type="button"
                            variant="ghost"
                            size="icon"
                            className="h-5 w-5 p-0 text-muted-foreground hover:text-foreground"
                            onClick={() => setIsExpanded(!isExpanded)}
                        >
                            {isExpanded ? (
                                <ChevronDown className="h-3.5 w-3.5" />
                            ) : (
                                <ChevronRight className="h-3.5 w-3.5" />
                            )}
                        </Button>
                    ) : (
                        <GripVertical className="h-3.5 w-3.5 text-muted-foreground/50" />
                    )}
                </div>

                <div className="flex flex-1 items-center gap-2 flex-nowrap overflow-hidden">
                    {isEditingKey && !isArrayItem ? (
                        <Input
                            value={editingKeyValue}
                            onChange={(e) => setEditingKeyValue(e.target.value)}
                            onBlur={handleKeySubmit}
                            onKeyDown={(e) => {
                                if (e.key === "Enter") handleKeySubmit();
                                if (e.key === "Escape") {
                                    setEditingKeyValue(nodeKey);
                                    setIsEditingKey(false);
                                }
                            }}
                            className="h-7 w-auto max-w-[200px] font-mono text-xs"
                            autoFocus
                        />
                    ) : (
                        <button
                            type="button"
                            onClick={() => !isArrayItem && setIsEditingKey(true)}
                            className={cn(
                                "font-mono text-xs font-medium text-foreground",
                                !isArrayItem && "cursor-text hover:bg-muted/50 rounded px-1 -mx-1"
                            )}
                        >
                            {isArrayItem ? `[${nodeKey}]` : nodeKey}
                        </button>
                    )}

                    <span className="text-muted-foreground text-xs">:</span>

                    {renderValue()}

                    <span
                        className={cn(
                            "rounded px-1.5 py-0.5 text-[10px] font-medium uppercase tracking-wider whitespace-nowrap",
                            getTypeBadgeColor(valueType)
                        )}
                    >
                        {valueType}
                    </span>
                </div>

                <div
                    className={cn(
                        "flex items-center gap-1 transition-opacity",
                        isHovered ? "opacity-100" : "opacity-0"
                    )}
                >
                    {isExpandable && (
                        <DropdownMenu>
                            <DropdownMenuTrigger asChild>
                                <Button
                                    type="button"
                                    variant="ghost"
                                    size="icon"
                                    className="h-6 w-6 text-muted-foreground hover:text-foreground"
                                >
                                    <Plus className="h-3.5 w-3.5" />
                                </Button>
                            </DropdownMenuTrigger>
                            <DropdownMenuContent align="end">
                                <DropdownMenuItem onClick={() => handleAddNewProperty("string")}>
                                    <span className="w-16 text-green-600 font-mono text-xs">String</span>
                                </DropdownMenuItem>
                                <DropdownMenuItem onClick={() => handleAddNewProperty("number")}>
                                    <span className="w-16 text-blue-600 font-mono text-xs">Number</span>
                                </DropdownMenuItem>
                                <DropdownMenuItem onClick={() => handleAddNewProperty("boolean")}>
                                    <span className="w-16 text-purple-600 font-mono text-xs">Boolean</span>
                                </DropdownMenuItem>
                                <DropdownMenuItem onClick={() => handleAddNewProperty("null")}>
                                    <span className="w-16 text-gray-500 font-mono text-xs">Null</span>
                                </DropdownMenuItem>
                                <DropdownMenuItem onClick={() => handleAddNewProperty("object")}>
                                    <span className="w-16 text-orange-600 font-mono text-xs">Object</span>
                                </DropdownMenuItem>
                                <DropdownMenuItem onClick={() => handleAddNewProperty("array")}>
                                    <span className="w-16 text-amber-600 font-mono text-xs">Array</span>
                                </DropdownMenuItem>
                            </DropdownMenuContent>
                        </DropdownMenu>
                    )}
                    <Button
                        type="button"
                        variant="ghost"
                        size="icon"
                        className="h-6 w-6 text-muted-foreground hover:text-destructive"
                        onClick={() => onDelete(path)}
                    >
                        <Trash2 className="h-3.5 w-3.5" />
                    </Button>
                </div>
            </div>

            {isExpandable && isExpanded && (
                <div className="mt-1">
                    {Array.isArray(value)
                        ? value.map((item, index) => (
                              <JsonNodeInternal
                                  key={index}
                                  nodeKey={String(index)}
                                  value={item}
                                  path={[...path, String(index)]}
                                  depth={depth + 1}
                                  onChange={onChange}
                                  onDelete={onDelete}
                                  onRename={onRename}
                                  onAddProperty={onAddProperty}
                                  isArrayItem
                              />
                          ))
                        : Object.entries(value).map(([k, v]) => (
                              <JsonNodeInternal
                                  key={k}
                                  nodeKey={k}
                                  value={v}
                                  path={[...path, k]}
                                  depth={depth + 1}
                                  onChange={onChange}
                                  onDelete={onDelete}
                                  onRename={onRename}
                                  onAddProperty={onAddProperty}
                              />
                          ))}
                </div>
            )}
        </div>
    );
});

JsonNodeInternal.displayName = "JsonNode";

export const JsonNode = JsonNodeInternal;

JsonNode.propTypes = {
    nodeKey: PropTypes.string.isRequired,
    value: PropTypes.any,
    path: PropTypes.array.isRequired,
    depth: PropTypes.number.isRequired,
    onChange: PropTypes.func.isRequired,
    onDelete: PropTypes.func.isRequired,
    onRename: PropTypes.func.isRequired,
    onAddProperty: PropTypes.func.isRequired,
    isArrayItem: PropTypes.bool,
};
