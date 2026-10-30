import PropTypes from "prop-types";
import { useTranslation } from "react-i18next";

import { DateTimePickerWithRange, KField } from "@kace/ui-shared";
import InputCard from "@/components/core/Cards/InputCard";
import SectionForm from "@/components/core/Cards/section-form";
import { DateInfo } from "./DateInfo";

export const DateSelect = ({ dateRange, setDateRange, setFieldValue, formatDate, disabled }) => {
    const { t } = useTranslation();

    return (
        <SectionForm id="reports_form_selection" dataTestId="reports_form_selection">
            <InputCard>
                <KField>
                    <div className="flex flex-col gap-2">
                        <span className="text-sm font-medium">{t("reports.form.selectPeriod")}</span>
                        <DateTimePickerWithRange
                            setValue={(name, value) => {
                                if (name === "period.initialDate") {
                                    setDateRange((prev) => ({ ...prev, from: value, to: undefined }));
                                } else if (name === "period.endDate") {
                                    setDateRange((prev) => ({ ...prev, to: value }));
                                }
                                setFieldValue(name, value);
                            }}
                            setDateRange={setDateRange}
                            nameFrom="period.initialDate"
                            nameTo="period.endDate"
                            noInitialDate={true}
                            isTitle={false}
                            disabled={disabled}
                        />
                    </div>
                </KField>
            </InputCard>

            {dateRange.from && dateRange.to && <DateInfo formatDate={formatDate} dateRange={dateRange} />}
        </SectionForm>
    );
};

DateSelect.propTypes = {
    dateRange: PropTypes.object,
    setDateRange: PropTypes.func,
    setFieldValue: PropTypes.func,
    formatDate: PropTypes.func,
    disabled: PropTypes.oneOfType([
        PropTypes.bool,
        PropTypes.func,
        PropTypes.arrayOf(PropTypes.instanceOf(Date)),
        PropTypes.object,
    ]),
};
