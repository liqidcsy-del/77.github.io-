// 元梦之星 UGC买量知识库 - GitHub Gist 云同步版
const STORAGE_KEYS = {
  docs:'ymzx_docs',tasks:'ymzx_tasks',materials:'ymzx_materials',dataRows:'ymzx_data_rows',
  messages:'ymzx_messages',todos:'ymzx_todos',navItems:'ymzx_nav_items',theme:'ymzx_theme',
  widgets:'ymzx_widgets',customNotes:'ymzx_custom_notes',subCategories:'ymzx_sub_categories',weekFocus:'ymzx_week_focus'
};

// ===== GitHub Gist 云同步 =====
const GIST_CONFIG_KEY = 'ymzx_gist_config';
const SYNC_DATA_FILE = 'ymzx_data.json';
const CLOUD_KEYS = ['docs','tasks','materials','dataRows','messages','todos','navItems','widgets','customNotes','subCategories','weekFocus'];
let _gistConfig = null;
let _syncTimer = null;
let _syncDirty = false;
let _cloudData = null;
let _cloudReady = false;

function getGistConfig(){
  if(_gistConfig) return _gistConfig;
  try{ _gistConfig = JSON.parse(localStorage.getItem(GIST_CONFIG_KEY)); } catch{}
  return _gistConfig;
}
function saveGistConfig(cfg){
  _gistConfig = cfg;
  localStorage.setItem(GIST_CONFIG_KEY, JSON.stringify(cfg));
}
function isCloudEnabled(){ return !!getGistConfig()?.token && !!getGistConfig()?.gistId; }

function updateSyncStatus(status, msg){
  const el = document.getElementById('syncStatus');
  if(!el) return;
  const map = {syncing:'🔄',success:'✅',error:'❌',offline:'💾',loading:'⏳'};
  el.innerHTML = `<span class="sync-icon">${map[status]||'💾'}</span><span class="sync-text">${msg||''}</span>`;
  el.className = 'sync-status sync-'+status;
}

async function gistApiGet(){
  const cfg = getGistConfig();
  if(!cfg?.token || !cfg?.gistId) return null;
  const resp = await fetch('https://api.github.com/gists/'+cfg.gistId, {
    headers: {'Authorization':'token '+cfg.token,'Accept':'application/vnd.github.v3+json'}
  });
  if(!resp.ok) throw new Error('Gist读取失败: '+resp.status);
  const data = await resp.json();
  const file = data.files[SYNC_DATA_FILE];
  if(!file) return {};
  return JSON.parse(file.content);
}

async function gistApiPut(allData){
  const cfg = getGistConfig();
  if(!cfg?.token || !cfg?.gistId) return;
  const resp = await fetch('https://api.github.com/gists/'+cfg.gistId, {
    method:'PATCH',
    headers: {'Authorization':'token '+cfg.token,'Accept':'application/vnd.github.v3+json','Content-Type':'application/json'},
    body: JSON.stringify({ files:{ [SYNC_DATA_FILE]:{ content: JSON.stringify(allData) } } })
  });
  if(!resp.ok) throw new Error('Gist写入失败: '+resp.status);
}

function collectAllCloudData(){
  const data = {};
  CLOUD_KEYS.forEach(k => {
    try{ data[k] = JSON.parse(localStorage.getItem(STORAGE_KEYS[k])); }catch{ data[k] = null; }
  });
  return data;
}

function applyCloudData(data){
  if(!data) return;
  CLOUD_KEYS.forEach(k => {
    if(data[k] !== undefined && data[k] !== null){
      localStorage.setItem(STORAGE_KEYS[k], JSON.stringify(data[k]));
    }
  });
}

async function cloudPull(){
  if(!isCloudEnabled()) return;
  try{
    updateSyncStatus('loading','正在从云端加载...');
    const data = await gistApiGet();
    if(data && Object.keys(data).length > 0){
      _cloudData = data;
      applyCloudData(data);
      _cloudReady = true;
      updateSyncStatus('success','云端数据已加载');
    } else {
      _cloudReady = true;
      updateSyncStatus('success','云端为空，使用本地数据');
      scheduleSyncPush();
    }
  }catch(e){
    console.error('云端拉取失败:', e);
    _cloudReady = true;
    updateSyncStatus('error','云端拉取失败: '+e.message);
  }
}

function scheduleSyncPush(){
  _syncDirty = true;
  if(_syncTimer) clearTimeout(_syncTimer);
  _syncTimer = setTimeout(doSyncPush, 1500);
}

async function doSyncPush(){
  if(!isCloudEnabled() || !_syncDirty) return;
  _syncDirty = false;
  try{
    updateSyncStatus('syncing','正在同步到云端...');
    const data = collectAllCloudData();
    await gistApiPut(data);
    updateSyncStatus('success','已同步到云端');
  }catch(e){
    console.error('云端推送失败:', e);
    updateSyncStatus('error','同步失败: '+e.message);
    _syncDirty = true;
  }
}

function loadData(k){try{return JSON.parse(localStorage.getItem(STORAGE_KEYS[k]))||[];}catch{return[];}}
function loadObj(k){try{return JSON.parse(localStorage.getItem(STORAGE_KEYS[k]))||{};}catch{return{};}}
function saveData(k,d){
  localStorage.setItem(STORAGE_KEYS[k],JSON.stringify(d));
  if(isCloudEnabled() && CLOUD_KEYS.includes(k)) scheduleSyncPush();
}
function genId(){return Date.now().toString(36)+Math.random().toString(36).slice(2,7);}
function today(){return new Date().toISOString().split('T')[0];}
function nowStr(){const d=new Date();return d.getFullYear()+'-'+String(d.getMonth()+1).padStart(2,'0')+'-'+String(d.getDate()).padStart(2,'0')+' '+String(d.getHours()).padStart(2,'0')+':'+String(d.getMinutes()).padStart(2,'0');}
function esc(s){if(!s)return '';const d=document.createElement('div');d.textContent=s;return d.innerHTML;}

const DEFAULT_NAV=[
  {id:'docs',icon:'📁',label:'文档中心',builtin:true},{id:'progress',icon:'📋',label:'工作进度',builtin:true},
  {id:'material',icon:'🎬',label:'素材投放',builtin:true},{id:'data',icon:'📈',label:'数据回收',builtin:true},
  {id:'team',icon:'👥',label:'团队协作',builtin:true}
];
const DEFAULT_SUBCATS={
  docs:['投放策略','创意方案','数据报告','SOP流程','复盘总结','竞品分析','素材需求','其他'],
  material:['待审核','投放中','已暂停','已下线'],progress:['P0-紧急','P1-重要','P2-普通'],
  data:['抖音','快手','B站','微信','小红书','微博','其他'],team:['本周重点','日常沟通','问题反馈']
};
const WIDGET_DEFS={
  docs:[{key:'doc_total',label:'文档总数',desc:'知识库文档总数'},{key:'doc_recent',label:'最近更新',desc:'本周更新数'},{key:'doc_draft',label:'草稿数量',desc:'待完善草稿'}],
  progress:[{key:'task_overdue',label:'逾期任务',desc:'已过截止日期'},{key:'task_today',label:'今日截止',desc:'今天需完成'},{key:'task_rate',label:'完成率',desc:'任务完成百分比'}],
  material:[{key:'mat_hot',label:'爆款素材',desc:'ROI>1.5'},{key:'mat_review',label:'待审核',desc:'等待审核'},{key:'mat_cost_total',label:'总消耗',desc:'所有素材总消耗'}],
  data:[{key:'data_cost_week',label:'本周消耗',desc:'本周总投放消耗'},{key:'data_user_week',label:'本周新增',desc:'本周新增用户'},{key:'data_best_ch',label:'最优渠道',desc:'ROI最高渠道'}],
  team:[{key:'team_msg_count',label:'消息数',desc:'沟通记录数'},{key:'team_todo_open',label:'待办未完成',desc:'未完成待办'},{key:'team_todo_urgent',label:'紧急待办',desc:'紧急优先级'}]
};

