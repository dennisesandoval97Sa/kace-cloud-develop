import PropTypes from "prop-types";

export function ExclamationCircle({ width = 24, height = 24 }) {
    return (
        <svg
            width={width}
            height={height}
            viewBox="0 0 16 16"
        >
            <path
                fill="currentColor"
                d="M16 8A8 8 0 1 1 0 8a8 8 0 0 1 16 0M8 4a.905.905 0 0 0-.9.995l.35 3.507a.552.552 0 0 0 1.1 0l.35-3.507A.905.905 0 0 0 8 4m.002 6a1 1 0 1 0 0 2a1 1 0 0 0 0-2"
            />
        </svg>
    )
}

ExclamationCircle.propTypes = {
  width: PropTypes.number,
  height: PropTypes.number,
};