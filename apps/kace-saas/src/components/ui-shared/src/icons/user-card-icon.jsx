import PropTypes from "prop-types"

export function UserCardIcon({ width = 24, height = 24 }) {
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
                <path d="M1.358 2.266h11.284s.858 0 .858.858v7.752s0 .858-.858.858H1.358s-.858 0-.858-.858V3.124s0-.858.858-.858M9.36 5.88h1.986M9.36 7.849h1.986" />
                <path d="M3.507 6.208a1.64 1.64 0 1 0 3.282 0a1.64 1.64 0 0 0-3.282 0" />
                <path d="M2.654 9.473a3.17 3.17 0 0 1 1.064-1.19a2.62 2.62 0 0 1 1.43-.434c.502 0 .994.15 1.431.434a3.17 3.17 0 0 1 1.064 1.19" />
            </g>
        </svg>
    )
}

UserCardIcon.propTypes = {
  width: PropTypes.number,
  height: PropTypes.number,
};
