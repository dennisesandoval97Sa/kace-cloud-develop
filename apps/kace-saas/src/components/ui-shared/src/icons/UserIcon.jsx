import PropTypes from "prop-types"

export function UserIcon({ width = 24, height = 24 }) {
    return (
        <svg
            width={width}
            height={height}
            viewBox="0 0 24 24"
        >
            <g
                fill="none"
                stroke="currentColor"
                strokeLinecap="round"
                strokeLinejoin="round"
                strokeWidth="2"
            >
                <circle cx="12" cy="8" r="5" fill="currentColor" />
                <path d="M20 21a8 8 0 1 0-16 0" />
                <path
                    fill="currentColor"
                    d="M12 13a8 8 0 0 0-8 8h16a8 8 0 0 0-8-8"
                />
            </g>
        </svg>
    )
}

UserIcon.propTypes = {
  width: PropTypes.number,
  height: PropTypes.number,
}
