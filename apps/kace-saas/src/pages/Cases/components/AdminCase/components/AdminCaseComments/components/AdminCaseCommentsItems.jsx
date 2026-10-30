import { PropTypes } from "prop-types"
import { EMOJI_LIST } from "../../../../../data/Constants"

const colorClasses = {
    redCustom: "border-redCustom",
    yellowCustom: "border-yellowCustom",
    greenCustom: "border-greenCustom",
    blueCustom: "border-blueCustom",
    limeCustom: "border-limeCustom",
    grayCustom: "border-gray-300"
}

export const CommentsItems = ({ item, currentIndex }) => {
    const { descripcion, calificacion, creator } = item

    const emoji = EMOJI_LIST.find(
        (emojiItem) => emojiItem.value === calificacion
    ) || { color: "gray-300", icon: "❓" }

    return (
        <div className="flex w-full p-2 gap-2 justify-center">
            <div className={`${currentIndex % 2 !== 0 ? "hidden" : ""}`} id={`comment_item_${currentIndex}`} data-testid={`comment_item_${currentIndex}`}>
                {emoji.icon}
            </div>
            <div className="relative max-w-80" id={`comment_item_emoji_left_${currentIndex}`} data-testid={`comment_item_emoji_left_${currentIndex}`}>
                <div
                    className={`absolute ${currentIndex % 2 === 0 ? "-left-1" : "-right-1"} -top-1 w-0 h-0 border-t-8 border-t-transparent -rotate-90 border-b-8 border-b-transparent border-r-8 ${colorClasses[emoji.color] || ""}`}
                    id={`comment_item_arrow_${currentIndex}`}
                    data-testid={`comment_item_arrow_${currentIndex}`}
                ></div>

                <div
                    className={`bg-${emoji.color} rounded-lg px-4 py-2 text-sm shadow flex flex-col gap-2`}
                    id={`comment_item_bubble_${currentIndex}`}
                    data-testid={`comment_item_bubble_${currentIndex}`}
                >
                    <div className="flex justify-between gap-4" id={`comment_item_meta_${currentIndex}`} data-testid={`comment_item_meta_${currentIndex}`}>
                        <span className="font-bold text-blue-800" id={`comment_item_date_${currentIndex}`} data-testid={`comment_item_date_${currentIndex}`}>
                            {item.created_at?.date || ""}
                        </span>
                        <span className="font-bold text-blue-800" id={`comment_item_time_${currentIndex}`} data-testid={`comment_item_time_${currentIndex}`}>
                            {item.created_at?.time || ""}
                        </span>
                    </div >
                    <div className="overflow-y-auto break-words" id={`comment_item_descripcion_${currentIndex}`} data-testid={`comment_item_descripcion_${currentIndex}`}>
                        {descripcion}
                    </div>
                </div>

                <p className="text-xs text-right mt-1" id={`comment_item_creator_${currentIndex}`} data-testid={`comment_item_creator_${currentIndex}`}>
                    {`${creator?.nombres ?? ""} ${creator?.apellido1 ?? ""} ${creator?.apellido2 ?? ""}`}
                </p>
            </div>
            <div className={`${currentIndex % 2 === 0 ? "hidden" : ""}`} id={`comment_item_emoji_right_${currentIndex}`} data-testid={`comment_item_emoji_right_${currentIndex}`}>
                {emoji.icon}
            </div>
        </div >
    )
}

CommentsItems.propTypes = {
    item: PropTypes.shape({
        descripcion: PropTypes.string,
        calificacion: PropTypes.number,
        created_at: PropTypes.shape({
            date: PropTypes.string,
            time: PropTypes.string
        }),
        creator: PropTypes.shape({
            nombres: PropTypes.string,
            apellido1: PropTypes.string,
            apellido2: PropTypes.string
        })
    }),
    currentIndex: PropTypes.number
}
