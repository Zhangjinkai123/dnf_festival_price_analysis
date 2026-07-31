/**
 * DNF 节日礼包物价记录档案与分析 - 应用核心控制逻辑
 */

(async function () {
  const KEY = 'dnf-festival-price-v2';
  const MAP_KEY = 'dnf-festival-category-map-v2';
  const $ = selector => document.querySelector(selector);

  function generateUUID() {
    if (typeof crypto !== 'undefined' && crypto.randomUUID) {
      return crypto.randomUUID();
    }
    return 'id-' + Date.now() + '-' + Math.random().toString(36).substring(2, 9);
  }

  const fmt = n => (n === null || n === undefined || isNaN(n)) ? '--' : Number(n).toLocaleString('zh-CN', { maximumFractionDigits: 4 });

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

    const known = new Set(validSaved.map(x => `${x.year}|${x.season}|${x.date}|${x.name}`));
    const missing = seedItems.filter(x => !known.has(`${x.year}|${x.season}|${x.date}|${x.name}`));

    items = [...validSaved, ...missing];
    save();
  } catch (e) {
    items = [...seedItems];
    save();
  }

  function seasonClass(s) {
    return s === '春节' ? 'spring' : s === '夏日' ? 'summer' : s === '金秋' ? 'autumn' : '';
  }

  // ---------------- 产物映射字典管理 ----------------
  function loadCategoryMap() {
    try {
      const raw = localStorage.getItem(MAP_KEY);
      if (raw) {
        const list = JSON.parse(raw);
        if (Array.isArray(list) && list.length > 0) return list;
      }
    } catch (e) {}
    return JSON.parse(JSON.stringify(DEFAULT_CATEGORY_MAP));
  }

  function saveCategoryMap() {
    try {
      localStorage.setItem(MAP_KEY, JSON.stringify(categoryMap));
    } catch (e) {}
  }

  let categoryMap = loadCategoryMap();

  function updateStatBadge() {
    const el = $('#statBadge');
    if (!el) return;
    const total = (items || []).length;
    const filtered = filteredRawItems().length;
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
    const years = [...new Set((items || []).map(x => x.year).filter(Boolean))].sort((a,b)=>a-b);
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
      countEl.innerHTML = `已筛选出 <strong>${rows.length}</strong> 条记录 (全库 ${total} 条)`;
    }

    if (!tbody) return;

    if (!rows.length) {
      tbody.innerHTML = `<tr><td colspan="8" style="text-align:center;padding:30px;color:var(--muted);">未查找到匹配条目。若数据丢失，请点击“重置筛选与恢复数据”按钮。</td></tr>`;
      return;
    }

    tbody.innerHTML = rows.map(x => {
      const hasLow = x.low !== null && x.low !== undefined && !isNaN(x.low) && Number(x.low) > 0;
      const hasHigh = x.high !== null && x.high !== undefined && !isNaN(x.high);
      const rangeIncrease = (hasLow && hasHigh) ? (Number(x.high) - Number(x.low)) / Number(x.low) : null;
      const rangeIncreaseText = rangeIncrease === null ? '--' : (rangeIncrease * 100).toFixed(1) + '%';

      return `<tr>
        <td>${x.year || '--'}</td>
        <td><span class="badge ${seasonClass(x.season || '')}">${x.season || '--'}</span></td>
        <td>${x.date || '--'}</td>
        <td>${x.name || '--'}</td>
        <td class="num">${fmt(x.current)}</td>
        <td class="num high">${fmt(x.high)}</td>
        <td class="num low">${fmt(x.low)}</td>
        <td class="num ${rangeIncrease > 0 ? 'high' : ''}">${rangeIncreaseText}</td>
      </tr>`;
    }).join('');
  }

  // 渲染跨年同类对比视图
  function renderGroupView() {
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

    matched.forEach(item => {
      let matchedCat = null;
      let maxKwLen = -1;

      // 优先匹配更精确/更长关键字规则（防止 BUFF+2 称号被普通称号关键字误拦截）
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

      const groupLabel = matchedCat ? matchedCat.label : item.name;

      if (qFilter) {
        const matchName = item.name.toLowerCase().includes(qFilter);
        const matchLabel = groupLabel.toLowerCase().includes(qFilter);
        if (!matchName && !matchLabel) return;
      }

      if (!groups.has(groupLabel)) {
        groups.set(groupLabel, {
          label: groupLabel,
          season: item.season,
          items: []
        });
      }
      groups.get(groupLabel).items.push(item);
    });

    const container = $('#groupView');
    if (!container) return;

    if (groups.size === 0) {
      container.innerHTML = `<div class="panel" style="text-align:center;padding:40px;color:var(--muted);">未检索到匹配的节日同类产物数据。</div>`;
      return;
    }

    let html = '';

    groups.forEach((groupData, label) => {
      groupData.items.sort((a, b) => (b.year || 0) - (a.year || 0) || new Date(b.date || 0) - new Date(a.date || 0));

      html += `
      <div class="groupCard">
        <div class="groupHead">
          <div class="groupTitle">
            🏷️ 【${label}】
            <span class="badge ${seasonClass(groupData.season)}">${groupData.season}系列</span>
          </div>
          <div class="groupCount">共收录 ${groupData.items.length} 年数据 (年份降序)</div>
        </div>
        <div class="groupBody">
      `;

      groupData.items.forEach(it => {
        const low = it.low || it.current || 0;
        const high = it.high || it.current || 0;
        const priceDisplay = (it.low !== null && it.low !== undefined && !isNaN(it.low) && Number(it.low) > 0) ? it.low : it.current;
        let percent = 50;
        if (high > low && it.current) {
          percent = Math.min(100, Math.max(0, ((it.current - low) / (high - low)) * 100));
        }

        html += `
          <div class="compareRow">
            <div><span class="badge year">${it.year || '--'} 年</span></div>
            <div><span class="badge ${seasonClass(it.season)}">${it.season || '--'}</span></div>
            <div class="compareItemName" title="${it.name}">${it.name}</div>
            <div class="comparePrice" title="历史最低价: ${fmt(priceDisplay)}万 (统计日期: ${it.date})">${fmt(priceDisplay)} 万</div>
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
      updateStatBadge();

      const pageMode = (document.body && document.body.dataset.page) ? document.body.dataset.page : 'table';
      if (pageMode === 'group') {
        if ($('#tableView')) $('#tableView').style.display = 'none';
        if ($('#groupView')) $('#groupView').style.display = 'flex';
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

  function notice(text) {
    const el = $('#notice');
    if (!el) return;
    el.textContent = text;
    el.classList.add('show');
    setTimeout(() => el.classList.remove('show'), 2400);
  }

  function openModal(id) {
    const el = $('#' + id);
    if (el) el.showModal();
  }

  // OCR Worker 资源清理释放辅助
  async function terminateOCRWorker() {
    if (ocrWorker) {
      try {
        await ocrWorker.terminate();
      } catch (e) {
        console.warn('OCR worker terminate warning:', e);
      }
      ocrWorker = null;
    }
  }

  // 事件监听注册
  document.querySelectorAll('[data-close]').forEach(x => x.onclick = () => {
    const modalId = x.dataset.close;
    const modal = $('#' + modalId);
    if (modal) modal.close();
    if (modalId === 'importModal') {
      terminateOCRWorker();
    }
  });
  if ($('#openImport')) $('#openImport').onclick = () => openModal('importModal');
  if ($('#openAdd')) $('#openAdd').onclick = () => openModal('addModal');

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
          <div>${highlightText(m.name, q)}</div>
          <span class="suggestTag">${m.type}</span>
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

  // 重置与恢复数据
  if ($('#reset')) {
    $('#reset').onclick = () => {
      if ($('#season')) $('#season').value = 'all';
      if ($('#year')) $('#year').value = 'all';
      if ($('#search')) $('#search').value = '';
      items = [...seedItems];
      save();
      render();
      notice('已成功重置筛选并恢复 180+ 条完整预置物价数据！');
    };
  }

  // 图像选择与预览
  let activePreviewUrl = null;
  if ($('#imageFile')) {
    $('#imageFile').onchange = e => {
      const f = e.target.files[0];
      const img = $('#imagePreview');
      if (activePreviewUrl) {
        URL.revokeObjectURL(activePreviewUrl);
        activePreviewUrl = null;
      }
      if (!f || !img) {
        if (img) img.style.display = 'none';
        return;
      }
      activePreviewUrl = URL.createObjectURL(f);
      img.src = activePreviewUrl;
      img.style.display = 'block';
    };
  }

  // 价格解析算法
  function parsePrice(value) {
    if (value === null || value === undefined) return NaN;
    let s = String(value).trim().replace(/[，,\s]/g, '');
    if (!s) return NaN;

    if (s.includes('亿')) {
      const m = s.match(/^(\d+(?:\.\d+)?)亿(?:(\d+(?:\.\d+)?)万?)?$/);
      if (m) return Number(m[1]) * 10000 + Number(m[2] || 0);
    }

    if (s.includes('万')) {
      const w = s.match(/^(\d+)万(\d+)?$/);
      if (w) {
        const main = Number(w[1]);
        const decStr = w[2];
        if (!decStr || Number(decStr) === 0) return main;
        const dec = Number(decStr) / Math.pow(10, decStr.length);
        return Number((main + dec).toFixed(4));
      }
      return Number(s.replace('万', ''));
    }

    return Number(s);
  }

  // Tesseract.js OCR 智能识别
  let ocrWorker = null;

  async function runOCR(imageSources) {
    if (typeof Tesseract === 'undefined') {
      notice('Tesseract.js OCR 引擎尚未加载完成，请检查网络');
      return;
    }

    const pBox = $('#ocrProgress');
    const pBar = $('#ocrProgressBar');
    const status = $('#ocrStatus');
    if (pBox) pBox.style.display = 'block';
    if (pBar) pBar.style.width = '10%';
    if (status) status.textContent = '正在启动 OCR 识别引擎（首次需加载中文包）...';

    try {
      if (!ocrWorker) {
        ocrWorker = await Tesseract.createWorker('chi_sim+eng');
      }

      const extractedLines = [];
      let detectedDate = null;

      for (let idx = 0; idx < imageSources.length; idx++) {
        const src = imageSources[idx];
        if (status) status.textContent = `正在识别第 ${idx + 1}/${imageSources.length} 张截图...`;
        if (pBar) pBar.style.width = `${Math.round(((idx + 0.3) / imageSources.length) * 100)}%`;

        const res = await ocrWorker.recognize(src);
        if (pBar) pBar.style.width = `${Math.round(((idx + 0.9) / imageSources.length) * 100)}%`;
        const text = res.data.text;

        const dateMatch = text.match(/统计日期[：:\s]*(\d{4})[年.-](\d{1,2})[月.-](\d{1,2})/);
        if (dateMatch) {
          detectedDate = `${dateMatch[1]}-${String(dateMatch[2]).padStart(2, '0')}-${String(dateMatch[3]).padStart(2, '0')}`;
        }

        const rawLines = text.split(/\n+/);
        for (let raw of rawLines) {
          const line = raw.trim();
          if (!line || /道具名称|本期价格|历史高价|下架日期|对比差额|序号|图标/.test(line)) continue;

          const parts = line.split(/\t|,|，|\s{2,}/).map(x => x.trim()).filter(Boolean);
          if (parts.length >= 4) {
            let name = '';
            const numbers = [];

            for (let p of parts) {
              if (/^\d+(\.\d+)?(万|亿)?(\d+)?$/.test(p) || /^(\d+)万(\d+)$/.test(p) || /^(\d+)亿(\d+)$/.test(p)) {
                numbers.push(p);
              } else if (p.length >= 2 && !/^\d+$/.test(p) && !name) {
                name = p;
              }
            }

            if (name && numbers.length >= 3) {
              const cur = numbers[0];
              const high = numbers[numbers.length - 2];
              const low = numbers[numbers.length - 1];
              extractedLines.push(`${name},${cur},${high},${low}`);
            } else if (parts.length >= 4) {
              extractedLines.push(parts.slice(0, 4).join(','));
            }
          }
        }
      }

      if (detectedDate && $('#importDate')) {
        $('#importDate').value = detectedDate;
        const y = detectedDate.split('-')[0];
        if (y && $('#importYear')) $('#importYear').value = y;
      }

      if (extractedLines.length > 0) {
        const exist = $('#importText').value.trim();
        $('#importText').value = (exist ? exist + '\n' : '') + extractedLines.join('\n');
        if (status) status.textContent = `✅ 识别成功！已自动提取 ${extractedLines.length} 条道具物价数据。`;
        notice(`OCR 识别成功！提取 ${extractedLines.length} 条道具物价`);
      } else {
        if (status) status.textContent = '⚠️ 未自动解析出标准表格行，已保留原文本在输入框，请核对。';
        notice('未识别到标准数据列，请尝试提升截图清晰度');
      }

      if (pBar) pBar.style.width = '100%';
      setTimeout(() => { if (pBox) pBox.style.display = 'none'; }, 2500);
    } catch (err) {
      console.error('OCR error:', err);
      if (status) status.textContent = '❌ OCR 识别异常：' + (err.message || '引擎失败');
      if (pBox) pBox.style.display = 'none';
      notice('OCR 识别失败');
    }
  }

  if ($('#btnOcr')) {
    $('#btnOcr').onclick = async () => {
      const files = $('#imageFile') ? $('#imageFile').files : null;
      if (!files || !files.length) {
        return notice('请先选择要识别的截图文件');
      }
      const sources = [];
      for (let f of files) {
        sources.push(URL.createObjectURL(f));
      }
      await runOCR(sources);
      sources.forEach(src => URL.revokeObjectURL(src));
    };
  }

  // 剪贴板 Ctrl + V 直接识别图片
  if ($('#importModal')) {
    $('#importModal').addEventListener('paste', async e => {
      const clipboardItems = (e.clipboardData || e.originalEvent.clipboardData).items;
      let blob = null;
      for (let item of clipboardItems) {
        if (item.type.indexOf('image') !== -1) {
          blob = item.getAsFile();
          break;
        }
      }
      if (blob) {
        if (activePreviewUrl) URL.revokeObjectURL(activePreviewUrl);
        activePreviewUrl = URL.createObjectURL(blob);
        if ($('#imagePreview')) {
          $('#imagePreview').src = activePreviewUrl;
          $('#imagePreview').style.display = 'block';
        }
        notice('检测到剪贴板截图，正在进行 OCR 智能识别...');
        await runOCR([activePreviewUrl]);
      }
    });
  }

  // 批量数据导入
  if ($('#importSubmit')) {
    $('#importSubmit').onclick = () => {
      const text = $('#importText').value.trim();
      const season = $('#importSeason').value;
      const year = +$('#importYear').value;
      const date = $('#importDate').value;
      const source = [...$('#imageFile').files].map(f => f.name).join('、') || '批量/OCR 文本导入';

      if (!text || !year || !date) return notice('请填写年份、日期和至少一行数据');

      const addItems = [];
      for (const line of text.split(/\n+/)) {
        const p = line.trim().split(/\t|,|，|\s{2,}/).map(x => x.trim()).filter(Boolean);
        if (p.length < 4) continue;
        const [name, current, high, low] = p;
        const n = [current, high, low].map(parsePrice);
        if (name && n.every(Number.isFinite)) {
          addItems.push({
            id: generateUUID(),
            year,
            season,
            date,
            name,
            current: n[0],
            high: n[1],
            low: n[2],
            source
          });
        }
      }

      if (!addItems.length) return notice('未识别到有效行，请检查分隔格式');

      items.push(...addItems);
      save();
      $('#importModal').close();
      terminateOCRWorker();
      $('#importText').value = '';
      $('#imageFile').value = '';
      if ($('#imagePreview')) $('#imagePreview').style.display = 'none';
      render();
      notice(`已成功导入 ${addItems.length} 条物价数据`);
    };
  }

  // 手动新增单条数据
  if ($('#addSubmit')) {
    $('#addSubmit').onclick = () => {
      const name = $('#addName').value.trim();
      const current = +$('#addCurrent').value;
      const high = +$('#addHigh').value;
      const low = +$('#addLow').value;
      const year = +$('#addYear').value;
      const date = $('#addDate').value;

      if (!name || !date || ![current, high, low].every(Number.isFinite)) {
        return notice('请完整填写道具名称和三项价格');
      }

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
    const tbody = $('#categoryRulesBody');
    if (!tbody) return;

    tbody.innerHTML = rules.map((r) => {
      const kwStr = Array.isArray(r.keywords) ? r.keywords.join(', ') : String(r.keywords || '');
      return `<tr>
        <td style="padding:6px 8px;">
          <select class="cat-season-select" style="width:100%; height:32px; border:1px solid #c6d2db; border-radius:4px; padding:0 4px;">
            <option ${r.season==='通用'?'selected':''}>通用</option>
            <option ${r.season==='春节'?'selected':''}>春节</option>
            <option ${r.season==='耕耘'?'selected':''}>耕耘</option>
            <option ${r.season==='夏日'?'selected':''}>夏日</option>
            <option ${r.season==='金秋'?'selected':''}>金秋</option>
          </select>
        </td>
        <td style="padding:6px 8px;">
          <input class="cat-label-input" value="${r.label || ''}" placeholder="分类名称" style="width:100%; height:32px; border:1px solid #c6d2db; border-radius:4px; padding:0 8px;">
        </td>
        <td style="padding:6px 8px;">
          <input class="cat-keywords-input" value="${kwStr}" placeholder="用逗号分隔关键字" style="width:100%; height:32px; border:1px solid #c6d2db; border-radius:4px; padding:0 8px;">
        </td>
        <td style="padding:6px 8px; text-align:center;">
          <button type="button" class="btn" style="background:#fde8e8; color:var(--red); padding:4px 8px; font-size:12px; border:none; border-radius:3px;" onclick="this.closest('tr').remove()">删除</button>
        </td>
      </tr>`;
    }).join('');
  }

  if ($('#openCategoryModal')) {
    $('#openCategoryModal').onclick = () => {
      renderCategoryModalRows(categoryMap);
      openModal('categoryModal');
    };
  }

  if ($('#addCategoryRuleBtn')) {
    $('#addCategoryRuleBtn').onclick = () => {
      const tbody = $('#categoryRulesBody');
      if (!tbody) return;
      const tr = document.createElement('tr');
      tr.innerHTML = `
        <td style="padding:6px 8px;">
          <select class="cat-season-select" style="width:100%; height:32px; border:1px solid #c6d2db; border-radius:4px; padding:0 4px;">
            <option>通用</option>
            <option>春节</option>
            <option>耕耘</option>
            <option>夏日</option>
            <option>金秋</option>
          </select>
        </td>
        <td style="padding:6px 8px;">
          <input class="cat-label-input" placeholder="分类名称" style="width:100%; height:32px; border:1px solid #c6d2db; border-radius:4px; padding:0 8px;">
        </td>
        <td style="padding:6px 8px;">
          <input class="cat-keywords-input" placeholder="用逗号分隔关键字" style="width:100%; height:32px; border:1px solid #c6d2db; border-radius:4px; padding:0 8px;">
        </td>
        <td style="padding:6px 8px; text-align:center;">
          <button type="button" class="btn" style="background:#fde8e8; color:var(--red); padding:4px 8px; font-size:12px; border:none; border-radius:3px;" onclick="this.closest('tr').remove()">删除</button>
        </td>
      `;
      tbody.appendChild(tr);
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
      const rows = document.querySelectorAll('#categoryRulesBody tr');
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
        const fileName = `dnf节日礼包物价数据_${getTimestampStr()}.json`;
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

        const fileName = `dnf节日礼包物价数据_${getTimestampStr()}.csv`;
        downloadFile('\ufeff' + csvLines, fileName, 'text/csv;charset=utf-8');
        notice(`已成功导出 ${total} 条 CSV 物价数据文件！`);
      }
    };
  }

  window.addEventListener('resize', render);

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
