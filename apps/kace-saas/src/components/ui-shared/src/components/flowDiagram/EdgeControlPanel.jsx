import { Trash2, Eye, EyeOff } from "lucide-react";
import { useTranslation } from "react-i18next";
import { Switch } from "@/components/ui-shared";

export const EdgeControlPanel = ({ edge, onVisibilityChange, onDelete, className = "", showSelectHint = true }) => {
    const { t } = useTranslation();

    if (!edge) {
        if (!showSelectHint) return null;
        return (
            <div className="absolute top-4 right-4 z-50 pointer-events-none opacity-50">
                <span className="text-[10px] text-gray-400 font-medium bg-white/80 px-2 py-1 rounded-full border border-gray-100 shadow-sm">
                    {t("app.flowDiagram.selectTransition")}
                </span>
            </div>
        );
    }

    const isVisible = edge.data?.is_visible ?? true;

    return (
        <div
            className={`absolute top-4 right-4 z-50 bg-white/95 backdrop-blur shadow-md border border-gray-200 rounded-full py-1.5 px-3 flex items-center gap-3 transition-all animate-in fade-in slide-in-from-top-2 ${className}`}
        >
            <button
                type="button"
                onClick={() => onVisibilityChange(edge.id)}
                className="text-gray-400 hover:text-amber-500 transition-colors p-1 rounded-full hover:bg-amber-50"
                title={isVisible ? t("app.flowDiagram.hideTransition") : t("app.flowDiagram.showTransition")}
            >
                {isVisible ? <Eye className="w-3.5 h-3.5" /> : <EyeOff className="w-3.5 h-3.5 text-amber-500" />}
            </button>

            <div className="h-4 w-px bg-gray-200" />

            <button
                type="button"
                onClick={() => onDelete(edge.id)}
                className="text-gray-400 hover:text-red-500 transition-colors p-1 rounded-full hover:bg-red-50"
                title={t("app.flowDiagram.deleteTransition")}
            >
                <Trash2 className="w-3.5 h-3.5" />
            </button>
        </div>
    );
};
