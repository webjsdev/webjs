/**
 * The session token is encrypted exactly as Auth.js v5 encrypts it (#1686):
 * JWE `dir` + `A256CBC-HS512`, the key from HKDF-SHA256 over the secret with
 * the cookie name as salt and `Auth.js Generated Encryption Key (<salt>)` as
 * info, and a SHA-512 JWK thumbprint as `kid` (`packages/core/src/jwt.ts` in
 * the Auth.js repository). The two fixtures were made by `jose` (the library
 * Auth.js uses) with that derivation, so decrypting them proves the format
 * matches the reference, not merely itself. Runs on Node and Bun.
 */
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { encryptSession, decryptSession } from '../../src/jwe.js';

const SECRET = 'authjs-interop-vector-secret-0123456789';
const JOSE_MADE = {
  'webjs.auth': 'eyJhbGciOiJkaXIiLCJlbmMiOiJBMjU2Q0JDLUhTNTEyIiwia2lkIjoieEhlajZXaF8xYUxITkd6RHNuMjBtTVotb2JPcy1Id1BQYmk2dnZ3U0R3OFE3cGRfcTdNaFd1N0lsZmZwdFFYQmdrWDB4LVJETXFiT1lBQjlxZ2hOTGcifQ..3SHnf3YLFqoqFxfk7xivqA.Gva67dqJYFDfe3fz1E0W6SoQ2DH2BNavy5X4e9rE5LVChBLBRja_hOwpIgmn3H8Fn4FKTMPfs1nAv0sKMMksOyZOgcox3TLvzX_v5o1zLU0zmxyDKn8QOqdgO6lcV2vfF2v2wKimWUtCjNmFbdkADg._c3ImPz1e7COPWIAKtkQo7PGkAGPNfdHCmX420k7kus',
  '__Host-webjs.auth': 'eyJhbGciOiJkaXIiLCJlbmMiOiJBMjU2Q0JDLUhTNTEyIiwia2lkIjoicXJ6RktObXlHYi1scnRmYU5GSG01Rm9WNkRMYS1OQjJfWEJBYTQ1U0FBS2RreFZVUDE5V2UzekE3ZXBXc1pmN213bDZLZ3pUeGlKcU5Xb0dJMGU3cUEifQ..R8rKJr17UzmDj3d4NpW5pA.vob7_Cld3ih-5mwMaeR4r-YdblOYvx82LYnl_TkspBwFSWn6I4fNS3syi20nbqbn8dQieW-7LPfhjZEvTVGlQouPsrFBdCUb4MseBbTbOJyAtaGAArYlch2yR_HMZ75EoUbi0irMkRQyyGeft3L3tg.57BJflYeDWlMQjNLUMQ75sl5xnv_r-Sb-pWreRc8d2w',
};

test('a token jose made with Auth.js key derivation decrypts', async () => {
  for (const [salt, token] of Object.entries(JOSE_MADE)) {
    const claims = await decryptSession(token, SECRET, salt);
    assert.equal(claims?.sub, '42', salt);
    assert.equal(claims?.email, 'vector@example.com');
    assert.equal(claims?.jti, 'vector-jti');
  }
});

test('the salt is part of the key: a token for one cookie name does not open under another', async () => {
  assert.equal(await decryptSession(JOSE_MADE['webjs.auth'], SECRET, '__Host-webjs.auth'), null);
  assert.equal(await decryptSession(JOSE_MADE['webjs.auth'], SECRET + 'x', 'webjs.auth'), null, 'nor under another secret');
});

test('the token is encrypted: the claims are not readable from it', async () => {
  const token = await encryptSession({ sub: 'u1', email: 'private@example.com' }, SECRET, 'webjs.auth');
  const parts = token.split('.');
  assert.equal(parts.length, 5, 'compact JWE');
  assert.equal(parts[1], '', 'dir has no encrypted key');
  const header = JSON.parse(Buffer.from(parts[0], 'base64url').toString());
  assert.equal(header.alg, 'dir');
  assert.equal(header.enc, 'A256CBC-HS512');
  for (const p of parts) assert.ok(!Buffer.from(p, 'base64url').toString().includes('private@example.com'), 'no claim is readable');
  assert.equal((await decryptSession(token, SECRET, 'webjs.auth'))?.email, 'private@example.com');
});

test('several secrets rotate: a token made with the old one still opens', async () => {
  const token = await encryptSession({ sub: 'r' }, 'old-secret-0123456789abcdef', 'webjs.auth');
  assert.equal((await decryptSession(token, ['new-secret-0123456789abcdef', 'old-secret-0123456789abcdef'], 'webjs.auth'))?.sub, 'r');
});
