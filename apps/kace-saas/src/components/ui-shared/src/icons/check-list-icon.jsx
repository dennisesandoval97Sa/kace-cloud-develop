import React from "react";
import PropTypes from "prop-types";

export const CheckListIcon = ({ width = 24, height = 24 }) => {
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
        <path d="M9.5 1.5H11a1 1 0 0 1 1 1v10a1 1 0 0 1-1 1H3a1 1 0 0 1-1-1v-10a1 1 0 0 1 1-1h1.5" />
        <rect width="5" height="2.5" x="4.5" y=".5" rx="1" />
        <path d="M4.5 5.5h5M4.5 8h5m-5 2.5h5" />
      </g>
    </svg>
  );
};

CheckListIcon.propTypes = {
  width: PropTypes.number,
  height: PropTypes.number,
};
