/**
 * 毒奶粉节日礼包物价记录档案与分析 - 应用核心控制逻辑
 */

(async function () {
  const KEY = 'dnf-festival-price-v2';
  const MAP_KEY = 'dnf-festival-category-map-v2';
  const $ = selector => document.querySelector(selector);

  // 访问模式:auto = 本地(file:// / localhost)为管理员,远程访问为游客;
  // 部署到服务器供他人访问时,游客端自动移除管理按钮与弹窗(防止误操作/视图被污染)。
  // 游客的操作本就仅写入其自身浏览器 localStorage,服务器数据文件任何访客都无法修改。
  // 需在远程环境解锁管理功能时,可强制指定 'admin';反之可强制 'guest'。
  const ACCESS_MODE = 'auto';
  const IS_OWNER = ACCESS_MODE === 'admin' ? true
    : ACCESS_MODE === 'guest' ? false
      : (location.protocol === 'file:' || ['localhost', '127.0.0.1', '0.0.0.0', '::1'].includes(location.hostname));

  if (!IS_OWNER) {
    // 游客模式:移除管理按钮与对应弹窗;后续事件绑定因元素不存在而全部自动跳过
    ['openCategoryModal', 'exportCsv', 'exportJson', 'openAdd', 'addModal', 'categoryModal'].forEach(id => {
      const el = $('#' + id);
      if (el) el.remove();
    });
  }

  function generateUUID() {
    if (typeof crypto !== 'undefined' && crypto.randomUUID) {
      return crypto.randomUUID();
    }
    return 'id-' + Date.now() + '-' + Math.random().toString(36).substring(2, 9);
  }

  // 千分位用细空格(U+2009)代替逗号,避免与小数点混淆
  const fmt = n => (n === null || n === undefined || isNaN(n)) ? '--' : Number(n).toLocaleString('zh-CN', { maximumFractionDigits: 4 }).replace(/,/g, '\u2009');

  // 价格展示:≥1亿(10000万)自动转亿,其余以万显示;数据存储与导出仍统一为万
  function priceParts(n) {
    if (n === null || n === undefined || isNaN(n)) return { text: '--', unit: '' };
    const v = Number(n);
    if (v >= 10000) return { text: fmt(v / 10000), unit: '亿' };
    return { text: fmt(v), unit: '万' };
  }

  const priceHtml = n => {
    const p = priceParts(n);
    if (!p.unit) return p.text;
    return `${p.text} <span class="text-xs text-slate-400 font-normal">${p.unit}</span>`;
  };

  const priceText = n => {
    const p = priceParts(n);
    return p.unit ? `${p.text} ${p.unit}` : p.text;
  };

  // ---------------- 数据智能加载器 (JSON 优先 + JS 降级) ----------------
  let seedItems = [];
  let DEFAULT_CATEGORY_MAP = [];

  async function loadInitialData() {
    try {
      const [priceRes, catRes] = await Promise.all([
        fetch('data/price_data.json'),
        fetch('data/category_map.json')
      ]);
      if (priceRes.ok && catRes.ok) {
        const priceData = await priceRes.json();
        const catData = await catRes.json();
        if (Array.isArray(priceData) && priceData.length > 0) {
          seedItems = priceData.map(x => ({
            id: generateUUID(),
            year: Number(x.year),
            season: String(x.season),
            date: String(x.date),
            name: String(x.name),
            current: x.current !== null && x.current !== undefined ? Number(x.current) : null,
            high: x.high !== null && x.high !== undefined ? Number(x.high) : null,
            low: x.low !== null && x.low !== undefined ? Number(x.low) : null,
            source: '初始数据加载'
          }));
        }
        if (Array.isArray(catData) && catData.length > 0) {
          DEFAULT_CATEGORY_MAP = Object.freeze(JSON.parse(JSON.stringify(catData)));
        }
      }
    } catch (e) {
      console.warn('JSON fetch failed or local file:// protocol restriction. Falling back to window.DNF_DEFAULT_*', e);
    }

    // 降级退回机制
    if (!seedItems.length && window.DNF_DEFAULT_PRICE_DATA) {
      seedItems = window.DNF_DEFAULT_PRICE_DATA.map(x => ({
        id: generateUUID(),
        year: Number(x.year),
        season: String(x.season),
        date: String(x.date),
        name: String(x.name),
        current: x.current !== null && x.current !== undefined ? Number(x.current) : null,
        high: x.high !== null && x.high !== undefined ? Number(x.high) : null,
        low: x.low !== null && x.low !== undefined ? Number(x.low) : null,
        source: '初始数据加载'
      }));
    }
    if (!DEFAULT_CATEGORY_MAP.length && window.DNF_DEFAULT_CATEGORY_MAP) {
      DEFAULT_CATEGORY_MAP = Object.freeze(JSON.parse(JSON.stringify(window.DNF_DEFAULT_CATEGORY_MAP)));
    }
  }

  await loadInitialData();

  // 数据自愈与持久化逻辑
  function sanitizeItems(list) {
    if (!Array.isArray(list)) return [];
    return list.filter(x => x && typeof x === 'object' && x.name && String(x.name).trim() !== '');
  }

  function save() {
    try {
      localStorage.setItem(KEY, JSON.stringify(items));
    } catch (e) { console.error('Save error:', e); }
  }

  let items = [];
  try {
    const savedRaw = localStorage.getItem(KEY);
    const savedList = savedRaw ? JSON.parse(savedRaw) : null;
    const validSaved = sanitizeItems(savedList);

    // 种子数据为基准:同键条目一律以最新种子为准,确保数据修正与批量导入能同步到浏览器;
    // localStorage 仅保留种子之外的条目(如手工新增),避免旧缓存覆盖修正后的数值
    const seedKeys = new Set(seedItems.map(x => `${x.year}|${x.season}|${x.date}|${x.name}`));
    const userExtras = validSaved.filter(x => !seedKeys.has(`${x.year}|${x.season}|${x.date}|${x.name}`));

    items = [...seedItems, ...userExtras];
    save();
  } catch (e) {
    items = [...seedItems];
    save();
  }

  function seasonClass(s) {
    return s === '春节' ? 'badge-spring' : s === '夏日' ? 'badge-summer' : s === '金秋' ? 'badge-autumn' : 'badge-default';
  }

  // ---------------- 产物映射字典管理 ----------------
  function loadCategoryMap() {
    let saved = null;
    try {
      const raw = localStorage.getItem(MAP_KEY);
      if (raw) {
        const list = JSON.parse(raw);
        if (Array.isArray(list) && list.length > 0) saved = list;
      }
    } catch (e) { }
    if (!saved) return JSON.parse(JSON.stringify(DEFAULT_CATEGORY_MAP));
    // 用户保存过自定义映射:以自定义为基础,合并种子中新增的规则(如新系列导入的映射),
    // 保证官方规则更新能进入已保存过映射的浏览器;若官方修改了既有规则的关键字,
    // 需将 MAP_KEY 版本号 +1 使本地旧映射整体失效(见 .agents/AGENTS.md)
    const savedLabels = new Set(saved.map(c => c && c.label).filter(Boolean));
    const seedAdditions = DEFAULT_CATEGORY_MAP.filter(c => c && c.label && !savedLabels.has(c.label));
    return [...saved, ...JSON.parse(JSON.stringify(seedAdditions))];
  }

  function saveCategoryMap() {
    try {
      localStorage.setItem(MAP_KEY, JSON.stringify(categoryMap));
    } catch (e) { }
  }

  let categoryMap = loadCategoryMap();

  function updateStatBadge() {
    const el = $('#statBadge');
    if (!el) return;
    const total = (items || []).length;
    const pageMode = (document.body && document.body.dataset.page) ? document.body.dataset.page : 'table';
    // 对比页与 renderGroupView 同口径:搜索命中道具名或归类名均计入
    const filtered = (pageMode === 'group') ? computeGroupData().visibleCount : filteredRawItems().length;
    el.textContent = `全库收录 ${total} 条数据 | 筛选出 ${filtered} 条`;
  }

  function filteredRawItems() {
    const s = $('#season') ? $('#season').value : 'all';
    const y = $('#year') ? $('#year').value : 'all';
    const qInput = $('#search') ? $('#search').value : '';
    const q = qInput.trim().toLowerCase();

    return (items || []).filter(x => {
      if (!x || !x.name) return false;
      const matchSeason = (s === 'all' || x.season === s);
      const matchYear = (y === 'all' || String(x.year) === String(y));
      const matchQuery = (!q || String(x.name).toLowerCase().includes(q));
      return matchSeason && matchYear && matchQuery;
    });
  }

  function updateYears() {
    const yearEl = $('#year');
    if (!yearEl) return;
    const current = yearEl.value;
    const years = [...new Set((items || []).map(x => x.year).filter(Boolean))].sort((a, b) => a - b);
    yearEl.innerHTML = '<option value="all">全部年份</option>' + years.map(y => `<option value="${y}">${y}年</option>`).join('');
    yearEl.value = (current && (current === 'all' || years.includes(+current))) ? current : 'all';
  }

  // 渲染原始明细表格视图
  function renderTableView() {
    const rows = filteredRawItems();
    const tbody = $('#rows');
    const countEl = $('#tableStatCount');

    if (countEl) {
      const total = (items || []).length;
      countEl.innerHTML = `已筛选出 <strong class="text-indigo-600 font-bold">${rows.length}</strong> 条记录 (全库 ${total} 条)`;
    }

    if (!tbody) return;

    if (!rows.length) {
      tbody.innerHTML = `<tr><td colspan="8" class="text-center py-10 text-slate-400 text-xs">未查找到匹配条目。若数据丢失，请点击“重置筛选”按钮。</td></tr>`;
      return;
    }

    tbody.innerHTML = rows.map(x => {
      const hasLow = x.low !== null && x.low !== undefined && !isNaN(x.low) && Number(x.low) > 0;
      const hasHigh = x.high !== null && x.high !== undefined && !isNaN(x.high);
      const rangeIncrease = (hasLow && hasHigh) ? (Number(x.high) - Number(x.low)) / Number(x.low) : null;
      const rangeIncreaseText = rangeIncrease === null ? '--' : (rangeIncrease * 100).toFixed(1) + '%';

      return `<tr class="hover:bg-slate-50/80 transition-colors">
        <td class="py-3 px-4 font-semibold text-slate-900">${x.year || '--'}</td>
        <td class="py-3 px-4"><span class="badge ${seasonClass(x.season || '')}">${x.season || '--'}</span></td>
        <td class="py-3 px-4 text-xs text-slate-500 font-mono">${x.date || '--'}</td>
        <td class="py-3 px-4 font-semibold text-slate-800">${x.name || '--'}</td>
        <td class="py-3 px-4 text-right font-mono font-bold text-slate-900">${priceHtml(x.current)}</td>
        <td class="py-3 px-4 text-right font-mono font-bold text-rose-600">${priceHtml(x.high)}</td>
        <td class="py-3 px-4 text-right font-mono font-bold text-emerald-600">${priceHtml(x.low)}</td>
        <td class="py-3 px-4 text-right font-mono">
          ${rangeIncrease > 0
          ? `<span class="inline-flex items-center px-2 py-0.5 rounded-full text-xs font-semibold bg-rose-50 text-rose-600 border border-rose-100">+${rangeIncreaseText}</span>`
          : `<span class="text-slate-400">${rangeIncreaseText}</span>`}
        </td>
      </tr>`;
    }).join('');
  }

  // 跨年同类归组计算:返回分组 Map 与当前筛选下可见条数(供对比页渲染与统计徽章共用同一口径)
  function matchCategoryFor(item) {
    let matchedCat = null;
    let maxKwLen = -1;
    categoryMap.forEach(c => {
      if (c.season === '通用' || c.season === item.season) {
        (c.keywords || []).forEach(k => {
          if (item.name.includes(k) || k.includes(item.name)) {
            if (k.length > maxKwLen) {
              maxKwLen = k.length;
              matchedCat = c;
            }
          }
        });
      }
    });
    return matchedCat;
  }

  function computeGroupData() {
    const sFilter = $('#season') ? $('#season').value : 'all';
    const yFilter = $('#year') ? $('#year').value : 'all';
    const qInput = $('#search') ? $('#search').value : '';
    const qFilter = qInput.trim().toLowerCase();

    const matched = (items || []).filter(x =>
      x && x.name &&
      (sFilter === 'all' || x.season === sFilter) &&
      (yFilter === 'all' || String(x.year) === String(yFilter))
    );

    const groups = new Map();
    let visibleCount = 0;

    matched.forEach(item => {
      const matchedCat = matchCategoryFor(item);
      const groupLabel = matchedCat ? matchedCat.label : item.name;

      if (qFilter) {
        const matchName = item.name.toLowerCase().includes(qFilter);
        const matchLabel = groupLabel.toLowerCase().includes(qFilter);
        if (!matchName && !matchLabel) return;
      }
      visibleCount++;

      if (!groups.has(groupLabel)) {
        groups.set(groupLabel, {
          label: groupLabel,
          season: item.season,
          items: []
        });
      }
      groups.get(groupLabel).items.push(item);
    });

    return { groups, visibleCount };
  }

  // 渲染跨年同类对比视图
  function renderGroupView() {
    const { groups } = computeGroupData();

    const container = $('#groupView');
    if (!container) return;

    if (groups.size === 0) {
      container.innerHTML = `<div class="bg-white rounded-2xl p-10 text-center border border-slate-200/80 shadow-sm text-slate-400 text-sm">未检索到匹配的节日同类产物数据。</div>`;
      return;
    }

    let html = '';

    groups.forEach((groupData, label) => {
      groupData.items.sort((a, b) => (b.year || 0) - (a.year || 0) || new Date(b.date || 0) - new Date(a.date || 0));

      html += `
      <div class="bg-white rounded-2xl border border-slate-200/80 shadow-sm overflow-hidden transition-all hover:shadow-md">
        <div class="bg-slate-50/80 border-b border-slate-200/80 px-6 py-4 flex justify-between items-center">
          <div class="flex items-center gap-3">
            <span class="text-base font-bold text-slate-900">🏷️ 【${label}】</span>
            <span class="badge ${seasonClass(groupData.season)}">${groupData.season}系列</span>
          </div>
          <div class="text-xs text-slate-500 font-medium bg-white px-3 py-1 rounded-full border border-slate-200 shadow-2xs">
            共收录 <strong class="text-indigo-600 font-bold">${groupData.items.length}</strong> 年数据 (年份降序)
          </div>
        </div>
        <div class="divide-y divide-slate-100">
      `;

      groupData.items.forEach(it => {
        const priceDisplay = (it.low !== null && it.low !== undefined && !isNaN(it.low) && Number(it.low) > 0) ? it.low : it.current;
        const pp = priceParts(priceDisplay);

        html += `
          <div class="grid grid-cols-12 gap-3 items-center px-6 py-3.5 hover:bg-slate-50/80 transition-colors">
            <div class="col-span-2 sm:col-span-2">
              <span class="badge badge-year font-mono">${it.year || '--'} 年</span>
            </div>
            <div class="col-span-3 sm:col-span-2">
              <span class="badge ${seasonClass(it.season)}">${it.season || '--'}</span>
            </div>
            <div class="col-span-4 sm:col-span-5 font-semibold text-slate-800 text-sm truncate" title="${it.name}">
              ${it.name}
            </div>
            <div class="col-span-3 sm:col-span-3 text-right">
              <span class="text-base font-mono font-bold text-indigo-600" title="历史最低价: ${priceText(priceDisplay)} (统计日期: ${it.date})">
                ${pp.text} <span class="text-xs text-slate-500 font-normal">${pp.unit}</span>
              </span>
            </div>
          </div>
        `;
      });

      html += `
        </div>
      </div>
      `;
    });

    container.innerHTML = html;
  }

  function render() {
    try {
      if (!items || !Array.isArray(items) || items.length < 10) {
        items = [...seedItems];
        save();
      }

      updateYears();
      syncCxButtons();
      updateStatBadge();

      const pageMode = (document.body && document.body.dataset.page) ? document.body.dataset.page : 'table';
      if (pageMode === 'group') {
        if ($('#tableView')) $('#tableView').style.display = 'none';
        if ($('#groupView')) $('#groupView').style.display = 'block';
        renderGroupView();
      } else {
        if ($('#tableView')) $('#tableView').style.display = 'block';
        if ($('#groupView')) $('#groupView').style.display = 'none';
        renderTableView();
      }
    } catch (err) {
      console.error('Render crash caught:', err);
      items = [...seedItems];
      save();
      renderTableView();
    }
  }

  let noticeTimer = null;
  function notice(text) {
    const el = $('#notice');
    if (!el) return;

    // 若当前有打开的原生 dialog，挂载至 dialog 内部使其位于浏览器的 Top Layer 顶层
    const activeModal = document.querySelector('dialog[open]');
    if (activeModal && el.parentElement !== activeModal) {
      activeModal.appendChild(el);
    } else if (!activeModal && el.parentElement !== document.body) {
      document.body.appendChild(el);
    }

    el.textContent = text;
    el.classList.add('show');
    if (noticeTimer) clearTimeout(noticeTimer);
    noticeTimer = setTimeout(() => {
      el.classList.remove('show');
    }, 2800);
  }

  function openModal(id) {
    const el = $('#' + id);
    if (el) el.showModal();
  }

  // 事件监听注册
  document.querySelectorAll('[data-close]').forEach(x => x.onclick = () => {
    const modalId = x.dataset.close;
    const modal = $('#' + modalId);
    if (modal) modal.close();
    const noticeEl = $('#notice');
    if (noticeEl && noticeEl.parentElement !== document.body) {
      document.body.appendChild(noticeEl);
    }
  });
  if ($('#openAdd')) $('#openAdd').onclick = () => openModal('addModal');
  // 新增弹窗统计日期默认当天
  if ($('#addDate')) {
    const now = new Date();
    $('#addDate').value = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}-${String(now.getDate()).padStart(2, '0')}`;
  }

  ['season', 'year', 'search'].forEach(id => {
    const el = $('#' + id);
    if (el) el.addEventListener(id === 'search' ? 'input' : 'change', render);
  });

  // ---------------- 搜索框内容联想下拉框模块 ----------------
  function initSearchSuggest() {
    const searchInput = $('#search');
    const suggestBox = $('#searchSuggest');
    if (!searchInput || !suggestBox) return;

    let selectedIndex = -1;

    function hideSuggest() {
      suggestBox.classList.remove('show');
      suggestBox.innerHTML = '';
      selectedIndex = -1;
    }

    function highlightText(text, keyword) {
      if (!keyword) return text;
      const idx = text.toLowerCase().indexOf(keyword.toLowerCase());
      if (idx === -1) return text;
      const before = text.slice(0, idx);
      const match = text.slice(idx, idx + keyword.length);
      const after = text.slice(idx + keyword.length);
      return `${before}<span class="matchHighlight">${match}</span>${after}`;
    }

    function updateSuggest() {
      const q = searchInput.value.trim().toLowerCase();
      if (!q) {
        hideSuggest();
        return;
      }

      const allNames = [...new Set((items || []).map(x => x && x.name).filter(Boolean))];
      const categoryLabels = [...new Set((categoryMap || []).map(c => c && c.label).filter(Boolean))];

      const matchedNames = allNames.filter(n => n.toLowerCase().includes(q));
      const matchedCats = categoryLabels.filter(c => c.toLowerCase().includes(q) && !matchedNames.includes(c));

      const matches = [
        ...matchedCats.map(c => ({ name: c, type: '分类归类' })),
        ...matchedNames.map(n => ({ name: n, type: '道具' }))
      ].slice(0, 12);

      if (!matches.length) {
        hideSuggest();
        return;
      }

      suggestBox.innerHTML = matches.map((m, idx) => `
        <div class="suggestItem ${idx === selectedIndex ? 'active' : ''}" data-value="${m.name}">
          <div class="flex-1 min-w-0 truncate font-medium text-slate-800" title="${m.name}">${highlightText(m.name, q)}</div>
          <span class="suggestTag whitespace-nowrap shrink-0">${m.type}</span>
        </div>
      `).join('');

      suggestBox.classList.add('show');

      suggestBox.querySelectorAll('.suggestItem').forEach(item => {
        item.onmousedown = (e) => {
          e.preventDefault();
          searchInput.value = item.dataset.value;
          hideSuggest();
          render();
        };
      });
    }

    searchInput.addEventListener('input', () => {
      selectedIndex = -1;
      updateSuggest();
    });

    searchInput.addEventListener('focus', updateSuggest);

    searchInput.addEventListener('keydown', e => {
      const suggestItems = suggestBox.querySelectorAll('.suggestItem');
      if (!suggestBox.classList.contains('show') || !suggestItems.length) return;

      if (e.key === 'ArrowDown') {
        e.preventDefault();
        selectedIndex = (selectedIndex + 1) % suggestItems.length;
        updateSuggestItemsHighlight(suggestItems);
      } else if (e.key === 'ArrowUp') {
        e.preventDefault();
        selectedIndex = (selectedIndex - 1 + suggestItems.length) % suggestItems.length;
        updateSuggestItemsHighlight(suggestItems);
      } else if (e.key === 'Enter') {
        if (selectedIndex >= 0 && suggestItems[selectedIndex]) {
          e.preventDefault();
          searchInput.value = suggestItems[selectedIndex].dataset.value;
          hideSuggest();
          render();
        }
      } else if (e.key === 'Escape') {
        hideSuggest();
      }
    });

    function updateSuggestItemsHighlight(suggestItems) {
      suggestItems.forEach((item, idx) => {
        if (idx === selectedIndex) {
          item.classList.add('active');
          item.scrollIntoView({ block: 'nearest' });
        } else {
          item.classList.remove('active');
        }
      });
    }

    document.addEventListener('click', e => {
      if (!searchInput.contains(e.target) && !suggestBox.contains(e.target)) {
        hideSuggest();
      }
    });
  }

  initSearchSuggest();

  // ---------------- 原生下拉框增强:自定义弹出列表 ----------------
  // 原生 select 展开后的 option 弹窗是浏览器/OS 原生控件,CSS 无法美化;
  // 此处以隐藏的原生 select 作为数据源与读写载体,用同外观按钮 + 自定义弹层替代展开交互,
  // 现有逻辑(筛选、映射表读写 .value)完全不受影响。
  let cxOpen = null; // { sel, btn, listbox, items, activeIndex }

  function cxFindBtn(sel) {
    return (sel.nextElementSibling && sel.nextElementSibling.classList.contains('cxBtn')) ? sel.nextElementSibling : null;
  }

  function enhanceSelect(sel) {
    if (!sel || sel.dataset.cxEnhanced) return;
    sel.dataset.cxEnhanced = '1';

    const btn = document.createElement('button');
    btn.type = 'button';
    btn.className = sel.className.split(/\s+/).filter(c => c && c !== 'cat-season-select').join(' ') + ' cxBtn';
    btn.setAttribute('aria-haspopup', 'listbox');
    btn.setAttribute('aria-expanded', 'false');
    // 关联的原生 label 无法作用于替代按钮,复制其文本作为可访问名称
    const labelEl = sel.id ? document.querySelector(`label[for="${sel.id}"]`) : null;
    if (labelEl) btn.setAttribute('aria-label', labelEl.textContent.trim());
    sel.insertAdjacentElement('afterend', btn);
    sel.classList.add('cxNative');

    const sync = () => {
      const opt = sel.options[sel.selectedIndex];
      btn.textContent = opt ? opt.textContent.trim() : '';
    };
    btn._cxSync = sync;
    sync();
    sel.addEventListener('change', sync);

    btn.addEventListener('click', () => {
      if (cxOpen && cxOpen.btn === btn) { cxClose(); return; }
      cxOpenListbox(sel, btn);
    });

    btn.addEventListener('keydown', e => {
      if (!cxOpen || cxOpen.btn !== btn) {
        if (e.key === 'ArrowDown' || e.key === 'Enter' || e.key === ' ') {
          e.preventDefault();
          cxOpenListbox(sel, btn);
        }
        return;
      }
      const count = cxOpen.items.length;
      if (e.key === 'ArrowDown') {
        e.preventDefault();
        cxHighlight((cxOpen.activeIndex + 1) % count);
      } else if (e.key === 'ArrowUp') {
        e.preventDefault();
        cxHighlight((cxOpen.activeIndex - 1 + count) % count);
      } else if (e.key === 'Enter') {
        e.preventDefault();
        cxPick(cxOpen.activeIndex);
      } else if (e.key === 'Escape' || e.key === 'Tab') {
        cxClose();
      }
    });
  }

  function enhanceAllSelects(root) {
    (root || document).querySelectorAll('select').forEach(enhanceSelect);
  }

  function syncCxButtons() {
    document.querySelectorAll('select.cxNative').forEach(sel => {
      const btn = cxFindBtn(sel);
      if (btn && btn._cxSync) btn._cxSync();
    });
  }

  function cxClose() {
    if (!cxOpen) return;
    cxOpen.btn.setAttribute('aria-expanded', 'false');
    cxOpen.btn.classList.remove('open');
    cxOpen.listbox.remove();
    cxOpen = null;
  }

  function cxHighlight(idx) {
    if (!cxOpen) return;
    cxOpen.items.forEach((it, i) => it.classList.toggle('active', i === idx));
    if (cxOpen.items[idx]) cxOpen.items[idx].scrollIntoView({ block: 'nearest' });
    cxOpen.activeIndex = idx;
  }

  function cxPick(idx) {
    if (!cxOpen) return;
    const { sel, btn } = cxOpen;
    const opt = sel.options[idx];
    cxClose();
    if (opt && sel.value !== opt.value) {
      sel.value = opt.value;
      sel.dispatchEvent(new Event('change', { bubbles: true }));
    }
    btn.focus();
  }

  function cxOpenListbox(sel, btn) {
    cxClose();
    const lb = document.createElement('div');
    lb.className = 'cxListbox';
    lb.setAttribute('role', 'listbox');

    const items = [...sel.options].map((opt, i) => {
      const item = document.createElement('div');
      item.className = 'cxOption' + (i === sel.selectedIndex ? ' selected' : '');
      item.setAttribute('role', 'option');
      item.textContent = opt.textContent.trim();
      item.addEventListener('mousedown', e => e.preventDefault());
      item.addEventListener('click', () => cxPick(i));
      lb.appendChild(item);
      return item;
    });

    // 弹层挂载:select 位于 dialog 内时挂到 dialog(进入 Top Layer 覆盖遮罩),否则挂到 body
    (sel.closest('dialog') || document.body).appendChild(lb);

    const r = btn.getBoundingClientRect();
    lb.style.minWidth = r.width + 'px';
    const spaceBelow = window.innerHeight - r.bottom;
    if (spaceBelow < 260 && r.top > spaceBelow) {
      lb.style.top = Math.max(8, r.top - 6 - lb.offsetHeight) + 'px';
    } else {
      lb.style.top = (r.bottom + 6) + 'px';
    }
    lb.style.left = Math.max(8, Math.min(r.left, window.innerWidth - 8 - lb.offsetWidth)) + 'px';

    btn.classList.add('open');
    btn.setAttribute('aria-expanded', 'true');
    cxOpen = { sel, btn, listbox: lb, items, activeIndex: sel.selectedIndex };
  }

  enhanceAllSelects();

  document.addEventListener('click', e => {
    if (!cxOpen) return;
    if (cxOpen.listbox.contains(e.target) || cxOpen.btn.contains(e.target)) return;
    cxClose();
  });
  window.addEventListener('scroll', e => { if (cxOpen && e.target !== cxOpen.listbox) cxClose(); }, true);
  window.addEventListener('resize', cxClose);

  // 重置与恢复数据
  if ($('#reset')) {
    $('#reset').onclick = () => {
      if ($('#season')) $('#season').value = 'all';
      if ($('#year')) $('#year').value = 'all';
      if ($('#search')) $('#search').value = '';
      items = [...seedItems];
      save();
      render();
      notice(`已成功重置筛选并恢复 ${seedItems.length} 条完整预置物价数据！`);
    };
  }

  // 手动新增单条数据
  if ($('#addSubmit')) {
    $('#addSubmit').onclick = () => {
      // 名称会拼入 innerHTML 渲染模板,剥离可能破坏结构的字符
      const name = $('#addName').value.trim().replace(/[<>"]/g, '');
      const date = $('#addDate').value;
      const year = +$('#addYear').value;
      const curRaw = $('#addCurrent').value.trim();
      const highRaw = $('#addHigh').value.trim();
      const lowRaw = $('#addLow').value.trim();

      if (!name) return notice('请填写道具名称');
      if (!date) return notice('请选择统计日期');
      if (!Number.isFinite(year) || year <= 0) return notice('请填写有效年份');
      if (curRaw === '' || highRaw === '' || lowRaw === '') return notice('请完整填写三项价格');

      const current = +curRaw;
      const high = +highRaw;
      const low = +lowRaw;
      if (![current, high, low].every(Number.isFinite)) return notice('价格需为有效数字');
      if (low > high) return notice('历史低价不能高于历史高价');

      items.push({
        id: generateUUID(),
        year,
        season: $('#addSeason').value,
        date,
        name,
        current,
        high,
        low,
        source: '手工新增'
      });

      save();
      $('#addModal').close();
      ['addName', 'addCurrent', 'addHigh', 'addLow'].forEach(id => { if ($('#' + id)) $('#' + id).value = ''; });
      render();
      notice('条目已成功保存');
    };
  }

  // 映射规则配置渲染
  function renderCategoryModalRows(rules) {
    const tbody = $('#categoryTableBody') || $('#categoryRulesBody');
    if (!tbody) return;

    tbody.innerHTML = rules.map((r) => {
      const kwStr = Array.isArray(r.keywords) ? r.keywords.join(', ') : String(r.keywords || '');
      return `<tr>
        <td class="py-2.5 px-3">
          <select class="cat-season-select w-full h-8 px-2 bg-slate-50 border border-slate-200 rounded-lg text-xs font-medium focus:ring-2 focus:ring-indigo-500 focus:outline-none">
            <option ${r.season === '通用' ? 'selected' : ''}>通用</option>
            <option ${r.season === '春节' ? 'selected' : ''}>春节</option>
            <option ${r.season === '耕耘' ? 'selected' : ''}>耕耘</option>
            <option ${r.season === '夏日' ? 'selected' : ''}>夏日</option>
            <option ${r.season === '金秋' ? 'selected' : ''}>金秋</option>
          </select>
        </td>
        <td class="py-2.5 px-3">
          <input class="cat-label-input w-full h-8 px-2.5 bg-slate-50 border border-slate-200 rounded-lg text-xs font-medium focus:ring-2 focus:ring-indigo-500 focus:outline-none" value="${r.label || ''}" placeholder="分类名称">
        </td>
        <td class="py-2.5 px-3">
          <input class="cat-keywords-input w-full h-8 px-2.5 bg-slate-50 border border-slate-200 rounded-lg text-xs font-medium focus:ring-2 focus:ring-indigo-500 focus:outline-none" value="${kwStr}" placeholder="用逗号分隔关键字">
        </td>
        <td class="py-2.5 px-3 text-center">
          <button type="button" class="px-2.5 py-1 bg-rose-50 text-rose-600 hover:bg-rose-100 border border-rose-200/60 rounded-lg text-xs font-semibold transition-all" onclick="this.closest('tr').remove()">删除</button>
        </td>
      </tr>`;
    }).join('');
    enhanceAllSelects(tbody);
  }

  if ($('#openCategoryModal')) {
    $('#openCategoryModal').onclick = () => {
      renderCategoryModalRows(categoryMap);
      openModal('categoryModal');
    };
  }

  if ($('#addCategoryRuleBtn')) {
    $('#addCategoryRuleBtn').onclick = () => {
      const tbody = $('#categoryTableBody') || $('#categoryRulesBody');
      if (!tbody) return;
      const tr = document.createElement('tr');
      tr.innerHTML = `
        <td class="py-2.5 px-3">
          <select class="cat-season-select w-full h-8 px-2 bg-slate-50 border border-slate-200 rounded-lg text-xs font-medium focus:ring-2 focus:ring-indigo-500 focus:outline-none">
            <option>通用</option>
            <option>春节</option>
            <option>耕耘</option>
            <option>夏日</option>
            <option>金秋</option>
          </select>
        </td>
        <td class="py-2.5 px-3">
          <input class="cat-label-input w-full h-8 px-2.5 bg-slate-50 border border-slate-200 rounded-lg text-xs font-medium focus:ring-2 focus:ring-indigo-500 focus:outline-none" placeholder="分类名称">
        </td>
        <td class="py-2.5 px-3">
          <input class="cat-keywords-input w-full h-8 px-2.5 bg-slate-50 border border-slate-200 rounded-lg text-xs font-medium focus:ring-2 focus:ring-indigo-500 focus:outline-none" placeholder="用逗号分隔关键字">
        </td>
        <td class="py-2.5 px-3 text-center">
          <button type="button" class="px-2.5 py-1 bg-rose-50 text-rose-600 hover:bg-rose-100 border border-rose-200/60 rounded-lg text-xs font-semibold transition-all" onclick="this.closest('tr').remove()">删除</button>
        </td>
      `;
      tbody.appendChild(tr);
      enhanceAllSelects(tr);
      tr.scrollIntoView({ behavior: 'smooth', block: 'nearest' });
    };
  }

  if ($('#resetCategoryRulesBtn')) {
    $('#resetCategoryRulesBtn').onclick = () => {
      const ok = confirm('确定要重置产物映射表为官方初始基准规则字典吗？\n您自定义修改的映射关系将被还原覆盖。');
      if (!ok) return;
      categoryMap = JSON.parse(JSON.stringify(DEFAULT_CATEGORY_MAP));
      saveCategoryMap();
      renderCategoryModalRows(categoryMap);
      render();
      notice('已成功重置产物映射表为系统基准规则！');
    };
  }

  if ($('#saveCategoryRulesBtn')) {
    $('#saveCategoryRulesBtn').onclick = () => {
      const tbody = $('#categoryTableBody') || $('#categoryRulesBody');
      const rows = tbody ? tbody.querySelectorAll('tr') : [];
      const newMap = [];
      rows.forEach(tr => {
        const seasonSelect = tr.querySelector('.cat-season-select');
        const labelInput = tr.querySelector('.cat-label-input');
        const kwInput = tr.querySelector('.cat-keywords-input');
        if (seasonSelect && labelInput && kwInput) {
          const season = seasonSelect.value;
          const label = labelInput.value.trim();
          const kwRaw = kwInput.value.trim();
          const keywords = kwRaw.split(/[,，]/).map(k => k.trim()).filter(Boolean);
          if (label && keywords.length > 0) {
            newMap.push({ season, label, keywords });
          }
        }
      });

      if (!newMap.length) return notice('请至少保留一条有效映射规则');

      categoryMap = newMap;
      saveCategoryMap();
      $('#categoryModal').close();
      render();
      notice(`映射表保存成功！共生效 ${categoryMap.length} 条分类规则`);
    };
  }

  // 导出功能辅助
  function getTimestampStr() {
    const d = new Date();
    const yyyy = d.getFullYear();
    const mm = String(d.getMonth() + 1).padStart(2, '0');
    const dd = String(d.getDate()).padStart(2, '0');
    return `${yyyy}${mm}${dd}`;
  }

  function downloadFile(content, name, type) {
    const a = document.createElement('a');
    const blob = new Blob([content], { type });
    const url = URL.createObjectURL(blob);
    a.href = url;
    a.download = name;
    a.click();
    URL.revokeObjectURL(url);
  }

  if ($('#exportJson')) {
    $('#exportJson').onclick = () => {
      const total = (items || []).length;
      if (!total) return notice('当前无有效物价数据可供导出');
      const ok = confirm(`确定要导出全库物价数据为 JSON 文件吗？\n当前共有 ${total} 条物价数据记录。`);
      if (ok) {
        const fileName = `毒奶粉节日礼包物价数据_${getTimestampStr()}.json`;
        downloadFile(JSON.stringify(items, null, 2), fileName, 'application/json');
        notice(`已成功导出 ${total} 条 JSON 物价数据文件！`);
      }
    };
  }

  if ($('#exportCsv')) {
    $('#exportCsv').onclick = () => {
      const total = (items || []).length;
      if (!total) return notice('当前无有效物价数据可供导出');
      const ok = confirm(`确定要导出全库物价数据为 CSV 文件吗？\n当前共有 ${total} 条物价数据记录。`);
      if (ok) {
        const headers = ['年份', '礼包', '统计日期', '道具名称', '本期价格(万)', '历史高价(万)', '历史低价(万)', '来源'];
        const csvLines = [
          headers,
          ...items.map(x => [x.year, x.season, x.date, x.name, x.current, x.high, x.low, x.source])
        ].map(r => r.map(v => '"' + String(v).replaceAll('"', '""') + '"').join(',')).join('\n');

        const fileName = `毒奶粉节日礼包物价数据_${getTimestampStr()}.csv`;
        downloadFile('\ufeff' + csvLines, fileName, 'text/csv;charset=utf-8');
        notice(`已成功导出 ${total} 条 CSV 物价数据文件！`);
      }
    };
  }

  // 初始化自愈启动
  try {
    render();
  } catch (e) {
    console.error('Initial render failed:', e);
    items = [...seedItems];
    save();
    renderTableView();
  }
})();
