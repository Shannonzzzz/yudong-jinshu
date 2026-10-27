(function () {
  'use strict';
  const C = window.Yudong;
  const data = JSON.parse(document.getElementById('source-data').textContent);
  const entries = new Map(data.entries.map(entry => [entry.key, entry]));
  const $ = id => document.getElementById(id);
  let active = null;
  let exportUrl = null;

  function addOption(select, value, label) {
    const option = document.createElement('option');
    option.value = value;
    option.textContent = label;
    select.append(option);
  }
  C.topics.forEach(topic => addOption($('topic'), topic.branch, `${topic.name} · ${topic.branch}`));
  C.branches.forEach((branch, i) => addOption($('hour'), branch, `${branch}时  ${C.timeRanges[i].replace('–', '-')}`));
  C.topics.forEach(topic => {
    const button = document.createElement('button');
    button.type = 'button';
    button.className = 'topic-button';
    button.dataset.value = topic.branch;
    button.setAttribute('aria-pressed', 'false');
    button.setAttribute('aria-label', `${topic.name}，${topic.branch}`);
    const label = document.createElement('span');
    label.textContent = topic.name;
    const branch = document.createElement('small');
    branch.textContent = topic.branch;
    branch.setAttribute('aria-hidden', 'true');
    button.append(label, branch);
    button.addEventListener('click', () => {
      if ($('topic').value === topic.branch) return;
      $('topic').value = topic.branch;
      invalidate();
    });
    $('topic-grid').append(button);
  });

  function mode() { return document.querySelector('input[name="mode"]:checked').value; }
  function selectedHour() { return mode() === 'clock' ? C.branchFromTime($('clock').value) : $('hour').value; }

  function updateControls() {
    const clockMode = mode() === 'clock';
    $('clock-group').hidden = !clockMode;
    $('branch-group').hidden = clockMode;
    $('clock').disabled = !clockMode;
    $('hour').disabled = clockMode;
    const topic = C.topics.find(item => item.branch === $('topic').value);
    $('topic-hint').textContent = topic.description;
    document.querySelectorAll('.topic-button').forEach(button => {
      button.setAttribute('aria-pressed', String(button.dataset.value === topic.branch));
    });
    try {
      const hour = selectedHour();
      $('hour-preview').textContent = `${hour}时`;
      $('range-preview').textContent = clockMode ? C.timeRanges[C.branches.indexOf(hour)].replace('–', '-') : '手动指定';
    } catch (_) {
      $('hour-preview').textContent = '待定';
      $('range-preview').textContent = '请填写有效钟点';
    }
  }

  function invalidate() {
    if (active) {
      active = null;
      $('result').hidden = true;
      $('empty-state').hidden = false;
      $('result-status').textContent = '输入已更改，请重新起盘';
    }
    $('form-error').textContent = '';
    updateControls();
  }

  function useNow() {
    const parts = new Intl.DateTimeFormat('en-GB', { timeZone: 'Asia/Shanghai', year: 'numeric',
      month: '2-digit', day: '2-digit', hour: '2-digit', minute: '2-digit', hourCycle: 'h23' }).formatToParts(new Date());
    const values = Object.fromEntries(parts.map(part => [part.type, part.value]));
    $('date').value = `${values.year}-${values.month}-${values.day}`;
    $('clock').value = `${values.hour}:${values.minute}`;
    invalidate();
  }

  function renderChart(result, target = 'chart-ring') {
    const ring = $(target);
    ring.replaceChildren();
    C.branches.forEach((branch, index) => {
      const node = document.createElement('span');
      const angle = index * Math.PI / 6 - Math.PI / 2;
      node.className = 'branch-node';
      if (branch === result.hour) node.classList.add('is-hour');
      if (branch === result.topic) node.classList.add('is-topic');
      node.style.left = `${50 + 50 * Math.cos(angle)}%`;
      node.style.top = `${50 + 50 * Math.sin(angle)}%`;
      node.textContent = branch;
      node.title = branch + (branch === result.hour ? ' · 起点时辰' : '') + (branch === result.topic ? ' · 所问事项' : '');
      ring.append(node);
    });
  }

  function showResult(snapshot) {
    const result = snapshot.result;
    const entry = entries.get(result.key);
    if (!entry) throw new Error('没有找到对应原文，请检查文件是否完整。');
    active = { snapshot, entry };
    const topic = C.topics.find(item => item.branch === result.topic);
    $('result-key').textContent = result.key;
    $('result-subtitle').textContent = `${result.hour}时 · 问${topic.name}`;
    $('result-grade').textContent = entry.grade;
    $('judgment').textContent = entry.judgment;
    $('poem').textContent = entry.poem;
    $('tune').textContent = entry.tune;
    $('step-count').textContent = `共 ${result.steps.length} 位，起点即第一位`;
    $('composition').textContent = `${result.key[0]}（数得天干）＋${result.topic}（事项）＋${result.hour}（时辰）＝${result.key}`;
    $('steps').replaceChildren();
    result.steps.forEach(step => {
      const node = document.createElement('span');
      node.className = 'step';
      const number = document.createElement('small');
      number.textContent = String(step.position).padStart(2, '0');
      const text = document.createElement('span');
      text.textContent = step.branch + step.stem;
      node.append(number, text);
      $('steps').append(node);
    });
    const clockLabel = snapshot.mode === 'clock' ? `北京时间 ${snapshot.clock}` : '手动指定时辰';
    $('print-meta').textContent = `${snapshot.date}  ${clockLabel}\n${result.hour}时问${topic.name}` +
      (snapshot.question ? `\n所问：${snapshot.question}` : '');
    const notes = C.notesFor(entry.key);
    $('original-note').textContent = notes.join('\n');
    $('original-note').hidden = notes.length === 0;
    $('provenance').textContent = `原文定位：${data.source} · 搜索「${entry.key}」`;
    renderChart(result);
    $('empty-state').hidden = true;
    $('result').hidden = false;
    $('result-status').textContent = `已起盘 · ${result.key}`;
    if (window.matchMedia('(max-width: 768px)').matches) {
      $('result-heading').scrollIntoView({ block: 'start' });
      $('result-heading').focus({ preventScroll: true });
    }
  }

  $('cast-form').addEventListener('submit', event => {
    event.preventDefault();
    try {
      if (!C.validDate($('date').value)) throw new Error('请填写有效的记录日期。');
      const result = C.cast(selectedHour(), $('topic').value);
      showResult(Object.freeze({ result, date: $('date').value, clock: mode() === 'clock' ? $('clock').value : '',
        mode: mode(), question: $('question').value.trim() }));
      $('form-error').textContent = '';
    } catch (error) {
      invalidate();
      $('form-error').textContent = error.message;
    }
  });
  $('cast-form').addEventListener('input', invalidate);
  $('cast-form').addEventListener('change', invalidate);
  $('use-now').addEventListener('click', useNow);

  $('export').addEventListener('click', () => {
    if (!active) return;
    try {
      const content = C.markdown(active.snapshot, active.entry);
      if (exportUrl) URL.revokeObjectURL(exportUrl);
      const url = URL.createObjectURL(new Blob([content], { type: 'text/markdown;charset=utf-8' }));
      exportUrl = url;
      const link = document.createElement('a');
      link.href = url;
      link.download = `玉洞金书_${active.entry.key}_${active.snapshot.date}.md`;
      document.body.append(link);
      link.click();
      link.remove();
      setTimeout(() => { URL.revokeObjectURL(url); if (exportUrl === url) exportUrl = null; }, 3000);
      $('form-error').textContent = '';
    } catch (error) {
      $('form-error').textContent = `导出失败：${error.message}。可使用打印功能保存当前结果。`;
    }
  });
  $('print').addEventListener('click', () => { if (active) window.print(); });

  function renderLibrary() {
    const keyword = $('search').value.trim();
    const found = data.entries.filter(entry => [entry.key, entry.grade, entry.tune, entry.poem, entry.judgment]
      .some(text => text.includes(keyword)));
    $('search-count').textContent = `找到 ${found.length} 则；点击条目可按其时辰与事项起盘。`;
    const fragment = document.createDocumentFragment();
    found.forEach(entry => {
      const button = document.createElement('button');
      button.type = 'button';
      button.className = 'library-button';
      const title = document.createElement('span');
      title.className = 'library-title';
      const key = document.createElement('span');
      key.textContent = entry.key;
      const info = document.createElement('small');
      info.textContent = `${entry.grade} · ${entry.tune}`;
      const preview = document.createElement('span');
      preview.className = 'library-preview';
      preview.textContent = entry.judgment;
      title.append(key, info);
      button.append(title, preview);
      button.addEventListener('click', () => {
        document.querySelector('input[name="mode"][value="branch"]').checked = true;
        $('hour').value = entry.key[2];
        $('topic').value = entry.key[1];
        invalidate();
        if (!$('cast-form').reportValidity()) return;
        $('cast-form').requestSubmit();
        $('result-heading').scrollIntoView({ block: 'start' });
      });
      fragment.append(button);
    });
    if (!found.length) {
      const empty = document.createElement('p');
      empty.className = 'no-results';
      empty.textContent = '没有匹配的条目，请换个词试试。';
      fragment.append(empty);
    }
    $('library').replaceChildren(fragment);
  }
  $('search').addEventListener('input', renderLibrary);
  ['open-library', 'open-rules'].forEach(id => $(id).addEventListener('click', () => {
    $('reference').open = true;
  }));
  const systemTheme = window.matchMedia('(prefers-color-scheme: dark)');
  function themeIsDark() {
    return document.documentElement.dataset.theme === 'dark' ||
      (!document.documentElement.dataset.theme && systemTheme.matches);
  }
  function updateThemeLabel() {
    const dark = themeIsDark();
    $('theme-toggle').textContent = dark ? '切换浅色' : '切换深色';
    $('theme-toggle').setAttribute('aria-label', dark ? '切换浅色主题' : '切换深色主题');
    $('theme-toggle').setAttribute('aria-pressed', String(dark));
  }
  $('theme-toggle').addEventListener('click', () => {
    document.documentElement.dataset.theme = themeIsDark() ? 'light' : 'dark';
    updateThemeLabel();
  });
  systemTheme.addEventListener('change', updateThemeLabel);
  $('rule-text').textContent = data.rules.join('\n');
  renderChart({ hour: '', topic: '' }, 'empty-ring');
  updateThemeLabel();
  renderLibrary();
  useNow();
})();
