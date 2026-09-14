/**
 * Discover live / direct providers from a runtime registry (the Flarum app).
 * Canonical namespace: app.flatRateMessagingSources.{live,direct}
 * Missing keys are null — the shell must not Composer-require those packages.
 *
 * @param {object} [registry]
 * @returns {{ live: object|null, direct: object|null }}
 */
export default function discoverSources(registry) {
  const nested = registry?.flatRateMessagingSources;
  return {
    live: nested?.live || null,
    direct: nested?.direct || null,
  };
}

export function productMode(sources) {
  const live = !!sources?.live;
  const direct = !!sources?.direct;
  if (live && direct) return 'unified';
  if (live) return 'live';
  if (direct) return 'direct';
  return 'unavailable';
}
