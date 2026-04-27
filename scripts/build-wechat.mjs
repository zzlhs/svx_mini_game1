import { copyFile, mkdir, writeFile } from 'node:fs/promises';
import { build } from 'esbuild';

const outdir = 'dist-wechat';
const gameConfig = {
  deviceOrientation: 'portrait',
  showStatusBar: false,
};

await mkdir(outdir, { recursive: true });

await build({
  entryPoints: ['src/wechat/main.ts'],
  bundle: true,
  outfile: 'game.js',
  format: 'iife',
  platform: 'browser',
  target: ['es2018'],
  charset: 'utf8',
  sourcemap: false,
  legalComments: 'none',
});

await writeFile('game.json', `${JSON.stringify(gameConfig, null, 2)}\n`, 'utf8');
await copyFile('game.js', `${outdir}/game.js`);
await writeFile(`${outdir}/game.json`, `${JSON.stringify(gameConfig, null, 2)}\n`, 'utf8');
