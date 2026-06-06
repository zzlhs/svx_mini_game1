import { execFileSync } from 'node:child_process';
import { copyFile, mkdir, readFile, rm, writeFile } from 'node:fs/promises';
import { dirname } from 'node:path';
import { build } from 'esbuild';

const outdir = 'dist-wechat';
const gameConfig = {
  deviceOrientation: 'portrait',
  showStatusBar: false,
};

async function copyWechatImage(source, target, maxSize = null) {
  await mkdir(dirname(target), { recursive: true });
  await copyFile(source, target);
  if (maxSize) {
    execFileSync('sips', ['-Z', String(maxSize), target], { stdio: 'ignore' });
  }
}

async function copyWechatEmbeddedPngSvg(source, target, maxSize = null) {
  await mkdir(dirname(target), { recursive: true });
  const svg = await readFile(source, 'utf8');
  const match = svg.match(/data:image\/png;base64,([^"']+)/s);
  if (!match) {
    throw new Error(`Unable to extract embedded PNG from ${source}`);
  }
  await writeFile(target, Buffer.from(match[1], 'base64'));
  if (maxSize) {
    execFileSync('sips', ['-Z', String(maxSize), target], { stdio: 'ignore' });
  }
}

await rm(outdir, { recursive: true, force: true });
await mkdir(outdir, { recursive: true });

await build({
  entryPoints: ['src/wechat/main.ts'],
  bundle: true,
  outfile: `${outdir}/game.js`,
  format: 'cjs',
  platform: 'browser',
  target: ['es2018'],
  charset: 'utf8',
  sourcemap: false,
  legalComments: 'none',
});

await writeFile('game.js', "require('./dist-wechat/game.js');\n", 'utf8');
await writeFile('game.json', `${JSON.stringify(gameConfig, null, 2)}\n`, 'utf8');
await writeFile(`${outdir}/game.json`, `${JSON.stringify(gameConfig, null, 2)}\n`, 'utf8');
await mkdir(`${outdir}/assets/wechat`, { recursive: true });
await copyFile('assets/wechat/bg.jpg', `${outdir}/assets/wechat/bg.jpg`);
await copyFile('assets/wechat/bg_kawaii.png', `${outdir}/assets/wechat/bg_kawaii.png`);
await copyFile('assets/wechat/check_icon.png', `${outdir}/assets/wechat/check_icon.png`);
await copyFile('assets/wechat/help_icon.png', `${outdir}/assets/wechat/help_icon.png`);
await copyFile('assets/wechat/new_game2.png', `${outdir}/assets/wechat/new_game2.png`);
await copyFile('assets/wechat/rank_cutout.png', `${outdir}/assets/wechat/rank_cutout.png`);
await mkdir(`${outdir}/assets/wechat/kawaii`, { recursive: true });
await copyFile('assets/wechat/kawaii/icon-sun.png', `${outdir}/assets/wechat/kawaii/icon-sun.png`);
await copyFile('assets/wechat/kawaii/icon-trophy.png', `${outdir}/assets/wechat/kawaii/icon-trophy.png`);
await copyFile('assets/wechat/kawaii/icon-lightbulb.png', `${outdir}/assets/wechat/kawaii/icon-lightbulb.png`);
await copyFile('assets/wechat/kawaii/icon-note.png', `${outdir}/assets/wechat/kawaii/icon-note.png`);
await copyFile('assets/wechat/kawaii/icon-flag.png', `${outdir}/assets/wechat/kawaii/icon-flag.png`);
await copyFile('assets/wechat/kawaii/icon-checklist.png', `${outdir}/assets/wechat/kawaii/icon-checklist.png`);
await copyFile('assets/wechat/kawaii/icon-cloud-face.png', `${outdir}/assets/wechat/kawaii/icon-cloud-face.png`);
await copyFile('assets/wechat/kawaii/mascot-cat-cloud.png', `${outdir}/assets/wechat/kawaii/mascot-cat-cloud.png`);
await copyFile('assets/wechat/kawaii/bottom-btn.png', `${outdir}/assets/wechat/kawaii/bottom-btn.png`);
await copyFile('assets/wechat/kawaii/icon-star-heart-cloud.png', `${outdir}/assets/wechat/kawaii/icon-star-heart-cloud.png`);
await mkdir(`${outdir}/assets/wechat/leaderboard`, { recursive: true });
await copyWechatEmbeddedPngSvg(
  'assets/wechat/leaderboard/decor_ribbon_leaderboard_purple.svg',
  `${outdir}/assets/wechat/leaderboard/decor_ribbon_leaderboard_purple.png`,
  720,
);
await copyWechatEmbeddedPngSvg(
  'assets/wechat/leaderboard/decor_bunny_peek_left.svg',
  `${outdir}/assets/wechat/leaderboard/decor_bunny_peek_left.png`,
  220,
);
await copyWechatEmbeddedPngSvg(
  'assets/wechat/leaderboard/decor_rainbow_cloud.svg',
  `${outdir}/assets/wechat/leaderboard/decor_rainbow_cloud.png`,
  220,
);
await copyWechatEmbeddedPngSvg(
  'assets/wechat/leaderboard/empty_trophy_bunny.svg',
  `${outdir}/assets/wechat/leaderboard/empty_trophy_bunny.png`,
  480,
);
await mkdir(`${outdir}/assets/wechat/selection`, { recursive: true });
await copyWechatImage(
  'assets/wechat/selection/selection_decor_strawberry.png',
  `${outdir}/assets/wechat/selection/selection_decor_strawberry.png`,
  120,
);
await copyWechatImage(
  'assets/wechat/selection/selection_decor_heart_pink.png',
  `${outdir}/assets/wechat/selection/selection_decor_heart_pink.png`,
  120,
);
await copyWechatImage(
  'assets/wechat/selection/selection_decor_star_yellow.png',
  `${outdir}/assets/wechat/selection/selection_decor_star_yellow.png`,
  120,
);
await copyWechatImage(
  'assets/wechat/selection/selection_decor_sparkle_white.png',
  `${outdir}/assets/wechat/selection/selection_decor_sparkle_white.png`,
  112,
);
await copyWechatImage(
  'assets/wechat/selection/selection_decor_bubble_pink.png',
  `${outdir}/assets/wechat/selection/selection_decor_bubble_pink.png`,
  120,
);
await copyWechatImage(
  'assets/wechat/selection/selection_decor_bubble_yellow.png',
  `${outdir}/assets/wechat/selection/selection_decor_bubble_yellow.png`,
  120,
);
await copyWechatImage(
  'assets/wechat/selection/selection_top_drip_yellow.png',
  `${outdir}/assets/wechat/selection/selection_top_drip_yellow.png`,
  640,
);
await mkdir(`${outdir}/assets/wechat/settings`, { recursive: true });
await copyWechatImage(
  'assets/wechat/settings/decor_cloud_cluster_left.png',
  `${outdir}/assets/wechat/settings/decor_cloud_cluster_left.png`,
  180,
);
await copyWechatImage(
  'assets/wechat/settings/decor_cloud_smile_heart.png',
  `${outdir}/assets/wechat/settings/decor_cloud_smile_heart.png`,
  180,
);
await copyWechatImage(
  'assets/wechat/settings/decor_heart_corner.png',
  `${outdir}/assets/wechat/settings/decor_heart_corner.png`,
  120,
);
await copyWechatImage(
  'assets/wechat/settings/decor_heart_small.png',
  `${outdir}/assets/wechat/settings/decor_heart_small.png`,
  92,
);
await copyWechatImage(
  'assets/wechat/settings/decor_sparkle_white.png',
  `${outdir}/assets/wechat/settings/decor_sparkle_white.png`,
  96,
);
await copyWechatImage(
  'assets/wechat/settings/decor_star_pink_big.png',
  `${outdir}/assets/wechat/settings/decor_star_pink_big.png`,
  150,
);
await copyWechatImage(
  'assets/wechat/settings/decor_star_yellow_small_transparent.png',
  `${outdir}/assets/wechat/settings/decor_star_yellow_small_transparent.png`,
  96,
);
await copyWechatImage(
  'assets/wechat/settings/icon_music_badge.png',
  `${outdir}/assets/wechat/settings/icon_music_badge.png`,
  120,
);
await copyWechatImage(
  'assets/wechat/settings/icon_vibration_badge.png',
  `${outdir}/assets/wechat/settings/icon_vibration_badge.png`,
  120,
);
await mkdir(`${outdir}/assets/wechat/level-panel`, { recursive: true });
await copyWechatImage(
  'assets/wechat/level-panel/decor_cloud_cluster_left.png',
  `${outdir}/assets/wechat/level-panel/decor_cloud_cluster_left.png`,
  180,
);
await copyWechatImage(
  'assets/wechat/level-panel/decor_cloud_cluster_right.png',
  `${outdir}/assets/wechat/level-panel/decor_cloud_cluster_right.png`,
  180,
);
await copyWechatImage(
  'assets/wechat/level-panel/decor_cloud_smile_heart.png',
  `${outdir}/assets/wechat/level-panel/decor_cloud_smile_heart.png`,
  160,
);
await copyWechatImage(
  'assets/wechat/level-panel/decor_heart_pink.png',
  `${outdir}/assets/wechat/level-panel/decor_heart_pink.png`,
  140,
);
await copyWechatImage(
  'assets/wechat/level-panel/decor_ribbon_pink.png',
  `${outdir}/assets/wechat/level-panel/decor_ribbon_pink.png`,
  140,
);
await copyWechatImage(
  'assets/wechat/level-panel/decor_sparkle_white.png',
  `${outdir}/assets/wechat/level-panel/decor_sparkle_white.png`,
  96,
);
await copyWechatImage(
  'assets/wechat/level-panel/decor_star_big_yellow.png',
  `${outdir}/assets/wechat/level-panel/decor_star_big_yellow.png`,
  140,
);
await copyWechatImage(
  'assets/wechat/level-panel/decor_star_blue.png',
  `${outdir}/assets/wechat/level-panel/decor_star_blue.png`,
  120,
);
await copyWechatImage(
  'assets/wechat/level-panel/decor_star_face_yellow.png',
  `${outdir}/assets/wechat/level-panel/decor_star_face_yellow.png`,
  140,
);
await copyWechatImage(
  'assets/wechat/level-panel/decor_star_pink.png',
  `${outdir}/assets/wechat/level-panel/decor_star_pink.png`,
  140,
);
