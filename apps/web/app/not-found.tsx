import Link from "next/link";

export default function NotFound() {
  return (
    <main style={{ padding: 32, maxWidth: 720, margin: "0 auto" }}>
      <h1>Página no encontrada</h1>
      <p>La página que buscas no existe o ya no está disponible.</p>
      <Link href="/">Volver al inicio</Link>
    </main>
  );
}
