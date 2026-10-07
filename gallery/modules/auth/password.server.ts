// scrypt from node:crypto (Node and Bun, no dependency) in a server-only
// utility. Swap in argon2 or bcrypt here; call sites use hash() and compare().
import { scrypt, randomBytes, timingSafeEqual } from 'node:crypto';
import { promisify } from 'node:util';

const scryptAsync = promisify(scrypt);

export async function hash(password: string): Promise<string> {
  const salt = randomBytes(16).toString('hex');
  const buf = (await scryptAsync(password, salt, 64)) as Buffer;
  return salt + ':' + buf.toString('hex');
}

export async function compare(password: string, stored: string): Promise<boolean> {
  const [salt, key] = stored.split(':');
  const buf = (await scryptAsync(password, salt, 64)) as Buffer;
  return timingSafeEqual(buf, Buffer.from(key, 'hex'));
}
