import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import Swal from 'sweetalert2';
import { KaceEngine } from '#plugins/kace/KaceEngine.js';
import {
  SUBCASE_ATTACHMENT_DELETE_SWAL_CANCEL,
  SUBCASE_ATTACHMENT_DELETE_SWAL_CONFIRM,
  SUBCASE_ATTACHMENT_DELETE_SWAL_TITLE,
  getSubcaseAttachmentDeleteSwalText,
} from '#plugins/kace/components/subcases/lib/subcaseAttachments.constants.js';

/**
 * Hook atómico: adjuntos de subcaso en estado local (no usa `cases.attachments` ni `kace_data.attachments`).
 * @param {{ enabled?: boolean }} options
 * @returns {{
 *   files: Array<Record<string, unknown>>,
 *   pendingFiles: Array<Record<string, unknown>>,
 *   message: { type: string, text: string } | null,
 *   isLoading: boolean,
 *   fileInputRef: React.RefObject<HTMLInputElement | null>,
 *   validExtensions: string | null,
 *   maxFileSizeMB: number,
 *   quantityFiles: number,
 *   allowMultiple: boolean,
 *   showAttachments: boolean,
 *   reset: () => void,
 *   loadAttachments: (caseId: string | number | null | undefined) => Promise<void>,
 *   handleFileChange: (e: import('react').ChangeEvent<HTMLInputElement>) => void,
 *   handleDrop: (e: import('react').DragEvent) => void,
 *   handleClick: () => void,
 *   handleRemoveFile: (file: Record<string, unknown>) => Promise<void>,
 *   handleDownload: (payload: Record<string, unknown>, rowKey?: string) => Promise<void>,
 *   fileActionInProgress: { kind: 'download' | 'delete', rowKey: string } | null,
 *   getAttachmentRowKey: (file: Record<string, unknown>) => string,
 * }}
 */
