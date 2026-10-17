import { describe, it, expect } from 'vitest';
import { readFileSync } from 'node:fs';

describe('demoコンテナのDocker', () => {
  it('イメージにdocker.ioを入れ、起動時にdockerdを立ち上げる', () => {
    expect(readFileSync('containers/demo/Dockerfile', 'utf8')).toContain('docker.io');
    expect(readFileSync('containers/demo/entrypoint.sh', 'utf8')).toContain('dockerd >/tmp/dockerd.log 2>&1 &');
  });
  it('/healthにdockerを含め、ページに表示する', () => {
    const server = readFileSync('containers/demo/server.js', 'utf8');
    expect(server).toContain("runCmd('docker', ['info'");
    expect(server).toContain('docker: value(docker)');
    expect(server).toContain("'/tmp/dockerd.log'");
    const view = readFileSync('src/views/cfContainers.ts', 'utf8');
    expect(view).toContain('<th>Docker</th>');
    expect(view).toContain("getElementById('health-docker').innerHTML = badge(data.docker)");
  });
});
