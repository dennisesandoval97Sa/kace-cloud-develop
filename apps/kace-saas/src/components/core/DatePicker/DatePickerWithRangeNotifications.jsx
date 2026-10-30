import { DatePickerWithRange } from "@kace/ui-shared";
import { PropTypes } from "prop-types";
import { useState } from "react";
import { useTranslation } from "react-i18next";
import { toNotificationCalendarDate } from "../../../utils/notificationDates";

export const DatePickerWithRangeNotifications = ({
    setValue,
    nameFrom,
    nameTo,
    errorFrom,
    errorTo,
    touchedFrom,
    touchedTo,
    isTitle,
    initialValues = [],
}) => {
    const { t } = useTranslation();
    const [updateDate, setUpdateDate] = useState(false);
    const hasInitialRange = initialValues.some(
        (value) => value !== undefined && value !== null && String(value).length > 0,
    );
    const calendarInitialValues = hasInitialRange
        ? initialValues.map((value) => toNotificationCalendarDate(value))
        : null;
    const handleUpdateDate = () => {
        setUpdateDate(true);
    };
    return (
        <div className="grid grid-cols-5 items-end gap-2">
            <DatePickerWithRange
                setValue={setValue}
                nameFrom={nameFrom}
                nameTo={nameTo}
                errorFrom={errorFrom}
                errorTo={errorTo}
                touchedFrom={touchedFrom}
                touchedTo={touchedTo}
                isTitle={isTitle}
                initialValues={calendarInitialValues}
                handleUpdateDate={handleUpdateDate}
                className="col-span-4"
            />
            <p className={`${!updateDate ? "text-orange-400" : "text-greenCustom"} font-semibold mb-2`}>
                {!updateDate ? t(`app.forms.defaultDate`) : t(`app.forms.newDate`)}
            </p>
        </div>
    );
};

DatePickerWithRangeNotifications.propTypes = {
    setValue: PropTypes.func.isRequired,
    nameFrom: PropTypes.string.isRequired,
    errorFrom: PropTypes.string,
    errorTo: PropTypes.string,
    touchedFrom: PropTypes.bool,
    touchedTo: PropTypes.bool,
    isTitle: PropTypes.bool,
    initialValues: PropTypes.arrayOf(PropTypes.string),
    nameTo: PropTypes.string.isRequired,
};
