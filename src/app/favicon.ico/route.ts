export function GET() {
  return new Response(
    `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 64 64">
      <rect width="64" height="64" rx="12" fill="#08111f"/>
      <path d="M17 20h30v7H17zM17 31h20v6H17zM17 41h30v5H17z" fill="#4f8cff"/>
      <circle cx="45" cy="34" r="8" fill="none" stroke="#33d69f" stroke-width="5"/>
    </svg>`,
    {
      headers: {
        "content-type": "image/svg+xml; charset=utf-8",
        "cache-control": "public, max-age=31536000, immutable"
      }
    }
  );
}
