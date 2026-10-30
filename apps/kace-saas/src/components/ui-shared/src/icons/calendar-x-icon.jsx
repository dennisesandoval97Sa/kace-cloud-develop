import React from "react"
import PropTypes from "prop-types"

export const CalendarXIcon = ({ width = 24, height = 24 }) => {
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
                <path d="M8 2v4m8-4v4" />
                <rect width="18" height="18" x="3" y="4" rx="2" />
                <path d="M3 10h18m-7 4l-4 4m0-4l4 4" />
            </g>
        </svg>
    )
}

CalendarXIcon.propTypes = {
    width: PropTypes.number,
    height: PropTypes.number
}
