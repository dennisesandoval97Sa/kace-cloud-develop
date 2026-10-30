import './RichTextEditor.css';
import '#plugins/kace/shared/styles/kace-disabled.css';
import '#plugins/kace/components/states/States.css';
import EditorToolbar from '#plugins/kace/components/rich-text-editor/components/EditorToolbar.jsx';
import useRichTextEditor from '#plugins/kace/hooks/useRichTextEditor.js';
import { useKaceDisabled } from '#plugins/kace/hooks/useKaceDisabled.hook.js';
import React from 'react';

/**
 * @typedef Props
 * @prop {{ [x: string]: unknown }} component - `this.component` properties
 * @prop {(value: any, flags: any, source: any) => any} updateValue - Function to update `this.value` (formio component instance) value
 * @prop {boolean} [disabled=false] - Disables interactions when Form.io sets disable
 */

/**
 * @param {Props} props
 */
export const RichTextEditor = ({ onEvent, updateValue, disabled = false }) => {
  const {
    disabled: isDisabled,
    readOnlyLock,
    className: disabledClassName,
  } = useKaceDisabled(disabled);
  const {
    editorRef,
    activeFormats,
    disabledDescription,
    locked,
    showDescription,
    showDescriptionFromStore,
    descriptionLoading,
    handleFormat,
    handleInput,
    handleKeyUp,
    handleMouseUp,
  } = useRichTextEditor(updateValue, onEvent);

  if (descriptionLoading || showDescriptionFromStore == null) {
    return (
      <div className="card shadow-sm">
        <div className="card-body p-4 states__card-body">
          <h1 className="h3 font-weight-bold mb-2">Descripcion del caso</h1>
          <p className="text-muted mb-4">
            Digite una descripción detallada del caso para facilitar su análisis
            y resolución.
          </p>

          <div className="overflow-auto states__content">
            <div className="d-flex justify-content-center align-items-center h-100">
              <div className="text-primary spinner-border" role="status">
                <span className="sr-only">Cargando...</span>
              </div>
            </div>
          </div>
        </div>
      </div>
    );
  }

  if (showDescriptionFromStore === false) {
    return (
      <div className="card shadow-sm">
        <div className="card-body p-4">
          <h1 className="h3 font-weight-bold mb-2">Descripcion del caso</h1>
          <p className="text-muted mb-4">
            Digite una descripción detallada del caso para facilitar su análisis
            y resolución.
          </p>

          <div className="overflow-auto" style={{ height: '500px' }}>
            <div
              className="d-flex flex-column justify-content-center align-items-center"
              style={{ height: '100%' }}
            >
              <h5 className="h5 font-weight-bold mb-2 text-danger">
                Permiso denegado
              </h5>
              <p className="mb-4 text-muted">
                No tiene permisos para mostrar la descripción consulte las
                configuraciones globales del grupo
              </p>
            </div>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className={`card shadow-sm ${disabledClassName}`}>
      <div className="card-body p-4">
        <h1 className="h3 font-weight-bold mb-2">Descripcion del caso</h1>
        <p className="text-muted mb-4">
          Digite una descripción detallada del caso para facilitar su análisis y
          resolución.
        </p>

        <div className="overflow-auto classifications-levels">
          <div className="editor-wrapper">
            <EditorToolbar
              activeFormats={activeFormats}
              onFormat={handleFormat}
              disabled={isDisabled || disabledDescription || locked}
            />

            <div
              ref={editorRef}
              className="editor-content"
              contentEditable={!(isDisabled || disabledDescription || locked)}
              onInput={handleInput}
              onKeyUp={handleKeyUp}
              onMouseUp={handleMouseUp}
              data-placeholder={''}
              suppressContentEditableWarning={true}
              style={{ minHeight: '200px' }}
            />
          </div>
        </div>
      </div>
    </div>
  );
};
