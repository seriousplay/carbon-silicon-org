import { createClient } from "@supabase/supabase-js";
import { getAdminSupabaseClient } from "./pool";

/**
 * @deprecated Use getAdminSupabaseClient() from @/lib/supabase/pool instead.
 * This function now delegates to the singleton pool for connection reuse.
 *
 * Performance improvement: Avoids creating new connections on every request.
 * Expected savings: 100-200ms per request.
 */
export function createAdminSupabaseClient() {
  return getAdminSupabaseClient();
}
