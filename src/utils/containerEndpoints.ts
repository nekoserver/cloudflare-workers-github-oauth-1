/** Canonical origin for the active CFC container's Apache/API/stream services.
 * test.cfc is the management Worker; do not use it as a Tunnel origin.
 */
export const CFC_CONTAINER_ORIGIN = 'https://stream.test.cfc.nekomaneki.work';
export const CFC_CONTAINER_HOSTNAME = new URL(CFC_CONTAINER_ORIGIN).hostname;
export const CONTAINER_ENDPOINTS = {
  tunnels: new URL('/lib/api/tunnels', CFC_CONTAINER_ORIGIN).href,
  conversation: new URL('/lib/conversation-embed.html', CFC_CONTAINER_ORIGIN).href,
  docker: CFC_CONTAINER_ORIGIN,
} as const;
