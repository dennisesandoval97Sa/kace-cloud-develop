function findTreeNodeByStoredValue(nodes, stored) {
  if (
    !Array.isArray(nodes) ||
    stored === undefined ||
    stored === null ||
    stored === ''
  ) {
    return null;
  }
  const needle = String(stored);
  return (
    nodes.find((o) => String(o.value) === needle) ??
    nodes.find((o) => String(o.label ?? o.value) === needle) ??
    null
  );
}

export const getCurrentOptions = (
  nivel,
  classificationsData,
  selectedOptions
) => {
  if (nivel === 'nivel1') return classificationsData;

  const nivelNum = parseInt(nivel.replace('nivel', ''), 10);
  let currentOptions = classificationsData;

  for (let i = 1; i < nivelNum; i++) {
    const currentNivel = `nivel${i}`;
    const currentSelection = selectedOptions[currentNivel];

    if (!currentSelection) break;

    const currentOpt = findTreeNodeByStoredValue(
      currentOptions,
      currentSelection
    );

    if (!currentOpt?.options?.length) break;
    currentOptions = currentOpt.options;
  }

  return currentOptions;
};
