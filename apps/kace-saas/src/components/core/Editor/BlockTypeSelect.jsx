import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@kace/ui-shared";
import { PropTypes } from "prop-types";
import { useTranslation } from "react-i18next";
import { $getSelection, $isRangeSelection, $createParagraphNode } from "lexical";
import { $setBlocksType } from "@lexical/selection";
import { $createHeadingNode } from "@lexical/rich-text";

const BLOCK_TYPE_OPTIONS = ["paragraph", "h1", "h2", "h3", "h4", "h5", "h6"];

export const BlockTypeSelect = ({ blockType = "paragraph", editor = null }) => {
    const { t } = useTranslation();

    const handleValueChange = (value) => {
        editor.update(() => {
            const selection = $getSelection();
            if (!$isRangeSelection(selection)) return;

            if (value === "paragraph") {
                $setBlocksType(selection, () => $createParagraphNode());
            } else {
                $setBlocksType(selection, () => $createHeadingNode(value));
            }
        });
    };

    return (
        <Select value={blockType} onValueChange={handleValueChange}>
            <SelectTrigger
                className="w-36"
                id="toolbar_block_type"
                data-testid="toolbar_block_type"
                aria-label="Block type"
            >
                <SelectValue />
            </SelectTrigger>
            <SelectContent id="toolbar_block_type_content" data-testid="toolbar_block_type_content">
                {BLOCK_TYPE_OPTIONS.map((option) => (
                    <SelectItem
                        key={option}
                        value={option}
                        id={`toolbar_block_type_${option}`}
                        data-testid={`toolbar_block_type_${option}`}
                    >
                        {t(`editor.blockType.${option}`)}
                    </SelectItem>
                ))}
            </SelectContent>
        </Select>
    );
};

BlockTypeSelect.propTypes = {
    blockType: PropTypes.string,
    editor: PropTypes.object,
};
