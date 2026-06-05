import { copyFile, mkdir, rm, writeFile } from 'node:fs/promises';
import { build } from 'esbuild';

const outdir = 'dist-wechat';
const gameConfig = {
  deviceOrientation: 'portrait',
  showStatusBar: false,
};

await rm(outdir, { recursive: true, force: true });
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
await mkdir(`${outdir}/assets/wechat`, { recursive: true });
await copyFile('assets/wechat/bg.jpg', `${outdir}/assets/wechat/bg.jpg`);
await copyFile('assets/wechat/check_icon.png', `${outdir}/assets/wechat/check_icon.png`);
await copyFile('assets/wechat/help_icon.png', `${outdir}/assets/wechat/help_icon.png`);
await copyFile('assets/wechat/new_game2.png', `${outdir}/assets/wechat/new_game2.png`);
await copyFile('assets/wechat/rank_cutout.png', `${outdir}/assets/wechat/rank_cutout.png`);
