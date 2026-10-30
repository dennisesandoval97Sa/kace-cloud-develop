import { useEffect, useState } from "react";
import PropTypes from "prop-types";
import { Button } from "./ui/button";
import { Input } from "./ui/input";
import { useTranslation } from "react-i18next";
import { Trash2 } from "lucide-react";

export const JsonTableEditor = ({ name, label, value, setFieldValue }) => {
    const { t } = useTranslation();

    const [rows, setRows] = useState([]);
    const [showPreview, setShowPreview] = useState(false);
    const [newRow, setNewRow] = useState({ key: "", value: "" });
    const [previewJson, setPreviewJson] = useState("{}");

    // Load initial data - Formik
    useEffect(() => {
        if (!value) {
            setRows([]);
            return;
        }

        try {
            const parsed = typeof value === "string" ? JSON.parse(value) : value;
            if (typeof parsed === "object" && !Array.isArray(parsed)) {
                const formatted = Object.entries(parsed).map(([key, val]) => ({
                    key,
                    value: typeof val === "string" ? val : JSON.stringify(val),
                }));
                setRows(formatted);
                setPreviewJson(JSON.stringify(parsed, null, 4)); // Init preview
            }
        } catch (e) {
            setRows([]);
        }
    }, [value]);

    const updateFormikValue = (updatedRows) => {
        const obj = {};
        updatedRows.forEach((row) => {
            if (row.key.trim() !== "") {
                let parsedValue;
                try {
                    // Parse only if the text is a validate JSON
                    parsedValue = JSON.parse(row.value);
                } catch {
                    // Else, Leave it literally as a chain
                    parsedValue = row.value;
                }
                obj[row.key] = parsedValue;
            }
        });

        const jsonString = JSON.stringify(obj, null, 4);
        setPreviewJson(jsonString); // Update preview
        setFieldValue(name, JSON.stringify(obj, null, 4));
    };

    const handleRowChange = (index, field, newValue) => {
        const updated = [...rows];
        updated[index][field] = newValue;
        setRows(updated);
        updateFormikValue(updated);
    };

    const handleNewRowChange = (field, value) => {
        setNewRow((prev) => ({
            ...prev,
            [field]: value,
        }));
    };

    const handleAddRow = () => {
        if (!newRow.key.trim()) return;
        const updated = [...rows, { ...newRow }];
        setRows(updated);
        updateFormikValue(updated);

        // Clean creation inputs
        setNewRow({ key: "", value: "" });
    };

    const handleDeleteRow = (index) => {
        const updated = rows.filter((_, i) => i !== index);
        setRows(updated);
        updateFormikValue(updated);
    };

    return (
        <div className="flex flex-col gap-3">
            <label className="font-semibold">{label}</label>
            <div className="flex flex-col gap-3 border rounded p-3 bg-gray-50">
                <div className="grid grid-cols-12 gap-2 items-center">
                    <Input
                        className="col-span-4"
                        placeholder={t("restEndPoint.key")}
                        value={newRow.key}
                        onChange={(e) => handleNewRowChange("key", e.target.value)}
                    />
                    <Input
                        className="col-span-6"
                        placeholder={t("restEndPoint.value")}
                        value={newRow.value}
                        onChange={(e) => handleNewRowChange("value", e.target.value)}
                    />
                    <Button type="button" variant="default" className="col-span-2" onClick={handleAddRow}>
                        {t("app.forms.add")}
                    </Button>
                </div>

                <hr className="my-2" />

                {rows.map((row, idx) => (
                    <div key={idx} className="grid grid-cols-12 gap-2 items-center">
                        <Input
                            className="col-span-5"
                            placeholder={t("restEndPoint.key")}
                            value={row.key}
                            onChange={(e) => handleRowChange(idx, "key", e.target.value)}
                        />
                        <textarea
                            className="col-span-5 border rounded px-2 py-1 text-sm resize-y min-h-[32px]"
                            placeholder={t("restEndPoint.value")}
                            value={row.value}
                            onChange={(e) => handleRowChange(idx, "value", e.target.value)}
                        />

                        <Button
                            type="button"
                            variant="outline"
                            className="col-span-2"
                            onClick={() => handleDeleteRow(idx)}
                        >
                            <Trash2 className="w-4" />
                        </Button>
                    </div>
                ))}
            </div>
            <div className="flex justify-end">
                <button
                    type="button"
                    className="text-xs text-gray-500 hover:text-gray-700 underline"
                    onClick={() => setShowPreview(!showPreview)}
                >
                    {showPreview ? t("restEndPoint.hidePreview") : t("restEndPoint.showPreview")}
                </button>
            </div>

            {showPreview && (
                <pre className="mt-2 p-3 bg-gray-50 border rounded text-xs overflow-auto max-h-64">{previewJson}</pre>
            )}
        </div>
    );
};

JsonTableEditor.propTypes = {
    name: PropTypes.string.isRequired,
    label: PropTypes.string,
    value: PropTypes.any,
    setFieldValue: PropTypes.func.isRequired,
};
