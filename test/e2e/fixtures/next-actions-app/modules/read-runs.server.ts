'use server';
import { runs } from './store.server.ts';

export async function readRuns(): Promise<number> {
  return runs();
}
