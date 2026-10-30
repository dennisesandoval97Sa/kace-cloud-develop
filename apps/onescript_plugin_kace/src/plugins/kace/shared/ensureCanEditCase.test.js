import { beforeEach, describe, expect, it, vi } from 'vitest';
import Swal from 'sweetalert2';
import { ensureCanEditCase } from './ensureCanEditCase.js';

vi.mock('sweetalert2', () => ({
  default: { fire: vi.fn() },
}));

const buildKaceEngine = ({ caseEditLocked = false, canEditCaseSync } = {}) => {
  const storeService = { get: vi.fn(() => caseEditLocked) };
  const userService =
    canEditCaseSync === undefined
      ? {}
      : { canEditCaseSync: () => canEditCaseSync };

  return {
    getService: (name) => {
      if (name === 'user') return userService;
      if (name === 'storeService') return storeService;
      return undefined;
    },
  };
};

describe('ensureCanEditCase', () => {
  beforeEach(() => {
    Swal.fire.mockReset();
  });

  it('allows submit when the user can edit the case and it is not locked', async () => {
    const kaceEngine = buildKaceEngine({ canEditCaseSync: true });

    const blocked = await ensureCanEditCase(kaceEngine);

    expect(blocked).toBe(false);
    expect(Swal.fire).not.toHaveBeenCalled();
  });

  it('blocks submit and warns when canEditCaseSync returns false', async () => {
    const kaceEngine = buildKaceEngine({ canEditCaseSync: false });

    const blocked = await ensureCanEditCase(kaceEngine);

    expect(blocked).toBe(true);
    expect(Swal.fire).toHaveBeenCalledTimes(1);
    expect(Swal.fire).toHaveBeenCalledWith(
      expect.objectContaining({ icon: 'warning' })
    );
  });

  it('blocks submit when the case is locked, even if the user could edit it', async () => {
    const kaceEngine = buildKaceEngine({
      caseEditLocked: true,
      canEditCaseSync: true,
    });

    const blocked = await ensureCanEditCase(kaceEngine);

    expect(blocked).toBe(true);
    expect(Swal.fire).toHaveBeenCalledTimes(1);
  });

  it('allows submit when canEditCaseSync is not implemented by the user service', async () => {
    const kaceEngine = buildKaceEngine();

    const blocked = await ensureCanEditCase(kaceEngine);

    expect(blocked).toBe(false);
    expect(Swal.fire).not.toHaveBeenCalled();
  });
});
