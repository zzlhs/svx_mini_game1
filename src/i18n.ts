export type Locale = 'zh-CN' | 'en-US';

const STORAGE_KEY = 'patch-grid-locale-v1';

const messages = {
  'zh-CN': {
    'locale.label': '语言',
    'locale.name.zh-CN': '中文',
    'locale.name.en-US': 'English',
    'app.eyebrow': '',
    'app.title': '填满格子',
    'app.heroCopy': '拖拽生成矩形，让每个矩形只包含一个数字，并且面积等于该数字。',
    'home.subtitle': '把棋盘完整填满，让每个数字恰好对应一个矩形。',
    'home.progress': '已完成 {completed} / {total} 关',
    'home.currentLevel': '当前进度：第 {level} 关',
    'home.continue': '继续挑战',
    'home.start': '从第一关开始',
    'home.resumeTip': '会恢复你上次的局面，并保留已通关记录。',
    'home.freshTip': '会从第 1 关重新开始当前进度，已通关记录会保留。',
    'landing.weeklyLeaderboard': '本周排行榜',
    'landing.localWeeklyNote': '当前展示的是本机本周通关总用时排行。',
    'landing.emptyLeaderboard': '本周还没有完整通关记录，先开始一局吧。',
    'landing.bestTime': '总用时 {duration}',
    'landing.completedAt': '完成于 {completedAt}',
    'landing.close': '点击空白处返回',
    'landing.helpTitle': '玩法说明',
    'landing.goalTitle': '通关目标',
    'landing.ruleSection': '基本规则',
    'landing.goalSection': '目标说明',
    'landing.toolSection': '辅助功能',
    'landing.helpRule1': '在棋盘上拖拽生成一个矩形区域。',
    'landing.helpRule2': '每个矩形必须恰好包含一个数字提示。',
    'landing.helpRule3': '矩形面积必须等于它所包含数字的值。',
    'landing.helpRule4': '所有格子都要被完整覆盖，不能重叠，也不能遗漏。',
    'landing.goalRule1': '每一关都要用合法矩形完整填满棋盘才算通关。',
    'landing.goalRule2': '从第 1 关开始连续完成全部关卡后，才会记录本次总用时。',
    'landing.goalRule3': '本周排行榜按完整通关总用时排序，用时越短排名越靠前。',
    'landing.toolHint': '提示：推荐当前局面中的一个可放置合法矩形。',
    'landing.toolUndo': '撤销：回退上一步操作，方便重新推理。',
    'landing.toolRestart': '重开：清空当前关卡并重新开始挑战。',
    'landing.gotIt': '我知道了',
    'settings.title': '设置',
    'settings.sound': '声音',
    'settings.vibration': '震动',
    'settings.backHome': '回到主页',
    'settings.continue': '继续游戏',
    'section.levels': '关卡',
    'section.hints': '提示',
    'section.record': '本关记录',
    'section.progress': '当前进度',
    'section.actions': '操作',
    'section.rules': '规则',
    'button.undo': '撤销',
    'button.restart': '重开',
    'button.retry': '重新挑战',
    'button.hint': '提示',
    'button.next': '下一关',
    'rule.area': '矩形面积必须等于其包含数字的值',
    'rule.singleClue': '每个矩形只能包含一个数字',
    'rule.cover': '所有格子必须被完整覆盖，不能重叠',
    'rule.input': '桌面可鼠标拖拽，移动端可触摸拖拽',
    'fallback.unknownTime': '时间未知',
    'record.noneSummary': '尚未完成这一关。',
    'record.noneDetail': '完成后会记录通关用时和当时的解法。',
    'record.summary': '最近通关用时：{duration}',
    'record.detailViewing': '正在查看已保存解法，共 {count} 个矩形，完成于 {completedAt}。',
    'record.detailSaved': '已记录 {count} 个矩形的解法，完成于 {completedAt}。点击关卡格子可直接查看。',
    'level.progress': '第 {current} / {total} 关',
    'level.name': '第 {number} 关 · {title}',
    'level.collectionMeta': '已完成 {completed} / {total} 关。点击已完成关卡可直接查看记录。',
    'board.meta': '{width} × {height} · {clues} 个数字',
    'hint.placeholder': '点击“提示”后，这里会显示当前局面的一步建议。',
    'coverage.play': '已覆盖 {covered} / {total} 格',
    'coverage.record': '记录解法覆盖 {covered} / {total} 格',
    'chip.record': '查看记录',
    'chip.solved': '通关',
    'chip.ready': '可放置',
    'chip.active': '进行中',
    'tile.completed': '{levelName}，已完成，用时 {duration}',
    'tile.incomplete': '{levelName}，未完成',
    'renderer.badgeSolved': '通关',
    'renderer.badgeRecord': '记录',
    'banner.nextLevel': '即将进入下一关',
    'banner.allCleared': '全部关卡完成',
    'status.baseInstruction': '拖拽创建矩形，让每块面积等于其数字。',
    'status.previewValid': '可放置：面积 {area}',
    'status.invalidGeneric': '当前矩形不合法',
    'status.selectedPlacement': '已选中一个矩形，点击红叉可删除。',
    'status.removedPlacement': '已移除这个矩形',
    'status.solvedWithDuration': '通关成功，用时 {duration}。',
    'status.coveredProgress': '已覆盖 {covered} / {total} 格',
    'status.solvedBoardCovered': '通关成功，棋盘已完整覆盖。',
    'status.undo': '已撤销上一步',
    'status.reset': '已重开当前关卡',
    'status.hintSolved': '当前关卡已经通关，无需提示。',
    'status.noHint': '当前局面没有可推荐的合法矩形，可以尝试撤销或重开。',
    'status.hintSingle': '提示：数字 {value} 目前只剩 1 种合法矩形。',
    'status.hintTryRect': '提示：试试围绕数字 {value} 放置一个 {width}×{height} 的矩形。',
    'status.lastLevel': '已经是最后一关',
    'status.enteredLevel': '已进入第 {levelNumber} 关',
    'status.viewingRecord': '正在查看通关记录，用时 {duration}。',
    'hint.solved': '当前关卡已经通关，不需要额外提示。',
    'hint.noHint': '当前局面没有可推荐的合法矩形，可以尝试撤销上一步或直接重开本关。',
    'hint.single': '推荐先看数字 {value}。它在当前局面只剩 1 个合法矩形，位置覆盖第 {rowStart} 行到第 {rowEnd} 行、第 {colStart} 列到第 {colEnd} 列。',
    'hint.tryRect': '推荐围绕数字 {value} 放置一个 {width}×{height} 的合法矩形。它覆盖第 {rowStart} 行到第 {rowEnd} 行、第 {colStart} 列到第 {colEnd} 列。',
    'logic.validationOutOfBounds': '矩形必须完整落在棋盘内',
    'logic.validationOverlap': '矩形不能与已放置区域重叠',
    'logic.validationSingleClue': '每个矩形必须恰好包含一个数字',
    'logic.validationArea': '矩形面积需要等于数字 {value}',
    'level.title.warmup': '热身',
    'level.title.cross': '十字',
    'level.title.stairs': '阶梯',
    'level.title.switchback': '折返',
    'level.title.corridor': '回廊',
    'level.title.courtyard': '中庭',
    'level.title.bridge': '长桥',
    'level.title.offset': '错层',
    'level.title.ring': '环带',
    'level.title.endgame': '终局',
    'level.hint.warmup': '先找面积为 6 的大块，再看剩余的小矩形。',
    'level.hint.cross': '注意中间的小数字，它通常能快速收窄候选矩形。',
    'level.hint.stairs': '把边缘的长条先定下来，会更容易看清中间结构。',
    'level.hint.switchback': '6、8 这类大数字很适合先观察可以延伸到哪些边界。',
    'level.hint.corridor': '试着先定位那些只能贴着边界摆放的大矩形。',
    'level.hint.courtyard': '中部的大矩形会强烈约束四角区域，别只盯着单个数字。',
    'level.hint.bridge': '横向和纵向的长条会互相卡位，观察它们的交界最有效。',
    'level.hint.offset': '这一组里 8、9 这样的数字可能是整片结构的主心骨。',
    'level.hint.ring': '大面积矩形和边角小块会互相限制，优先找“只能这样放”的一块。',
    'level.hint.endgame': '先定位最受边界约束的大块，再利用剩余空间反推其他矩形。',
  },
  'en-US': {
    'locale.label': 'Language',
    'locale.name.zh-CN': '中文',
    'locale.name.en-US': 'English',
    'app.eyebrow': '',
    'app.title': 'Fill Grid',
    'app.heroCopy': 'Drag to create rectangles. Each rectangle must contain exactly one number and match its area.',
    'home.subtitle': 'Cover the whole board so each clue belongs to exactly one matching rectangle.',
    'home.progress': '{completed} / {total} levels cleared',
    'home.currentLevel': 'Current progress: Level {level}',
    'home.continue': 'Continue',
    'home.start': 'Start From 1',
    'home.resumeTip': 'Resume your previous board and keep all cleared records.',
    'home.freshTip': 'Restart the current run from level 1 while keeping cleared records.',
    'landing.weeklyLeaderboard': 'Weekly Leaderboard',
    'landing.localWeeklyNote': 'This leaderboard currently shows this device\'s weekly total clear times.',
    'landing.emptyLeaderboard': 'No full clear has been recorded this week yet. Start a new run first.',
    'landing.bestTime': 'Total time {duration}',
    'landing.completedAt': 'Completed at {completedAt}',
    'landing.close': 'Tap outside to return',
    'landing.helpTitle': 'How To Play',
    'landing.goalTitle': 'Goals',
    'landing.ruleSection': 'Basic Rules',
    'landing.goalSection': 'Clear Goals',
    'landing.toolSection': 'Support Tools',
    'landing.helpRule1': 'Drag on the board to create a rectangle.',
    'landing.helpRule2': 'Each rectangle must contain exactly one clue number.',
    'landing.helpRule3': 'The rectangle area must equal the value of that clue.',
    'landing.helpRule4': 'Cover the whole board with no overlap and no empty cells.',
    'landing.goalRule1': 'You clear a level only after the whole board is covered legally.',
    'landing.goalRule2': 'A full run is recorded only after you finish every level from level 1 onward.',
    'landing.goalRule3': 'The weekly leaderboard ranks full-run total times. Shorter time ranks higher.',
    'landing.toolHint': 'Hint: suggests one legal rectangle for the current position.',
    'landing.toolUndo': 'Undo: step back one move and rethink the board.',
    'landing.toolRestart': 'Restart: clear the current level and begin it again.',
    'landing.gotIt': 'Got it',
    'settings.title': 'Settings',
    'settings.sound': 'Sound',
    'settings.vibration': 'Vibration',
    'settings.backHome': 'Back Home',
    'settings.continue': 'Continue',
    'section.levels': 'Levels',
    'section.hints': 'Hint',
    'section.record': 'Level Record',
    'section.progress': 'Progress',
    'section.actions': 'Actions',
    'section.rules': 'Rules',
    'button.undo': 'Undo',
    'button.restart': 'Restart',
    'button.retry': 'Retry',
    'button.hint': 'Hint',
    'button.next': 'Next',
    'rule.area': 'A rectangle area must equal the number it contains',
    'rule.singleClue': 'Each rectangle may contain exactly one number',
    'rule.cover': 'The whole board must be covered with no overlap',
    'rule.input': 'Mouse drag on desktop, touch drag on mobile',
    'fallback.unknownTime': 'Unknown time',
    'record.noneSummary': 'This level is not completed yet.',
    'record.noneDetail': 'Completion time and the solved layout will be saved after you clear it.',
    'record.summary': 'Best clear shown here: {duration}',
    'record.detailViewing': 'Viewing the saved solution with {count} rectangles, completed at {completedAt}.',
    'record.detailSaved': 'Saved solution with {count} rectangles, completed at {completedAt}. Click the level tile to review it.',
    'level.progress': 'Level {current} / {total}',
    'level.name': 'Level {number} · {title}',
    'level.collectionMeta': '{completed} / {total} levels completed. Click a cleared tile to review its record.',
    'board.meta': '{width} × {height} · {clues} clues',
    'hint.placeholder': 'Click "Hint" to reveal one suggested move for the current board state.',
    'coverage.play': '{covered} / {total} cells covered',
    'coverage.record': 'Saved solution covers {covered} / {total} cells',
    'chip.record': 'Record',
    'chip.solved': 'Solved',
    'chip.ready': 'Ready',
    'chip.active': 'Active',
    'tile.completed': '{levelName}, solved in {duration}',
    'tile.incomplete': '{levelName}, not solved yet',
    'renderer.badgeSolved': 'Solved',
    'renderer.badgeRecord': 'Record',
    'banner.nextLevel': 'Next level incoming',
    'banner.allCleared': 'All levels cleared',
    'status.baseInstruction': 'Drag to create rectangles whose areas match their numbers.',
    'status.previewValid': 'Valid placement: area {area}',
    'status.invalidGeneric': 'This rectangle is not valid',
    'status.selectedPlacement': 'Rectangle selected. Tap the red X to remove it.',
    'status.removedPlacement': 'Removed the selected rectangle',
    'status.solvedWithDuration': 'Solved in {duration}.',
    'status.coveredProgress': '{covered} / {total} cells covered',
    'status.solvedBoardCovered': 'Solved. The whole board is covered.',
    'status.undo': 'Undid the last move',
    'status.reset': 'Restarted the current level',
    'status.hintSolved': 'This level is already solved, so no hint is needed.',
    'status.noHint': 'No recommended legal rectangle is available right now. Try undo or restart.',
    'status.hintSingle': 'Hint: clue {value} has only one legal rectangle left.',
    'status.hintTryRect': 'Hint: try a {width}×{height} rectangle around clue {value}.',
    'status.lastLevel': 'This is already the final level',
    'status.enteredLevel': 'Entered level {levelNumber}',
    'status.viewingRecord': 'Viewing the saved record, clear time {duration}.',
    'hint.solved': 'This level is already solved, so no extra hint is needed.',
    'hint.noHint': 'There is no recommended legal rectangle for this position. Try undoing or restarting the level.',
    'hint.single': 'Start with clue {value}. It has only one legal rectangle left: rows {rowStart}-{rowEnd}, columns {colStart}-{colEnd}.',
    'hint.tryRect': 'Try a legal {width}×{height} rectangle around clue {value}. It covers rows {rowStart}-{rowEnd}, columns {colStart}-{colEnd}.',
    'logic.validationOutOfBounds': 'The rectangle must stay entirely inside the board',
    'logic.validationOverlap': 'The rectangle cannot overlap an existing placement',
    'logic.validationSingleClue': 'Each rectangle must contain exactly one clue',
    'logic.validationArea': 'The rectangle area must equal clue {value}',
    'level.title.warmup': 'Warmup',
    'level.title.cross': 'Crossroads',
    'level.title.stairs': 'Stairs',
    'level.title.switchback': 'Switchback',
    'level.title.corridor': 'Corridor',
    'level.title.courtyard': 'Courtyard',
    'level.title.bridge': 'Bridge',
    'level.title.offset': 'Offset',
    'level.title.ring': 'Ring',
    'level.title.endgame': 'Endgame',
    'level.hint.warmup': 'Find the large area-6 block first, then clean up the remaining small rectangles.',
    'level.hint.cross': 'The small center clue is a strong anchor and quickly narrows the options.',
    'level.hint.stairs': 'Lock in the long edge strips first and the middle shape becomes easier to read.',
    'level.hint.switchback': 'Large values like 6 and 8 are easiest when you check how far they can extend to the borders.',
    'level.hint.corridor': 'Start with the large rectangles that can only fit against the outer boundary.',
    'level.hint.courtyard': 'The central large rectangle strongly constrains the corners, so look at the whole shape.',
    'level.hint.bridge': 'Long horizontal and vertical strips block each other, so inspect their intersections.',
    'level.hint.offset': 'Large values like 8 and 9 often act as the structural anchors of the whole board.',
    'level.hint.ring': 'Large blocks and corner pieces constrain each other. Find the one that can only fit one way.',
    'level.hint.endgame': 'Fix the large edge-constrained blocks first, then use the remaining space to infer the rest.',
  },
} as const;

