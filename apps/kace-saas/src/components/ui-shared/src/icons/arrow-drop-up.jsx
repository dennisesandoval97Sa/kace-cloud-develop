import PropTypes from "prop-types"

export function ArrowDropUp({ width = 24, height = 24 }) {
    return (
        <svg width={width} height={height} viewBox="0 0 24 24">
            <path fill="currentColor" d="m7 14l5-5l5 5z" />
        </svg>
    )
}

ArrowDropUp.propTypes = {
  width: PropTypes.number,
  height: PropTypes.number
}