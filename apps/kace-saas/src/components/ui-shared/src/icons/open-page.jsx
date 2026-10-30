import PropTypes from "prop-types";

export function OpenPage({ width = 24, height = 24 }) {
    return (
        <svg
            width={width}
            height={height}
            viewBox="0 0 14 14"
        >
            <g
                fill="none"
                stroke="currentColor"
                strokeLinecap="round"
                strokeLinejoin="round"
            >
                <path d="M3.5 13.5h-2a1 1 0 0 1-1-1v-11a1 1 0 0 1 1-1h11a1 1 0 0 1 1 1v11a1 1 0 0 1-1 1h-2m-10-10h13M7 13.5V7" />
                <path d="M4.5 9.5L7 7l2.5 2.5" />
            </g>
        </svg>
    )
}

OpenPage.propTypes = {
  width: PropTypes.number,
  height: PropTypes.number,
};
