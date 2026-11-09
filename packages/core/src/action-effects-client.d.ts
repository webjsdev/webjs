/** Browser effects a server action's RPC response asks for (revalidatePath's in-place refresh). Read by the generated action stub. */
export function parseRefreshHeader(value: string | null | undefined): { path: string; layout: boolean }[];
export function refreshCovers(entry: { path: string; layout: boolean }, pathname: string): boolean;
export function applyActionRefresh(value: string | null | undefined): Promise<boolean>;
export function evictRefreshed(value: string | null | undefined): void;
export function followActionRedirect(value: string): Promise<never>;
