const $ = (selector) => document.querySelector(selector);
const FOCUS_CITIES = new Set(['杭州', '广州', '深圳']);
const FOCUS_SUBJECT = /信息技术|信息科技|计算机|人工智能/;
const FOCUS_COHORT = '2027';
const todayChina = () => {
  const parts = Object.fromEntries(new Intl.DateTimeFormat('en-US', {timeZone:'Asia/Shanghai',year:'numeric',month:'2-digit',day:'2-digit'}).formatToParts(new Date()).map(part => [part.type,part.value]));
  return `${parts.year}-${parts.month}-${parts.day}`;
};
const formatDate = (value) => value ? value.replaceAll('-', '.') : '未公布';
let dataset;

function node(tag, className, content) {
  const element = document.createElement(tag);
  if (className) element.className = className;
  if (content !== undefined && content !== null) element.textContent = String(content);
  return element;
}
function safeLink(url) {
  try { const parsed = new URL(url); return parsed.protocol === 'https:' ? parsed.href : '#'; }
  catch { return '#'; }
}
function applicationState(item) {
  if (!item.applyDeadline || ['报名已结束','已取消','暂停'].includes(item.status)) return null;
  if (item.applyDeadline < todayChina()) return null;
  if (item.applyDeadlineAt && new Date(item.applyDeadlineAt) < new Date()) return null;
  if (item.applyStartAt && new Date(item.applyStartAt) > new Date()) return '即将报名';
  if (item.applyStart && item.applyStart > todayChina()) return '即将报名';
  return '报名中';
}
function focusedNotices() {
  return dataset.notices.filter(item => FOCUS_CITIES.has(item.workCity) && FOCUS_SUBJECT.test(item.subject || '') && item.eligibleCohorts?.includes(FOCUS_COHORT) && applicationState(item));
}
function field(label, value, className = '') {
  const box = node('div', 'field ' + className);
  box.append(node('dt','',label),node('dd','',value || '公告未公布'));
  return box;
}
function renderNotices() {
  const query = $('#search').value.trim().toLowerCase();
  const city = $('#city-filter').value;
  const focused = focusedNotices();
  $('#filters').hidden = focused.length === 0;
  const items = focused
    .filter(item => (!city || item.workCity === city) && (!query || [item.title,item.school,item.positions,item.workDistrict,item.positionCode].some(value => value?.toLowerCase().includes(query))))
    .sort((a,b) => Number(applicationState(b) === '报名中') - Number(applicationState(a) === '报名中') || (b.published || '').localeCompare(a.published || ''));
  $('#results-label').textContent = items.length + ' 条岗位';
  const list = $('#notice-list'); list.replaceChildren();
  if (!items.length) {
    const empty = node('div','empty-state');
    empty.append(node('strong','',focused.length ? '没有符合搜索条件的岗位' : '目前没有已核实、仍可报考的2027届信息技术教师岗位'),node('p','',focused.length ? '可调整搜索或工作城市。' : '2025年的2026届校招及已过报名期限的公告不会混入清单。可在下方查看官方栏目与最近巡检时间。'));
    list.append(empty); return;
  }
  items.forEach(item => {
    const card = node('article','notice-card');
    const head = node('div','card-head');
    const title = node('div','card-title');
    title.append(node('div','card-meta',item.workCity + (item.workDistrict ? ' · ' + item.workDistrict : '') + '  /  ' + (item.school || '招聘单位待核')),node('h3','',item.positions || item.title));
    const state = applicationState(item);
    const status = node('span',state === '报名中' ? 'status open' : 'status upcoming',state);
    head.append(title,status);
    const facts = node('dl','fact-grid');
    facts.append(
      field('实际工作地点',item.workplace,'emphasis'),
      field('考试地点 / 考场',item.examVenue),
      field('计划招聘',item.plannedHires == null ? null : item.plannedHires + ' 人'),
      field('报名截止',item.applyDeadline ? formatDate(item.applyDeadline) : null),
      field('考试时间',item.examTime),
      field('考试科目 / 方式',item.subjects),
      field('资格要点',item.qualifications,'wide')
    );
    const foot = node('div','card-foot');
    const codeLabel = item.sourceId === 'hangzhou' ? '岗位表序号 ' : '岗位编号 ';
    foot.append(node('span','',(item.positionCode ? codeLabel + item.positionCode + ' · ' : '') + '公告 ' + formatDate(item.published) + ' · 核对 ' + formatDate(item.verified)));
    const link = node('a','official-link','官方原文 ↗'); link.href = safeLink(item.url); link.target = '_blank'; link.rel = 'noopener noreferrer';
    foot.append(link);
    card.append(head,facts,foot); list.append(card);
  });
}
function renderSummary() {
  const focused = focusedNotices();
  $('#active-count').textContent = focused.filter(item => applicationState(item) === '报名中').length;
  $('#city-count').textContent = FOCUS_CITIES.size;
  $('#last-check').textContent = dataset.generatedAt ? new Date(dataset.generatedAt).toLocaleString('zh-CN',{timeZone:'Asia/Shanghai',month:'2-digit',day:'2-digit',hour:'2-digit',minute:'2-digit'}) : '尚未运行';
}
function renderSources() {
  const box = $('#source-list'); box.replaceChildren();
  dataset.sources.filter(source => FOCUS_CITIES.has(source.region)).forEach(source => {
    const row = node('div','source-row');
    const link = node('a','',source.region + ' · ' + source.name + ' ↗');
    link.href = safeLink(source.url); link.target = '_blank'; link.rel = 'noopener noreferrer';
    const health = dataset.health?.[source.id];
    row.append(link,node('span',health?.ok === false ? 'source-health failed':'source-health',health ? (health.ok ? '巡检正常' : '巡检失败') : '待巡检'));
    box.append(row);
  });
}
async function start() {
  try {
    const response = await fetch('data/publications.json',{cache:'no-store'});
    if (!response.ok) throw new Error('HTTP ' + response.status);
    dataset = await response.json();
    renderSummary(); renderNotices(); renderSources();
  } catch (error) {
    $('#results-label').textContent = '数据暂时无法加载';
    $('#notice-list').append(node('p','load-error','请稍后刷新页面。' + error.message));
  }
}
$('#search').addEventListener('input',renderNotices);
$('#city-filter').addEventListener('change',renderNotices);
start();
