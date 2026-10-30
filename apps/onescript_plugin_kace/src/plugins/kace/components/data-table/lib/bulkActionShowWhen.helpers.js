export function extractShowWhenVisibilityCode(showWhen) {
  const trimmed = String(showWhen ?? '').trim();
  if (!trimmed || !/\bloadPass\b/.test(trimmed)) {
    return trimmed;
  }
  const marker = trimmed.match(/^if\s*\(\s*loadPass\s*\)\s*\{/);
  if (!marker) {
    return trimmed;
  }
  let depth = 0;
  let started = false;
  for (let i = 0; i < trimmed.length; i += 1) {
    const char = trimmed[i];
    if (char === '{') {
      depth += 1;
      started = true;
    } else if (char === '}') {
      depth -= 1;
      if (started && depth === 0) {
        return trimmed.slice(i + 1).trim();
      }
    }
  }
  return trimmed;
}

export function wrapShowWhenForAsyncEvaluation(showWhen) {
  const trimmed = String(showWhen ?? '').trim();
  if (!trimmed) {
    return trimmed;
  }
  return `return (async function() {\n${trimmed}\n})();`;
}
