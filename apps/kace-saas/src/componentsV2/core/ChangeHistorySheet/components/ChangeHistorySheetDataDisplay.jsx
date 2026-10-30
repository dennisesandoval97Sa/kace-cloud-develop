import React, { useEffect, useRef, useState } from "react"
import PropTypes from "prop-types"
import { Button, cn } from "@/components/ui-shared"
import { useTranslation } from "react-i18next"

const ChangeHistorySheetDataDisplay = ({ attributeType, attribute, isOriginal = false }) => {
    const { t } = useTranslation()
    const [seeMore, setSeeMore] = useState(false)
    const [isContentTruncated, setIsContentTruncated] = useState(false)
    const contentRef = useRef(null)

    useEffect(() => {
        if (contentRef.current) {
            const element = contentRef.current
            setIsContentTruncated(element.scrollHeight > element.clientHeight)
        }
    }, [attribute])
    return (
        <div>
            <h3 className="text-sm font-bold">{t(isOriginal ? "app.title.original" : "app.title.changes")}</h3>
            {attributeType === "string" ? (
                <span
                    ref={contentRef}
                    className={cn("text-xs text-gray-500 line-clamp-3 min-h-10 break-words", {
                        "line-clamp-none": seeMore
                    })}
                >
                    {attribute}
                </span>
            ) : (
                <pre
                    ref={contentRef}
                    className={cn("text-xs text-gray-500 line-clamp-3 min-h-10 break-words", {
                        "line-clamp-none": seeMore
                    })}
                >
                    {attribute}
                </pre>
            )}

            {isContentTruncated && (
                <Button className="text-xs" variant="link" size="sm" type="button" onClick={() => setSeeMore(!seeMore)}>
                    {t(seeMore ? "app.button.seeLess" : "app.button.seeMore")}
                </Button>
            )}
        </div>
    )
}

ChangeHistorySheetDataDisplay.propTypes = {
    attributeType: PropTypes.oneOf(["string", "json"]).isRequired,
    attribute: PropTypes.string.isRequired,
    isOriginal: PropTypes.bool
}

export default ChangeHistorySheetDataDisplay
