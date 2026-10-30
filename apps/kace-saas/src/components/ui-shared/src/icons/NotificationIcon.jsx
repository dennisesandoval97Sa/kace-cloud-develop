import PropTypes from "prop-types"

export function NotificationIcon({ width = 24, height = 24 }) {
    return (
        <svg
            width={width}
            height={height}
            viewBox="0 0 20 20"
        >
            <path
                fill="currentColor"
                d="M4 8a6 6 0 0 1 4.03-5.67a2 2 0 1 1 3.95 0A6 6 0 0 1 16 8v6l3 2v1H1v-1l3-2zm8 10a2 2 0 1 1-4 0z"
            />
        </svg>
    )
}

NotificationIcon.propTypes = {
  width: PropTypes.number,
  height: PropTypes.number
}
