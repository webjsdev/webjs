/**
 * The auto-linked icon and manifest lists are memoized per build epoch
 * (#1644): `autoMetadataRouteIcons` / `autoManifestUrl` read only the icon
 * routes and the base path, and both of their writers bump the epoch, so one
 * entry serves every render of a build instead of re-prefixing per request.
 */
import { test, after } from 'node:test';
import assert from 'node:assert/strict';

import { autoMetadataRouteIcons, autoManifestUrl, setMetadataIconRoutes } from '../../src/ssr/head.js';
import { setBasePath } from '../../src/importmap.js';

after(async () => {
  setMetadataIconRoutes(null);
  await setBasePath('');
});

test('autoMetadataRouteIcons: same object within a build, fresh after setMetadataIconRoutes', () => {
  setMetadataIconRoutes([
    { stem: 'icon', urlPath: '/icon', contentType: 'image/svg+xml' },
    { stem: 'manifest', urlPath: '/manifest', static: true },
  ]);
  const a = autoMetadataRouteIcons();
  assert.deepEqual(a, { icon: [{ url: '/icon', sizes: 'any' }] });
  assert.equal(autoMetadataRouteIcons(), a, 'memoized identity within a build');
  assert.equal(autoManifestUrl(), '/manifest');
  setMetadataIconRoutes([{ stem: 'apple-icon', urlPath: '/apple-icon', contentType: 'image/png' }]);
  const b = autoMetadataRouteIcons();
  assert.notEqual(b, a, 'a new icon set is a new build');
  assert.deepEqual(b, { apple: [{ url: '/apple-icon' }] });
  assert.equal(autoManifestUrl(), null);
});

test('autoMetadataRouteIcons: setBasePath invalidates and the urls carry the prefix', async () => {
  setMetadataIconRoutes([{ stem: 'icon', urlPath: '/icon', contentType: 'image/svg+xml' }, { stem: 'manifest', urlPath: '/manifest' }]);
  const a = autoMetadataRouteIcons();
  await setBasePath('/m');
  const b = autoMetadataRouteIcons();
  assert.notEqual(b, a);
  assert.deepEqual(b, { icon: [{ url: '/m/icon', sizes: 'any' }] });
  assert.equal(autoManifestUrl(), '/m/manifest');
  await setBasePath('');
  assert.deepEqual(autoMetadataRouteIcons(), { icon: [{ url: '/icon', sizes: 'any' }] });
});

test('autoMetadataRouteIcons: null when the app has no icon routes', () => {
  setMetadataIconRoutes(null);
  assert.equal(autoMetadataRouteIcons(), null);
  assert.equal(autoManifestUrl(), null);
});
