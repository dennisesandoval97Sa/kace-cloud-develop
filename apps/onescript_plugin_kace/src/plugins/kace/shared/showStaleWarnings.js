import Swal from 'sweetalert2';
import { STALE_CODE_WARNINGS } from '../services/caseService.js';

/**
 * Shows one grouped warning for known stale snapshot codes.
 * Builds DOM nodes with textContent so warning copy is never interpolated as HTML.
 *
 * @param {string[]} staleCodes
 * @param {typeof Swal} [swal]
 */
export async function showStaleWarnings(staleCodes, swal = Swal) {
  const warnings = (staleCodes ?? [])
    .map((code) => STALE_CODE_WARNINGS[code])
    .filter(Boolean);
  if (!warnings.length) return;

  const container = document.createElement('div');
  for (const text of warnings) {
    const p = document.createElement('p');
    p.textContent = text;
    container.appendChild(p);
  }
  await swal.fire({ icon: 'warning', html: container });
}
