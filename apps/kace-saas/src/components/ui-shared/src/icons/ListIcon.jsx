import PropTypes from "prop-types"

export function ListIcon({ width = 24, height = 24 }) {
    return (
        <svg width={width} height={height} viewBox="0 0 24 24">
            <path
                fill="none"
                stroke="currentColor"
                strokeLinecap="round"
                strokeWidth="2"
                d="M9 6h12M9 12h12M9 18h8M4 7a1 1 0 1 0 0-2a1 1 0 0 0 0 2Zm0 6a1 1 0 1 0 0-2a1 1 0 0 0 0 2Zm0 6a1 1 0 1 0 0-2a1 1 0 0 0 0 2Z"
            />
        </svg>
    )
}

ListIcon.propTypes = {
    width: PropTypes.number,
    height: PropTypes.number
}
