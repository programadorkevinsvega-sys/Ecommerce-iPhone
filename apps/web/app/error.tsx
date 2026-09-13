"use client";

import { useEffect } from "react";

type ErrorPageProps = { error: Error & { digest?: string }; reset: () => void };

export default function ErrorPage({ error, reset }: ErrorPageProps) {
  useEffect(() => {
    if (process.env.NODE_ENV !== "production") console.error("Unexpected application error", error);
  }, [error]);

  return (
    <main style={{ padding: 32, maxWidth: 720, margin: "0 auto" }}>
      <h1>Ocurrió un error</h1>
      <p>No pudimos completar la operación.</p>
      <button type="button" onClick={() => reset()}>Intentar nuevamente</button>
    </main>
  );
}
