import { describe, expect, it } from 'vitest';
import {
  extractShowWhenVisibilityCode,
  wrapShowWhenForAsyncEvaluation,
} from './bulkActionShowWhen.helpers.js';

describe('bulkActionShowWhen.helpers', () => {
  it('extractShowWhenVisibilityCode removes loadPass block with await', () => {
    const code = `if (loadPass) {
  const response = await apiService.post('/users/search', {});
  setSelectOptions('user', []);
  return true;
}

if (modalFormData.asignamentType !== 'user') {
  return false;
}

return true;`;
    const visibility = extractShowWhenVisibilityCode(code);
    expect(visibility).toContain("modalFormData.asignamentType !== 'user'");
    expect(visibility).not.toContain('await');
    expect(() => new Function('modalFormData', visibility)).not.toThrow();
  });

  it('wrapShowWhenForAsyncEvaluation allows await in loadPass block', () => {
    const code = `if (loadPass) {
  await apiService.post('/users/search', {});
  return true;
}
return true;`;
    const wrapped = wrapShowWhenForAsyncEvaluation(code);
    expect(() => new Function('loadPass', 'apiService', wrapped)).not.toThrow();
  });
});
