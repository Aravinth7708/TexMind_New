export function renderErrorPage(err?: unknown): string {
  const message = err instanceof Error ? `${err.message}\n${err.stack ?? ""}` : String(err ?? "Unknown error");
  return `<!doctype html>
<html lang="en">
  <head>
    <meta charset="utf-8" />
    <title>Server Error Details</title>
    <meta name="viewport" content="width=device-width, initial-scale=1" />
    <style>
      body { font: 14px/1.5 monospace; background: #0f172a; color: #f8fafc; padding: 2rem; }
      .card { max-width: 60rem; margin: 0 auto; background: #1e293b; border-radius: 0.5rem; padding: 2rem; border: 1px solid #334155; }
      h1 { font-size: 1.25rem; margin: 0 0 1rem; color: #f87171; }
      pre { background: #090d16; padding: 1rem; border-radius: 0.375rem; overflow-x: auto; white-space: pre-wrap; word-break: break-all; color: #fbbf24; }
    </style>
  </head>
  <body>
    <div class="card">
      <h1>Server-Side Rendering Error</h1>
      <pre>${message}</pre>
    </div>
  </body>
</html>`;
}
