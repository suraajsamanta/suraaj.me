import { createHash } from 'node:crypto';
import { readFileSync } from 'node:fs';
import { createRequire } from 'node:module';
import assert from 'node:assert/strict';
import test, { after } from 'node:test';
import ts from 'typescript';

const require = createRequire(import.meta.url);
const previous = new Map();
for (const ext of ['.ts', '.tsx']) {
  previous.set(ext, require.extensions[ext]);
  require.extensions[ext] = (module, path) => module._compile(ts.transpileModule(readFileSync(path, 'utf8'), {
    compilerOptions: { module: ts.ModuleKind.CommonJS, jsx: ts.JsxEmit.ReactJSX },
  }).outputText, path);
}
const { SHARE_CARDS, SHARE_SIZE, madfunMetadata } = require('./share-metadata.ts');
const { GET, generateStaticParams } = require('../share/v1/[game]/route.ts');
after(() => {
  for (const [ext, loader] of previous) {
    if (loader) require.extensions[ext] = loader;
    else delete require.extensions[ext];
  }
});

test('all game previews, hub, and personal homepage resolve to their own 1200×630 PNG', async () => {
  const slugs = Object.keys(SHARE_CARDS);
  assert.equal(slugs.length, 11);
  assert.deepEqual(generateStaticParams().map(({ game }) => game), slugs);
  const images = new Set();
  for (const game of slugs) {
    const metadata = madfunMetadata(game);
    const url = new URL(metadata.openGraph.images[0].url);
    assert.equal(url.origin, 'https://suraaj.me');
    assert.equal(url.pathname, `/madfun/share/v1/${game}`);
    assert.equal(url.search, '');
    assert.equal(url.hash, '');
    assert.equal(metadata.openGraph.url, undefined);
    assert.equal(metadata.twitter.card, 'summary_large_image');
    assert.equal(metadata.twitter.images[0].url, url.href);
    assert.ok(metadata.description.length > 22);

    const result = await GET(new Request(url), { params: Promise.resolve({ game }) });
    assert.equal(result.status, 200);
    assert.equal(result.headers.get('content-type'), 'image/png');
    assert.match(result.headers.get('cache-control'), /public/);
    const bytes = Buffer.from(await result.arrayBuffer());
    assert.equal(bytes.subarray(1, 4).toString(), 'PNG');
    assert.equal(bytes.readUInt32BE(16), SHARE_SIZE.width);
    assert.equal(bytes.readUInt32BE(20), SHARE_SIZE.height);
    assert.ok(bytes.length <= 256_000);
    images.add(createHash('sha256').update(bytes).digest('hex'));
  }
  assert.equal(images.size, slugs.length);
});

test('invite data cannot select or create arbitrary artwork', async () => {
  const known = ['constructor', 'not-a-game', 'inside-ranks?room=ABC123', 'inside-ranks#private'];
  for (const game of known) {
    const response = await GET(new Request('https://suraaj.me/'), { params: Promise.resolve({ game }) });
    assert.equal(response.status, 404);
  }
});
