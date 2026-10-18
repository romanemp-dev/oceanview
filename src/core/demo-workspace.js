// Demo workspace (dev aid): an in-memory workspace with realistic content so
// the app and the 3D scene can be viewed/inspected without picking a folder.
// Usage: open /?demo=1 (optionally &scene=oceanview).
import { memoryAdapter } from './memory-adapter.js';
import { serializeFrontMatter, todayIso } from './frontmatter.js';

function isoOffset(days) {
  const d = new Date();
  d.setDate(d.getDate() + days);
  const p = (n) => String(n).padStart(2, '0');
  return `${d.getFullYear()}-${p(d.getMonth() + 1)}-${p(d.getDate())}`;
}

export function createDemoAdapter() {
  const adapter = memoryAdapter();
  const today = todayIso();
  const yesterday = isoOffset(-1);
  const inThreeDays = isoOffset(3);

  const dirs = ['inbox', 'stacks', '.desk', '.desk/activity', '.desk/trash'];
  for (const d of dirs) adapter.ensureDir(d);

  // Mirror the user's real workspace: 10 stacks + inbox (stress test for the arc).
  // ?stacks=N limits the count (bisecting/debug).
  let stacks = [
    'Рабочие задачи',
    'Идеи для реализации',
    'Поездка в Китай',
    'Отложенные планы',
    'Личные заметки',
    'Семейное',
    'Рецепты',
    'Настройка OpenClaw',
    'Oceanview',
    'Дайджесты',
  ];
  const limit = Number(new URLSearchParams(window.location.search).get('stacks') ?? 0);
  if (limit > 0) stacks = stacks.slice(0, limit);
  for (const s of stacks) adapter.ensureDir(`stacks/${s}`);

  const item = (type, title, body, tags = []) =>
    serializeFrontMatter({ type, title, created: today, updated: today, tags }, `${body}\n`);

  adapter.writeFile(
    'stacks/Рабочие задачи/current-tasks.md',
    item(
      'checklist',
      'Текущие рабочие задачи',
      `- [ ] Сходить в офис @due(${today})\n- [ ] Разобрать входящие @due(${today})\n- [ ] Подготовить отчёт @due(${yesterday})\n- [ ] Созвон с командой`,
      ['work'],
    ),
  );
  adapter.writeFile(
    'stacks/Поездка в Китай/prep.md',
    item(
      'checklist',
      'Подготовка к поездке',
      `- [ ] Виза\n- [ ] Билеты @due(${inThreeDays})\n- [ ] VPN до поездки\n- [ ] Alipay / WeChat Pay`,
      ['travel', 'china'],
    ),
  );
  adapter.writeFile(
    'stacks/Идеи для реализации/start-here.md',
    item('note', 'Как устроен этот стек', 'Одна идея — один айтем: захват через N, сортировка подсказками.', ['ideas']),
  );
  adapter.writeFile(
    'stacks/Отложенные планы/backlog.md',
    item('checklist', 'Копилка отложенного', '- [ ] Сходить: выставка\n- [ ] Посмотреть: курс\n- [ ] Выбрать/купить: кресло', ['someday']),
  );
  adapter.writeFile(
    'stacks/Личные заметки/start-here.md',
    item('note', 'Личные заметки — старт', 'Идеи по психологии, самореализации, разбору проблем.', ['personal']),
  );
  adapter.writeFile(
    'stacks/Семейное/family-tasks.md',
    item('checklist', 'Семейные дела', '- [ ] Спланировать выходные', ['family']),
  );
  adapter.writeFile(
    'stacks/Настройка OpenClaw/setup-checklist.md',
    item('checklist', 'Чек-лист настройки OpenClaw', '- [ ] Каналы\n- [ ] Навыки\n- [ ] Память', ['openclaw']),
  );
  adapter.writeFile(
    'stacks/Oceanview/readme.md',
    item('note', 'Oceanview — обзор проекта', 'Локальный стол для заметок и задач.', ['oceanview']),
  );
  adapter.writeFile(
    'stacks/Дайджесты/2026-10-18.md',
    item('note', 'Сегодня — 2026-10-18', 'Утренний дайджест (демо).', ['digest']),
  );
  adapter.writeFile(
    'stacks/Рецепты/project-brief.md',
    item('note', 'Проект «Рецепты» — брифинг', 'Что это, для кого, MVP, критерии успеха.', ['project']),
  );

  adapter.writeFile(
    'inbox/capture-1.md',
    item('note', 'Купить билеты в Китай', 'Сравнить цены на рейсы, проверить даты.', ['travel']),
  );
  adapter.writeFile(
    'inbox/capture-2.md',
    item('note', 'Идея для Рецептов', 'Импорт рецептов из заметок в один клик.', ['ideas']),
  );

  adapter.writeFile(
    '.desk/config.json',
    JSON.stringify(
      {
        version: 1,
        theme: 'oceanview',
        stacks: {
          'Рабочие задачи': { agents: ['claw'] },
          Рецепты: { agents: ['claw'] },
        },
      },
      null,
      2,
    ) + '\n',
  );
  adapter.writeFile(
    '.desk/activity/2026-10-18.log',
    JSON.stringify({
      ts: '2026-10-18T09:12:00.000Z',
      agent: 'claw',
      stack: 'Рабочие задачи',
      action: 'edit',
      files: ['stacks/Рабочие задачи/current-tasks.md'],
      summary: 'Demo: разобрал входящие и добавил две задачи',
    }) + '\n',
  );

  return adapter;
}
