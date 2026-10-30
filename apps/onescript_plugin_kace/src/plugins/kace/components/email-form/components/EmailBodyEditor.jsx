import React from 'react';

export const EmailBodyEditor = ({ bodyRef, bodyLocked, exec }) => (
  <div
    className={`email-form-field${bodyLocked ? ' email-form-field--locked' : ''}`}
  >
    <label>
      Cuerpo {bodyLocked && <span className="locked-badge">🔒</span>}
    </label>
    <div
      className={`email-body-wrapper${bodyLocked ? ' email-body-wrapper--locked' : ''}`}
    >
      {!bodyLocked && (
        <div className="email-rte-toolbar">
          <div className="toolbar-group undo-redo">
            <button type="button" title="Undo" onClick={() => exec('undo')}>
              ↩
            </button>
            <button type="button" title="Redo" onClick={() => exec('redo')}>
              ↪
            </button>
          </div>
          <div className="toolbar-group">
            <select
              className="toolbar-select"
              onChange={(e) => exec('formatBlock', e.target.value)}
              defaultValue="p"
            >
              <option value="p">Formats</option>
              <option value="h1">Heading 1</option>
              <option value="h2">Heading 2</option>
              <option value="h3">Heading 3</option>
              <option value="p">Paragraph</option>
              <option value="pre">Preformatted</option>
            </select>
          </div>
          <div className="toolbar-group">
            <button type="button" title="Bold" onClick={() => exec('bold')}>
              <strong>B</strong>
            </button>
            <button type="button" title="Italic" onClick={() => exec('italic')}>
              <em>I</em>
            </button>
          </div>
          <div className="toolbar-group">
            <button
              type="button"
              title="Align Left"
              onClick={() => exec('justifyLeft')}
            >
              ≡L
            </button>
            <button
              type="button"
              title="Align Center"
              onClick={() => exec('justifyCenter')}
            >
              ≡C
            </button>
            <button
              type="button"
              title="Align Right"
              onClick={() => exec('justifyRight')}
            >
              ≡R
            </button>
            <button
              type="button"
              title="Justify"
              onClick={() => exec('justifyFull')}
            >
              ≡J
            </button>
          </div>
          <div className="toolbar-group">
            <button
              type="button"
              title="Unordered List"
              onClick={() => exec('insertUnorderedList')}
            >
              ☰
            </button>
            <button
              type="button"
              title="Ordered List"
              onClick={() => exec('insertOrderedList')}
            >
              ☷
            </button>
          </div>
        </div>
      )}
      <div
        ref={bodyRef}
        className="email-body-content"
        contentEditable={!bodyLocked}
        suppressContentEditableWarning
        data-placeholder="Escriba el cuerpo del mensaje aquí..."
      />
    </div>
  </div>
);
