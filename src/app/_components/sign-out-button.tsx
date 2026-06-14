"use client";

import { signOut } from "next-auth/react";

export function SignOutButton({ className }: { className?: string }) {
  return (
    <button
      onClick={() => void signOut({ callbackUrl: "/" })}
      className={className}
    >
      SIGN OUT ✕
    </button>
  );
}
