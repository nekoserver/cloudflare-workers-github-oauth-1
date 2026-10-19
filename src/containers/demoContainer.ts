import { Container } from '@cloudflare/containers';

/**
 * Cloudflare Container backing the demo developer environment image.
 *
 * The image exposes its small control server on port 8080. Internet access is
 * required by the bundled Codex, Claude, GitHub, Wrangler, and network tools.
 */
export class DemoContainer extends Container {
  defaultPort = 8080;
  sleepAfter = '30m';
  enableInternet = true;
}
