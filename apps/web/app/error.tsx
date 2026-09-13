"use client";

type ErrorPageProps = { error: Error & { digest?: string }; reset: () => void };

export default function ErrorPage({ reset }: ErrorPageProps) {
  return (
    <main style={{ padding: 32, maxWidth: 720, margin: "0 auto" }}>
      <h1>Ocurrió un error</h1>
      <p>No pudimos completar la operación.</p>
      <button type="button" onClick={() => reset()}>Intentar nuevamente</button>
    </main>
  );
}
