/**
 * Supabase Client Pool - Connection reuse for better performance
 *
 * Problem: Every request creates a new Supabase client instance, causing:
 * - New connection overhead (100-200ms per request)
 * - No connection pooling at application level
 * - Increased database connection churn
 *
 * Solution: Singleton pattern that reuses Supabase client instances
 * - Admin client: reused across server-side requests
 * - Reduces connection overhead significantly
 *
 * Based on performance analysis showing 1.469s for getEventSummary()
 * with 4 sequential queries, each 400-900ms due to connection overhead.
 */

import { createClient, SupabaseClient } from "@supabase/supabase-js";

// Singleton instances
let adminClient: SupabaseClient | null = null;
let serviceClient: SupabaseClient | null = null;

/**
 * Get or create admin Supabase client (singleton)
 * Uses service role key to bypass RLS for admin operations
 *
 * @returns Supabase client instance or null if env vars missing
 */
export function getAdminSupabaseClient(): SupabaseClient | null {
  // Return existing instance if available
  if (adminClient) {
    return adminClient;
  }

  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const serviceRole = process.env.SUPABASE_SERVICE_ROLE_KEY;

  if (!url || !serviceRole) {
    console.warn("Missing Supabase environment variables for admin client");
    return null;
  }

  // Create and cache the client instance
  adminClient = createClient(url, serviceRole, {
    auth: {
      autoRefreshToken: false,
      persistSession: false,
    },
    // Enable connection pooling at client level
    db: {
      schema: "public",
    },
    global: {
      headers: {
        "x-application-name": "carbon-silicon-tools-site",
      },
    },
  });

  return adminClient;
}

/**
 * Get or create service Supabase client (singleton)
 * Separate from admin client for operations that don't need full admin privileges
 *
 * @returns Supabase client instance or null if env vars missing
 */
export function getServiceSupabaseClient(): SupabaseClient | null {
  if (serviceClient) {
    return serviceClient;
  }

  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const serviceRole = process.env.SUPABASE_SERVICE_ROLE_KEY;

  if (!url || !serviceRole) {
    return null;
  }

  serviceClient = createClient(url, serviceRole, {
    auth: {
      autoRefreshToken: false,
      persistSession: false,
    },
    db: {
      schema: "public",
    },
  });

  return serviceClient;
}

/**
 * Reset admin client (useful for testing or when env vars change)
 */
export function resetAdminClient(): void {
  adminClient = null;
}

/**
 * Reset service client
 */
export function resetServiceClient(): void {
  serviceClient = null;
}

/**
 * Reset all cached clients
 */
export function resetAllClients(): void {
  adminClient = null;
  serviceClient = null;
}

// Export original function name for backward compatibility
export const createAdminSupabaseClient = getAdminSupabaseClient;
