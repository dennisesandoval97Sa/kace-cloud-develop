import PropTypes from "prop-types";

export function MixerHorizontalIcon({ width = 24, height = 24, ...props }) {
    return (
        <svg width={width} height={height} viewBox="0 0 15 15" {...props}>
            <path
                fill="currentColor"
                fillRule="evenodd"
                d="M5.5 3a1.5 1.5 0 1 0 0 3a1.5 1.5 0 0 0 0-3M3 5c.017 0 .033 0 .05-.002a2.5 2.5 0 0 0 4.9 0A.507.507 0 0 0 8 5h5.5a.5.5 0 0 0 0-1H8c-.017 0-.033 0-.05.002a2.5 2.5 0 0 0-4.9 0A.507.507 0 0 0 3 4H1.5a.5.5 0 0 0 0 1zm8.95 5.998a2.5 2.5 0 0 1-4.9 0A.507.507 0 0 1 7 11H1.5a.5.5 0 0 1 0-1H7c.017 0 .033 0 .05.002a2.5 2.5 0 0 1 4.9 0A.506.506 0 0 1 12 10h1.5a.5.5 0 0 1 0 1H12c-.017 0-.033 0-.05-.002M8 10.5a1.5 1.5 0 1 1 3 0a1.5 1.5 0 0 1-3 0"
                clipRule="evenodd"
            />
        </svg>
    );
}

MixerHorizontalIcon.propTypes = {
    width: PropTypes.number,
    height: PropTypes.number,
};
