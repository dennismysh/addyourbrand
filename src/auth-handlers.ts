// Auth.js handlers re-export. Kept in its own module so we can import handlers
// without pulling the full auth config (which imports the DB) into edge code.
import { handlers } from "./auth";
export const { GET, POST } = handlers;
