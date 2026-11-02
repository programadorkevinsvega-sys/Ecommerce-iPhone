"use client";

import ClientErrorReporter from "./components/ClientErrorReporter";

export default function GlobalError({
  error,
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  return (
    <html lang="es">
      <body>
        <ClientErrorReporter digest={error.digest} />
        <main>
          <h1>Ocurrió un error</h1>
          <p>No pudimos completar la operación.</p>
          <button type="button" onClick={() => reset()}>
            Intentar nuevamente
          </button>
        </main>
      </body>
    </html>
  );
}
