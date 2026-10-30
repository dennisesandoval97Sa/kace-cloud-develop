import { beforeEach, describe, expect, it, vi } from 'vitest';
import Swal from 'sweetalert2';
import { showStaleWarnings } from './showStaleWarnings.js';

vi.mock('sweetalert2', () => ({
  default: { fire: vi.fn() },
}));

vi.mock('../services/caseService.js', () => ({
  STALE_CODE_WARNINGS: {
    '0x030041': 'El estado del caso <b>no</b> fue modificado.',
    '0x030042': 'El responsable del caso no fue modificado.',
  },
}));

describe('showStaleWarnings', () => {
  beforeEach(() => {
    Swal.fire.mockReset();
  });

  it('does not open Swal when there are no known codes', async () => {
    await showStaleWarnings(['0xDEAD']);
    expect(Swal.fire).not.toHaveBeenCalled();
  });

  it('renders known warnings as text nodes, not interpolated HTML', async () => {
    await showStaleWarnings(['0x030041', '0x030042']);

    expect(Swal.fire).toHaveBeenCalledTimes(1);
    const [{ icon, html }] = Swal.fire.mock.calls[0];
    expect(icon).toBe('warning');
    expect(html).toBeInstanceOf(HTMLElement);
    const paragraphs = [...html.querySelectorAll('p')].map(
      (node) => node.textContent
    );
    expect(paragraphs).toEqual([
      'El estado del caso <b>no</b> fue modificado.',
      'El responsable del caso no fue modificado.',
    ]);
    expect(html.querySelector('b')).toBeNull();
  });
});
