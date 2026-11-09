// Lit idiom (@lit/context): the context is its key, created once and shared.
import { createContext } from '@webjsdev/core/context';

export const themeContext = createContext<string>('theme');
