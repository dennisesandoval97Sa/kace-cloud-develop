import { useState, useEffect, useRef, useCallback } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "../ui/card";
import { Button } from "../ui/button";
import { JsonNode } from "./JsonNode";
import { Textarea } from "../ui/textarea";
import { Copy, Plus, FileJson, Undo2, Redo2, Check, AlertCircle } from "lucide-react";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "../ui/tabs";
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuTrigger } from "../ui/dropdown-menu";
import { useTranslation } from "react-i18next";
import PropTypes from "prop-types";
export function JsonEditor({
    value = {},
    name,
    setFieldValue,
    label = "JSON Editor",
}) {
    const { t } = useTranslation();
    const [isInitialized, setIsInitialized] = useState(false);
    const [data, setData] = useState({});
    const [history, setHistory] = useState([]);
    const [historyIndex, setHistoryIndex] = useState(0);
    const [copied, setCopied] = useState(false);
    const [rawInput, setRawInput] = useState("");
    const [jsonError, setJsonError] = useState(null);

    useEffect(() => {
        setRawInput(JSON.stringify(data, null, 4));
    }, [data]);

    useEffect(() => {
        if (value && !isInitialized) {
            try {
                const parsed = typeof value === "string" ? (value.trim() ? JSON.parse(value) : null) : value;
                
                if (parsed && typeof parsed === "object" && Object.keys(parsed).length > 0) {
                    setData(parsed);
                    setHistory([parsed]);
                    setHistoryIndex(0);
                    setIsInitialized(true);
                }
            } catch (e) {
                console.error("Invalid JSON input", e);
            }
        }
    }, [value, isInitialized]);

    const updateData = useCallback((newData) => {
        const newHistory = history.slice(0, historyIndex + 1);
        newHistory.push(newData);
        
        setHistory(newHistory);
        setHistoryIndex(newHistory.length - 1);
        setData(newData);
        setIsInitialized(true);

        if (setFieldValue && name) {
            setFieldValue(name, JSON.stringify(newData, null, 4));
        }
    }, [history, historyIndex, setFieldValue, name]);

    const undo = useCallback(() => {
        if (historyIndex > 0) {
            const prevIndex = historyIndex - 1;
            setHistoryIndex(prevIndex);
            const prevData = history[prevIndex];
            setData(prevData);
            if (setFieldValue && name) {
                 setFieldValue(name, JSON.stringify(prevData, null, 4));
            }
        }
    }, [historyIndex, history, setFieldValue, name]);

    const redo = useCallback(() => {
        if (historyIndex < history.length - 1) {
            const nextIndex = historyIndex + 1;
            setHistoryIndex(nextIndex);
            const nextData = history[nextIndex];
            setData(nextData);
            if (setFieldValue && name) {
                  setFieldValue(name, JSON.stringify(nextData, null, 4));
            }
        }
    }, [historyIndex, history, setFieldValue, name]);

    const handleChange = useCallback((path, value) => {
        const newData = structuredClone(data);
        let current = newData;
        for (let i = 0; i < path.length - 1; i++) {
            const key = path[i];
            current = current[key];
        }
        const lastKey = path[path.length - 1];
        current[lastKey] = value;
        updateData(newData);
    }, [data, updateData]);

    const handleDelete = useCallback((path) => {
        if (path.length === 1) {
            const newData = { ...data };
            delete newData[path[0]];
            updateData(newData);
            return;
        }

        const newData = structuredClone(data);
        let current = newData;
        for (let i = 0; i < path.length - 1; i++) {
            const key = path[i];
            current = current[key];
        }
        const lastKey = path[path.length - 1];
        if (Array.isArray(current)) {
            current.splice(Number(lastKey), 1);
        } else {
            delete current[lastKey];
        }
        updateData(newData);
    }, [data, updateData]);

    const handleRename = useCallback((path, newKey) => {
        if (path.length === 1) {
            const newData = {};
            for (const key of Object.keys(data)) {
                if (key === path[0]) {
                    newData[newKey] = data[key];
                } else {
                    newData[key] = data[key];
                }
            }
            updateData(newData);
            return;
        }

        const newData = structuredClone(data);
        let current = newData;
        for (let i = 0; i < path.length - 1; i++) {
            const key = path[i];
            current = current[key];
        }
        const oldKey = path[path.length - 1];
        if (typeof current === "object" && current !== null && !Array.isArray(current)) {
            const value = current[oldKey];
            delete current[oldKey];
            current[newKey] = value;
        }
        updateData(newData);
    }, [data, updateData]);

    const handleAddProperty = useCallback((path, key, value) => {
        if (path.length === 0) {
            const newData = { ...data, [key]: value };
            updateData(newData);
            return;
        }

        const newData = structuredClone(data);
        let current = newData;
        for (let i = 0; i < path.length; i++) {
            const k = path[i];
            current = current[k];
        }
        if (Array.isArray(current)) {
            current.push(value);
        } else if (typeof current === "object" && current !== null) {
            current[key] = value;
        }
        updateData(newData);
    }, [data, updateData]);

    const applyRawJson = useCallback(() => {
        try {
            const parsed = JSON.parse(rawInput);
            if (parsed && typeof parsed === "object") {
                updateData(parsed);
                setJsonError(null);
            } else {
                setJsonError(t("jsonEditor.jsonMustBeObject"));
            }
        } catch (e) {
            setJsonError(`${t("jsonEditor.invalidJson")}: ${e.message}`);
        }
    }, [rawInput, updateData, t]);

    const copyToClipboard = useCallback(() => {
        navigator.clipboard.writeText(JSON.stringify(data, null, 2));
        setCopied(true);
        setTimeout(() => setCopied(false), 2000);
    }, [data]);

    return (
        <div className="space-y-4">
            <Card className="border-border bg-card shadow-sm">
                <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-4">
                    <div className="flex items-center gap-3">
                        <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-primary/10">
                            <FileJson className="h-5 w-5 text-primary" />
                        </div>
                        <div>
                            <CardTitle className="text-sm font-semibold text-card-foreground">{label}</CardTitle>
                        </div>
                    </div>
                    <div className="flex items-center gap-2">
                        <Button
                            type="button"
                            variant="outline"
                            size="icon"
                            onClick={undo}
                            disabled={historyIndex === 0}
                            title={t("jsonEditor.undo")}
                        >
                            <Undo2 className="h-4 w-4" />
                        </Button>
                        <Button
                            type="button"
                            variant="outline"
                            size="icon"
                            onClick={redo}
                            disabled={historyIndex === history.length - 1}
                            title={t("jsonEditor.redo")}
                        >
                            <Redo2 className="h-4 w-4" />
                        </Button>
                        <div className="h-6 w-px bg-border" />
                        <Button type="button" variant="outline" size="icon" onClick={copyToClipboard} title={t("jsonEditor.copy")}>
                            <Copy className="h-4 w-4" />
                        </Button>
                    </div>
                </CardHeader>
                <CardContent>
                    <Tabs defaultValue="editor" className="w-full">
                        <TabsList className="mb-4">
                            <TabsTrigger value="editor">{t("jsonEditor.editor")}</TabsTrigger>
                            <TabsTrigger value="raw">{t("jsonEditor.raw")}</TabsTrigger>
                        </TabsList>
                        <TabsContent value="editor" className="mt-0">
                            <div className="rounded-lg border border-border bg-gray-50/50 p-4">
                                <div className="space-y-1">
                                    {Object.entries(data).map(([key, value]) => (
                                        <JsonNode
                                            key={key}
                                            nodeKey={key}
                                            value={value}
                                            path={[key]}
                                            depth={0}
                                            onChange={handleChange}
                                            onDelete={handleDelete}
                                            onRename={handleRename}
                                            onAddProperty={handleAddProperty}
                                        />
                                    ))}
                                    {Object.keys(data).length === 0 && (
                                        <div className="text-center text-sm text-muted-foreground py-4">{t("jsonEditor.jsonEmpty")}</div>
                                    )}
                                </div>
                                <DropdownMenu>
                                    <DropdownMenuTrigger asChild>
                                        <Button
                                            type="button"
                                            variant="ghost"
                                            size="sm"
                                            className="mt-3 text-muted-foreground hover:text-foreground text-xs"
                                        >
                                            <Plus className="mr-1.5 h-3.5 w-3.5" />
                                            {t("jsonEditor.addProperty")}
                                        </Button>
                                    </DropdownMenuTrigger>
                                    <DropdownMenuContent align="start">
                                        <DropdownMenuItem
                                            onClick={() => {
                                                const newKey = `newKey${Object.keys(data).length}`;
                                                handleAddProperty([], newKey, "");
                                            }}
                                        >
                                            <span className="w-16 text-green-600 font-mono text-xs">String</span>
                                        </DropdownMenuItem>
                                        <DropdownMenuItem
                                            onClick={() => {
                                                const newKey = `newKey${Object.keys(data).length}`;
                                                handleAddProperty([], newKey, 0);
                                            }}
                                        >
                                            <span className="w-16 text-blue-600 font-mono text-xs">Number</span>
                                        </DropdownMenuItem>
                                        <DropdownMenuItem
                                            onClick={() => {
                                                const newKey = `newKey${Object.keys(data).length}`;
                                                handleAddProperty([], newKey, false);
                                            }}
                                        >
                                            <span className="w-16 text-purple-600 font-mono text-xs">Boolean</span>
                                        </DropdownMenuItem>
                                        <DropdownMenuItem
                                            onClick={() => {
                                                const newKey = `newKey${Object.keys(data).length}`;
                                                handleAddProperty([], newKey, null);
                                            }}
                                        >
                                            <span className="w-16 text-gray-500 font-mono text-xs">Null</span>
                                        </DropdownMenuItem>
                                        <DropdownMenuItem
                                            onClick={() => {
                                                const newKey = `newKey${Object.keys(data).length}`;
                                                handleAddProperty([], newKey, {});
                                            }}
                                        >
                                            <span className="w-16 text-orange-600 font-mono text-xs">Object</span>
                                        </DropdownMenuItem>
                                        <DropdownMenuItem
                                            onClick={() => {
                                                const newKey = `newKey${Object.keys(data).length}`;
                                                handleAddProperty([], newKey, []);
                                            }}
                                        >
                                            <span className="w-16 text-amber-600 font-mono text-xs">Array</span>
                                        </DropdownMenuItem>
                                    </DropdownMenuContent>
                                </DropdownMenu>
                            </div>
                        </TabsContent>
                        <TabsContent value="raw" className="mt-0">
                            <div className="space-y-3">
                                <div className="rounded-lg border border-border bg-gray-50/50 p-2">
                                    <Textarea
                                        value={rawInput}
                                        onChange={(e) => {
                                            setRawInput(e.target.value);
                                            if (jsonError) setJsonError(null);
                                        }}
                                        className="min-h-[300px] font-mono text-xs text-foreground bg-transparent border-none focus-visible:ring-0 resize-y"
                                        placeholder={t("jsonEditor.pastePlaceholder")}
                                    />
                                </div>
                                
                                {jsonError && (
                                    <div className="flex items-center gap-2 text-xs text-destructive bg-destructive/10 p-2 rounded">
                                        <AlertCircle className="h-3.5 w-3.5" />
                                        <span>{jsonError}</span>
                                    </div>
                                )}

                                <div className="flex justify-end">
                                    <Button 
                                        type="button" 
                                        size="sm" 
                                        onClick={applyRawJson}
                                        className="gap-2"
                                    >
                                        <Check className="h-3.5 w-3.5" />
                                        {t("jsonEditor.applyChanges")}
                                    </Button>
                                </div>
                            </div>
                        </TabsContent>
                    </Tabs>
                </CardContent>
            </Card>
            {copied && (
                <div className="fixed bottom-4 right-4 rounded-lg bg-black/80 px-4 py-2 text-white shadow-lg text-sm z-50">
                    {t("jsonEditor.copiedToClipboard")}
                </div>
            )}
        </div>
    );
}

JsonEditor.propTypes = {
    value: PropTypes.oneOfType([PropTypes.object, PropTypes.string]),
    name: PropTypes.string,
    setFieldValue: PropTypes.func,
    label: PropTypes.string,
};
