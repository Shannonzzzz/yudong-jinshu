(function (root, factory) {
  const api = factory();
  if (typeof module === 'object' && module.exports) module.exports = api;
  else root.Yudong = api;
})(typeof globalThis !== 'undefined' ? globalThis : this, function () {
  'use strict';
  const branches = Object.freeze(Array.from('子丑寅卯辰巳午未申酉戌亥'));
  const stems = Object.freeze(Array.from('甲乙丙丁戊己庚辛壬癸'));
  const topics = Object.freeze([
    ['求财', '财利、求财'], ['音信', '消息、书信'], ['婚姻', '婚配、姻缘'],
    ['行人', '出行、在外行人'], ['见贵', '求见、提携'], ['失物', '遗失的财物'],
    ['走失', '走失、逃走的人'], ['求谋', '谋事、求望'], ['官讼', '官司、争讼'],
    ['病灾', '疾病、灾患'], ['交易', '买卖、交易'], ['孕产', '怀孕、生产']
  ].map((row, index) => Object.freeze({ branch: branches[index], name: row[0], description: row[1] })));
  const timeRanges = Object.freeze(['23:00–01:00', '01:00–03:00', '03:00–05:00', '05:00–07:00',
    '07:00–09:00', '09:00–11:00', '11:00–13:00', '13:00–15:00', '15:00–17:00',
    '17:00–19:00', '19:00–21:00', '21:00–23:00']);

  function cast(hour, topic) {
    const start = branches.indexOf(hour);
    const end = branches.indexOf(topic);
    if (start < 0 || end < 0) throw new Error('请选择有效的时辰与事项。');
    const distance = (end - start + 12) % 12;
    const steps = Array.from({ length: distance + 1 }, (_, i) => Object.freeze({
      branch: branches[(start + i) % 12], stem: stems[i % 10], position: i + 1
    }));
    return Object.freeze({ key: stems[distance % 10] + topic + hour, hour, topic,
      steps: Object.freeze(steps) });
  }

  function branchFromTime(clock) {
    if (typeof clock !== 'string' || !/^([01]\d|2[0-3]):[0-5]\d$/.test(clock)) {
      throw new Error('请输入完整的有效钟点，例如 09:30。');
    }
    const [hour, minute] = clock.split(':').map(Number);
    return branches[Math.floor(((hour * 60 + minute + 60) % 1440) / 120)];
  }

  function validDate(value) {
    if (typeof value !== 'string' || !/^\d{4}-\d{2}-\d{2}$/.test(value)) return false;
    const [year, month, day] = value.split('-').map(Number);
    if (year < 1 || year > 9999 || month < 1 || month > 12 || day < 1) return false;
    const leap = year % 400 === 0 || (year % 4 === 0 && year % 100 !== 0);
    return day <= [31, leap ? 29 : 28, 31, 30, 31, 30, 31, 31, 30, 31, 30, 31][month - 1];
  }

  function notesFor(key) {
    return key === '乙午未' ? ['本条词句提及“遇巳逢寅”，简断提及“庚申日”，两处表述不同，均按校对稿保留。'] : [];
  }

  function markdown(snapshot, entry) {
    if (!snapshot || !entry || snapshot.result.key !== entry.key) throw new Error('记录与原文不对应。');
    const result = snapshot.result;
    const topic = topics.find(item => item.branch === result.topic);
    const question = String(snapshot.question || '未填写').replace(/\r\n?/g, '\n');
    // 使用足够长的围栏，将问事文字作为纯文本导出，避免被 Markdown 当作 HTML 或链接。
    const longestFence = Math.max(0, ...(question.match(/`+/g) || []).map(run => run.length));
    const fence = '`'.repeat(Math.max(3, longestFence + 1));
    const questionBlock = `${fence}text\n${question}\n${fence}`;
    const basis = snapshot.mode === 'clock'
      ? `${snapshot.clock}（北京时间 UTC+08:00；按常见双小时制换算）`
      : `${result.hour}时（手动指定；不作钟点换算）`;
    const notes = notesFor(entry.key);
    return `# 玉洞金书排盘记录\n\n记录日期：${snapshot.date}\n\n所问事项：${topic.name}（${result.topic}）\n\n取时依据：${basis}\n\n所报时辰：${result.hour}时\n\n## 所问之事\n\n${questionBlock}\n\n## 排盘结果\n\n三字卦名：${entry.key}\n\n原文标示：${entry.grade} · ${entry.tune}\n\n顺数过程：${result.steps.map(step => step.branch + step.stem).join(' → ')}\n\n组成方式：${entry.key[0]}（数得天干）＋${result.topic}（事项）＋${result.hour}（时辰）\n\n## 原文词句\n\n${entry.poem}\n\n## 原文简断\n\n${entry.judgment}\n\n${notes.length ? '原文提示：' + notes.join('\n') + '\n\n' : ''}来源：《玉洞金书 校对.docx》。原文词句与简断按校对稿保留。日期仅作记录；原稿未细说取时规则，本程序采用的钟点换算不含真太阳时校正。\n\n传统文本供研读参考。\n`;
  }

  return Object.freeze({ branches, stems, topics, timeRanges, cast, branchFromTime, validDate, notesFor, markdown });
});
