"use client";

import { useRouter } from "next/navigation";
import { signIn } from "next-auth/react";
import { useState } from "react";

import { api } from "~/trpc/react";

type Mode = "signin" | "register";

export function AuthPanel() {
  const router = useRouter();
  const [mode, setMode] = useState<Mode>("signin");
  const [name, setName] = useState("");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  const register = api.auth.register.useMutation();

  async function signInWithCredentials() {
    const res = await signIn("credentials", {
      email,
      password,
      redirect: false,
    });
    if (res?.error) {
      setError("WRONG EMAIL OR PASSWORD");
      return false;
    }
    router.push("/");
    router.refresh();
    return true;
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError(null);
    setBusy(true);
    try {
      if (mode === "register") {
        try {
          await register.mutateAsync({ name, email, password });
        } catch (err) {
          setError(
            (err as { message?: string }).message?.toUpperCase() ??
              "REGISTRATION FAILED",
          );
          return;
        }
      }
      await signInWithCredentials();
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="pixel-border bg-panel relative p-5 [filter:drop-shadow(4px_4px_0_rgba(0,0,0,0.45))] [--pb:#2c3854] md:p-6">
      <h1 className="font-pixel text-cream mb-1 text-center text-xs md:text-sm">
        {mode === "signin" ? "SIGN IN" : "NEW RUNNER"}
      </h1>
      <p className="text-dim mb-5 text-center text-[9px] tracking-[0.25em]">
        {mode === "signin"
          ? "WELCOME BACK TO THE TRACK"
          : "CREATE YOUR LANE ASSIGNMENT"}
      </p>

      {/* Google */}
      <button
        onClick={() => void signIn("google", { callbackUrl: "/" })}
        className="bevel font-pixel text-night flex w-full cursor-pointer items-center justify-center gap-2 bg-[#ece1c8] px-4 py-3 text-[10px] transition-[filter] hover:brightness-95"
      >
        <GoogleMark />
        CONTINUE WITH GOOGLE
      </button>

      <div className="my-5 flex items-center gap-3">
        <div className="bg-line h-px flex-1" />
        <span className="text-dim text-[8px] tracking-[0.3em]">OR</span>
        <div className="bg-line h-px flex-1" />
      </div>

      {/* Email / password */}
      <form onSubmit={handleSubmit} className="flex flex-col gap-3">
        {mode === "register" && (
          <Field
            label="NAME"
            type="text"
            value={name}
            onChange={setName}
            autoComplete="name"
            minLength={2}
            maxLength={50}
          />
        )}
        <Field
          label="EMAIL"
          type="email"
          value={email}
          onChange={setEmail}
          autoComplete="email"
        />
        <Field
          label="PASSWORD"
          type="password"
          value={password}
          onChange={setPassword}
          autoComplete={
            mode === "register" ? "new-password" : "current-password"
          }
          minLength={mode === "register" ? 8 : 1}
          maxLength={100}
        />

        {error && (
          <p className="text-flame text-center text-[9px] tracking-[0.2em]">
            ✕ {error}
          </p>
        )}

        <button
          type="submit"
          disabled={busy}
          className="bevel bg-blaze font-pixel text-cream mt-1 w-full cursor-pointer px-4 py-3 text-[10px] transition-[filter] hover:brightness-110 disabled:cursor-default disabled:opacity-60"
        >
          {busy ? "…" : mode === "signin" ? "SIGN IN ▸" : "CREATE ACCOUNT ▸"}
        </button>
      </form>

      <button
        onClick={() => {
          setMode(mode === "signin" ? "register" : "signin");
          setError(null);
        }}
        className="text-dim hover:text-cream mt-5 w-full cursor-pointer text-center text-[9px] tracking-[0.25em] transition-colors"
      >
        {mode === "signin"
          ? "NO ACCOUNT? REGISTER ▸"
          : "HAVE AN ACCOUNT? SIGN IN ▸"}
      </button>
    </div>
  );
}

function Field({
  label,
  type,
  value,
  onChange,
  autoComplete,
  minLength,
  maxLength,
}: {
  label: string;
  type: string;
  value: string;
  onChange: (v: string) => void;
  autoComplete?: string;
  minLength?: number;
  maxLength?: number;
}) {
  return (
    <label className="flex flex-col gap-1.5">
      <span className="text-dim text-[8px] tracking-[0.3em]">{label}</span>
      <input
        type={type}
        value={value}
        onChange={(e) => onChange(e.target.value)}
        autoComplete={autoComplete}
        minLength={minLength}
        maxLength={maxLength}
        required
        className="border-line bg-night text-cream focus:border-dim w-full border px-3 py-2.5 font-mono text-sm outline-none placeholder:text-white/20"
      />
    </label>
  );
}

/** Pixel-art "G" — keeps the Google button on-style. */
function GoogleMark() {
  return (
    <svg
      viewBox="0 0 8 8"
      className="h-3.5 w-3.5"
      shapeRendering="crispEdges"
      aria-hidden
    >
      <rect x="2" y="0" width="4" height="2" fill="#ea4335" />
      <rect x="0" y="2" width="2" height="2" fill="#ea4335" />
      <rect x="0" y="4" width="2" height="2" fill="#fbbc05" />
      <rect x="2" y="6" width="4" height="2" fill="#34a853" />
      <rect x="6" y="4" width="2" height="2" fill="#4285f4" />
      <rect x="4" y="3" width="3" height="2" fill="#4285f4" />
    </svg>
  );
}
