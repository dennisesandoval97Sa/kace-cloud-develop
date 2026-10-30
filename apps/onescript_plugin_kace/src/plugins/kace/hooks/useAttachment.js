import { evaluateKace } from '#plugins/kace/shared/evaluateKace.js';
import { useEffect, useMemo, useRef, useState } from 'react';
import useEventData from '#plugins/kace/hooks/useEventData.js';
import {
  KACE_EVENT_ATTACHMENT_VISIBILITY,
  SCHEMA_KEY_ATTACHMENT_HIDDEN,
  SCHEMA_KEY_ATTACHMENT_HIDDEN_INITIAL,
} from '#plugins/kace/shared/kace-events.constants.js';
import { KaceEngine } from '../KaceEngine';

/**
 * Evaluates the attachment component's hidden expression with current form data.
 * @param {Object} formData - Current form data (root.data)
 * @param {string} [hiddenExpression] - JavaScript expression from component.hidden
 * @returns {boolean} True if the component should be hidden
 */
function evaluateHidden(formData, hiddenExpression) {
  if (
    !hiddenExpression ||
    typeof hiddenExpression !== 'string' ||
    !hiddenExpression.trim()
  ) {
    return false;
  }
  try {
    const result = evaluateKace(hiddenExpression, {
      data: formData ?? {},
      row: formData ?? {},
    });
    return Boolean(result);
  } catch {
    return false;
  }
}

/**
 * Normalizes a file entry ensuring it has a tipoFoto property.
 * Restores tipoFoto from attachment_type (DB column) for files loaded from the API.
 * Falls back to null for files that predate the feature.
 * @param {Record<string, unknown>} file
 * @returns {Record<string, unknown>}
 */
function normalizeFile(file) {
  if (!file || typeof file !== 'object') return file;
  if (Object.prototype.hasOwnProperty.call(file, 'tipoFoto')) return file;
  const attachmentType = file.attachment_type ?? null;
  return {
    ...file,
    tipoFoto: attachmentType
      ? { id: attachmentType, label: attachmentType }
      : null,
  };
}

/**
 * Hook for attachment component: file list, visibility, tipo de foto, and event subscriptions.
 *
 * TODO(tech-debt): Naming inconsistency — public API uses `fileTypeCategory*` but internal
 * file objects use `file.tipoFoto` and form schema uses `tipoFotoItems`/`tipoFotoRequired`.
 * Cannot rename without migrating persisted store entries and published form JSONs across tenants.
 * See: https://konecta.atlassian.net/browse/KACE-XXXX
 *
 * @param {Function} onEvent - Component's on() for kace events
 * @param {{ root?: { on?: Function, off?: Function, data?: Object }, component?: { hidden?: string, tipoFotoItems?: Array<{label: string}>, tipoFotoRequired?: boolean } }} [options]
 */
