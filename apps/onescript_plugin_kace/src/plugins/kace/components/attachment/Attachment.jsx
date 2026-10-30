import './Attachment.css';
import '#plugins/kace/shared/styles/kace-disabled.css';
import '#plugins/kace/components/states/States.css';
import useAttachment from '#plugins/kace/hooks/useAttachment.js';
import { useKaceDisabled } from '#plugins/kace/hooks/useKaceDisabled.hook.js';
import { useEffect, useRef, useState } from 'react';

/**
 * @typedef Props
 * @prop {(event: string, callback: Function) => void} onEvent - Component's on() for kace events
 * @prop {{ on?: Function, off?: Function, data?: Object }} [root] - Root form instance for visibility events and data
 * @prop {{ [x: string]: unknown }} [component] - `this.component` properties (Formio), e.g. hidden expression
 * @prop {boolean} [disabled=false] - Disables interactions when Form.io sets disable
 */

export const Attachment = ({ onEvent, root, component, disabled = false }) => {
  const {
    disabled: isDisabled,
    readOnlyLock,
    className: disabledClassName,
  } = useKaceDisabled(disabled);
  const {
    fileInputRef,
    files,
    message,
    validExtensions,
    maxFileSizeMB,
    quantityFiles,
    allowMultiple,
    handleClick,
    handleDrop,
    handleFileChange,
    showAttachments,
    isHidden,
    isLoading,
    handleRemoveFile,
    handleDownload,
    enableCategorySelection,
    fileTypeCategoryOptions,
    hasUnclassifiedFiles,
    handleSetFileTypeCategory,
    enableTypeSelection,
    fileTypeNumericOptions,
    handleFileTypeChange,
  } = useAttachment(onEvent, { root, component });

  // Risk 2: track which file's dropdown is open and close on outside click
  const [openDropdownFor, setOpenDropdownFor] = useState(
    /** @type {Record<string, any> | null} */ (null)
  );
  const dropdownContainerRef = useRef(
    /** @type {HTMLDivElement | null} */ (null)
  );

  useEffect(() => {
    if (!openDropdownFor) return;
    const handleOutsideClick = (/** @type {MouseEvent} */ e) => {
      if (
        dropdownContainerRef.current &&
        !dropdownContainerRef.current.contains(/** @type {Node} */ (e.target))
      ) {
        setOpenDropdownFor(null);
      }
    };
    document.addEventListener('mousedown', handleOutsideClick);
    return () => document.removeEventListener('mousedown', handleOutsideClick);
  }, [openDropdownFor]);

  if (isHidden) {
    return null;
  }

  if (isLoading) {
    return (
      <div className="card shadow-sm">
        <div className="card-body p-4 states__card-body">
          <h1 className="h3 font-weight-bold mb-2">Adjuntos</h1>
          <p className="text-muted mb-4">
            Adjunte información relevante al caso, como imagenes o capturas de
            pantalla.
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

  return (
    <div className={`card shadow-sm ${disabledClassName}`}>
      <div className="card-body p-4">
        <h1 className="h3 font-weight-bold mb-2">Adjuntos</h1>
        <p className="text-muted mb-4">
          Adjunte información relevante al caso, como imagenes o capturas de
          pantalla.
        </p>

        <div className="attachment-card text-center d-flex flex-column gap-3">
          {showAttachments ? (
            <div
              className="border border-secondary rounded p-4 mb-3"
              style={{
                borderStyle: 'dashed',
                cursor: 'pointer',
                opacity: 1,
              }}
              onClick={handleClick}
              onDrop={handleDrop}
              onDragOver={(e) => e.preventDefault()}
            >
              <i
                className="fa fa-download mb-2"
                style={{ fontSize: '50px', color: '#6c757d' }}
              />

              <p className="text-muted mb-1">
                Arrastra y suelta archivos aquí, o haz clic para seleccionar
                archivos
              </p>
              <small className="text-muted d-block">
                Formatos permitidos: {validExtensions}
              </small>
              <small className="text-muted d-block">
                Tamaño maximo: {maxFileSizeMB} MB
              </small>
              {quantityFiles ? (
                <small className="text-muted d-block">
                  Cantidad máxima de archivos: {quantityFiles}
                </small>
              ) : null}

              <input
                type="file"
                accept={validExtensions}
                ref={fileInputRef}
                onChange={handleFileChange}
                className="d-none"
                multiple={allowMultiple}
                disabled={isDisabled}
              />
            </div>
          ) : (
            <div className="d-flex flex-column justify-content-center align-items-center py-5">
              <h5 className="h5 font-weight-bold mb-2 text-danger">
                Permiso denegado
              </h5>
              <p className="mb-4 text-muted">
                No tiene permisos para adjuntar archivos, consulte las
                configuraciones globales del grupo
              </p>
            </div>
          )}

          {/* Risk 4: persistent warning when files need classification */}
          {hasUnclassifiedFiles && (
            <div
              className="alert alert-warning py-2 px-3 mb-2 d-flex align-items-center"
              role="alert"
            >
              <i className="fa fa-exclamation-triangle mr-2" />
              <span className="small">
                Todos los archivos deben tener un{' '}
                <strong>tipo de clasificación de adjunto</strong> asignado antes
                de guardar.
              </span>
            </div>
          )}

          {files.length ? (
            <div ref={dropdownContainerRef} className="attachment-file-list">
              {files.map((file) => (
                <div
                  key={file.id || file.path}
                  className="attachment-file-card small"
                >
                  <div className="attachment-file-row d-flex align-items-center">
                    {/* Status icon */}
                    <span className="attachment-file-status flex-shrink-0">
                      {file.s3_payload ? (
                        <i className="fa fa-check text-success" />
                      ) : (
                        <i className="fa fa-clock-o text-warning" />
                      )}
                    </span>

                    {/* Filename */}
                    <span className="attachment-filename text-truncate flex-grow-1 mx-2">
                      {file.path}
                    </span>

                    {/* Tipo de foto badge — only when literal is configured */}
                    {enableCategorySelection &&
                      fileTypeCategoryOptions?.length > 0 && (
                        <div className="attachment-tipo-wrapper flex-shrink-0 mr-2 position-relative">
                          <button
                            type="button"
                            className={`attachment-tipo-badge ${file.tipoFoto ? 'attachment-tipo-badge--set' : 'attachment-tipo-badge--unset'}`}
                            onClick={() =>
                              !isDisabled &&
                              setOpenDropdownFor(
                                openDropdownFor === file ? null : file
                              )
                            }
                            disabled={isDisabled}
                            title={
                              file.tipoFoto
                                ? `Tipo: ${file.tipoFoto.label}`
                                : 'Asignar tipo de foto'
                            }
                          >
                            {file.tipoFoto ? (
                              <>
                                <span
                                  className="attachment-tipo-dot mr-1"
                                  aria-hidden="true"
                                >
                                  ●
                                </span>
                                {file.tipoFoto.label}
                              </>
                            ) : (
                              <>
                                <i
                                  className="fa fa-exclamation-triangle mr-1"
                                  aria-hidden="true"
                                />
                                Sin tipo
                              </>
                            )}
                            <i
                              className="fa fa-caret-down ml-1"
                              aria-hidden="true"
                            />
                          </button>

                          {openDropdownFor === file && (
                            <ul
                              className="attachment-tipo-menu list-unstyled mb-0"
                              role="listbox"
                            >
                              {fileTypeCategoryOptions.map((opt) => {
                                const isSelected =
                                  file.tipoFoto != null &&
                                  file.tipoFoto.id === opt.id &&
                                  file.tipoFoto.label === opt.label;
                                return (
                                  <li
                                    key={opt.id}
                                    role="option"
                                    aria-selected={isSelected}
                                    className={`attachment-tipo-option ${isSelected ? 'attachment-tipo-option--active' : ''}`}
                                    onClick={() => {
                                      handleSetFileTypeCategory(file, opt);
                                      setOpenDropdownFor(null);
                                    }}
                                  >
                                    <span className="attachment-tipo-option-check mr-2">
                                      {isSelected ? (
                                        <i
                                          className="fa fa-check text-success"
                                          aria-hidden="true"
                                        />
                                      ) : null}
                                    </span>
                                    {opt.label}
                                  </li>
                                );
                              })}
                            </ul>
                          )}
                        </div>
                      )}

                    {/* Actions */}
                    <div className="d-flex align-items-center flex-shrink-0 attachment-file-actions">
                      {file.s3_payload && (
                        <i
                          className="fa fa-download text-success"
                          style={{ cursor: 'pointer' }}
                          title="Descargar archivo"
                          onClick={() =>
                            !isDisabled && handleDownload(file.s3_payload)
                          }
                        />
                      )}
                      <i
                        className="fa fa-times text-danger"
                        style={{ cursor: 'pointer' }}
                        title="Eliminar archivo"
                        onClick={() => !isDisabled && handleRemoveFile(file)}
                      />
                    </div>
                  </div>

                  {/* ── Type selection row (radio buttons) ── */}
                  {enableTypeSelection &&
                    fileTypeNumericOptions?.length > 0 && (
                      <div className="attachment-file-type-row d-flex align-items-center">
                        <small
                          className="text-muted mr-3"
                          style={{ whiteSpace: 'nowrap' }}
                        >
                          <i className="fa fa-tag mr-1" aria-hidden="true" />
                          Tipo:
                        </small>
                        <div
                          className="d-flex flex-wrap"
                          style={{ gap: '8px 16px' }}
                        >
                          {fileTypeNumericOptions.map((type) => (
                            <label
                              key={type.identifier}
                              className="mb-0 d-flex align-items-center"
                              style={{
                                cursor: isDisabled ? 'not-allowed' : 'pointer',
                                gap: 4,
                              }}
                            >
                              <input
                                type="radio"
                                name={`attachment-type-${file.id || file.path}`}
                                value={type.identifier}
                                checked={
                                  String(file?.attachmentType ?? file?.type) ===
                                  String(type.identifier)
                                }
                                onChange={() =>
                                  !isDisabled &&
                                  handleFileTypeChange(file, type.identifier)
                                }
                                disabled={isDisabled}
                              />
                              <span>{type.label}</span>
                            </label>
                          ))}
                        </div>
                      </div>
                    )}
                </div>
              ))}
            </div>
          ) : (
            <div className="text-muted">
              <i
                className="fa fa-file-o mb-2 d-block"
                style={{ fontSize: '50px' }}
              />
              No hay adjuntos cargados en este momento
            </div>
          )}

          {message && (
            <div
              className={`alert alert-${message.type} mt-3 p-2`}
              role="alert"
            >
              {message.text}
            </div>
          )}
        </div>
      </div>
    </div>
  );
};