export function useSubcaseAttachments(options = {}) {
  const { enabled = false } = options;
  const kace = useMemo(() => KaceEngine(), []);
  const fileService = useMemo(() => kace?.getService('file') ?? null, [kace]);
  const store = useMemo(() => kace?.getService('storeService') ?? null, [kace]);
  const userService = useMemo(() => kace?.getService('user') ?? null, [kace]);

  const [files, setFiles] = useState([]);
  const [message, setMessage] = useState(null);
  const [isLoading, setIsLoading] = useState(false);
  /** Acción en curso sobre una fila (descarga o borrado en servidor). */
  const [fileActionInProgress, setFileActionInProgress] = useState(null);
  const fileInputRef = useRef(null);
  const filesRef = useRef(files);

  useEffect(() => {
    filesRef.current = files;
  }, [files]);

  const maxFileSizeMB = store?.get?.('cases.maximun_size_allowed') ?? 0;
  const quantityFiles = store?.get?.('cases.quantity_files_allowed') ?? 0;
  const extensionsList = store?.get?.('cases.allowed_files_extensions') ?? [];
  const allowMultiple = !quantityFiles || quantityFiles > 1;

  const validExtensions = useMemo(
    () => extensionsList.join(', ') || null,
    [extensionsList]
  );

  const showAttachments = useMemo(
    () => Boolean(validExtensions?.length),
    [validExtensions]
  );

  const handleMessage = useCallback((value) => {
    setMessage(value);
    setTimeout(() => setMessage(null), 6000);
  }, []);

  const resetFileInput = useCallback(() => {
    try {
      if (fileInputRef.current) {
        fileInputRef.current.value = '';
      }
    } catch (error) {
      console.error('useSubcaseAttachments resetFileInput', error);
    }
  }, []);

  const getAttachmentRowKey = useCallback((file) => {
    if (file == null || typeof file !== 'object') {
      return '';
    }
    const id = file.id;
    const path = file.path;
    if (id != null && String(id).trim() !== '') {
      return String(id);
    }
    return path != null ? String(path) : '';
  }, []);

  const reset = useCallback(() => {
    try {
      setFiles([]);
      setMessage(null);
      setFileActionInProgress(null);
      resetFileInput();
    } catch (error) {
      console.error('useSubcaseAttachments reset', error);
    }
  }, [resetFileInput]);

  const loadAttachments = useCallback(
    async (caseId) => {
      if (!enabled || caseId == null || caseId === '') {
        setFiles([]);
        return;
      }
      if (!fileService) {
        setFiles([]);
        return;
      }
      try {
        setIsLoading(true);
        const list = await fileService.fetchAttachmentsByCaseId(caseId);
        setFiles(Array.isArray(list) ? list : []);
      } catch (error) {
        setFiles([]);
        handleMessage({
          type: 'danger',
          text:
            error?.message ?? 'No se pudieron cargar los adjuntos del subcaso.',
        });
      } finally {
        setIsLoading(false);
      }
    },
    [enabled, fileService, handleMessage]
  );

  const handleFileSelect = useCallback(
    (selectedFile) => {
      try {
        if (!selectedFile || !enabled) {
          return;
        }
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
        const validExts = (extensionsList || []).map((ext) =>
          String(ext).replace('.', '').toLowerCase()
        );
        const fileExtension = selectedFile.name.includes('.')
          ? selectedFile.name.split('.').pop().toLowerCase()
          : '';
        if (!fileExtension || !validExts.includes(fileExtension)) {
          handleMessage({
            type: 'danger',
            text: 'Extensión de archivos no válida.',
          });
          return;
        }
        if (!userService?.canEditCaseSync?.()) {
          handleMessage({
            type: 'danger',
            text: 'No tiene permisos para adjuntar.',
          });
          return;
        }
        const casesConfig = store?.get?.('config.cases_config');
        if (!casesConfig?.allow_client_send_attachments) {
          handleMessage({
            type: 'danger',
            text: 'No tiene permisos para enviar archivos, consulte las configuraciones globales del grupo.',
          });
          return;
        }
        const prev = filesRef.current;
        const isDuplicate = prev.some((f) => f.path === selectedFile.name);
        if (isDuplicate) {
          handleMessage({
            type: 'warning',
            text: 'Ya existe un archivo con el mismo nombre.',
          });
          return;
        }
        const quantityFilesAllowed = quantityFiles || 0;
        if (quantityFilesAllowed > 0 && prev.length >= quantityFilesAllowed) {
          handleMessage({
            type: 'danger',
            text: `Ha alcanzado el número máximo de archivos permitidos (${quantityFilesAllowed}).`,
          });
          return;
        }
        const fileName = selectedFile.name;
        const contentType = selectedFile.type || 'application/octet-stream';
        const newFile = {
          path: fileName,
          description: contentType,
          file: selectedFile,
          isLocal: true,
        };
        setFiles((p) => [...p, newFile]);
      } catch (error) {
        handleMessage({
          type: 'danger',
          text: error?.message ?? 'Error al agregar el archivo.',
        });
      }
    },
    [
      enabled,
      extensionsList,
      handleMessage,
      maxFileSizeMB,
      quantityFiles,
      store,
      userService,
    ]
  );

  const handleFileChange = useCallback(
    (e) => {
      try {
        const selectedFiles = Array.from(e.target.files || []);
        const quantityFilesAllowed = quantityFiles || 0;
        let filesToProcess = selectedFiles;
        if (quantityFilesAllowed > 0) {
          const availableSlots = quantityFilesAllowed - filesRef.current.length;
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
          handleFileSelect(file);
        });
        resetFileInput();
      } catch (error) {
        handleMessage({
          type: 'danger',
          text: error?.message ?? 'Error al procesar archivos.',
        });
      }
    },
    [handleFileSelect, handleMessage, quantityFiles, resetFileInput]
  );

  const handleDrop = useCallback(
    (e) => {
      try {
        e.preventDefault();
        const droppedFiles = Array.from(e.dataTransfer.files || []);
        const quantityFilesAllowed = quantityFiles || 0;
        let filesToProcess = droppedFiles;
        if (quantityFilesAllowed > 0) {
          const availableSlots = quantityFilesAllowed - filesRef.current.length;
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
          handleFileSelect(file);
        });
        resetFileInput();
      } catch (error) {
        handleMessage({
          type: 'danger',
          text: error?.message ?? 'Error al soltar archivos.',
        });
      }
    },
    [handleFileSelect, handleMessage, quantityFiles, resetFileInput]
  );

  const handleClick = useCallback(() => {
    try {
      fileInputRef.current?.click();
    } catch (error) {
      handleMessage({
        type: 'danger',
        text: error?.message ?? 'Error al abrir el selector de archivos.',
      });
    }
  }, [handleMessage]);

  const handleRemoveFile = useCallback(
    async (file) => {
      if (!file) {
        return;
      }
      if (!userService?.canEditCaseSync?.()) {
        handleMessage({
          type: 'danger',
          text: 'No tiene permisos.',
        });
        return;
      }
      const fileLabel = file.path != null ? String(file.path) : '';
      try {
        const confirmResult = await Swal.fire({
          icon: 'warning',
          title: SUBCASE_ATTACHMENT_DELETE_SWAL_TITLE,
          text: getSubcaseAttachmentDeleteSwalText(fileLabel),
          showCancelButton: true,
          confirmButtonText: SUBCASE_ATTACHMENT_DELETE_SWAL_CONFIRM,
          cancelButtonText: SUBCASE_ATTACHMENT_DELETE_SWAL_CANCEL,
          focusCancel: true,
        });
        if (!confirmResult.isConfirmed) {
          return;
        }
      } catch (error) {
        handleMessage({
          type: 'danger',
          text: error?.message ?? 'No se pudo mostrar la confirmación.',
        });
        return;
      }
      if (file.isLocal || !file.id) {
        setFiles((prev) => prev.filter((f) => f !== file));
        resetFileInput();
        return;
      }
      if (!fileService) {
        handleMessage({
          type: 'danger',
          text: 'Servicio de archivos no disponible.',
        });
        return;
      }
      const rowKey = getAttachmentRowKey(file);
      const op = { kind: 'delete', rowKey };
      setFileActionInProgress(op);
      try {
        await fileService.deleteFile(String(file.id));
        setFiles((prev) => prev.filter((f) => f.id !== file.id));
        handleMessage({
          type: 'warning',
          text: 'Archivo eliminado.',
        });
      } catch (error) {
        handleMessage({
          type: 'danger',
          text: error?.message ?? 'No se pudo eliminar el archivo.',
        });
      } finally {
        setFileActionInProgress((current) =>
          current?.kind === op.kind && current?.rowKey === op.rowKey
            ? null
            : current
        );
      }
    },
    [
      fileService,
      getAttachmentRowKey,
      handleMessage,
      resetFileInput,
      userService,
    ]
  );

  const handleDownload = useCallback(
    async (payload, rowKeyForUi) => {
      if (!fileService || !payload) {
        return;
      }
      const fileName = payload.fileName != null ? String(payload.fileName) : '';
      const rowKey =
        rowKeyForUi != null && String(rowKeyForUi).trim() !== ''
          ? String(rowKeyForUi)
          : fileName;
      if (!rowKey) {
        try {
          await fileService.downloadFile(payload);
        } catch (error) {
          handleMessage({
            type: 'danger',
            text: 'Error descargando archivo.',
          });
        }
        return;
      }
      const op = { kind: 'download', rowKey };
      setFileActionInProgress(op);
      try {
        await fileService.downloadFile(payload);
      } catch (error) {
        handleMessage({
          type: 'danger',
          text: 'Error descargando archivo.',
        });
      } finally {
        setFileActionInProgress((current) =>
          current?.kind === op.kind && current?.rowKey === op.rowKey
            ? null
            : current
        );
      }
    },
    [fileService, handleMessage]
  );

  const pendingFiles = useMemo(
    () => files.filter((f) => f && !f.id && f.file),
    [files]
  );

  return useMemo(
    () => ({
      files,
      pendingFiles,
      message,
      isLoading,
      fileInputRef,
      validExtensions,
      maxFileSizeMB,
      quantityFiles,
      allowMultiple,
      showAttachments,
      reset,
      loadAttachments,
      handleFileChange,
      handleDrop,
      handleClick,
      handleRemoveFile,
      handleDownload,
      fileActionInProgress,
      getAttachmentRowKey,
    }),
    [
      allowMultiple,
      fileActionInProgress,
      files,
      getAttachmentRowKey,
      pendingFiles,
      handleClick,
      handleDownload,
      handleDrop,
      handleFileChange,
      handleRemoveFile,
      isLoading,
      loadAttachments,
      maxFileSizeMB,
      message,
      quantityFiles,
      reset,
      showAttachments,
      validExtensions,
    ]
  );
}
