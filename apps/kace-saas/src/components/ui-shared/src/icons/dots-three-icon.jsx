
import PropTypes from "prop-types";

export function DotsThreeIcon({ width = 24, height = 24 }) {
    return (
        <svg
            width={width}
            height={height}
            viewBox="0 0 256 256"
        >
            <path
                fill="currentColor"
                d="M156 128a28 28 0 1 1-28-28a28 28 0 0 1 28 28M48 100a28 28 0 1 0 28 28a28 28 0 0 0-28-28m160 0a28 28 0 1 0 28 28a28 28 0 0 0-28-28"
            />
        </svg>
    )
}

DotsThreeIcon.propTypes = {
  width: PropTypes.number,
  height: PropTypes.number,
};