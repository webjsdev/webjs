// An intentional render throw, so the dev error overlay goes up and the embed
// bridge relays it to the host as `server-error`.
export default function Crash() {
  throw new Error('embed fixture: this page threw during render');
}
