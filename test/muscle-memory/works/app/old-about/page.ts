// Next idiom: `permanentRedirect()` from a page.
import { permanentRedirect } from '@webjsdev/core';

export default function OldAbout() {
  permanentRedirect('/');
}
