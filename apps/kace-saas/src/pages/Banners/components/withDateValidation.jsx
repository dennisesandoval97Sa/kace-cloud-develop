import PropTypes from "prop-types"
import { differenceInDays, parseISO } from "date-fns"

const withDateValidation = (Component) => {
    const WrappedComponent = ({ startDate, endDate, ...props }) => {
        const startDateString = startDate instanceof Date ? startDate.toISOString() : startDate
        const endDateString = endDate instanceof Date ? endDate.toISOString() : endDate

        const isEndDateValid = endDateString && startDateString
            ? differenceInDays(parseISO(endDateString), parseISO(startDateString)) >= 0
            : true

        return (
            <Component
                {...props}
                disabled={!isEndDateValid}
                error={!isEndDateValid || props.errorMessage}
            />
        )
    }

    WrappedComponent.displayName = `withDateValidation(${Component.displayName || Component.name || "Component"})`

    WrappedComponent.propTypes = {
        startDate: PropTypes.oneOfType([
            PropTypes.string,
            PropTypes.instanceOf(Date)
        ]),
        endDate: PropTypes.oneOfType([
            PropTypes.string,
            PropTypes.instanceOf(Date)
        ])
    }

    return WrappedComponent
}

export default withDateValidation