// ===== Init =====
document.addEventListener('DOMContentLoaded', async ()=>{
  document.getElementById('dateDisplay').textContent=new Date().toLocaleDateString('zh-CN',{year:'numeric',month:'long',day:'numeric',weekday:'long'});
  initTheme();
  if(isCloudEnabled()){
    updateSyncStatus('loading','正在从云端加载...');
    try {
      await cloudPull();
    } catch(e) {
      console.error(e);
      updateSyncStatus('error','云端加载失败，使用本地数据');
    }
  } else {
    updateSyncStatus('offline','本地模式（点击 ☁ 配置云同步）');
  }
  initNav();renderDocs();renderTasks();renderMaterials();renderDataSection();renderMessages();renderTodos();renderAllWidgets();initWeekFocus();
});

// ===== Theme =====
function initTheme(){applyTheme(localStorage.getItem(STORAGE_KEYS.theme)||'dark');}
function applyTheme(t){document.body.className='theme-'+t;localStorage.setItem(STORAGE_KEYS.theme,t);document.getElementById('themeBtn').textContent=t==='dark'?'☀️ 亮色':'🌙 暗色';}
function toggleTheme(){applyTheme((localStorage.getItem(STORAGE_KEYS.theme)||'dark')==='dark'?'light':'dark');setTimeout(renderDataChart,200);}

// ===== Nav =====
let editingNavId=null,navExpanded={},dragNavIdx=null;
function getNavItems(){let items=loadData('navItems');if(!items.length){items=[...DEFAULT_NAV];saveData('navItems',items);}return items;}
function initNav(){renderNav();}
function renderNav(){
  const items=getNavItems(),menu=document.getElementById('navMenu'),activeTab=document.querySelector('.tab-content.active')?.id?.replace('tab-','')||'docs';
  menu.innerHTML=items.map((item,i)=>{
    const subs=getSubCategories(item.id),hasSubs=subs&&subs.length>0,isExp=navExpanded[item.id],isAct=item.id===activeTab;
    let h=`<div class="nav-group"><div class="nav-item ${isAct?'active':''}" data-tab="${item.id}" data-idx="${i}" draggable="true" ondragstart="navDragStart(event,${i})" ondragover="navDragOver(event,${i})" ondrop="navDrop(event,${i})" ondragend="navDragEnd()" onclick="switchTab('${item.id}')">
      <span class="nav-drag-handle" onclick="event.stopPropagation()">⠿</span>
      ${hasSubs?`<span class="nav-expand-btn" onclick="event.stopPropagation();toggleNavExpand('${item.id}')">${isExp?'▾':'▸'}</span>`:''}
      <span class="nav-icon">${item.icon}</span><span class="nav-label">${esc(item.label)}</span>
      <span class="nav-edit-btn" onclick="event.stopPropagation();editNavItem('${item.id}')">✏️</span></div>`;
    if(hasSubs&&isExp){
      h+='<div class="nav-sub-list">'+subs.map(sub=>`<div class="nav-sub-item ${isAct&&getActiveSubFilter(item.id)===sub?'active':''}" onclick="event.stopPropagation();navSubClick('${item.id}','${sub.replace(/'/g,"\\'")}')"><span class="nav-sub-dot"></span><span class="nav-sub-label">${esc(sub)}</span></div>`).join('');
      h+=`<div class="nav-sub-item nav-sub-add" onclick="event.stopPropagation();openSubCatModal('${item.id}')"><span class="nav-sub-dot add">+</span><span class="nav-sub-label" style="color:var(--text-muted)">管理分类</span></div></div>`;
    }
    return h+'</div>';
  }).join('');
}
function toggleNavExpand(id){navExpanded[id]=!navExpanded[id];renderNav();}
function getActiveSubFilter(t){if(t==='docs')return activeDocFilter==='全部'?null:activeDocFilter;if(t==='material')return activeMatFilter==='全部'?null:activeMatFilter;return null;}
function navSubClick(tabId,sub){switchTab(tabId);if(tabId==='docs'){activeDocFilter=sub;renderDocs();}else if(tabId==='material'){activeMatFilter=sub;renderMaterials();}renderNav();}
function navDragStart(e,i){dragNavIdx=i;e.currentTarget.classList.add('dragging');}
function navDragOver(e,i){e.preventDefault();document.querySelectorAll('.nav-item').forEach(n=>n.classList.remove('drag-over'));e.currentTarget.classList.add('drag-over');}
function navDrop(e,i){e.preventDefault();if(dragNavIdx===null||dragNavIdx===i)return;const items=getNavItems();const[m]=items.splice(dragNavIdx,1);items.splice(i,0,m);saveData('navItems',items);renderNav();}
function navDragEnd(){dragNavIdx=null;document.querySelectorAll('.nav-item').forEach(n=>{n.classList.remove('dragging');n.classList.remove('drag-over');});}
function openNavEditModal(id){editingNavId=id||null;document.getElementById('navEditTitle').textContent=id?'编辑目录':'新增目录';document.getElementById('navDeleteBtn').style.display=id?'block':'none';if(id){const item=getNavItems().find(x=>x.id===id);if(!item)return;document.getElementById('navIconInput').value=item.icon;document.getElementById('navLabelInput').value=item.label;if(item.builtin)document.getElementById('navDeleteBtn').style.display='none';}else{document.getElementById('navIconInput').value='📂';document.getElementById('navLabelInput').value='';}openModal('navEditModal');}
function editNavItem(id){openNavEditModal(id);}
function saveNavItem(){const icon=document.getElementById('navIconInput').value.trim()||'📂',label=document.getElementById('navLabelInput').value.trim();if(!label){alert('请输入目录名称');return;}const items=getNavItems();if(editingNavId){const item=items.find(x=>x.id===editingNavId);if(item){item.icon=icon;item.label=label;}}else{const newId='custom_'+genId();items.push({id:newId,icon,label,builtin:false});createCustomTabSection(newId,label);}saveData('navItems',items);closeModal('navEditModal');renderNav();}
function deleteNavItem(){if(!confirm('确定删除？'))return;saveData('navItems',getNavItems().filter(x=>x.id!==editingNavId));const s=document.getElementById('tab-'+editingNavId);if(s)s.remove();closeModal('navEditModal');renderNav();switchTab('docs');}
function createCustomTabSection(id,label){if(document.getElementById('tab-'+id))return;const sec=document.createElement('section');sec.className='tab-content';sec.id='tab-'+id;const notes=loadObj('customNotes');sec.innerHTML=`<div class="page-header"><h1>${esc(label)}</h1></div><div class="custom-tab-content"><div class="custom-notes"><textarea id="customNote_${id}" placeholder="在此输入内容...">${esc(notes[id]||'')}</textarea><button class="btn-primary" onclick="saveCustomNote('${id}')">保存</button></div></div>`;document.querySelector('.main-content').appendChild(sec);}
function saveCustomNote(id){const notes=loadObj('customNotes');notes[id]=document.getElementById('customNote_'+id).value;saveData('customNotes',notes);}
function ensureCustomTabs(){getNavItems().filter(x=>!x.builtin).forEach(item=>createCustomTabSection(item.id,item.label));}
function switchTab(tabId){ensureCustomTabs();document.querySelectorAll('.tab-content').forEach(t=>t.classList.remove('active'));const tab=document.getElementById('tab-'+tabId);if(tab)tab.classList.add('active');if(tabId==='data')setTimeout(renderDataChart,150);renderNav();}

