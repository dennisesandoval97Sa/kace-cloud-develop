import PropTypes from "prop-types";
import { useTranslation } from "react-i18next";

import InputCard from "@/components/core/Cards/InputCard";
import { formatDateTime } from "../utils/formatDateTime";

export const DateInfo = ({ dateRange }) => {
    const { t } = useTranslation();
    return (
        <InputCard>
            <div className="flex flex-col gap-4 p-4 bg-gray-50 rounded-md border border-gray-200">
                <h3 className="text-base font-semibold text-gray-700">{t("reports.form.selectedDates")}</h3>
                <div className="grid grid-cols-2 gap-4">
                    <div className="flex flex-col">
                        <span className="text-sm text-gray-500 font-medium">{t("reports.form.startDate")}</span>
                        <span className="text-base font-semibold text-gray-800 mt-1">
                            {formatDateTime(dateRange.from)}
                        </span>
                    </div>
                    <div className="flex flex-col">
                        <span className="text-sm text-gray-500 font-medium">{t("reports.form.endDate")}</span>
                        <span className="text-base font-semibold text-gray-800 mt-1">
                            {formatDateTime(dateRange.to)}
                        </span>
                    </div>
                </div>
            </div>
        </InputCard>
    );
};

DateInfo.propTypes = {
    formatDate: PropTypes.func,
    dateRange: PropTypes.object,
};
