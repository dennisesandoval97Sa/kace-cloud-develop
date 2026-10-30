import PropTypes from "prop-types";

export function ClockIcon({ width = 24, height = 24 }) {
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
        <circle cx="12" cy="12" r="10" />
        <path d="M12 6v6l4 2" />
      </g>
    </svg>
  );
}

ClockIcon.propTypes = {
  width: PropTypes.number,
  height: PropTypes.number,
};
