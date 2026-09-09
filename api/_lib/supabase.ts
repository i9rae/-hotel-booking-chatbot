import { createClient } from "@supabase/supabase-js";

// Clé "anon" + policies RLS en lecture seule (voir sql/002_rls_policies.sql).
// Jamais la service_role key ici, même si ce code tourne côté serveur —
// principe du moindre privilège : ce endpoint ne fait que lire des prix.
export const supabase = createClient(
  process.env.SUPABASE_URL!,
  process.env.SUPABASE_ANON_KEY!
);