const useAttachment = (onEvent, options = {}) => {
  const { root, component } = options;
  const classificationMode =
    component?.classificationMode ??
    (component?.enableTypeSelection
      ? 'tipoAdjunto'
      : component?.tipoFotoItems?.length
        ? 'tipoFoto'
        : 'none');
  const enableTypeSelection = classificationMode === 'tipoAdjunto';
  const fileTypeNumericOptions = component?.attachmentTypes || [];
  const fileTypeCategoryOptions = useMemo(
    () =>
      (component?.tipoFotoItems || [])
        .filter((i) => i?.label?.trim())
        .map((i) => {
          const label = i.label.trim().slice(0, 255);
          return { id: label, label };
        }),
    // JSON.stringify because component.tipoFotoItems is a new array reference on every render
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [JSON.stringify(component?.tipoFotoItems)]
  );
  const enableCategorySelection =
    classificationMode === 'tipoFoto' && fileTypeCategoryOptions.length > 0;
  const { data, attachmentsLoading, error: authError } = useEventData(onEvent);
  const initialHidden =
    component?.[SCHEMA_KEY_ATTACHMENT_HIDDEN_INITIAL] === true;
  const [isHidden, setIsHidden] = useState(initialHidden);
  const hiddenExpression = component?.[SCHEMA_KEY_ATTACHMENT_HIDDEN];
  const [files, setFiles] = useState(
    /** @type {Array<Record<string, any>>} */ ([])
  );
  const [message, setMessage] = useState(
    /** @type {{type: string, text: string} | null} */ (null)
  );
  const fileInputRef = useRef(null);
  const [isLoading, setIsLoading] = useState(false);
  // Tracks whether we've already done the initial cache load for this component instance.
  // Used to strip stale tipoFotoChanged/typeChanged flags only on the first hydration from
  // the store — flags left over from a session where BOTON_GUARDAR did not clear the store.
  // After the first load the user may have set flags intentionally; subsequent loads must
  // not strip them.
  const hasLoadedFromCacheRef = useRef(false);

  const kaceEngine = KaceEngine();
  const storeService = kaceEngine.getService('storeService');
  const fileService = kaceEngine.getService('file');
  const userService = kaceEngine.getService('user');

  const globalConfig = storeService.get('config.global_config');
  const globalConfigReady = globalConfig != null;
  const maxFileSizeMB = useMemo(
    () =>
      globalConfig?.behaviors?.application?.agente?.files_extensions
        ?.maximun_size_allowed || 0,
    [globalConfig]
  );
  const quantityFiles = useMemo(
    () =>
      globalConfig?.behaviors?.application?.agente?.files_extensions
        ?.quantity_files_allowed || 0,
    [globalConfig]
  );
  const extensionsList = useMemo(
    () =>
      globalConfig?.behaviors?.application?.agente?.files_extensions
        ?.allowed_file_extensions || [],
    [globalConfig]
  );
  const allowMultiple = useMemo(
    () => !quantityFiles || quantityFiles > 1,
    [quantityFiles]
  );

  const caseConfig = storeService.get('config.cases_config');
  const allowClientSendAttachments = useMemo(
    () => caseConfig?.allow_client_send_attachments || false,
    [caseConfig]
  );

  const validExtensions = useMemo(
    () => extensionsList.join(', ') || null,
    [extensionsList]
  );

  const userCanEditCase = useMemo(
    () =>
      typeof userService?.canEditCaseSync === 'function'
        ? userService.canEditCaseSync()
        : false,
    [data, userService]
  );

  const showAttachments = useMemo(
    () => Boolean(validExtensions?.length) || false,
    [validExtensions]
  );

  // ─── Tipo de foto ────────────────────────────────────────────────────────────

  /** Whether every uploaded file must be classified before saving. */
  const fileTypeCategoryRequired =
    enableCategorySelection && component?.tipoFotoRequired !== false;

  /**
   * Assigns a tipo de foto to a specific file entry.
   * @param {Object} targetFile - Reference to the file object in state
   * @param {{ id: string, label: string } | null} option - Selected option or null to clear
   */
  const handleSetFileTypeCategory = (targetFile, option) => {
    setFiles((prev) => {
      const updated = prev.map((f) =>
        f === targetFile
          ? {
              ...f,
              tipoFoto: option,
              ...(f.id ? { tipoFotoChanged: true } : {}),
            }
          : f
      );
      storeService.set('cases.attachments', updated);
      const hasUnclassified =
        fileTypeCategoryRequired && updated.some((f) => f.tipoFoto === null);
      storeService.set('cases.attachments_has_unclassified', hasUnclassified);
      return updated;
    });
  };

  /** True when tipoFotoRequired is on and at least one file has no type assigned. */
  const hasUnclassifiedFiles = useMemo(
    () =>
      fileTypeCategoryRequired &&
      files.length > 0 &&
      files.some((f) => f.tipoFoto === null),
    [fileTypeCategoryRequired, files]
  );

  // ─── File helpers ────────────────────────────────────────────────────────────

  const resetFileInput = () => {
    if (fileInputRef.current) {
      fileInputRef.current.value = '';
    }
  };

  const handleMessage = (value) => {
    setMessage(value);
    setTimeout(() => setMessage(null), 6000);
  };

  const handleFileChange = (e) => {
    const selectedFiles = Array.from(e.target.files || []);
    const quantityFilesAllowed = quantityFiles || 0;
    let filesToProcess = selectedFiles;
    if (quantityFilesAllowed > 0) {
      const availableSlots = quantityFilesAllowed - files.length;
      if (availableSlots <= 0) {
        handleMessage({
          type: 'danger',
          text: `Ha alcanzado el número máximo de archivos permitidos (${quantityFilesAllowed}).`,
        });
        return;
      }
      filesToProcess = selectedFiles.slice(0, availableSlots);
    }
    filesToProcess.forEach((file) => {
      void handleFileSelect(file);
    });
    resetFileInput();
  };

  const handleFileSelect = async (selectedFile) => {
    if (!selectedFile) return;
    if (maxFileSizeMB > 0) {
      const maxBytes = maxFileSizeMB * 1024 * 1024;
      if (selectedFile.size > maxBytes) {
        handleMessage({
          type: 'danger',
          text: `El archivo excede el tamaño máximo permitido de ${maxFileSizeMB} MB.`,
        });
        return;
      }
    }
    const validExtensions = (extensionsList || []).map((ext) =>
      ext.replace('.', '').toLowerCase()
    );
    const fileExtension = selectedFile.name.includes('.')
      ? selectedFile.name.split('.').pop().toLowerCase()
      : '';
    if (!fileExtension || !validExtensions.includes(fileExtension)) {
      handleMessage({
        type: 'danger',
        text: 'Extension de archivos no valida.',
      });
      return;
    }
    if (!userCanEditCase) {
      handleMessage({
        type: 'danger',
        text: 'No tiene permisos para adjuntar.',
      });
      return;
    }
    if (!allowClientSendAttachments) {
      handleMessage({
        type: 'danger',
        text: 'No tiene permisos para enviar archivos, consulte las configuraciones globales del grupo.',
      });
      return;
    }
    const isDuplicate = files.some((f) => f.path === selectedFile.name);
    if (isDuplicate) {
      handleMessage({
        type: 'warning',
        text: 'Ya existe un archivo con el mismo nombre.',
      });
      return;
    }
    const fileName = selectedFile.name;
    const contentType = selectedFile.type || 'application/octet-stream';
    const defaultType = fileTypeNumericOptions.length
      ? fileTypeNumericOptions[0].identifier
      : null;
    const newFile = {
      path: fileName,
      description: contentType,
      file: selectedFile,
      isLocal: true,
      tipoFoto: null,
      ...(enableTypeSelection && { attachmentType: defaultType }),
    };
    setFiles((prev) => {
      const updated = [...prev, newFile];
      storeService.set('cases.attachments', updated);
      if (fileTypeCategoryRequired) {
        storeService.set('cases.attachments_has_unclassified', true);
      }
      return updated;
    });
  };

  const handleRemoveFile = async (file) => {
    if (!file) return;
    if (!userCanEditCase) {
      handleMessage({
        type: 'danger',
        text: 'No tiene permisos.',
      });
      return;
    }
    if (file.isLocal || !file.id) {
      setFiles((prev) => {
        const updated = prev.filter((f) => f !== file);
        storeService.set('cases.attachments', updated);
        const hasUnclassified =
          fileTypeCategoryRequired && updated.some((f) => f.tipoFoto === null);
        storeService.set('cases.attachments_has_unclassified', hasUnclassified);
        return updated;
      });
      resetFileInput();
      return;
    }

    try {
      await fileService.deleteFile(String(file.id));
      setFiles((prev) => {
        const updated = prev.filter((f) => f.id !== file.id);
        const hasUnclassified =
          fileTypeCategoryRequired && updated.some((f) => f.tipoFoto === null);
        storeService.set('cases.attachments_has_unclassified', hasUnclassified);
        return updated;
      });
      handleMessage({
        type: 'warning',
        text: 'Archivo eliminado.',
      });
    } catch (error) {
      handleMessage({
        type: 'danger',
        text: 'No se pudo eliminar el archivo.',
      });
    }
  };

  const handleDownload = async (payload) => {
    try {
      await fileService.downloadFile(payload);
    } catch {
      handleMessage({
        type: 'danger',
        text: 'Error descargando archivo.',
      });
    }
  };

  const handleDrop = (e) => {
    e.preventDefault();
    const droppedFiles = Array.from(e.dataTransfer.files || []);
    const quantityFilesAllowed = quantityFiles || 0;
    let filesToProcess = droppedFiles;
    if (quantityFilesAllowed > 0) {
      const availableSlots = quantityFilesAllowed - files.length;
      if (availableSlots <= 0) {
        handleMessage({
          type: 'danger',
          text: `Máximo ${quantityFilesAllowed} archivos.`,
        });
        return;
      }
      filesToProcess = droppedFiles.slice(0, availableSlots);
    }
    filesToProcess.forEach((file) => {
      void handleFileSelect(file);
    });
    resetFileInput();
  };

  const handleFileTypeChange = (file, attachmentType) => {
    setFiles((prev) => {
      const updated = prev.map((f) =>
        f.path === file.path
          ? { ...f, attachmentType, ...(f.id ? { typeChanged: true } : {}) }
          : f
      );
      storeService.set('cases.attachments', updated);
      return updated;
    });
  };

  const handleClick = () => {
    fileInputRef.current.click();
  };

  // ─── Load existing attachments ───────────────────────────────────────────────

  useEffect(() => {
    if (attachmentsLoading) {
      return;
    }

    const isCreating = Boolean(storeService.get('cases.generated_case_id'));
    if (!isCreating) {
      try {
        setIsLoading(true);
        const caseData = storeService.get('cases.case_data');
        if (!caseData || typeof caseData !== 'object') {
          return;
        }
        const attachmentsPrefetched = storeService.get(
          'cases.attachments_prefetched'
        );
        const cachedAttachments = storeService.get('cases.attachments');
        if (attachmentsPrefetched && Array.isArray(cachedAttachments)) {
          // Risk 3: normalize files that predate the tipoFoto feature
          let normalized = cachedAttachments.map(normalizeFile);
          if (!hasLoadedFromCacheRef.current) {
            // Strip stale tipoFotoChanged / typeChanged flags that may have survived
            // from a previous session where BOTON_GUARDAR did not clear the store
            // (e.g. an old version without the store-invalidation step).
            // We also write the clean list back so updateModifiedAttachmentTypes
            // does not pick up those stale flags when it reads the store.
            normalized = normalized.map(
              // eslint-disable-next-line no-unused-vars
              ({ tipoFotoChanged, typeChanged, ...rest }) => rest
            );
            storeService.set('cases.attachments', normalized);
          }
          hasLoadedFromCacheRef.current = true;
          setFiles(normalized);
          const hasUnclassified =
            fileTypeCategoryRequired &&
            normalized.some((f) => f.tipoFoto === null);
          storeService.set(
            'cases.attachments_has_unclassified',
            hasUnclassified
          );
          return;
        }
      } catch {
        setFiles([]);
        return;
      } finally {
        setIsLoading(false);
      }
    }
  }, [data, attachmentsLoading, authError]);

  // ─── Visibility ──────────────────────────────────────────────────────────────

  useEffect(() => {
    if (!root || typeof root.on !== 'function') return;

    const handleVisibility = (payload) => {
      if (payload && typeof payload.hidden === 'boolean') {
        setIsHidden(payload.hidden);
      }
    };

    const handleChange = () => {
      if (
        !hiddenExpression ||
        typeof hiddenExpression !== 'string' ||
        !hiddenExpression.trim()
      ) {
        return;
      }
      const formData = root.data ?? {};
      setIsHidden(evaluateHidden(formData, hiddenExpression));
    };

    root.on(KACE_EVENT_ATTACHMENT_VISIBILITY, handleVisibility);
    root.on('change', handleChange);
    handleChange();

    return () => {
      if (typeof root.off === 'function') {
        root.off(KACE_EVENT_ATTACHMENT_VISIBILITY, handleVisibility);
        root.off('change', handleChange);
      }
    };
  }, [root, hiddenExpression]);

  return {
    data,
    fileInputRef,
    files,
    validExtensions,
    message,
    userCanEditCase,
    showAttachments,
    isHidden,
    isLoading: isLoading || attachmentsLoading || !globalConfigReady,
    maxFileSizeMB,
    quantityFiles,
    allowMultiple,
    handleClick,
    handleDrop,
    handleFileChange,
    handleRemoveFile,
    handleDownload,
    enableCategorySelection,
    fileTypeCategoryOptions,
    fileTypeCategoryRequired,
    hasUnclassifiedFiles,
    handleSetFileTypeCategory,
    enableTypeSelection,
    fileTypeNumericOptions,
    handleFileTypeChange,
  };
};

export default useAttachment;
