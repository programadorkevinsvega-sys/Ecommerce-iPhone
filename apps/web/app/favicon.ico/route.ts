const favicon = `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 64 64"><rect width="64" height="64" rx="14" fill="#171715"/><path d="M19 16h26v8H28v8h15v8H28v8h17v8H19z" fill="#fff"/></svg>`;

export function GET(): Response {
  return new Response(favicon, {
    headers: {
      "cache-control": "public, max-age=86400",
      "content-type": "image/svg+xml; charset=utf-8",
    },
  });
}
