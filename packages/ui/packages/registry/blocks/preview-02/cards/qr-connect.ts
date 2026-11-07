/**
 * The preview-02 "Scan to connect" card: a QR code over a heading and a
 * button. A fragment helper. Installed at `components/preview-02/qr-connect.ts`.
 * Ported from shadcn/ui's preview-02.
 *
 * shadcn draws the code with the react-qr-code package. The kit takes no
 * third-party dependency, so the code here is a fixed 21 by 21 module grid
 * drawn as SVG. To encode your own URL, render it with a QR library of your
 * choice on the server and put its SVG in place of the grid.
 */
import { html, svg } from '@webjsdev/core';
import { cn } from '../../../lib/utils.ts';
import { buttonClass } from '../../../components/button.ts';
import {
  cardClass,
  cardContentClass,
  cardDescriptionClass,
  cardFooterClass,
  cardHeaderClass,
  cardTitleClass,
} from '../../../components/card.ts';

const QR = [
  '111111100101101111111', '100000101001001000001', '101110101111101011101',
  '101110100100001011101', '101110101010101011101', '100000100111001000001',
  '111111101010101111111', '000000001101000000000', '101011111001111010110',
  '010100001110010101001', '111010111011101111010', '001101000101000010101',
  '110111101111010111011', '000000001001010001010', '111111101101111101001',
  '100000100010001001111', '101110101011101110100', '101110100110100010011',
  '101110101000111101110', '100000101101000011001', '111111101011101101111',
];

export function qrConnect() {
  const cells = QR.flatMap((row, y) => [...row].map((c, x) => (c === '1' ? svg`<rect x=${x} y=${y} width="1" height="1"></rect>` : '')));
  return html`
    <div data-slot="card" data-size="default" class=${cardClass()}>
      <div data-slot="card-content" class=${cn(cardContentClass(), 'flex justify-center pt-6')}>
        <div class="rounded-xl border bg-white p-4">
          <svg viewBox="0 0 21 21" width="160" height="160" class="size-40 text-black" role="img" aria-label="QR code to connect your mobile device" shape-rendering="crispEdges">
            <rect width="21" height="21" fill="white"></rect>
            ${cells}
          </svg>
        </div>
      </div>
      <div data-slot="card-header" class=${cn(cardHeaderClass(), 'text-center')}>
        <div data-slot="card-title" class=${cardTitleClass()}>Scan to connect your mobile device</div>
        <div data-slot="card-description" class=${cardDescriptionClass()}>Open the Ledger mobile app and scan this code to link your device.</div>
      </div>
      <div data-slot="card-footer" class=${cardFooterClass()}>
        <button type="button" data-slot="button" data-variant="secondary" data-size="default" class=${cn(buttonClass({ variant: 'secondary' }), 'w-full')}>Got it</button>
      </div>
    </div>
  `;
}
