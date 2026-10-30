import { PropTypes } from "prop-types";
import { useEffect, useRef, useState } from "react";
import { useTranslation } from "react-i18next";
import { FileJson, FileText, Link2 } from "lucide-react";
import { JsonEditor } from "../../../components/ui-shared/src/components/json-editor/JsonEditor";
import { Textarea } from "../../../components/ui-shared/src/components/ui/textarea";
import { Card, CardContent, CardHeader, CardTitle } from "../../../components/ui-shared/src/components/ui/card";
import { isContextReferenceBody } from "../data/helper";

const BODY_MODES = [
    { value: "json", labelKey: "restEndPoint.bodyType.json", Icon: FileJson },
    { value: "context_reference", labelKey: "restEndPoint.bodyType.contextReference", Icon: Link2 },
    { value: "plain_text", labelKey: "restEndPoint.bodyType.plainText", Icon: FileText },
];

const getCurrentMode = (bodyType, bodyValue) => {
    if (bodyType === "plain_text") return "plain_text";
    if (isContextReferenceBody(bodyValue)) return "context_reference";
    return "json";
};

export function BodyEditor({ bodyValue, bodyType = "json", setFieldValue, label }) {
    const { t } = useTranslation();
    const [currentMode, setCurrentMode] = useState(() => getCurrentMode(bodyType, bodyValue));
    const [contextReferenceValue, setContextReferenceValue] = useState(bodyValue ?? "");
    const [pendingBodyValue, setPendingBodyValue] = useState();
    const localBodyValueRef = useRef();
    const contextReferenceLabel = t("restEndPoint.bodyType.contextReferenceLabel", { label });

    useEffect(() => {
        setContextReferenceValue(bodyValue ?? "");
    }, [bodyValue]);

    useEffect(() => {
        if (pendingBodyValue !== undefined && bodyValue === pendingBodyValue) {
            setPendingBodyValue(undefined);
        }
    }, [bodyValue, pendingBodyValue]);

    useEffect(() => {
        const isLocalContextEdit = bodyValue === localBodyValueRef.current;

        setCurrentMode((selectedMode) => {
            if (bodyType === "plain_text") return "plain_text";
            if (isContextReferenceBody(bodyValue)) return "context_reference";
            if (selectedMode === "context_reference" && isLocalContextEdit) return "context_reference";
            return "json";
        });

        if (isLocalContextEdit) {
            localBodyValueRef.current = undefined;
        }
    }, [bodyType, bodyValue]);

    const handleModeChange = (newMode) => {
        if (newMode === currentMode) return;
        setCurrentMode(newMode);

        if (newMode === "plain_text") {
            setPendingBodyValue("");
            setFieldValue("body_type", "plain_text");
            setFieldValue("body", "");
            return;
        }

        setFieldValue("body_type", "json");
        const nextBodyValue = newMode === "context_reference" ? "context." : "{}";
        localBodyValueRef.current = nextBodyValue;
        setPendingBodyValue(nextBodyValue);
        if (newMode === "context_reference") {
            setContextReferenceValue(nextBodyValue);
        }
        setFieldValue("body", nextBodyValue);
    };

    const handleContextReferenceChange = (event) => {
        const nextValue = event.target.value;
        localBodyValueRef.current = nextValue;
        setContextReferenceValue(nextValue);
        setFieldValue("body", nextValue);
    };

    const renderedBodyValue = pendingBodyValue ?? bodyValue;

    return (
        <div className="space-y-2">
            <div className="flex gap-2 mb-2">
                {BODY_MODES.map(({ value, labelKey, Icon }) => (
                    <button
                        key={value}
                        type="button"
                        aria-pressed={currentMode === value}
                        onClick={() => handleModeChange(value)}
                        className={`flex items-center gap-1.5 px-3 py-1.5 rounded text-xs font-medium border transition-colors ${
                            currentMode === value
                                ? "bg-primary text-primary-foreground border-primary"
                                : "bg-background text-muted-foreground border-border hover:bg-accent"
                        }`}
                    >
                        <Icon className="h-3.5 w-3.5" />
                        {t(labelKey)}
                    </button>
                ))}
            </div>

            {currentMode === "plain_text" && (
                <Card className="border-border bg-card shadow-sm">
                    <CardHeader className="pb-2">
                        <CardTitle className="text-sm font-semibold text-card-foreground">{label}</CardTitle>
                    </CardHeader>
                    <CardContent>
                        <Textarea
                            value={renderedBodyValue ?? ""}
                            onChange={(e) => setFieldValue("body", e.target.value)}
                            className="min-h-[300px] font-mono text-xs resize-y"
                            placeholder={t("restEndPoint.bodyType.plainTextPlaceholder")}
                        />
                    </CardContent>
                </Card>
            )}

            {currentMode === "context_reference" && (
                <Card className="border-border bg-card shadow-sm">
                    <CardHeader className="pb-2">
                        <CardTitle className="text-sm font-semibold text-card-foreground">{label}</CardTitle>
                    </CardHeader>
                    <CardContent>
                        <label htmlFor="body_context_reference" className="sr-only">
                            {contextReferenceLabel}
                        </label>
                        <input
                            type="text"
                            id="body_context_reference"
                            name="body_context_reference"
                            value={contextReferenceValue}
                            onChange={handleContextReferenceChange}
                            className="flex h-10 w-full rounded-md border border-input bg-background px-3 py-2 font-mono text-xs ring-offset-background placeholder:text-muted-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 disabled:cursor-not-allowed disabled:opacity-50"
                            placeholder={t("restEndPoint.bodyType.contextReferencePlaceholder")}
                            autoComplete="off"
                            spellCheck={false}
                        />
                    </CardContent>
                </Card>
            )}

            {currentMode === "json" && (
                <JsonEditor name="body" label={label} value={renderedBodyValue} setFieldValue={setFieldValue} />
            )}
        </div>
    );
}

BodyEditor.propTypes = {
    bodyValue: PropTypes.string,
    bodyType: PropTypes.oneOf(["json", "plain_text"]),
    setFieldValue: PropTypes.func.isRequired,
    label: PropTypes.string,
};
