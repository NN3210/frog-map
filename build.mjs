// build.mjs — src -> dist (esbuild)
import * as esbuild from 'esbuild';
import { promises as fs } from 'node:fs';
import fssync from 'node:fs';
import path from 'node:path';
import zlib from 'node:zlib';
import { fileURLToPath } from 'node:url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const root = __dirname;
const distDir = path.join(root, 'dist');

const args = process.argv.slice(2);
const isDev = args.includes('--dev');
const sizeOnly = args.includes('--size');

const pkg = JSON.parse(fssync.readFileSync(path.join(root, 'package.json'), 'utf8'));
const APP_VERSION = pkg.version;

const SPECIES_IMAGE_EXT = ['jpg', 'jpeg', 'png', 'webp'];
const SPECIES_SOUND_EXT = ['mp3', 'm4a', 'ogg'];

function buildSpeciesAssetsManifest() {
  const speciesPath = path.join(root, 'config', 'species.json');
  const speciesList = JSON.parse(fssync.readFileSync(speciesPath, 'utf8'));
  const manifest = {};
  for (const sp of speciesList) {
    const code = sp.code;
    const entry = { image: null, sound: null };
    for (const ext of SPECIES_IMAGE_EXT) {
      const p = path.join(root, 'assets', 'species', `${code}.${ext}`);
      if (fssync.existsSync(p)) {
        entry.image = `${code}.${ext}`;
        break;
      }
    }
    for (const ext of SPECIES_SOUND_EXT) {
      const p = path.join(root, 'assets', 'sounds', `${code}.${ext}`);
      if (fssync.existsSync(p)) {
        entry.sound = `${code}.${ext}`;
        break;
      }
    }
    manifest[code] = entry;
  }
  return manifest;
}

async function copyAssets() {
  // Copy only real asset files (image/sound), never a placeholder.
  const manifest = buildSpeciesAssetsManifest();
  await fs.mkdir(path.join(distDir, 'assets', 'species'), { recursive: true });
  await fs.mkdir(path.join(distDir, 'assets', 'sounds'), { recursive: true });
  for (const code of Object.keys(manifest)) {
    const { image, sound } = manifest[code];
    if (image) {
      await fs.copyFile(
        path.join(root, 'assets', 'species', image),
        path.join(distDir, 'assets', 'species', image)
      );
    }
    if (sound) {
      await fs.copyFile(
        path.join(root, 'assets', 'sounds', sound),
        path.join(distDir, 'assets', 'sounds', sound)
      );
    }
  }
  return manifest;
}

async function copyIndexHtml() {
  const src = path.join(root, 'src', 'index.html');
  const dest = path.join(distDir, 'index.html');
  const html = await fs.readFile(src, 'utf8');
  await fs.writeFile(dest, html.replace('__APP_VERSION__', APP_VERSION), 'utf8');
}

async function writeNojekyll() {
  await fs.writeFile(path.join(distDir, '.nojekyll'), '', 'utf8');
}

function commonEsbuildOptions(assetsManifest) {
  return {
    entryPoints: [path.join(root, 'src', 'main.js')],
    bundle: true,
    outdir: distDir,
    entryNames: 'app',
    minify: !isDev,
    sourcemap: isDev ? 'inline' : 'external',
    target: ['es2019'],
    format: 'iife',
    logLevel: 'info',
    loader: {
      '.png': 'empty',
      '.json': 'json'
    },
    define: {
      __APP_VERSION__: JSON.stringify(APP_VERSION),
      __MOCK_API__: isDev ? 'true' : 'false',
      __SPECIES_ASSETS__: JSON.stringify(assetsManifest)
    }
  };
}

async function buildOnce() {
  await fs.rm(distDir, { recursive: true, force: true });
  await fs.mkdir(distDir, { recursive: true });
  const assetsManifest = await copyAssets();
  await copyIndexHtml();
  await writeNojekyll();
  await esbuild.build(commonEsbuildOptions(assetsManifest));
}

async function reportSize() {
  const jsPath = path.join(distDir, 'app.js');
  const cssPath = path.join(distDir, 'app.css');
  const jsBuf = fssync.existsSync(jsPath) ? fssync.readFileSync(jsPath) : Buffer.alloc(0);
  const cssBuf = fssync.existsSync(cssPath) ? fssync.readFileSync(cssPath) : Buffer.alloc(0);
  const totalRaw = jsBuf.length + cssBuf.length;
  const gz = (buf) => zlib.gzipSync(buf, { level: 9 }).length;
  const totalGzip = gz(jsBuf) + gz(cssBuf);

  const fmt = (n) => `${(n / 1024).toFixed(1)}KB`;
  console.log('--- dist size report ---');
  console.log(`app.js  : ${fmt(jsBuf.length)} (gzip ${fmt(gz(jsBuf))})`);
  console.log(`app.css : ${fmt(cssBuf.length)} (gzip ${fmt(gz(cssBuf))})`);
  console.log(`合計(raw)  : ${fmt(totalRaw)}`);
  console.log(`合計(gzip) : ${fmt(totalGzip)}`);

  const LIMIT = 300 * 1024;
  if (totalRaw > LIMIT) {
    console.error(`NG: JS+CSS 合計が 300KB を超えています (${fmt(totalRaw)})`);
    process.exitCode = 1;
  } else {
    console.log('OK: 300KB 以下です');
  }
}

async function runDevServer() {
  await fs.rm(distDir, { recursive: true, force: true });
  await fs.mkdir(distDir, { recursive: true });
  const assetsManifest = await copyAssets();
  await copyIndexHtml();
  await writeNojekyll();

  const ctx = await esbuild.context(commonEsbuildOptions(assetsManifest));
  await ctx.watch();
  const { host, port } = await ctx.serve({
    servedir: distDir,
    port: 8000
  });
  console.log(`dev server: http://${host === '0.0.0.0' ? 'localhost' : host}:${port}`);
}

if (sizeOnly) {
  await buildOnce();
  await reportSize();
} else if (isDev) {
  await runDevServer();
} else {
  await buildOnce();
  console.log('build complete: dist/');
}
