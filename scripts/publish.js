#!/usr/bin/env node
// Actual publisher: builds workspaces, compares versions, publishes changed packages to npm
const { execSync } = require('node:child_process');
const { readFileSync } = require('node:fs');
const { join } = require('node:path');

function sh(cmd, opts = {}) {
  return execSync(cmd, { stdio: 'pipe', encoding: 'utf8', ...opts });
}

function info(msg) { console.log(msg); }
function warn(msg) { console.warn(msg); }
function err(msg) { console.error(msg); }

const PACKAGES = [
  { name: '@qriptoagentiq/core-client', dir: 'packages/core-client' },
  { name: '@qriptoagentiq/kn0w1-client', dir: 'packages/kn0w1-client' },
  { name: '@qriptoagentiq/a2a-client', dir: 'packages/a2a-client' },
];

try {
  info('Building SDK workspaces...');
  sh('npm run build:sdk', { stdio: 'inherit' });

  const token = process.env.NPM_TOKEN || process.env.NODE_AUTH_TOKEN;
  if (!token) {
    warn('\nNo NPM_TOKEN/NODE_AUTH_TOKEN set. Running in dry-run mode (no publish).');
  }

  let published = 0;
  for (const pkg of PACKAGES) {
    const pkgJsonPath = join(process.cwd(), pkg.dir, 'package.json');
    const pkgJson = JSON.parse(readFileSync(pkgJsonPath, 'utf8'));
    const localVersion = pkgJson.version;
    let registryVersion = null;
    try {
      registryVersion = sh(`npm view ${pkg.name} version`, { stdio: 'pipe' }).trim();
    } catch (_) {
      // package may not exist yet
      registryVersion = null;
    }

    const needsPublish = !registryVersion || registryVersion !== localVersion;
    info(`\n${pkg.name}@${localVersion} -> registry: ${registryVersion || 'none'}`);

    if (!needsPublish) {
      info(' - up to date, skipping');
      continue;
    }

    if (!token) {
      info(' - would publish (dry-run)');
      continue;
    }

    // configure auth for publish
    try {
      // use env token via npm config for this process
      info(' - publishing to npm...');
      const publishCmd = `cd ${pkg.dir} && npm publish --access public`;
      sh(publishCmd, { stdio: 'inherit', env: { ...process.env, NODE_AUTH_TOKEN: token } });
      published++;
      info(' - published');
    } catch (e) {
      err(` - publish failed: ${e?.message || e}`);
      process.exitCode = 1;
    }
  }

  if (token) {
    info(`\nDone. Published ${published} package(s).`);
  } else {
    info('\nDry-run complete. No packages were published.');
  }
} catch (e) {
  err('publish:changed failed: ' + (e?.message || e));
  process.exit(1);
}
