// Lit idiom: a custom directive authored with `Directive` and `directive()`.
import { Directive, directive } from '@webjsdev/core/directive';

class ShoutDirective extends Directive {
  render(text: string) {
    return `${text.toUpperCase()}!`;
  }
}

export const shout = directive(ShoutDirective);
