import PropTypes from "prop-types"

export function CaretSortIcon({ width = 24, height = 24 }) {
    return (
        <svg width={width} height={height} viewBox="0 0 15 15">
            <path
                fill="currentColor"
                fillRule="evenodd"
                d="M4.932 5.432a.45.45 0 1 0 .636.636L7.5 4.136l1.932 1.932a.45.45 0 0 0 .636-.636l-2.25-2.25a.45.45 0 0 0-.636 0zm5.136 4.136a.45.45 0 0 0-.636-.636L7.5 10.864L5.568 8.932a.45.45 0 0 0-.636.636l2.25 2.25a.45.45 0 0 0 .636 0z"
                clipRule="evenodd"
            />
        </svg>
    )
}

CaretSortIcon.propTypes = {
    width: PropTypes.number,
    height: PropTypes.number
}
