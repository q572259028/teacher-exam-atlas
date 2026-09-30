const assert = require('node:assert/strict');
const fs = require('node:fs');
const vm = require('node:vm');
const path = require('node:path');

const code = fs.readFileSync(path.join(__dirname, '..', 'app.js'), 'utf8');
const context = vm.createContext({
  document: {querySelector: () => ({addEventListener() {}})},
  fetch: () => new Promise(() => {}),
  Intl, Date, URL, Set, Object, String,
});
vm.runInContext(code, context);
const base = {
  workCity: '广州', subject: '信息技术', eligibleCohorts: ['2027'],
  applyDeadline: '2099-12-31', status: '报名中',
};
context.jobs = [
  {...base, id: 'valid'},
  {...base, id: 'old-cohort', eligibleCohorts: ['2026']},
  {...base, id: 'expired', applyDeadline: '2025-10-16'},
  {...base, id: 'wrong-workplace', workCity: '北京', examVenue: '广州'},
  {...base, id: 'other-subject', subject: '语文'},
];
const ids = vm.runInContext('dataset = {notices: jobs}; focusedNotices().map(item => item.id)', context);
assert.deepEqual(Array.from(ids), ['valid']);
assert.equal(vm.runInContext('applicationState(jobs[2])', context), null);
console.log('2027 cohort, deadline, subject, and work-city filters pass');
