// Single accessor for backend secrets.
//
// Secrets are environment-variable based, never stored in this app's
// database. `secrets.get()` reads the Base44 secret store (populated from a
// .env file via `base44 secrets set --env-file .env`); `Deno.env.get()` is
// the fallback for plain env vars in the runtime. Shared helpers should use
// this instead of reaching for Deno.env directly, so a value set through the
// secret store resolves the same way everywhere.
import { secrets } from "base44:runtime";

export function getSecret(name: string, fallback = ""): string {
  let value = "";
  try {
    value = secrets.get(name) || "";
  } catch {
    value = "";
  }
  if (!value) {
    try {
      value = Deno.env.get(name) || "";
    } catch {
      value = "";
    }
  }
  return (value || fallback).trim();
}