// ===== Modal =====
function openModal(id){document.getElementById(id).classList.add('show');}
function closeModal(id){document.getElementById(id).classList.remove('show');}

// ===== Search =====
function globalSearchHandler(q){q=q.trim().toLowerCase();if(document.getElementById('tab-docs').classList.contains('active')){document.querySelectorAll('.doc-card').forEach(c=>{c.style.display=(!q||c.textContent.toLowerCase().includes(q))?'':'none';});}}

// ===== SubCategories =====
function getSubCategories(tab){const all=loadObj('subCategories');if(!all[tab]){all[tab]=[...(DEFAULT_SUBCATS[tab]||[])];saveData('subCategories',all);}return all[tab];}
function saveSubCategories(tab,list){const all=loadObj('subCategories');all[tab]=list;saveData('subCategories',all);}
let editingSubCatTab=null;
function openSubCatModal(tab){editingSubCatTab=tab;document.getElementById('subCatModalTitle').textContent='管理分类';renderSubCatList();openModal('subCatModal');}
function renderSubCatList(){const list=getSubCategories(editingSubCatTab);document.getElementById('subCatList').innerHTML=list.map((name,i)=>`<div class="subcat-item"><span class="subcat-name" id="subCatName_${i}">${esc(name)}</span><div class="subcat-actions"><button onclick="renameSubCategory(${i})">✏️</button><button class="del" onclick="removeSubCategory(${i})">🗑️</button></div></div>`).join('');}
function addSubCategory(){const input=document.getElementById('subCatNewInput'),name=input.value.trim();if(!name)return;const list=getSubCategories(editingSubCatTab);if(list.includes(name)){alert('已存在');return;}list.push(name);saveSubCategories(editingSubCatTab,list);input.value='';renderSubCatList();}
function renameSubCategory(idx){const list=getSubCategories(editingSubCatTab),old=list[idx],el=document.getElementById('subCatName_'+idx);el.innerHTML=`<input type="text" value="${esc(old)}" id="subCatRenameInput_${idx}" onkeydown="if(event.key==='Enter')confirmRenameSubCat(${idx})">`;document.getElementById('subCatRenameInput_'+idx).focus();el.closest('.subcat-item').querySelector('.subcat-actions').innerHTML=`<button onclick="confirmRenameSubCat(${idx})">✅</button>`;}
function confirmRenameSubCat(idx){const v=document.getElementById('subCatRenameInput_'+idx).value.trim();if(!v)return;const list=getSubCategories(editingSubCatTab),old=list[idx];list[idx]=v;saveSubCategories(editingSubCatTab,list);if(editingSubCatTab==='docs'){const docs=loadData('docs');docs.forEach(d=>{if(d.category===old)d.category=v;});saveData('docs',docs);}renderSubCatList();}
function removeSubCategory(idx){const list=getSubCategories(editingSubCatTab);if(!confirm('确定删除「'+list[idx]+'」？'))return;list.splice(idx,1);saveSubCategories(editingSubCatTab,list);renderSubCatList();}
function refreshCurrentTab(){const a=document.querySelector('.tab-content.active')?.id?.replace('tab-','');if(a==='docs')renderDocs();else if(a==='material')renderMaterials();else if(a==='data')renderDataSection();}

// ===== Widgets =====
function getWidgetConfig(){return loadObj('widgets');}function saveWidgetConfig(c){saveData('widgets',c);}
function openWidgetPanel(tab){const cfg=getWidgetConfig(),en=cfg[tab]||[],defs=WIDGET_DEFS[tab]||[];document.getElementById('widgetPanelBody').innerHTML=defs.map(w=>`<div class="widget-panel-item"><input type="checkbox" id="wc_${w.key}" ${en.includes(w.key)?'checked':''} onchange="toggleWidget('${tab}','${w.key}',this.checked)"><div><label for="wc_${w.key}">${w.label}</label><div class="w-desc">${w.desc}</div></div></div>`).join('');openModal('widgetPanelModal');}
function toggleWidget(tab,key,on){const cfg=getWidgetConfig();if(!cfg[tab])cfg[tab]=[];if(on&&!cfg[tab].includes(key))cfg[tab].push(key);if(!on)cfg[tab]=cfg[tab].filter(k=>k!==key);saveWidgetConfig(cfg);renderWidgets(tab);}
function removeWidget(tab,key){const cfg=getWidgetConfig();if(cfg[tab])cfg[tab]=cfg[tab].filter(k=>k!==key);saveWidgetConfig(cfg);renderWidgets(tab);}
function renderAllWidgets(){['docs','progress','material','data','team'].forEach(renderWidgets);}
function renderWidgets(tab){const area=document.getElementById('widgetsArea-'+tab);if(!area)return;const cfg=getWidgetConfig(),en=cfg[tab]||[];if(!en.length){area.innerHTML='';return;}area.innerHTML=en.map(key=>{const val=computeWidgetValue(key),def=Object.values(WIDGET_DEFS).flat().find(w=>w.key===key);return `<div class="widget-card"><span class="w-close" onclick="removeWidget('${tab}','${key}')">✕</span><h5>${def?.label||key}</h5><div class="w-value">${val.value}</div><div class="w-sub">${val.sub}</div></div>`;}).join('');}
function getWeekStart(){const d=new Date(),day=d.getDay()||7;d.setDate(d.getDate()-day+1);return d.toISOString().split('T')[0];}
function computeWidgetValue(key){
  const docs=loadData('docs'),tasks=loadData('tasks'),mats=loadData('materials'),rows=loadData('dataRows'),msgs=loadData('messages'),todos=loadData('todos'),t=today();
  switch(key){
    case'doc_total':return{value:docs.length,sub:'篇文档'};case'doc_recent':return{value:docs.filter(d=>d.updatedAt>=getWeekStart()).length,sub:'本周更新'};case'doc_draft':return{value:docs.filter(d=>d.status==='草稿').length,sub:'待完善'};
    case'task_overdue':return{value:tasks.filter(x=>x.due&&x.due<t&&x.status!=='已完成').length,sub:'需处理'};case'task_today':return{value:tasks.filter(x=>x.due===t&&x.status!=='已完成').length,sub:'今日截止'};
    case'task_rate':{const done=tasks.filter(x=>x.status==='已完成').length;return{value:tasks.length?Math.round(done/tasks.length*100)+'%':'0%',sub:done+'/'+tasks.length};}
    case'mat_hot':return{value:mats.filter(m=>parseFloat(m.roi)>1.5).length,sub:'ROI>1.5'};case'mat_review':return{value:mats.filter(m=>m.status==='待审核').length,sub:'等待审核'};
    case'mat_cost_total':{const c=mats.reduce((s,m)=>s+(parseFloat(m.cost)||0),0);return{value:c.toFixed(1)+'w',sub:'万元'};}
    case'data_cost_week':{const c=rows.filter(r=>r.date>=getWeekStart()).reduce((s,r)=>s+(parseFloat(r.cost)||0),0);return{value:'¥'+c.toFixed(1)+'w',sub:'本周'};}
    case'data_user_week':{const u=rows.filter(r=>r.date>=getWeekStart()).reduce((s,r)=>s+(parseInt(r.users)||0),0);return{value:u.toLocaleString(),sub:'本周新增'};}
    case'data_best_ch':{const m={};rows.forEach(r=>{if(!m[r.channel])m[r.channel]={roi:0,n:0};m[r.channel].roi+=parseFloat(r.roi)||0;m[r.channel].n++;});let b='-',bv=0;Object.entries(m).forEach(([c,v])=>{const a=v.roi/v.n;if(a>bv){bv=a;b=c;}});return{value:b,sub:'ROI '+bv.toFixed(2)};}
    case'team_msg_count':return{value:msgs.length,sub:'条记录'};case'team_todo_open':return{value:todos.filter(t=>!t.done).length,sub:'未完成'};case'team_todo_urgent':return{value:todos.filter(t=>t.priority==='紧急'&&!t.done).length,sub:'紧急待办'};
    default:return{value:'-',sub:''};
  }
}

