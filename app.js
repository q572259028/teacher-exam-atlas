const $ = (selector) => document.querySelector(selector);
const cnDate = (value) => value ? value.replaceAll('-', '.') : '日期待核';
const present = (value, fallback = '公告未公布') => value ?? fallback;
const todayChina = () => new Intl.DateTimeFormat('en-CA', {timeZone:'Asia/Shanghai',year:'numeric',month:'2-digit',day:'2-digit'}).format(new Date());
let dataset = null;
let visibleCount = 8;

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
function sourceFor(id) { return dataset.sources.find(item => item.id === id); }
function statusFor(item) {
  if (!item.applyDeadline) return item.status;
  return item.applyDeadline < todayChina() ? '报名已结束' : item.status;
}
function allNotices() {
  const verified = dataset.notices.map(item => ({...item, verifiedRecord:true}));
  const discovered = dataset.discovered.map(item => ({...item, verifiedRecord:false}));
  return [...verified, ...discovered].sort((a,b) => (b.published || '').localeCompare(a.published || ''));
}
function renderMetrics() {
  $('#source-count').textContent = String(dataset.sources.length).padStart(2,'0');
  $('#verified-count').textContent = `${dataset.notices.length} 则`;
  $('#metric-notices').textContent = dataset.notices.length;
  $('#metric-links').textContent = dataset.discovered.length;
  $('#metric-active').textContent = dataset.notices.filter(x => statusFor(x) === '报名中').length;
  $('#metric-sources').textContent = dataset.sources.length;
  $('#last-check').textContent = dataset.generatedAt ? new Date(dataset.generatedAt).toLocaleString('zh-CN',{timeZone:'Asia/Shanghai',month:'2-digit',day:'2-digit',hour:'2-digit',minute:'2-digit'}) : '尚未自动巡检';
}
function renderRegions() {
  const select = $('#region-filter');
  [...new Set(dataset.sources.map(s => s.region))].sort().forEach(region => {
    const option = node('option','',region); option.value = region; select.append(option);
  });
}
function renderNotices() {
  const search = $('#search').value.trim().toLowerCase();
  const region = $('#region-filter').value;
  const type = $('#type-filter').value;
  const filtered = allNotices().filter(item => (!region || item.region === region) &&
    (type === 'all' || (type === 'verified') === item.verifiedRecord) &&
    (!search || [item.title,item.region,item.city,item.school,item.positions].some(v => v?.toLowerCase().includes(search))));
  $('#results-label').textContent = `找到 ${filtered.length} 条相关信息`;
  const list = $('#notice-list'); list.replaceChildren();
  filtered.slice(0,visibleCount).forEach(item => {
    const card = node('article','notice-card');
    const body = node('div'); const tags = node('div','notice-tags');
    tags.append(node('span','tag',item.region),node('span',item.verifiedRecord ? 'tag' : 'tag amber',item.verifiedRecord ? '已核实摘要' : '自动发现·待核'));
    if (item.verifiedRecord && statusFor(item) === '报名中') tags.append(node('span','tag gray','报名中'));
    body.append(tags,node('h3','',item.title));
    const meta = node('div','notice-meta');
    [item.city || item.region,`发布日期 ${cnDate(item.published)}`,sourceFor(item.sourceId)?.name || '官方来源'].forEach(value => meta.append(node('span','',value)));
    body.append(meta);
    const button = node('button','',item.verifiedRecord ? '查看详情 ↗' : '查看链接 ↗');
    button.type = 'button'; button.addEventListener('click',() => openDetails(item));
    card.append(body,button); list.append(card);
  });
  $('#show-more').hidden = filtered.length <= visibleCount;
}
function detailItem(label,value,wide=false) {
  const item = node('div',wide ? 'detail-item wide' : 'detail-item');
  item.append(node('span','',label),node('strong','',present(value)));
  return item;
}
function openDetails(item) {
  const box = $('#dialog-content'); box.replaceChildren();
  box.append(node('h2','dialog-title',item.title));
  box.append(node('div','dialog-sub',`${item.region} · ${cnDate(item.published)} · ${sourceFor(item.sourceId)?.name || '官方来源'}`));
  const grid = node('div','detail-grid');
  grid.append(detailItem('招聘岗位',item.positions),detailItem('计划招聘人数',item.plannedHires === null ? null : `${item.plannedHires} 人`));
  grid.append(detailItem('报名时间',item.applyWindow),detailItem('考试时间',item.examTime));
  grid.append(detailItem('考试地点 / 考场',item.examVenue),detailItem('岗位实际工作地点',item.workplace));
  grid.append(detailItem('报考资格',item.qualifications,true),detailItem('考试科目 / 考核方式',item.subjects,true));
  box.append(grid);
  box.append(node('p','detail-note',item.notes || '该链接由程序自动发现，具体信息请核对官方原文及附件。'));
  const link = node('a','detail-link','打开官方公告原文 ↗'); link.href=safeLink(item.url); link.target='_blank'; link.rel='noopener noreferrer'; box.append(link);
  $('#detail-dialog').showModal();
}
function renderSources() {
  const list = $('#source-list'); list.replaceChildren();
  dataset.sources.forEach(source => {
    const health = dataset.health?.[source.id];
    const card = node('article','source-card'); const top = node('div','source-top');
    top.append(node('div','source-icon',source.region[0]));
    top.append(node('span',health?.ok === false ? 'health bad':'health',health ? (health.ok ? '巡检正常' : '巡检失败') : '待首次巡检'));
    card.append(top,node('h3','',source.name),node('p','',`${source.region} · ${source.scope}`),node('span','source-url',source.url));
    const link=node('a','source-link','访问官方栏目 ↗');link.href=safeLink(source.url);link.target='_blank';link.rel='noopener noreferrer';card.append(link);list.append(card);
  });
}
function renderHistory() {
  if (!dataset.history.length) return;
  const box=$('#history-content');box.className='history-table-wrap';box.replaceChildren();
  const table=node('table','history-table');const head=node('thead');const tr=node('tr');
  ['地区 / 岗位','年份','实考人数','最终录用','通过比例','官方出处'].forEach(x=>tr.append(node('th','',x)));head.append(tr);table.append(head);
  const tbody=node('tbody');dataset.history.forEach(row=>{
    const line=node('tr');[`${row.region} / ${row.position}`,row.year,row.examTakers,row.finalHires,`${(row.finalHires/row.examTakers*100).toFixed(1)}%`].forEach(x=>line.append(node('td','',x)));
    const td=node('td');const a=node('a','', '查看原文 ↗');a.href=safeLink(row.url);a.target='_blank';a.rel='noopener noreferrer';td.append(a);line.append(td);tbody.append(line);
  });table.append(tbody);box.append(table);
}
function renderPlans() {
  const list=$('#plan-list');list.replaceChildren();
  dataset.plans.forEach(plan=>{
    const card=node('article','plan-card');const body=node('div');body.append(node('h3','',`${plan.region} · ${plan.title}`),node('p','',plan.detail));
    const link=node('a','', '查看政策原文 ↗');link.href=safeLink(plan.url);link.target='_blank';link.rel='noopener noreferrer';card.append(body,link);list.append(card);
  });
}
async function start() {
  try {
    const response=await fetch('data/publications.json',{cache:'no-store'});
    if (!response.ok) throw new Error(`HTTP ${response.status}`);
    dataset=await response.json();
    renderMetrics();renderRegions();renderNotices();renderSources();renderHistory();renderPlans();
  } catch (error) {
    $('#results-label').textContent='数据暂时无法加载';
    $('#notice-list').append(node('p','',`请稍后刷新页面。${error.message}`));
  }
}
$('#search').addEventListener('input',()=>{visibleCount=8;renderNotices();});
$('#region-filter').addEventListener('change',()=>{visibleCount=8;renderNotices();});
$('#type-filter').addEventListener('change',()=>{visibleCount=8;renderNotices();});
$('#show-more').addEventListener('click',()=>{visibleCount+=8;renderNotices();});
$('#close-dialog').addEventListener('click',()=>$('#detail-dialog').close());
$('#detail-dialog').addEventListener('click',event=>{if(event.target.id==='detail-dialog')event.target.close();});
start();
