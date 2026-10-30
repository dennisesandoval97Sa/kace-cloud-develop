import { useEffect, useMemo, useRef, useState } from 'react';
import useEventData from '#plugins/kace/hooks/useEventData.js';
import { KaceEngine } from '../KaceEngine';
import { GLOBAL_CONFIG_PATHS } from '#plugins/kace/data/constants.js';
import { getValueByPath } from '#plugins/kace/utils/getValueByPath.js';
import { useGlobalConfig } from '#plugins/kace/hooks/useGlobalConfig.js';

/** Ruta dentro de `store.config.global_config` para {@link GLOBAL_CONFIG_PATHS.SHOW_DESCRIPTION}. */
const SHOW_DESCRIPTION_IN_GC =
  'layouts.application.agente.cases.show_description';

const normalizeDescription = (value, allowEmpty) => {
  let text = value ?? '';

  if (typeof text !== 'string') {
    text = '';
  }

  const plain = text
    .replace(/<[^>]*>/g, '')
    .replace(/&nbsp;/g, '')
    .replace(/\s+/g, '')
    .trim();

  if (plain === '') {
    return allowEmpty ? '_' : '';
  }

  return text;
};

const useRichTextEditor = (onChange, onEvent) => {
  const { descriptionLoading, data: kaceAuthPayload } = useEventData(onEvent);
  const editorRef = useRef(null);
  const [activeFormats, setActiveFormats] = useState({
    bold: false,
    italic: false,
    underline: false,
    strikethrough: false,
  });

  const showDescriptionPref = useGlobalConfig(
    onEvent,
    GLOBAL_CONFIG_PATHS.SHOW_DESCRIPTION
  );

  const allowedDescriptionEmptyFromStore = useGlobalConfig(
    onEvent,
    GLOBAL_CONFIG_PATHS.ALLOW_DESCRIPTIONS_EMPTY
  );

  const lockCaseDescriptionEdit = useGlobalConfig(
    onEvent,
    GLOBAL_CONFIG_PATHS.LOCK_CASE_DESCRIPTION_EDIT
  );

  const kaceEngine = KaceEngine();
  const storeService = kaceEngine.getService('storeService');
  const userService = kaceEngine.getService('user');
  const caseData = storeService.get('cases.case_data');

  const showDescriptionFromStore = useMemo(() => {
    if (showDescriptionPref != null) {
      return showDescriptionPref;
    }
    const gc = storeService?.get?.('config.global_config');
    if (!gc) {
      return null;
    }
    const fromGc = getValueByPath(gc, SHOW_DESCRIPTION_IN_GC);
    return fromGc !== undefined && fromGc !== null ? fromGc : true;
  }, [showDescriptionPref, kaceAuthPayload, descriptionLoading, storeService]);

  const isUpdate = Boolean(caseData?.id);
  const initialValue = caseData?.descripcion_caso?.descripcion ?? '';

  const userCanEdit = useMemo(
    () =>
      typeof userService?.canEditCaseSync === 'function'
        ? userService.canEditCaseSync()
        : false,
    [userService, caseData]
  );

  const disabledDescription = useMemo(
    () => showDescriptionFromStore !== true || (!userCanEdit && !isUpdate),
    [showDescriptionFromStore, isUpdate, userCanEdit]
  );

  /** Solo true cuando el flag resuelto es explícitamente true. */
  const showDescription = showDescriptionFromStore === true;

  const allowEmpty = allowedDescriptionEmptyFromStore || disabledDescription;

  const locked = isUpdate && lockCaseDescriptionEdit === true;

  useEffect(() => {
    if (showDescriptionFromStore === false) {
      onChange('_');
    }
  }, [showDescriptionFromStore]);

  useEffect(() => {
    if (!editorRef.current || showDescriptionFromStore !== true) return;

    const value = normalizeDescription(initialValue, allowEmpty);

    editorRef.current.innerHTML = value;
    onChange(value);
  }, [initialValue, allowEmpty, showDescriptionFromStore]);

  const updateActiveFormats = () => {
    setActiveFormats({
      bold: document.queryCommandState('bold'),
      italic: document.queryCommandState('italic'),
      underline: document.queryCommandState('underline'),
      strikethrough: document.queryCommandState('strikethrough'),
    });
  };

  const handleFormat = (command, value = null) => {
    document.execCommand(command, false, value);
    editorRef.current.focus();
    updateActiveFormats();
  };

  const handleInput = () => {
    const raw = editorRef.current?.innerHTML;

    const value = normalizeDescription(raw, allowEmpty);

    onChange(value);
    updateActiveFormats();
  };

  const handleKeyUp = () => {
    updateActiveFormats();
  };

  const handleMouseUp = () => {
    updateActiveFormats();
  };
  return {
    editorRef,
    activeFormats,
    disabledDescription,
    locked,
    showDescription,
    /**
     * Valor efectivo de `show_description` (null = aún sin `global_config` en store).
     */
    showDescriptionFromStore,
    descriptionLoading,
    handleFormat,
    handleInput,
    handleKeyUp,
    handleMouseUp,
  };
};

export default useRichTextEditor;
