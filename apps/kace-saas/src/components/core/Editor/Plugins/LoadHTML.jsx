import { useLexicalComposerContext } from "@lexical/react/LexicalComposerContext";
import { useEffect } from "react";
import { PropTypes } from "prop-types";
import { loadHtmlIntoEditor } from "../utils";

export const LoadHTML = ({ htmlString = "" }) => {
    const [editor] = useLexicalComposerContext();

    useEffect(() => {
        loadHtmlIntoEditor(editor, htmlString);
    }, [editor, htmlString]);

    return null;
};

LoadHTML.propTypes = {
    htmlString: PropTypes.string,
};
