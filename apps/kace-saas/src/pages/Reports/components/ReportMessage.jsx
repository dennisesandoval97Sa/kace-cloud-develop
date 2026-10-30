import { useTranslation } from "react-i18next";
import { ReportIcon } from "../utils/icons";

export const ReportMessage = () => {
    const { t } = useTranslation();
    return (
        <div className="flex flex-col items-center justify-center p-12 text-center bg-gray-50 rounded-lg border-2 border-dashed border-gray-300">
            <div className="max-w-md">
                <ReportIcon />
                <h3 className="text-lg font-semibold text-gray-900 mb-2">{t("reports.form.selectReportFirst")}</h3>
                <p className="text-sm text-gray-500">{t("reports.form.selectReportDescription")}</p>
            </div>
        </div>
    );
};
