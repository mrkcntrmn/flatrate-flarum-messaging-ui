/**
 * Discover live / direct providers from a runtime registry (the Flarum app).
 * Missing keys are null — the shell must not Composer-require those packages.
 *
 * @param {object} [registry]
 * @returns {{ live: object|null, direct: object|null }}
 */
export default function discoverSources(registry) {
  return {
    live: registry?.flatrateMessagingLive || null,
    direct: registry?.flatrateMessagingDirect || null,
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
