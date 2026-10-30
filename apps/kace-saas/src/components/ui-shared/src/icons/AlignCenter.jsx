import PropTypes from "prop-types"

export function AlignCenter({width = 24, height = 24}) {
    return (
        <svg
            width={width}
            height={height}
            viewBox="0 0 24 24"
        >
            <path 
                fill="currentColor" 
                d="M4 21q-.425 0-.712-.288T3 20t.288-.712T4 19h16q.425 0 .713.288T21 20t-.288.713T20 21zm4-4q-.425 0-.712-.288T7 16t.288-.712T8 15h8q.425 0 .713.288T17 16t-.288.713T16 17zm-4-4q-.425 0-.712-.288T3 12t.288-.712T4 11h16q.425 0 .713.288T21 12t-.288.713T20 13zm4-4q-.425 0-.712-.288T7 8t.288-.712T8 7h8q.425 0 .713.288T17 8t-.288.713T16 9zM4 5q-.425 0-.712-.288T3 4t.288-.712T4 3h16q.425 0 .713.288T21 4t-.288.713T20 5z"/>
        </svg>
        
    )
}

AlignCenter.propTypes = {
  width: PropTypes.number,
  height: PropTypes.number
}