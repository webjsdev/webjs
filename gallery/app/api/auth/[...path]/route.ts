// The createAuth endpoints (signin, signout, OAuth callbacks), at the app root
// because createAuth hardcodes /api/auth/*. The rest of the card is under
// app/features/auth/.
import { handlers } from '#modules/auth/auth.server.ts';
export const GET = handlers.GET;
export const POST = handlers.POST;
