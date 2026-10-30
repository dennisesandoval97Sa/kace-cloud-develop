import { useCallback, useEffect, useRef } from 'react';
import { AuxCasesSchema } from '#plugins/kace/components/aux-cases-schema/AuxCasesSchema.jsx';
import { DataTable } from '#plugins/kace/components/data-table/DataTable.jsx';
import { useSubcaseList } from '#plugins/kace/hooks/useSubcaseList.js';
import { useSubcases } from '#plugins/kace/hooks/useSubcases.js';
import '#plugins/kace/shared/styles/kace-disabled.css';
import { resolveKaceDisabledClassName } from '#plugins/kace/utils/kaceFormDisabled.js';
import { useKaceDisabled } from '#plugins/kace/hooks/useKaceDisabled.hook.js';
import './Subcases.css';

/**
 * @typedef Props
 * @prop {{ [x: string]: unknown, enableAttachments?: boolean, dataSourceValues?: Array<{ label: string, value: string }>, data?: { values?: Array<{ label: string, value: string }> }, buttonLabel?: string, tableColumns?: any[], auxColumns?: Array<{ selectExpression?: string, alias?: string, label?: string }> }} component - Formio component config (classifications; tableColumns + auxColumns para grid)
 * @prop {(value: any, flags: any, source: any) => any} updateValue - Function to update formio component value
 * @prop {boolean} [disabled=false] - Disables interactions when Form.io sets disable
 */

/**
 * Componente visual (Dumb). Toda la lógica en useSubcases.
 * @param {Props} props
 */
