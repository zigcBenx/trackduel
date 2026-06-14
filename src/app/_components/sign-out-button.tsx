"use client";

import { signOut } from "next-auth/react";
import { useState } from "react";

export function SignOutButton({ className }: { className?: string }) {
  const [busy, setBusy] = useState(false);
  return (
    <button
      onClick={() => {
        if (busy) return;
        setBusy(true);
        void signOut({ callbackUrl: "/" });
      }}
      disabled={busy}
      className={`press ${className ?? ""}`}
    >
      SIGN OUT ✕
    </button>
  );
}
