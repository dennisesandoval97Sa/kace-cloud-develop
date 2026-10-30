import PropTypes from "prop-types"

export function CancelIcon({ width = 24, height = 24 }) {
    return (
        <svg
            width={width}
            height={height}
            viewBox="0 0 16 16"
        >
            <path
                fill="currentColor"
                fillRule="evenodd"
                d="M3.47 3.47a.75.75 0 0 1 1.06 0L8 6.94l3.47-3.47a.75.75 0 1 1 1.06 1.06L9.06 8l3.47 3.47a.75.75 0 1 1-1.06 1.06L8 9.06l-3.47 3.47a.75.75 0 0 1-1.06-1.06L6.94 8L3.47 4.53a.75.75 0 0 1 0-1.06"
                clipRule="evenodd"
            />
        </svg>
    )
}

CancelIcon.propTypes = {
  width: PropTypes.number,
  height: PropTypes.number
}
