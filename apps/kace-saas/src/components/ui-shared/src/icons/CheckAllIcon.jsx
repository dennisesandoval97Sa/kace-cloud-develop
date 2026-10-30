import PropTypes from "prop-types";

export function CheckAllIcon({ width = 24, height = 24, className }) {
    return (
        <svg
            width={width}
            height={height}
            viewBox="0 0 24 24"
            className={className}
        >
            <path
                fill="none"
                stroke="currentColor"
                strokeLinecap="round"
                strokeLinejoin="round"
                strokeWidth="2"
                d="m8 12.485l4.243 4.243l8.484-8.485M3 12.485l4.243 4.243m8.485-8.485L12.5 11.5"
            />
        </svg>
    )
}

CheckAllIcon.propTypes = {
  width: PropTypes.number,
  height: PropTypes.number,
  className: PropTypes.string
}