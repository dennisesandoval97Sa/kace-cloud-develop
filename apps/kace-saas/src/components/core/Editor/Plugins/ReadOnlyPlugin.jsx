import { useEffect } from "react";
import { useLexicalComposerContext } from "@lexical/react/LexicalComposerContext";
import PropTypes from 'prop-types'

const ReadOnlyPlugin = ({ enabled = true }) => {
    const [editor] = useLexicalComposerContext();

    useEffect(() => {
        editor.setEditable(!enabled ? true : false);

        return () => {
            editor.setEditable(true);
        };
    }, [editor, enabled]);

    return null;
}

ReadOnlyPlugin.propTypes = {
    enabled: PropTypes.bool
}

export default ReadOnlyPlugin