export type MessageKey = keyof typeof messages['zh-CN'];

export interface MessageDescriptor {
  key: MessageKey;
  values?: Record<string, number | string>;
}

export function getSupportedLocales(): Locale[] {
  return ['zh-CN', 'en-US'];
}

export function isSupportedLocale(value: string): value is Locale {
  return value === 'zh-CN' || value === 'en-US';
}

export function detectLocale(): Locale {
  if (typeof navigator === 'undefined') {
    return 'zh-CN';
  }

  const preferred = navigator.language;
  if (preferred.startsWith('zh')) {
    return 'zh-CN';
  }

  return 'en-US';
}

export function loadLocale(): Locale | null {
  if (typeof window === 'undefined') {
    return null;
  }

  const saved = window.localStorage.getItem(STORAGE_KEY);
  return saved && isSupportedLocale(saved) ? saved : null;
}

export function saveLocale(locale: Locale): void {
  if (typeof window === 'undefined') {
    return;
  }

  window.localStorage.setItem(STORAGE_KEY, locale);
}

export function t(locale: Locale, key: MessageKey, values: Record<string, number | string> = {}): string {
  const template = messages[locale][key] ?? messages['zh-CN'][key];

  return template.replace(/\{(\w+)\}/g, (_, token: string) => {
    const value = values[token];
    return value === undefined ? `{${token}}` : String(value);
  });
}

export function tm(locale: Locale, message: MessageDescriptor): string {
  return t(locale, message.key, message.values);
}

export function formatLevelName(locale: Locale, levelNumber: number, titleKey: MessageKey): string {
  return t(locale, 'level.name', {
    number: levelNumber,
    title: t(locale, titleKey),
  });
}

export function formatLocaleDate(locale: Locale, isoString: string): string | null {
  const date = new Date(isoString);
  if (Number.isNaN(date.getTime())) {
    return null;
  }

  return new Intl.DateTimeFormat(locale, {
    month: 'numeric',
    day: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
  }).format(date);
}