// ===== Week Focus =====
function initWeekFocus(){const d=loadObj('weekFocus'),el=document.getElementById('weekFocusBody');if(el)el.textContent=d['week_'+getWeekStart()]||'';}
function saveWeekFocus(){const el=document.getElementById('weekFocusBody'),d=loadObj('weekFocus');d['week_'+getWeekStart()]=el.textContent;saveData('weekFocus',d);document.getElementById('weekFocusSaveBtn').style.display='none';}

// ===== Docs =====
let editingDocId=null,activeDocFilter='全部';
function getDocCategories(){return['全部',...getSubCategories('docs')];}
function renderDocFilterTags(){document.getElementById('docFilterTags').innerHTML=getDocCategories().map(c=>`<span class="filter-tag ${activeDocFilter===c?'active':''}" onclick="activeDocFilter='${c}';renderDocs()">${c}</span>`).join('');}
function renderDocCategorySelect(){document.getElementById('docCategorySelect').innerHTML=getSubCategories('docs').map(c=>`<option value="${c}">${c}</option>`).join('');}
function renderQuickCatSelect(){document.getElementById('docQuickCatSelect').innerHTML=getSubCategories('docs').map(c=>`<option value="${c}">${c}</option>`).join('');}
function autoDetectTitle(url){url=url.trim();const ti=document.getElementById('docQuickTitleInput');if(!url){ti.value='';return;}let name='';try{const u=new URL(url),host=u.hostname.replace('www.','');if(host.includes('docs.qq.com'))name='腾讯文档';else if(host.includes('feishu.cn'))name='飞书文档';else if(host.includes('notion.so'))name='Notion文档';else if(host.includes('shimo.im'))name='石墨文档';else if(host.includes('yuque.com'))name='语雀文档';else if(host.includes('kdocs.cn'))name='WPS文档';else name=host.split('.')[0];}catch{name='外部文档';}ti.value=name;}
function openDocLinkQuick(){document.getElementById('docQuickLinkInput').value='';document.getElementById('docQuickTitleInput').value='';renderQuickCatSelect();openModal('docLinkQuickModal');setTimeout(()=>document.getElementById('docQuickLinkInput').focus(),100);}
function saveQuickDoc(){const link=document.getElementById('docQuickLinkInput').value.trim();if(!link){alert('请粘贴链接');return;}const title=document.getElementById('docQuickTitleInput').value.trim()||'外部文档',cat=document.getElementById('docQuickCatSelect').value,docs=loadData('docs');docs.unshift({id:genId(),title,link,category:cat,author:'',status:'已发布',content:'',createdAt:today(),updatedAt:today()});saveData('docs',docs);closeModal('docLinkQuickModal');renderDocs();}
function openDocModalFull(id){editingDocId=id||null;document.getElementById('docModalTitle').textContent=id?'编辑文档':'新建文档';renderDocCategorySelect();if(id){const d=loadData('docs').find(x=>x.id===id);if(!d)return;document.getElementById('docTitleInput').value=d.title;document.getElementById('docCategorySelect').value=d.category;document.getElementById('docAuthorInput').value=d.author;document.getElementById('docStatusSelect').value=d.status;document.getElementById('docContentInput').value=d.content||'';document.getElementById('docLinkInput').value=d.link||'';}else{['docTitleInput','docAuthorInput','docContentInput','docLinkInput'].forEach(id=>document.getElementById(id).value='');document.getElementById('docCategorySelect').value=getSubCategories('docs')[0]||'其他';document.getElementById('docStatusSelect').value='草稿';}openModal('docModal');}
function renderDocs(){
  renderDocFilterTags();const docs=loadData('docs'),sort=document.getElementById('docSortSelect').value;
  let filtered=activeDocFilter==='全部'?docs:docs.filter(d=>d.category===activeDocFilter);
  filtered.sort((a,b)=>{if(sort==='updated')return(b.updatedAt||b.createdAt).localeCompare(a.updatedAt||a.createdAt);if(sort==='created')return b.createdAt.localeCompare(a.createdAt);return a.title.localeCompare(b.title);});
  const wrap=document.getElementById('docList');
  if(!filtered.length){wrap.innerHTML='<div class="doc-empty">暂无文档，点击「+ 添加链接」快速添加</div>';return;}
  const renderCard=d=>{const hl=d.link&&d.link.trim();return`<div class="doc-card ${hl?'has-link':''}" onclick="docCardClick('${d.id}')"><div class="doc-card-body"><h4>${hl?'<span class="link-icon">🔗</span>':''}${esc(d.title)}</h4><p>${esc((d.content||d.link||'').slice(0,80))}</p></div><div class="doc-card-footer"><span>${d.author?'👤 '+esc(d.author)+' · ':''}${d.updatedAt||d.createdAt}</span><div class="doc-card-actions" onclick="event.stopPropagation()"><button onclick="editDoc('${d.id}')">✏️</button><button onclick="deleteDoc('${d.id}')">🗑️</button></div></div></div>`;};
  if(activeDocFilter==='全部'){
    const cats=getSubCategories('docs'),grouped={};cats.forEach(c=>{grouped[c]=[];});
    filtered.forEach(d=>{if(grouped[d.category])grouped[d.category].push(d);else{if(!grouped['其他'])grouped['其他']=[];grouped['其他'].push(d);}});
    wrap.innerHTML=Object.entries(grouped).filter(([,list])=>list.length>0).map(([cat,list])=>`<div class="doc-group"><div class="doc-group-header"><span class="doc-group-title">${esc(cat)}</span><span class="doc-group-count">${list.length} 篇</span></div><div class="doc-group-list">${list.map(renderCard).join('')}</div></div>`).join('');
  }else{
    wrap.innerHTML='<div class="doc-group-list">'+filtered.map(renderCard).join('')+'</div>';
  }
  renderWidgets('docs');
}
function docCardClick(id){const d=loadData('docs').find(x=>x.id===id);if(!d)return;if(d.link&&d.link.trim())window.open(d.link.trim(),'_blank');else editDoc(id);}
function saveDoc(){const title=document.getElementById('docTitleInput').value.trim(),link=document.getElementById('docLinkInput').value.trim();if(!title&&!link){alert('请至少输入标题或链接');return;}const docs=loadData('docs'),data={title:title||link,category:document.getElementById('docCategorySelect').value,author:document.getElementById('docAuthorInput').value.trim()||'',status:document.getElementById('docStatusSelect').value,content:document.getElementById('docContentInput').value,link,updatedAt:today()};if(editingDocId){const idx=docs.findIndex(d=>d.id===editingDocId);if(idx>=0)Object.assign(docs[idx],data);}else{data.id=genId();data.createdAt=today();docs.unshift(data);}saveData('docs',docs);closeModal('docModal');renderDocs();}
function editDoc(id){openDocModalFull(id);}
function deleteDoc(id){if(!confirm('确定删除？'))return;saveData('docs',loadData('docs').filter(d=>d.id!==id));renderDocs();}

