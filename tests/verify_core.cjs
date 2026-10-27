const assert = require('node:assert/strict');
const core = require('../src/core.js');

assert.equal(core.cast('子', '寅').key, '丙寅子', '子时问婚须查丙寅子');
assert.equal(core.cast('卯', '子').key, '癸子卯', '卯时问财须查癸子卯');
assert.equal(core.cast('子', '戌').key, '甲戌子', '第十一位天干须回甲');
assert.equal(core.cast('子', '亥').key, '乙亥子', '第十二位须为乙');
assert.equal(core.cast('亥', '子').key, '乙子亥', '跨亥之后从子继续');
assert.equal(core.cast('酉', '酉').key, '甲酉酉', '同位第一步即甲');
console.log('六个原书算例通过');

const fs = require('node:fs');
const path = require('node:path');
const data = JSON.parse(fs.readFileSync(path.join(__dirname, '../src/data.json'), 'utf8'));
assert.equal(data.entries.length, 144);
const obtained = new Set();
for (const entry of data.entries) {
  // 预期值来自原书标题；调用接口时只给标题中的事项与时辰。
  const result = core.cast(entry.key[2], entry.key[1]);
  assert.equal(result.key, entry.key, `原书标题须匹配：${entry.key}`);
  assert.equal(result.steps[0].branch, entry.key[2]);
  assert.equal(result.steps[0].stem, '甲');
  assert.equal(result.steps.at(-1).branch, entry.key[1]);
  obtained.add(result.key);
}
assert.equal(obtained.size, 144);
for (const [clock, expected] of [
  ['00:00','子'],['00:59','子'],['01:00','丑'],['02:59','丑'],['03:00','寅'],['04:59','寅'],
  ['05:00','卯'],['06:59','卯'],['07:00','辰'],['08:59','辰'],['09:00','巳'],['10:59','巳'],
  ['11:00','午'],['12:59','午'],['13:00','未'],['14:59','未'],['15:00','申'],['16:59','申'],
  ['17:00','酉'],['18:59','酉'],['19:00','戌'],['20:59','戌'],['21:00','亥'],['22:59','亥'],
  ['23:00','子'],['23:59','子']
]) assert.equal(core.branchFromTime(clock), expected, `钟点边界 ${clock}`);
for (const invalid of ['', '24:00', '12:60', '1:00', null, 930, '09:30:00', 'xx:xx']) {
  assert.throws(() => core.branchFromTime(invalid));
}
for (const [hour, topic] of [['甲', '子'], ['子', '甲'], [null, '寅'], ['子', '']]) {
  assert.throws(() => core.cast(hour, topic));
}
for (const date of ['2026-10-27', '2024-02-29', '2000-02-29', '0001-01-01']) assert.ok(core.validDate(date));
for (const date of ['2026-02-29', '1900-02-29', '2026-04-31', '0000-01-01', '2026-13-01', '']) {
  assert.equal(core.validDate(date), false);
}
const entry = data.entries.find(row => row.key === '丙寅子');
const snapshot = { result: core.cast('子', '寅'), date: '2026-10-27', mode: 'clock', clock: '23:30',
  question: '<script>alert(1)</script>\n完整问题' };
const record = core.markdown(snapshot, entry);
for (const expected of [entry.key, entry.poem, entry.judgment, snapshot.question, '23:30', '北京时间', '2026-10-27']) {
  assert.ok(record.includes(expected));
}
assert.ok(core.markdown({ ...snapshot, mode: 'branch', clock: '' }, entry).includes('手动指定'));
assert.ok(record.includes('```text\n' + snapshot.question + '\n```'));
assert.ok(core.markdown({ ...snapshot, question: '```\n<script>示例</script>' }, entry)
  .includes('````text\n```\n<script>示例</script>\n````'));
assert.throws(() => core.markdown(snapshot, data.entries.find(row => row.key === '甲子子')));
assert.equal(core.notesFor('乙午未').length, 1);
assert.equal(core.notesFor('甲子子').length, 0);
console.log('144 种组合、26 个钟点边界、无效输入、日期及记录导出通过');
