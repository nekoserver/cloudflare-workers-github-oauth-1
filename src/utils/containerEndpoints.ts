/** The main (nekoroot) container retains its mygw endpoint.
 * CFC is a separate container with a separate connection token.
 */
export const CFC_CONTAINER_ORIGIN = 'https://stream.test.cfc.nekomaneki.work';
export const CFC_CONTAINER_HOSTNAME = new URL(CFC_CONTAINER_ORIGIN).hostname;
export const MAIN_CONTAINER_ORIGIN = 'https://mygw.nekomaneki.work';
export const MAIN_CONTAINER_HOSTNAME = new URL(MAIN_CONTAINER_ORIGIN).hostname;
export const CONTAINER_ENDPOINTS = {
  tunnels: new URL('/lib/api/tunnels', MAIN_CONTAINER_ORIGIN).href,
  conversation: new URL('/lib/conversation-embed.html', MAIN_CONTAINER_ORIGIN).href,
  docker: MAIN_CONTAINER_ORIGIN,
} as const;
