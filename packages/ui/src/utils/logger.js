import kleur from 'kleur';

export const logger = {
  info: (...args) => console.log(...args),
  success: (...args) => console.log(kleur.green('✔'), ...args),
  warn: (...args) => console.log(kleur.yellow('⚠'), ...args),
  error: (...args) => console.error(kleur.red('✖'), ...args),
  break: () => console.log(''),
  dim: (s) => kleur.dim(s),
  bold: (s) => kleur.bold(s),
  cyan: (s) => kleur.cyan(s),
  green: (s) => kleur.green(s),
};
