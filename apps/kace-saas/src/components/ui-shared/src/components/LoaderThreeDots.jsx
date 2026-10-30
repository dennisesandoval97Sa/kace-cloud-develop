import React from "react";

export const LoaderThreeDots = () => {
    return (
        <svg fill="hsl(288 64% 58%)" viewBox="0 0 24 24" width="50" height="50">
            <circle cx={4} cy={12} r={3}>
                <animate
                    attributeName="cx"
                    values="4;12;20;4"
                    dur="1.5s"
                    repeatCount="indefinite"
                />
            </circle>
            <circle cx={12} cy={12} r={3}>
                <animate
                    attributeName="cx"
                    values="12;20;4;12"
                    dur="1.5s"
                    repeatCount="indefinite"
                />
            </circle>
            <circle cx={20} cy={12} r={3}>
                <animate
                    attributeName="cx"
                    values="20;4;12;20"
                    dur="1.5s"
                    repeatCount="indefinite"
                />
            </circle>
        </svg>
    );
};