export const Subcases = ({ component, updateValue, disabled = false }) => {
  const {
    disabled: isDisabled,
    readOnlyLock,
    className: disabledClassName,
  } = useKaceDisabled(disabled);
  const editCallbackRef = useRef(null);
  const viewCallbackRef = useRef(null);
  const stableEditHandler = useCallback((row) => {
    editCallbackRef.current?.(row);
  }, []);
  const stableViewHandler = useCallback((row) => {
    viewCallbackRef.current?.(row);
  }, []);

  const {
    isListLoading,
    listError,
    refreshList,
    tableComponent,
    isEditingParentCase,
    setListFetchMountNode,
  } = useSubcaseList(component, {
    onEditSubcase: stableEditHandler,
    onViewSubcase: stableViewHandler,
  });

  const {
    isOpen,
    isLoading,
    error,
    states,
    selectedTransitionId,
    selectedClassificationId,
    isClassificationLocked,
    handleClassificationChange,
    mockRoot,
    oneScriptFormId,
    schemaId,
    buttonLabel,
    openModal,
    closeModal,
    handleEditClick,
    handleViewClick,
    handleTransitionChange,
    handleAuxFormUpdate,
    setFormInstance,
    handleSubmit,
    handleDescriptionChange,
    modalKey,
    isSubmitting,
    selectedSubcase,
    auxInitialSubmission,
    description,
    currentStateName,
    isSubcaseClosed,
    isViewMode,
    classificationOptions,
    primaryKey,
    subcaseSchemaRefreshNonce,
    subcaseAttachments,
  } = useSubcases(component, { refreshList });

  editCallbackRef.current = handleEditClick;
  viewCallbackRef.current = handleViewClick;

  const noopOnEvent = useCallback(() => {}, []);
  const descriptionEditorRef = useRef(null);
  const lastModalKeyRef = useRef(null);

  useEffect(() => {
    // Solo precargar cuando el modal se abre/reabre (modalKey cambia)
    if (
      isOpen &&
      descriptionEditorRef.current != null &&
      lastModalKeyRef.current !== modalKey
    ) {
      descriptionEditorRef.current.innerHTML = description ?? '';
      lastModalKeyRef.current = modalKey;
    }
  }, [modalKey, isOpen, description]);

  const applyFormat = useCallback((command) => {
    document.execCommand(command, false, null);
    descriptionEditorRef.current?.focus();
  }, []);

  const onDescriptionInput = useCallback(() => {
    const html = descriptionEditorRef.current?.innerHTML ?? '';
    handleDescriptionChange(html);
  }, [handleDescriptionChange]);

  /** Subir / zona de soltar: no en modo solo lectura ni cerrado. */
  const attachmentsUploadDisabled = isDisabled || isViewMode || isSubcaseClosed;
  const attachmentsCardPointerBlocked = isDisabled || isSubcaseClosed;
  const attachmentsCardClassName = resolveKaceDisabledClassName({
    disabled: attachmentsCardPointerBlocked,
    readOnlyLock,
  });
  const showSubcaseAttachmentsSection = Boolean(component?.enableAttachments);

  return (
    <div className={disabledClassName}>
      {!isEditingParentCase ? (
        <div className="alert alert-info mb-0" role="status">
          <i className="fa fa-info-circle mr-2" aria-hidden="true" />
          Los subcasos solo están disponibles al editar un caso existente. Abra
          un caso padre para crear o gestionar subcasos.
        </div>
      ) : (
        <div ref={setListFetchMountNode} className="kace-subcases-edit-root">
          <div className="text-right">
            <button
              type="button"
              className="btn btn-primary"
              onClick={openModal}
              disabled={isDisabled || isOpen}
            >
              <i className="fa fa-plus mr-1" aria-hidden="true" />
              {buttonLabel}
            </button>
          </div>

          <div className="mt-3">
            {isListLoading ? (
              <div className="d-flex justify-content-center py-3">
                <div className="spinner-border text-primary" role="status">
                  <span className="sr-only">Cargando subcasos...</span>
                </div>
              </div>
            ) : (
              <DataTable
                component={tableComponent}
                onEvent={noopOnEvent}
                disabled={isDisabled || isOpen}
              />
            )}
            {listError && (
              <div className="alert alert-warning mt-2" role="alert">
                {listError}
              </div>
            )}
          </div>

          {error && !isOpen && (
            <div className="alert alert-danger mt-2" role="alert">
              {error}
            </div>
          )}

          {isOpen && (
            <>
              <div
                className="modal fade show d-block"
                tabIndex={-1}
                role="dialog"
                aria-labelledby="subcaseModalTitle"
                aria-modal="true"
              >
                <div className="modal-dialog modal-xl" role="document">
                  <div className="modal-content">
                    <div className="modal-header">
                      <h5 className="modal-title" id="subcaseModalTitle">
                        {isViewMode
                          ? `Ver Subcaso ${selectedSubcase?.reference ?? ''}`
                          : selectedSubcase
                            ? `Editar Subcaso ${selectedSubcase?.reference ?? ''}`
                            : 'Crear Subcaso'}
                      </h5>
                      <button
                        type="button"
                        className="close"
                        onClick={closeModal}
                        aria-label="Cerrar"
                        disabled={isDisabled}
                      >
                        <span aria-hidden="true">&times;</span>
                      </button>
                    </div>
                    <div
                      className="modal-body overflow-auto p-3"
                      style={{ maxHeight: '70vh' }}
                    >
                      {isSubcaseClosed && (
                        <div className="alert alert-danger mb-3" role="alert">
                          Este subcaso está cerrado y no puede modificarse.
                        </div>
                      )}
                      {error && (
                        <div className="alert alert-danger mb-3" role="alert">
                          {error}
                        </div>
                      )}
                      <div className="form-group">
                        <label htmlFor="subcase-classification-select">
                          Clasificación
                        </label>
                        <select
                          id="subcase-classification-select"
                          className="form-control"
                          value={
                            selectedClassificationId != null
                              ? String(selectedClassificationId)
                              : ''
                          }
                          onChange={(e) =>
                            handleClassificationChange(e.target.value)
                          }
                          disabled={
                            isDisabled ||
                            isLoading ||
                            isClassificationLocked ||
                            isViewMode ||
                            isSubcaseClosed
                          }
                        >
                          <option value="">
                            -- Seleccione una clasificación --
                          </option>
                          {classificationOptions.map((opt) => (
                            <option
                              key={String(opt.value)}
                              value={String(opt.value)}
                            >
                              {opt.label}
                            </option>
                          ))}
                        </select>
                        {isClassificationLocked && (
                          <small className="form-text text-muted">
                            La clasificación no puede modificarse al editar un
                            subcaso.
                          </small>
                        )}
                      </div>
                      {isLoading ? (
                        <div className="form-group d-flex align-items-center py-3">
                          <div
                            className="text-primary spinner-border spinner-border-sm mr-2"
                            role="status"
                          >
                            <span className="sr-only">Cargando...</span>
                          </div>
                          <span className="text-muted">
                            Cargando estados y formulario...
                          </span>
                        </div>
                      ) : (
                        <>
                          {selectedSubcase && currentStateName && (
                            <div className="mb-3">
                              <div className="d-flex align-items-center">
                                <span className="text-muted mr-2">
                                  Estado actual:
                                </span>
                                <span className="badge badge-info px-3 py-2">
                                  {currentStateName}
                                </span>
                              </div>
                            </div>
                          )}
                          {states.length > 0 ? (
                            <div className="form-group">
                              <label htmlFor="subcase-state-select">
                                Estado siguiente
                              </label>
                              <select
                                id="subcase-state-select"
                                className="form-control"
                                value={selectedTransitionId ?? ''}
                                onChange={(e) =>
                                  handleTransitionChange(e.target.value)
                                }
                                disabled={
                                  isDisabled || isViewMode || isSubcaseClosed
                                }
                              >
                                <option value="">
                                  -- Seleccione un estado siguiente --
                                </option>
                                {states.map((s) => (
                                  <option
                                    key={s.transition_id}
                                    value={s.transition_id}
                                  >
                                    {s.nombre}
                                  </option>
                                ))}
                              </select>
                            </div>
                          ) : (
                            <div
                              className="alert alert-warning mb-3"
                              role="status"
                            >
                              {selectedSubcase
                                ? 'No hay estados siguientes disponibles para este subcaso.'
                                : 'Seleccione una clasificación para cargar los estados disponibles.'}
                            </div>
                          )}
                          {(schemaId || oneScriptFormId) && (
                            <div>
                              <AuxCasesSchema
                                key={`${String(selectedClassificationId ?? '')}-${String(schemaId ?? oneScriptFormId ?? '')}`}
                                component={component}
                                updateValue={handleAuxFormUpdate}
                                onEvent={noopOnEvent}
                                root={mockRoot}
                                setFormInstance={setFormInstance}
                                schemaId={schemaId}
                                oneScriptFormId={oneScriptFormId}
                                initialSubmission={auxInitialSubmission}
                                isSubcase={true}
                                primaryKey={primaryKey}
                                subcaseSchemaRefreshNonce={
                                  subcaseSchemaRefreshNonce
                                }
                                disabled={isDisabled}
                                readOnly={isViewMode || isSubcaseClosed}
                              />
                            </div>
                          )}
                          <div className="form-group" key={modalKey}>
                            <label className="font-weight-bold">
                              Descripción
                            </label>
                            <p className="text-muted small mb-2">
                              Digite una descripción del subcaso (requerido).
                            </p>
                            <div className="border rounded">
                              <div className="d-flex flex-wrap align-items-center gap-1 p-2 border-bottom bg-light rounded-top">
                                <button
                                  type="button"
                                  className="btn btn-sm btn-light border"
                                  onClick={() => applyFormat('bold')}
                                  title="Negrita"
                                  aria-label="Negrita"
                                  disabled={
                                    isDisabled || isViewMode || isSubcaseClosed
                                  }
                                >
                                  <i
                                    className="fa fa-bold"
                                    aria-hidden="true"
                                  />
                                </button>
                                <button
                                  type="button"
                                  className="btn btn-sm btn-light border"
                                  onClick={() => applyFormat('italic')}
                                  title="Cursiva"
                                  aria-label="Cursiva"
                                  disabled={
                                    isDisabled || isViewMode || isSubcaseClosed
                                  }
                                >
                                  <i
                                    className="fa fa-italic"
                                    aria-hidden="true"
                                  />
                                </button>
                                <button
                                  type="button"
                                  className="btn btn-sm btn-light border"
                                  onClick={() => applyFormat('underline')}
                                  title="Subrayado"
                                  aria-label="Subrayado"
                                  disabled={
                                    isDisabled || isViewMode || isSubcaseClosed
                                  }
                                >
                                  <i
                                    className="fa fa-underline"
                                    aria-hidden="true"
                                  />
                                </button>
                              </div>
                              <div
                                ref={descriptionEditorRef}
                                className="p-3 bg-white rounded-bottom"
                                contentEditable={
                                  !isDisabled && !isViewMode && !isSubcaseClosed
                                }
                                suppressContentEditableWarning
                                onInput={onDescriptionInput}
                                data-placeholder="Escriba la descripción del subcaso..."
                                role="textbox"
                                aria-label="Descripción del subcaso"
                                style={{ minHeight: '120px', outline: 'none' }}
                              />
                            </div>
                          </div>
                          {showSubcaseAttachmentsSection && (
                            <div className="form-group mt-3">
                              <label className="font-weight-bold d-block">
                                Adjuntos
                              </label>
                              <p className="text-muted small mb-2">
                                Los archivos se suben al guardar el subcaso.
                              </p>
                              {subcaseAttachments.isLoading ? (
                                <div className="card shadow-sm">
                                  <div className="card-body p-4">
                                    <h2 className="h3 font-weight-bold mb-2">
                                      Adjuntos
                                    </h2>
                                    <div className="subcases-attachments__scroll d-flex justify-content-center align-items-center">
                                      <div
                                        className="spinner-border text-primary"
                                        role="status"
                                      >
                                        <span className="sr-only">
                                          Cargando adjuntos...
                                        </span>
                                      </div>
                                    </div>
                                  </div>
                                </div>
                              ) : (
                                <div
                                  className={`card shadow-sm ${attachmentsCardClassName}`}
                                >
                                  <div className="card-body p-4">
                                    <div className="subcases-attachments__scroll text-center d-flex flex-column justify-content-around">
                                      {!subcaseAttachments.showAttachments ? (
                                        <div className="d-flex flex-column justify-content-center align-items-center py-3">
                                          <h3 className="h5 font-weight-bold mb-2 text-danger">
                                            Permiso denegado
                                          </h3>
                                          <p className="mb-0 text-muted">
                                            No tiene permisos para adjuntar
                                            archivos, consulte las
                                            configuraciones globales del grupo
                                          </p>
                                        </div>
                                      ) : null}
                                      {subcaseAttachments.showAttachments &&
                                      !attachmentsUploadDisabled ? (
                                        <div
                                          className="border border-secondary rounded p-4 mb-3 subcases-attachments__dropzone"
                                          onClick={
                                            subcaseAttachments.handleClick
                                          }
                                          onDrop={subcaseAttachments.handleDrop}
                                          onDragOver={(e) => e.preventDefault()}
                                          role="presentation"
                                        >
                                          <i
                                            className="fa fa-download fa-3x mb-2 text-secondary d-block"
                                            aria-hidden="true"
                                          />
                                          <p className="text-muted mb-1">
                                            Arrastra y suelta archivos aquí, o
                                            haz clic para seleccionar archivos
                                          </p>
                                          <small className="text-muted d-block">
                                            Formatos permitidos:{' '}
                                            {subcaseAttachments.validExtensions}
                                          </small>
                                          <small className="text-muted d-block">
                                            Tamaño máximo:{' '}
                                            {subcaseAttachments.maxFileSizeMB}{' '}
                                            MB
                                          </small>
                                          {subcaseAttachments.quantityFiles ? (
                                            <small className="text-muted d-block">
                                              Cantidad máxima de archivos:{' '}
                                              {subcaseAttachments.quantityFiles}
                                            </small>
                                          ) : null}
                                          <input
                                            type="file"
                                            accept={
                                              subcaseAttachments.validExtensions ??
                                              undefined
                                            }
                                            ref={
                                              subcaseAttachments.fileInputRef
                                            }
                                            onChange={
                                              subcaseAttachments.handleFileChange
                                            }
                                            className="d-none"
                                            multiple={
                                              subcaseAttachments.allowMultiple
                                            }
                                            disabled={
                                              isDisabled || isSubcaseClosed
                                            }
                                            aria-label="Seleccionar archivos adjuntos"
                                          />
                                        </div>
                                      ) : null}
                                      {subcaseAttachments.files.length ? (
                                        subcaseAttachments.files.map((file) => {
                                          const row =
                                            /** @type {Record<string, unknown>} */ (
                                              file
                                            );
                                          const pathLabel =
                                            row.path != null
                                              ? String(row.path)
                                              : '';
                                          const payload =
                                            /** @type {Record<string, unknown> | undefined} */ (
                                              row.s3_payload
                                            );
                                          const rowKey =
                                            subcaseAttachments.getAttachmentRowKey(
                                              row
                                            );
                                          const isDownloading =
                                            subcaseAttachments
                                              .fileActionInProgress?.kind ===
                                              'download' &&
                                            subcaseAttachments
                                              .fileActionInProgress?.rowKey ===
                                              rowKey;
                                          const isDeleting =
                                            subcaseAttachments
                                              .fileActionInProgress?.kind ===
                                              'delete' &&
                                            subcaseAttachments
                                              .fileActionInProgress?.rowKey ===
                                              rowKey;
                                          return (
                                            <div
                                              key={String(row.id ?? row.path)}
                                              className="d-flex justify-content-center align-items-center small"
                                              aria-busy={
                                                isDownloading || isDeleting
                                              }
                                            >
                                              {payload ? (
                                                <i
                                                  className="fa fa-check text-success mr-2"
                                                  aria-hidden="true"
                                                />
                                              ) : (
                                                <i
                                                  className="fa fa-clock-o text-warning mr-2"
                                                  aria-hidden="true"
                                                />
                                              )}
                                              <span>{pathLabel}</span>
                                              {payload && (
                                                <button
                                                  type="button"
                                                  className="btn btn-link btn-sm text-success p-0 ml-3 d-inline-flex align-items-center"
                                                  title="Descargar archivo"
                                                  aria-label={
                                                    isDownloading
                                                      ? 'Descargando archivo'
                                                      : 'Descargar archivo'
                                                  }
                                                  disabled={
                                                    isDisabled || isDownloading
                                                  }
                                                  onClick={() =>
                                                    void subcaseAttachments.handleDownload(
                                                      payload,
                                                      rowKey
                                                    )
                                                  }
                                                >
                                                  {isDownloading ? (
                                                    <>
                                                      <span
                                                        className="spinner-border spinner-border-sm text-success"
                                                        role="status"
                                                        aria-hidden="true"
                                                      />
                                                      <span className="sr-only">
                                                        Descargando…
                                                      </span>
                                                    </>
                                                  ) : (
                                                    <i
                                                      className="fa fa-download"
                                                      aria-hidden="true"
                                                    />
                                                  )}
                                                </button>
                                              )}
                                              {!attachmentsUploadDisabled && (
                                                <button
                                                  type="button"
                                                  className="btn btn-link btn-sm text-danger p-0 ml-3 d-inline-flex align-items-center"
                                                  title="Eliminar archivo"
                                                  aria-label={
                                                    isDeleting
                                                      ? 'Eliminando archivo'
                                                      : 'Eliminar archivo'
                                                  }
                                                  disabled={
                                                    isDisabled ||
                                                    isSubcaseClosed ||
                                                    isDeleting
                                                  }
                                                  onClick={() =>
                                                    void subcaseAttachments.handleRemoveFile(
                                                      row
                                                    )
                                                  }
                                                >
                                                  {isDeleting ? (
                                                    <>
                                                      <span
                                                        className="spinner-border spinner-border-sm text-danger"
                                                        role="status"
                                                        aria-hidden="true"
                                                      />
                                                      <span className="sr-only">
                                                        Eliminando…
                                                      </span>
                                                    </>
                                                  ) : (
                                                    <i
                                                      className="fa fa-times"
                                                      aria-hidden="true"
                                                    />
                                                  )}
                                                </button>
                                              )}
                                            </div>
                                          );
                                        })
                                      ) : (
                                        <div className="text-muted">
                                          <i
                                            className="fa fa-file-o fa-3x mb-2 d-block text-secondary"
                                            aria-hidden="true"
                                          />
                                          No hay adjuntos cargados en este
                                          momento
                                        </div>
                                      )}
                                      {subcaseAttachments.message && (
                                        <div
                                          className={`alert alert-${subcaseAttachments.message.type} mt-3 p-2`}
                                          role="alert"
                                        >
                                          {subcaseAttachments.message.text}
                                        </div>
                                      )}
                                    </div>
                                  </div>
                                </div>
                              )}
                            </div>
                          )}
                        </>
                      )}
                    </div>
                    <div className="modal-footer">
                      {isViewMode ? (
                        <button
                          type="button"
                          className="btn btn-secondary"
                          onClick={closeModal}
                          disabled={isDisabled}
                        >
                          Cerrar
                        </button>
                      ) : (
                        <>
                          <button
                            type="button"
                            className="btn btn-secondary"
                            onClick={closeModal}
                            disabled={isDisabled}
                          >
                            Cancelar
                          </button>
                          {!isSubcaseClosed && (
                            <button
                              type="button"
                              className="btn btn-primary"
                              onClick={handleSubmit}
                              disabled={isDisabled || isSubmitting}
                            >
                              {isSubmitting && (
                                <span
                                  className="spinner-border spinner-border-sm mr-1"
                                  role="status"
                                  aria-hidden="true"
                                />
                              )}
                              Guardar
                            </button>
                          )}
                        </>
                      )}
                    </div>
                  </div>
                </div>
              </div>
              <div className="modal-backdrop fade show" />
            </>
          )}
        </div>
      )}
    </div>
  );
};
