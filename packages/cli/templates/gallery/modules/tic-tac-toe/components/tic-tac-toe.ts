// A CLIENT-ONLY interactive component: no server, no db. Demonstrates instance
// signals as the default state primitive (read with .get() in render(), the
// built-in SignalWatcher re-renders on change) and @click handlers. Nothing
// here ships to the server; it is pure client interactivity in a component.
import { WebComponent, signal, html } from '@webjsdev/core';

type Cell = 'X' | 'O' | null;

export class TicTacToe extends WebComponent {
  // Instance signals are component-local (a module-scope signal would be shared
  // across every instance and survive navigations, which is not wanted here).
  private board = signal<Cell[]>(Array(9).fill(null));
  private turn = signal<'X' | 'O'>('X');

  private winner(b: Cell[]): Cell {
    const lines = [[0,1,2],[3,4,5],[6,7,8],[0,3,6],[1,4,7],[2,5,8],[0,4,8],[2,4,6]];
    for (const [a, c, d] of lines) if (b[a] && b[a] === b[c] && b[a] === b[d]) return b[a];
    return null;
  }

  private play(i: number) {
    const b = this.board.get();
    if (b[i] || this.winner(b)) return;
    const next = b.slice();
    next[i] = this.turn.get();
    this.board.set(next);
    this.turn.set(this.turn.get() === 'X' ? 'O' : 'X');
  }

  private reset() { this.board.set(Array(9).fill(null)); this.turn.set('X'); }

  render() {
    const b = this.board.get();
    const win = this.winner(b);
    const status = win ? `${win} wins` : b.every(Boolean) ? 'Draw' : `${this.turn.get()} to move`;
    return html`
      <div class="grid gap-3 w-fit">
        <p class="font-semibold" aria-live="polite">${status}</p>
        <div class="grid grid-cols-3 gap-1">
          ${b.map((cell, i) => html`
            <button
              @click=${() => this.play(i)}
              aria-label="cell ${i + 1}${cell ? `, ${cell}` : ''}"
              class="w-14 h-14 text-2xl font-bold border border-border rounded grid place-items-center">${cell ?? ''}</button>
          `)}
        </div>
        <button @click=${() => this.reset()} class="text-sm text-fg-subtle underline underline-offset-4">Reset</button>
      </div>
    `;
  }
}
TicTacToe.register('tic-tac-toe');