// ===== Tasks (Calendar) =====
let editingTaskId=null,calYear=2026,calMonth=3;
function renderTasks(){
  const tasks=loadData('tasks'),pending=tasks.filter(t=>t.status==='待开始'),doing=tasks.filter(t=>t.status==='进行中'),done=tasks.filter(t=>t.status==='已完成');
  document.getElementById('progressSummary').innerHTML=`<div class="progress-stat-card"><div class="stat-num">${tasks.length}</div><div class="stat-label">总任务</div></div><div class="progress-stat-card"><div class="stat-num" style="color:var(--orange)">${pending.length}</div><div class="stat-label">待开始</div></div><div class="progress-stat-card"><div class="stat-num" style="color:var(--primary-light)">${doing.length}</div><div class="stat-label">进行中</div></div><div class="progress-stat-card"><div class="stat-num" style="color:var(--green)">${done.length}</div><div class="stat-label">已完成</div></div><div class="progress-stat-card"><div class="stat-num">${tasks.length?Math.round(done.length/tasks.length*100):0}%</div><div class="stat-label">完成率</div></div>`;
  renderCalendar();renderWidgets('progress');
}
function renderCalendar(){
  const titleEl=document.getElementById('calMonthTitle'),daysEl=document.getElementById('calDays');if(!titleEl||!daysEl)return;
  const mn=['1月','2月','3月','4月','5月','6月','7月','8月','9月','10月','11月','12月'];titleEl.textContent=calYear+'年 '+mn[calMonth];
  const fd=new Date(calYear,calMonth,1),ld=new Date(calYear,calMonth+1,0),dim=ld.getDate();let sd=fd.getDay()-1;if(sd<0)sd=6;
  const ts=today(),tasks=loadData('tasks'),tm={};tasks.forEach(t=>{if(!t.due)return;if(!tm[t.due])tm[t.due]=[];tm[t.due].push(t);});
  let html='';const pml=new Date(calYear,calMonth,0).getDate();
  for(let i=sd-1;i>=0;i--){const d=pml-i,pm=calMonth===0?11:calMonth-1,py=calMonth===0?calYear-1:calYear,ds=`${py}-${String(pm+1).padStart(2,'0')}-${String(d).padStart(2,'0')}`;html+=renderCalDay(d,ds,tm[ds]||[],true,ts);}
  for(let d=1;d<=dim;d++){const ds=`${calYear}-${String(calMonth+1).padStart(2,'0')}-${String(d).padStart(2,'0')}`,dow=new Date(calYear,calMonth,d).getDay();html+=renderCalDay(d,ds,tm[ds]||[],false,ts,dow===0||dow===6);}
  const total=sd+dim,rem=total%7===0?0:7-total%7;
  for(let d=1;d<=rem;d++){const nm=calMonth===11?0:calMonth+1,ny=calMonth===11?calYear+1:calYear,ds=`${ny}-${String(nm+1).padStart(2,'0')}-${String(d).padStart(2,'0')}`;html+=renderCalDay(d,ds,tm[ds]||[],true,ts);}
  daysEl.innerHTML=html;
}
function renderCalDay(dn,ds,tasks,isOther,ts,isWe){
  tasks.sort((a,b)=>({'P0':0,'P1':1,'P2':2}[a.priority]||2)-({'P0':0,'P1':1,'P2':2}[b.priority]||2));
  let cls='cal-day';if(isOther)cls+=' other-month';if(ds===ts)cls+=' is-today';if(isWe)cls+=' is-weekend';
  let h=`<div class="${cls}" onclick="openDayDetail('${ds}')"><span class="cal-day-add" onclick="event.stopPropagation();openTaskModalForDate('${ds}')">+</span><div class="cal-day-num">${ds===ts?'<span>'+dn+'</span>':dn}</div><div class="cal-day-tasks">`;
  tasks.slice(0,3).forEach(t=>{h+=`<div class="cal-task-pill st-${t.status} p-${t.priority}" onclick="event.stopPropagation();editTask('${t.id}')" title="${esc(t.name)}">${esc(t.name)}</div>`;});
  if(tasks.length>3)h+=`<div class="cal-day-more">+${tasks.length-3} 更多</div>`;
  return h+'</div></div>';
}
function calPrevMonth(){calMonth--;if(calMonth<0){calMonth=11;calYear--;}renderCalendar();}
function calNextMonth(){calMonth++;if(calMonth>11){calMonth=0;calYear++;}renderCalendar();}
function calGoToday(){const d=new Date();calYear=d.getFullYear();calMonth=d.getMonth();renderCalendar();}
function openDayDetail(ds){
  const tasks=loadData('tasks').filter(t=>t.due===ds),d=new Date(ds+'T00:00:00'),wd=['日','一','二','三','四','五','六'];
  document.getElementById('dayDetailTitle').textContent=ds+' 周'+wd[d.getDay()];
  const body=document.getElementById('dayDetailBody');
  if(!tasks.length){body.innerHTML='<div class="day-empty">当天暂无任务</div>';}
  else{body.innerHTML='<div class="day-task-list">'+tasks.sort((a,b)=>({'P0':0,'P1':1,'P2':2}[a.priority]||2)-({'P0':0,'P1':1,'P2':2}[b.priority]||2)).map(t=>{const isDone=t.status==='已完成',si=isDone?'✅':t.status==='进行中'?'🔄':'⏳';return`<div class="day-task-item"><span class="dti-status" onclick="cycleDayTaskStatus('${t.id}','${ds}')">${si}</span><div class="dti-info"><div class="dti-name ${isDone?'done':''}">${esc(t.name)}</div><div class="dti-meta"><span class="priority-tag p-${t.priority}" style="font-size:10px;padding:1px 6px;border-radius:4px">${t.priority}</span>${t.owner?'<span>👤 '+esc(t.owner)+'</span>':''}<span>${t.status}</span></div></div><div class="dti-actions"><button onclick="closeModal('dayDetailModal');editTask('${t.id}')">✏️</button><button class="del" onclick="deleteDayTask('${t.id}','${ds}')">🗑️</button></div></div>`;}).join('')+'</div>';}
  document.getElementById('dayAddTaskBtn').onclick=()=>{closeModal('dayDetailModal');openTaskModalForDate(ds);};openModal('dayDetailModal');
}
function cycleDayTaskStatus(tid,ds){const tasks=loadData('tasks'),t=tasks.find(x=>x.id===tid);if(!t)return;t.status={'待开始':'进行中','进行中':'已完成','已完成':'待开始'}[t.status]||'待开始';t.updatedAt=today();saveData('tasks',tasks);openDayDetail(ds);renderTasks();}
function deleteDayTask(tid,ds){if(!confirm('确定删除？'))return;saveData('tasks',loadData('tasks').filter(t=>t.id!==tid));openDayDetail(ds);renderTasks();}
function openTaskModalForDate(ds){editingTaskId=null;document.getElementById('taskModalTitle').textContent='新建任务 - '+ds;document.getElementById('taskDeleteBtn').style.display='none';['taskNameInput','taskOwnerInput','taskDescInput'].forEach(id=>document.getElementById(id).value='');document.getElementById('taskPrioritySelect').value='P1';document.getElementById('taskDueInput').value=ds;document.getElementById('taskStatusSelect').value='待开始';openModal('taskModal');}
function openTaskModal(id){editingTaskId=id||null;document.getElementById('taskModalTitle').textContent=id?'编辑任务':'新建任务';document.getElementById('taskDeleteBtn').style.display=id?'block':'none';if(id){const t=loadData('tasks').find(x=>x.id===id);if(!t)return;document.getElementById('taskNameInput').value=t.name;document.getElementById('taskPrioritySelect').value=t.priority;document.getElementById('taskOwnerInput').value=t.owner||'';document.getElementById('taskDueInput').value=t.due||'';document.getElementById('taskStatusSelect').value=t.status;document.getElementById('taskDescInput').value=t.desc||'';}else{['taskNameInput','taskOwnerInput','taskDescInput'].forEach(id=>document.getElementById(id).value='');document.getElementById('taskPrioritySelect').value='P1';document.getElementById('taskDueInput').value=today();document.getElementById('taskStatusSelect').value='待开始';}openModal('taskModal');}
function saveTask(){const name=document.getElementById('taskNameInput').value.trim();if(!name){alert('请输入任务名称');return;}const tasks=loadData('tasks'),data={name,priority:document.getElementById('taskPrioritySelect').value,owner:document.getElementById('taskOwnerInput').value.trim(),due:document.getElementById('taskDueInput').value,status:document.getElementById('taskStatusSelect').value,desc:document.getElementById('taskDescInput').value,updatedAt:today()};if(editingTaskId){const idx=tasks.findIndex(t=>t.id===editingTaskId);if(idx>=0)Object.assign(tasks[idx],data);}else{data.id=genId();data.createdAt=today();tasks.push(data);}saveData('tasks',tasks);closeModal('taskModal');renderTasks();}
function editTask(id){openTaskModal(id);}
function deleteTask(){if(!confirm('确定删除？'))return;saveData('tasks',loadData('tasks').filter(t=>t.id!==editingTaskId));closeModal('taskModal');renderTasks();}

