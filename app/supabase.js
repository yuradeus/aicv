import { createClient } from "https://cdn.jsdelivr.net/npm/@supabase/supabase-js@2/+esm";

export function supabase() {
  const cfg = window.__SUPABASE__;
  if (!cfg?.url || !cfg?.anonKey) {
    throw new Error("Missing Supabase config. Check app/supabase-config.js");
  }
  return createClient(cfg.url, cfg.anonKey);
}

