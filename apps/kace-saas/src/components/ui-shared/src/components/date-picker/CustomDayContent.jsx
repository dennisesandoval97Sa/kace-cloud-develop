import PropTypes from "prop-types";
import React from "react";
import { DayContent, useDayRender } from "react-day-picker"

export const CustomDay = (props) => {
    const btnRef = React.useRef(null);
    const { buttonProps, divProps, isButton, isHidden } = useDayRender(
        props.date,
        props.displayMonth,
        btnRef
    );

    const dateStr = props.date.toISOString().split("T")[0];

    if (isHidden) return <div {...divProps} />;

    if (isButton) {
        return (
            <button
                {...buttonProps}
                ref={btnRef}
                id={`btn_day_${dateStr}`}
                data-testid={`btn_day_${dateStr}`}
            >
                <DayContent date={props.date} displayMonth={props.displayMonth} />
            </button>
        );
    }

    return <div {...divProps} />;
}

CustomDay.propTypes = {
    date: PropTypes.instanceOf(Date),
    displayMonth: PropTypes.instanceOf(Date),
};