// ===== Materials (月日历) =====
let editingMatId=null,matCalYear=2026,matCalMonth=3;
function renderMaterials(){renderMatCal();}
function matCalPrev(){matCalMonth--;if(matCalMonth<0){matCalMonth=11;matCalYear--;}renderMatCal();}
function matCalNext(){matCalMonth++;if(matCalMonth>11){matCalMonth=0;matCalYear++;}renderMatCal();}
function matCalToday(){const d=new Date();matCalYear=d.getFullYear();matCalMonth=d.getMonth();renderMatCal();}
function renderMatCal(){
  const titleEl=document.getElementById('matCalTitle'),daysEl=document.getElementById('matCalDays');if(!titleEl||!daysEl)return;
  const mn=['1月','2月','3月','4月','5月','6月','7月','8月','9月','10月','11月','12月'];
  titleEl.textContent=matCalYear+'年 '+mn[matCalMonth];
  const fd=new Date(matCalYear,matCalMonth,1),ld=new Date(matCalYear,matCalMonth+1,0),dim=ld.getDate();
  let sd=fd.getDay()-1;if(sd<0)sd=6;
  const ts=today(),mats=loadData('materials'),tm={};
  mats.forEach(m=>{const d=m.matDate||m.createdAt||m.updatedAt;if(!d)return;if(!tm[d])tm[d]=[];tm[d].push(m);});
  let html='';
  const pml=new Date(matCalYear,matCalMonth,0).getDate();
  for(let i=sd-1;i>=0;i--){const d=pml-i,pm=matCalMonth===0?11:matCalMonth-1,py=matCalMonth===0?matCalYear-1:matCalYear,ds=`${py}-${String(pm+1).padStart(2,'0')}-${String(d).padStart(2,'0')}`;html+=renderMatDay(d,ds,tm[ds]||[],true,ts);}
  for(let d=1;d<=dim;d++){const ds=`${matCalYear}-${String(matCalMonth+1).padStart(2,'0')}-${String(d).padStart(2,'0')}`,dow=new Date(matCalYear,matCalMonth,d).getDay();html+=renderMatDay(d,ds,tm[ds]||[],false,ts,dow===0||dow===6);}
  const total=sd+dim,rem=total%7===0?0:7-total%7;
  for(let d=1;d<=rem;d++){const nm=matCalMonth===11?0:matCalMonth+1,ny=matCalMonth===11?matCalYear+1:matCalYear,ds=`${ny}-${String(nm+1).padStart(2,'0')}-${String(d).padStart(2,'0')}`;html+=renderMatDay(d,ds,tm[ds]||[],true,ts);}
  daysEl.innerHTML=html;
}
function renderMatDay(dn,ds,items,isOther,ts,isWe){
  let cls='cal-day';if(isOther)cls+=' other-month';if(ds===ts)cls+=' is-today';if(isWe)cls+=' is-weekend';
  let h=`<div class="${cls}" onclick="openMatDayDetail('${ds}')"><span class="cal-day-add" onclick="event.stopPropagation();openMatModalForDate('${ds}')">+</span><div class="cal-day-num">${ds===ts?'<span>'+dn+'</span>':dn}</div><div class="cal-day-tasks">`;
  items.slice(0,3).forEach(m=>{
    const stCls=m.status==='投放中'?'st-进行中':'st-已完成';
    h+=`<div class="cal-task-pill ${stCls}" onclick="event.stopPropagation();editMaterial('${m.id}')" title="${esc(m.mapName||'')} · ${esc(m.channel||'')}">🗺️${esc(m.mapName||'未命名')} · ${esc(m.channel||'')}</div>`;
  });
  if(items.length>3)h+=`<div class="cal-day-more">+${items.length-3} 更多</div>`;
  return h+'</div></div>';
}
function openMatDayDetail(ds){
  const mats=loadData('materials').filter(m=>(m.matDate||m.createdAt||m.updatedAt)===ds);
  const d=new Date(ds+'T00:00:00'),wd=['日','一','二','三','四','五','六'];
  document.getElementById('matDayTitle').textContent=ds+' 周'+wd[d.getDay()]+' 投放情况';
  const body=document.getElementById('matDayBody');
  if(!mats.length){body.innerHTML='<div class="day-empty">当天无投放素材</div>';}
  else{body.innerHTML='<div class="day-task-list">'+mats.map(m=>{
    const icon=m.status==='投放中'?'▶️':'⏹️';
    return`<div class="day-task-item"><span class="dti-status" onclick="toggleMatStatus('${m.id}','${ds}')" title="点击切换状态">${icon}</span><div class="dti-info"><div class="dti-name">🗺️ ${esc(m.mapName||'未命名')}</div><div class="dti-meta"><span>📺 ${esc(m.channel||'-')}</span><span>${m.status}</span>${m.note?'<span>📝 '+esc(m.note)+'</span>':''}</div></div><div class="dti-actions"><button onclick="closeModal('matDayModal');editMaterial('${m.id}')">✏️</button><button class="del" onclick="deleteMatFromDay('${m.id}','${ds}')">🗑️</button></div></div>`;
  }).join('')+'</div>';}
  document.getElementById('matDayAddBtn').onclick=()=>{closeModal('matDayModal');openMatModalForDate(ds);};
  openModal('matDayModal');
}
function toggleMatStatus(id,ds){const mats=loadData('materials'),m=mats.find(x=>x.id===id);if(!m)return;m.status=m.status==='投放中'?'已下线':'投放中';m.updatedAt=today();saveData('materials',mats);openMatDayDetail(ds);renderMatCal();}
function deleteMatFromDay(id,ds){if(!confirm('确定删除？'))return;saveData('materials',loadData('materials').filter(m=>m.id!==id));openMatDayDetail(ds);renderMatCal();}
function openMatModalForDate(ds){editingMatId=null;document.getElementById('materialModalTitle').textContent='新增素材 - '+ds;document.getElementById('matDeleteBtn').style.display='none';document.getElementById('matMapInput').value='';document.getElementById('matChannelInput').value='';document.getElementById('matDateInput').value=ds;document.getElementById('matStatusSelect').value='投放中';document.getElementById('matNoteInput').value='';openModal('materialModal');}
function openMaterialModal(id){editingMatId=id||null;document.getElementById('materialModalTitle').textContent=id?'编辑素材':'新增素材';document.getElementById('matDeleteBtn').style.display=id?'block':'none';if(id){const m=loadData('materials').find(x=>x.id===id);if(!m)return;document.getElementById('matMapInput').value=m.mapName||'';document.getElementById('matChannelInput').value=m.channel||'';document.getElementById('matDateInput').value=m.matDate||'';document.getElementById('matStatusSelect').value=m.status||'投放中';document.getElementById('matNoteInput').value=m.note||'';}else{document.getElementById('matMapInput').value='';document.getElementById('matChannelInput').value='';document.getElementById('matDateInput').value=today();document.getElementById('matStatusSelect').value='投放中';document.getElementById('matNoteInput').value='';}openModal('materialModal');}
function saveMaterial(){const mapName=document.getElementById('matMapInput').value.trim();if(!mapName){alert('请输入地图名称');return;}const mats=loadData('materials'),data={name:mapName,mapName,channel:document.getElementById('matChannelInput').value.trim(),matDate:document.getElementById('matDateInput').value,status:document.getElementById('matStatusSelect').value,note:document.getElementById('matNoteInput').value,updatedAt:today()};if(editingMatId){const idx=mats.findIndex(m=>m.id===editingMatId);if(idx>=0)Object.assign(mats[idx],data);}else{data.id=genId();data.createdAt=today();mats.push(data);}saveData('materials',mats);closeModal('materialModal');renderMatCal();}
function editMaterial(id){openMaterialModal(id);}
function deleteMaterial(){if(!confirm('确定删除？'))return;saveData('materials',loadData('materials').filter(m=>m.id!==editingMatId));closeModal('materialModal');renderMatCal();}
function deleteMaterialDirect(id){if(!confirm('确定删除？'))return;saveData('materials',loadData('materials').filter(m=>m.id!==id));renderMatCal();}

