class OptimisticState {
  constructor(host, options) {
    this.host = host;
    this.options = options;
    this.updates = [];
    this._nextId = 0;
    if (host && typeof host.addController === 'function') {
      host.addController(this);
    }
  }

  get value() {
    let current = this.options.source();
    if (!this.options.update) {
      return this.updates.length > 0
        ? this.updates[this.updates.length - 1].payload
        : current;
    }
    for (const update of this.updates) {
      current = this.options.update(current, update.payload);
    }
    return current;
  }

  add(payload, promise) {
    const id = `opt-${++this._nextId}`;
    this.updates.push({ id, payload });
    this.host?.requestUpdate?.();

    const release = () => {
      const idx = this.updates.findIndex(u => u.id === id);
      if (idx !== -1) {
        this.updates.splice(idx, 1);
        this.host?.requestUpdate?.();
      }
    };

    if (promise && typeof promise.then === 'function') {
      if (typeof promise.finally === 'function') {
        promise.finally(() => release()).catch(() => {});
      } else {
        promise.then(() => release(), () => release());
      }
    }

    return release;
  }
}

async function runLegacyOptimistic(signal, value, action) {
  const prev = signal.get();
  signal.set(value);
  let result;
  try {
    result = await action();
  } catch (err) {
    signal.set(prev);
    throw err;
  }
  if (result && result.success === false) {
    signal.set(prev);
  }
  return result;
}

/**
 * Optimistic state manager supporting both React-style declarative wrapper and signal-based rollback.
 *
 * Declarative:
 *   const optimisticTodos = optimistic(this, {
 *     source: () => this.todos,
 *     update: (state, newTitle) => [...state, { id: 'temp', title: newTitle }]
 *   });
 *   // in submit:
 *   this.optimisticTodos.add(title, createTodoAction({ title }));
 *
 * Signal-based:
 *   await optimistic(likedSignal, true, () => likePost(postId));
 */
export function optimistic(first, second, third) {
  if (first && typeof first.get === 'function' && typeof first.set === 'function') {
    return runLegacyOptimistic(first, second, third);
  }
  return new OptimisticState(first, second);
}
