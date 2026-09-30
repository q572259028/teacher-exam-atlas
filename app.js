const $ = (selector) => document.querySelector(selector);
const FOCUS_CITIES = new Set(['杭州', '广州', '深圳']);
const FOCUS_SUBJECT = /信息技术|信息科技|计算机|人工智能/;
const todayChina = () => new Intl.DateTimeFormat('en-CA', {timeZone:'Asia/Shanghai',year:'numeric',month:'2-digit',day:'2-digit'}).format(new Date());
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
function focusedNotices() {
  return dataset.notices.filter(item => FOCUS_CITIES.has(item.workCity) && FOCUS_SUBJECT.test(item.subject || ''));
}
function isOpen(item) {
  return !!item.applyDeadline && item.applyDeadline >= todayChina() && item.status === '报名中';
}
function field(label, value, className = '') {
  const box = node('div', 'field ' + className);
  box.append(node('dt','',label),node('dd','',value || '公告未公布'));
  return box;
}
function renderNotices() {
  const query = $('#search').value.trim().toLowerCase();
  const city = $('#city-filter').value;
  const items = focusedNotices()
    .filter(item => (!city || item.workCity === city) && (!query || [item.title,item.school,item.positions,item.workDistrict,item.positionCode].some(value => value?.toLowerCase().includes(query))))
    .sort((a,b) => Number(isOpen(b)) - Number(isOpen(a)) || (b.published || '').localeCompare(a.published || ''));
  $('#results-label').textContent = items.length + ' 条岗位';
  const list = $('#notice-list'); list.replaceChildren();
  if (!items.length) {
    const empty = node('div','empty-state');
    empty.append(node('strong','','没有符合筛选条件的已核实岗位'),node('p','','可调整搜索；新公告只有核实学科及工作地点后才会进入清单。'));
    list.append(empty); return;
  }
  items.forEach(item => {
    const card = node('article','notice-card');
    const head = node('div','card-head');
    const title = node('div','card-title');
    title.append(node('div','card-meta',item.workCity + (item.workDistrict ? ' · ' + item.workDistrict : '') + '  /  ' + (item.school || '招聘单位待核')),node('h3','',item.positions || item.title));
    const status = node('span',isOpen(item) ? 'status open' : 'status closed',isOpen(item) ? '报名中' : '报名已结束');
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
  $('#active-count').textContent = focused.filter(isOpen).length;
  $('#position-count').textContent = focused.length;
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