// ===== Data =====
let editingDataId=null;
function renderDataSection(){renderDataKPI();renderDataDateFilter();renderDataTable();renderWidgets('data');}
function renderDataKPI(){const rows=loadData('dataRows'),tc=rows.reduce((s,r)=>s+(parseFloat(r.cost)||0),0),tu=rows.reduce((s,r)=>s+(parseInt(r.users)||0),0),ac=tu>0?(tc*10000/tu).toFixed(2):'-',ar=rows.length?(rows.reduce((s,r)=>s+(parseFloat(r.roi)||0),0)/rows.length).toFixed(2):'-';document.getElementById('dataKPIGrid').innerHTML=`<div class="data-kpi"><div class="kpi-title">总消耗</div><div class="kpi-value">¥${tc.toFixed(1)}w</div></div><div class="data-kpi"><div class="kpi-title">总新增用户</div><div class="kpi-value">${tu.toLocaleString()}</div></div><div class="data-kpi"><div class="kpi-title">平均CPA</div><div class="kpi-value">¥${ac}</div></div><div class="data-kpi"><div class="kpi-title">平均ROI</div><div class="kpi-value">${ar}</div></div>`;}
function renderDataDateFilter(){const rows=loadData('dataRows'),dates=[...new Set(rows.map(r=>r.date))].sort().reverse();document.getElementById('dataDateFilter').innerHTML='<option value="all">全部日期</option>'+dates.map(d=>`<option value="${d}">${d}</option>`).join('');}
function renderDataTable(){const rows=loadData('dataRows'),df=document.getElementById('dataDateFilter').value;let filtered=df==='all'?rows:rows.filter(r=>r.date===df);filtered.sort((a,b)=>b.date.localeCompare(a.date)||a.channel.localeCompare(b.channel));const tbody=document.getElementById('dataTableBody');if(!filtered.length){tbody.innerHTML='<tr><td colspan="10" style="text-align:center;color:var(--text-muted);padding:40px">暂无数据</td></tr>';return;}tbody.innerHTML=filtered.map(r=>{const ctr=(parseFloat(r.clicks)||0)>0&&(parseFloat(r.exposure)||0)>0?((parseFloat(r.clicks)/parseFloat(r.exposure))*100).toFixed(1)+'%':'-';const cpa=(parseInt(r.users)||0)>0?((parseFloat(r.cost)||0)*10000/parseInt(r.users)).toFixed(2):'-';return`<tr><td>${r.date}</td><td>${esc(r.channel)}</td><td>${r.cost||'-'}</td><td>${r.exposure||'-'}</td><td>${r.clicks||'-'}</td><td>${ctr}</td><td>${(parseInt(r.users)||0).toLocaleString()}</td><td>${cpa}</td><td>${r.roi||'-'}</td><td><button class="action-btn" onclick="editDataRow('${r.id}')">✏️</button><button class="action-btn" onclick="deleteDataRowDirect('${r.id}')">🗑️</button></td></tr>`;}).join('');}
function openDataModal(id){editingDataId=id||null;document.getElementById('dataModalTitle').textContent=id?'编辑数据':'新增渠道数据';document.getElementById('dataDeleteBtn').style.display=id?'block':'none';if(id){const r=loadData('dataRows').find(x=>x.id===id);if(!r)return;document.getElementById('dataDateInput').value=r.date;document.getElementById('dataChannelSelect').value=r.channel;document.getElementById('dataCostInput').value=r.cost||'';document.getElementById('dataExposureInput').value=r.exposure||'';document.getElementById('dataClickInput').value=r.clicks||'';document.getElementById('dataUserInput').value=r.users||'';document.getElementById('dataROIInput').value=r.roi||'';}else{document.getElementById('dataDateInput').value=today();document.getElementById('dataChannelSelect').value='抖音';['dataCostInput','dataExposureInput','dataClickInput','dataUserInput','dataROIInput'].forEach(id=>document.getElementById(id).value='');}openModal('dataModal');}
function saveDataRow(){const date=document.getElementById('dataDateInput').value;if(!date){alert('请选择日期');return;}const rows=loadData('dataRows'),data={date,channel:document.getElementById('dataChannelSelect').value,cost:document.getElementById('dataCostInput').value,exposure:document.getElementById('dataExposureInput').value,clicks:document.getElementById('dataClickInput').value,users:document.getElementById('dataUserInput').value,roi:document.getElementById('dataROIInput').value};if(editingDataId){const idx=rows.findIndex(r=>r.id===editingDataId);if(idx>=0)Object.assign(rows[idx],data);}else{data.id=genId();rows.push(data);}saveData('dataRows',rows);closeModal('dataModal');renderDataSection();setTimeout(renderDataChart,150);}
function editDataRow(id){openDataModal(id);}
function deleteDataRow(){if(!confirm('确定删除？'))return;saveData('dataRows',loadData('dataRows').filter(r=>r.id!==editingDataId));closeModal('dataModal');renderDataSection();}
function deleteDataRowDirect(id){if(!confirm('确定删除？'))return;saveData('dataRows',loadData('dataRows').filter(r=>r.id!==id));renderDataSection();}
function exportDataCSV(){const rows=loadData('dataRows');if(!rows.length){alert('暂无数据');return;}let csv='\uFEFF日期,渠道,消耗(万),曝光(万),点击(万),新增用户,ROI\n';rows.forEach(r=>{csv+=`${r.date},${r.channel},${r.cost||''},${r.exposure||''},${r.clicks||''},${r.users||''},${r.roi||''}\n`;});const a=document.createElement('a');a.href=URL.createObjectURL(new Blob([csv],{type:'text/csv'}));a.download=`买量数据_${today()}.csv`;a.click();}
let dataTrendChartInstance=null;
function renderDataChart(){const ctx=document.getElementById('dataTrendChart');if(!ctx)return;const rows=loadData('dataRows'),dateMap={};rows.forEach(r=>{if(!dateMap[r.date])dateMap[r.date]={cost:0,users:0};dateMap[r.date].cost+=parseFloat(r.cost)||0;dateMap[r.date].users+=parseInt(r.users)||0;});const dates=Object.keys(dateMap).sort(),costs=dates.map(d=>dateMap[d].cost),users=dates.map(d=>dateMap[d].users/1000);if(dataTrendChartInstance)dataTrendChartInstance.destroy();if(!dates.length)return;const isDark=(localStorage.getItem(STORAGE_KEYS.theme)||'dark')==='dark',gc=isDark?'rgba(42,42,69,.5)':'rgba(0,0,0,.08)',tc=isDark?'#55557a':'#999';dataTrendChartInstance=new Chart(ctx,{type:'line',data:{labels:dates,datasets:[{label:'消耗(万)',data:costs,borderColor:'#6c5ce7',backgroundColor:'rgba(108,92,231,.1)',fill:true,tension:.4,borderWidth:2,pointRadius:4,pointBackgroundColor:'#6c5ce7'},{label:'新增(千人)',data:users,borderColor:'#00cec9',backgroundColor:'rgba(0,206,201,.08)',fill:true,tension:.4,borderWidth:2,pointRadius:4,pointBackgroundColor:'#00cec9'}]},options:{responsive:true,maintainAspectRatio:false,plugins:{legend:{labels:{color:tc,font:{size:11},boxWidth:12}}},scales:{x:{grid:{color:gc},ticks:{color:tc,font:{size:11}}},y:{grid:{color:gc},ticks:{color:tc,font:{size:11}}}}}});}

