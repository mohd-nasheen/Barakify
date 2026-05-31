"use client";

import { useState } from "react";
import { createClient } from "@/lib/supabase/client";

export function PasskeyButtons({ showRegister = false }: { showRegister?: boolean }) {
  const [status, setStatus] = useState<string>("");
  const [loading, setLoading] = useState(false);

  async function signInWithPasskey() {
    setLoading(true);
    const supabase = createClient();
    const { error } = await supabase.auth.signInWithPasskey();
    setLoading(false);
    if (error) {
      setStatus(error.message);
      return;
    }
    window.location.href = "/dashboard";
  }

  async function registerPasskey() {
    setLoading(true);
    const supabase = createClient();
    const { error } = await supabase.auth.registerPasskey();
    setLoading(false);
    setStatus(error ? error.message : "Passkey registered.");
  }

  return (
    <div className="stack">
      <button className="button ghost" onClick={signInWithPasskey} disabled={loading} type="button">
        {loading ? "Processing..." : "Continue with Passkey"}
      </button>
      {showRegister ? (
        <button className="button ghost" onClick={registerPasskey} disabled={loading} type="button">
          Register a Passkey
        </button>
      ) : null}
      {status ? <p className="status">{status}</p> : null}
    </div>
  );
}
