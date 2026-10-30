import React from 'react';
import {
  Bold,
  Italic,
  Underline,
  Strikethrough,
  AlignLeft,
  AlignCenter,
  AlignRight,
  AlignJustify,
  RotateCcw,
  RotateCw,
} from 'lucide-react';

export default function EditorToolbar({ activeFormats, onFormat, disabled }) {
  return (
    <div className="editor-toolbar">
      <button
        type="button"
        onClick={() => onFormat('bold')}
        className={activeFormats.bold ? 'toolbar-btn active' : 'toolbar-btn'}
        title="Negrita (Ctrl+B)"
        disabled={disabled}
      >
        <Bold size={18} />
      </button>

      <button
        type="button"
        onClick={() => onFormat('italic')}
        className={activeFormats.italic ? 'toolbar-btn active' : 'toolbar-btn'}
        title="Cursiva (Ctrl+I)"
        disabled={disabled}
      >
        <Italic size={18} />
      </button>

      <button
        type="button"
        onClick={() => onFormat('underline')}
        className={
          activeFormats.underline ? 'toolbar-btn active' : 'toolbar-btn'
        }
        title="Subrayado (Ctrl+U)"
        disabled={disabled}
      >
        <Underline size={18} />
      </button>

      <button
        type="button"
        onClick={() => onFormat('strikeThrough')}
        className={
          activeFormats.strikethrough ? 'toolbar-btn active' : 'toolbar-btn'
        }
        title="Tachado"
        disabled={disabled}
      >
        <Strikethrough size={18} />
      </button>

      <div className="toolbar-divider"></div>

      <button
        type="button"
        onClick={() => onFormat('justifyLeft')}
        className="toolbar-btn"
        title="Alinear a la izquierda"
        disabled={disabled}
      >
        <AlignLeft size={18} />
      </button>

      <button
        type="button"
        onClick={() => onFormat('justifyCenter')}
        className="toolbar-btn"
        title="Centrar"
        disabled={disabled}
      >
        <AlignCenter size={18} />
      </button>

      <button
        type="button"
        onClick={() => onFormat('justifyRight')}
        className="toolbar-btn"
        title="Alinear a la derecha"
        disabled={disabled}
      >
        <AlignRight size={18} />
      </button>

      <button
        type="button"
        onClick={() => onFormat('justifyFull')}
        className="toolbar-btn"
        title="Justificar"
        disabled={disabled}
      >
        <AlignJustify size={18} />
      </button>

      <div className="toolbar-divider"></div>

      <button
        type="button"
        onClick={() => onFormat('undo')}
        className="toolbar-btn"
        title="Deshacer (Ctrl+Z)"
        disabled={disabled}
      >
        <RotateCcw size={18} />
      </button>

      <button
        type="button"
        onClick={() => onFormat('redo')}
        className="toolbar-btn"
        title="Rehacer (Ctrl+Y)"
        disabled={disabled}
      >
        <RotateCw size={18} />
      </button>
    </div>
  );
}