// ===== Team =====
function renderMessages(){const msgs=loadData('messages'),wrap=document.getElementById('msgList');if(!msgs.length){wrap.innerHTML='<div class="doc-empty">暂无消息</div>';return;}wrap.innerHTML=msgs.map(m=>`<div class="msg-item"><div class="msg-head"><span class="msg-author">${esc(m.author)}</span><span class="msg-time">${m.time}</span></div><div class="msg-text">${esc(m.content)}</div><div class="msg-del" onclick="deleteMessage('${m.id}')">删除</div></div>`).join('');}
function addMessage(){const author=document.getElementById('msgAuthorInput').value.trim()||'匿名',content=document.getElementById('msgContentInput').value.trim();if(!content){alert('请输入内容');return;}const msgs=loadData('messages');msgs.unshift({id:genId(),author,content,time:nowStr()});saveData('messages',msgs);document.getElementById('msgContentInput').value='';renderMessages();renderWidgets('team');}
function deleteMessage(id){if(!confirm('删除此消息？'))return;saveData('messages',loadData('messages').filter(m=>m.id!==id));renderMessages();renderWidgets('team');}
function renderTodos(){const todos=loadData('todos'),wrap=document.getElementById('teamTodoList');if(!todos.length){wrap.innerHTML='<div class="doc-empty" style="padding:30px">暂无待办</div>';return;}wrap.innerHTML=todos.map(t=>`<div class="todo-item ${t.priority==='紧急'?'urgent':''}"><input type="checkbox" ${t.done?'checked':''} onchange="toggleTodo('${t.id}')"><div class="todo-info"><div class="todo-title ${t.done?'done':''}">${esc(t.title)}</div><div class="todo-sub">${esc(t.assign||'')} ${t.due?'· 截止 '+t.due:''}</div></div><span class="todo-del" onclick="deleteTodo('${t.id}')">✕</span></div>`).join('');}
function openTodoModal(){['todoTitleInput','todoAssignInput'].forEach(id=>document.getElementById(id).value='');document.getElementById('todoDueInput').value=today();document.getElementById('todoPrioritySelect').value='普通';openModal('todoModal');}
function saveTodo(){const title=document.getElementById('todoTitleInput').value.trim();if(!title){alert('请输入待办内容');return;}const todos=loadData('todos');todos.unshift({id:genId(),title,assign:document.getElementById('todoAssignInput').value.trim(),due:document.getElementById('todoDueInput').value,priority:document.getElementById('todoPrioritySelect').value,done:false});saveData('todos',todos);closeModal('todoModal');renderTodos();renderWidgets('team');}
function toggleTodo(id){const todos=loadData('todos'),t=todos.find(x=>x.id===id);if(t)t.done=!t.done;saveData('todos',todos);renderTodos();renderWidgets('team');}
function deleteTodo(id){saveData('todos',loadData('todos').filter(t=>t.id!==id));renderTodos();renderWidgets('team');}

// ===== Export/Import =====
function exportAllData(){const data={};Object.keys(STORAGE_KEYS).forEach(k=>{try{data[k]=JSON.parse(localStorage.getItem(STORAGE_KEYS[k]));}catch{data[k]=null;}});const a=document.createElement('a');a.href=URL.createObjectURL(new Blob([JSON.stringify(data,null,2)],{type:'application/json'}));a.download=`元梦之星买量知识库_${today()}.json`;a.click();}
function importAllData(event){const file=event.target.files[0];if(!file)return;const reader=new FileReader();reader.onload=(e)=>{try{const data=JSON.parse(e.target.result);if(confirm('导入将覆盖当前所有数据，确定？')){Object.keys(STORAGE_KEYS).forEach(k=>{if(data[k]!==undefined)localStorage.setItem(STORAGE_KEYS[k],JSON.stringify(data[k]));});if(isCloudEnabled()) scheduleSyncPush();location.reload();}}catch{alert('格式错误');}};reader.readAsText(file);event.target.value='';}

// ===== Gist 配置管理 =====
function openGistConfigModal(){
  const cfg = getGistConfig() || {};
  document.getElementById('gistTokenInput').value = cfg.token || '';
  document.getElementById('gistIdInput').value = cfg.gistId || '';
  openModal('gistConfigModal');
}

async function saveGistConfigFromUI(){
  const token = document.getElementById('gistTokenInput').value.trim();
  const gistId = document.getElementById('gistIdInput').value.trim();
  if(!token || !gistId){ alert('请填写完整的 Token 和 Gist ID'); return; }
  const btn = document.querySelector('#gistConfigModal .btn-primary');
  btn.textContent = '验证中...'; btn.disabled = true;
  try {
    const resp = await fetch('https://api.github.com/gists/'+gistId, {
      headers: {'Authorization':'token '+token,'Accept':'application/vnd.github.v3+json'}
    });
    if(!resp.ok) throw new Error('无法访问 Gist ('+resp.status+')');
    saveGistConfig({token, gistId});
    closeModal('gistConfigModal');
    updateSyncStatus('success','云同步已配置');
    if(confirm('是否立即将本地数据上传到云端？（其他设备将看到这些数据）')){
      await doSyncPush();
      alert('数据已同步到云端！');
    }
  } catch(e) {
    alert('验证失败: '+e.message+'\n请检查 Token 和 Gist ID 是否正确');
  } finally {
    btn.textContent = '保存并验证'; btn.disabled = false;
  }
}

function disconnectGist(){
  if(!confirm('确定断开云同步？数据将仅保存在本地浏览器。')) return;
  localStorage.removeItem(GIST_CONFIG_KEY);
  _gistConfig = null;
  closeModal('gistConfigModal');
  updateSyncStatus('offline','本地模式（点击 ☁ 配置云同步）');
}

async function forceCloudPull(){
  if(!isCloudEnabled()){ alert('请先配置云同步'); return; }
  if(!confirm('强制从云端拉取将覆盖本地数据，确定？')) return;
  try{
    await cloudPull();
    location.reload();
  }catch(e){ alert('拉取失败: '+e.message); }
}

async function forceCloudPush(){
  if(!isCloudEnabled()){ alert('请先配置云同步'); return; }
  if(!confirm('强制推送将用本地数据覆盖云端数据，确定？')) return;
  try{
    _syncDirty = true;
    await doSyncPush();
    alert('已推送到云端');
  }catch(e){ alert('推送失败: '+e.message); }
}
