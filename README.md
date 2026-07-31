# 🎮 DNF 节日礼包物价记录档案与历史分析系统

[![应用形态](https://img.shields.io/badge/Architecture-Multi--Page%20Web-blue)](#)
[![技术栈](https://img.shields.io/badge/Tech-HTML5%20%7C%20CSS3%20%7C%20JS--ES6-orange)](#)
[![数据格式](https://img.shields.io/badge/Data-Pure--JSON-brightgreen)](#)
[![OCR 引擎](https://img.shields.io/badge/OCR-Tesseract.js-green)](#)

---

## 📖 项目简介
**DNF 节日礼包物价记录档案与历史分析系统** 是一款专为《地下城与勇士》（DNF）玩家打造的高效物价追踪与跨年对比分析工具。

系统收录了 2025~2026 年耕耘、春节、夏日、金秋等四大节日礼包中 180+ 条核心可交易道具（称号、装扮、增幅券/强化券、宠物/宝珠、白金徽章等）的历史本期价、高价与低价档案，并提供玩家视角下的同类产物横向价格比对与图像 OCR 自动提取功能。

---

## ✨ 页面与功能亮点

| 页面 / 模块 | 说明描述 |
| :--- | :--- |
| **🏠 首页 (`index.html`)** | **原始物价明细页面**。完整列出所有道具的年份、礼包类型、统计日期、本期价格、历史高/低价及历史区间涨幅。包含头部数据总量徽章与右上侧已筛选数量动态统计。 |
| **🏷️ 对比页 (`compare.html`)** | **跨年同类对比页面**。自动将不同年份的同类产物（如 2026 年与 2025 年的普通称号、+12 增幅券等）罗列对比，按**年份降序**排列，带有水位柱与同比涨跌标签。 |
| **🔍 搜索框内容联想** | 支持输入关键字（如 `犬夜叉`、`称号`）自动弹出匹配下拉列表，支持鼠标与键盘 `↑/↓/Enter` 快速导航高亮选定。 |
| **⚙️ 产物映射表管理** | 允许玩家自主查看并修改同类产物的归类映射规则（支持多关键字逗号分隔），配置保存在 LocalStorage 并在对比页即时生效。 |
| **🚀 OCR 截图智能提取** | 集成 Tesseract.js 识别引擎。支持上传游戏截图或使用 `Ctrl+V` 剪贴板快速识别，自动解析提取道具名称与价格。 |
| **💾 CSV / JSON 导出** | 支持一键导出全库物价数据为标准 UTF-8 CSV 或 JSON 文件，方便备份与分享。 |

---

## 🛠️ 技术架构与文件说明

* **多页面路由解耦**：原始物价明细（`index.html`）与跨年同类对比（`compare.html`）分离为独立页面，通过 Tab 页签平滑跳转切换。
* **数据与控制解耦**：数据（`data/`）、样式（`css/`）与逻辑（`js/`）彻底模块化分离。
* **智能数据加载**：优先异步 `fetch()` 加载标准 JSON 数据文件；同时支持本地 `file://` 协议无报错双击运行降级兼容。

### 项目目录结构
```text
dnf_festival_price_analysis/
├── index.html                        # 首页入口：原始物价明细页面
├── compare.html                      # 独立页面：跨年同类对比分析页面
├── dnf_festival_price_analysis.html  # 兼容镜像入口 (同 index.html)
├── css/
│   └── style.css                     # 独立 CSS 样式文件
├── js/
│   ├── data.js                       # 全能兼容降级数据模块
│   └── app.js                        # 核心业务逻辑与视图渲染控制
├── data/
│   ├── price_data.json               # 纯 JSON 格式物价种子数据
│   └── category_map.json             # 纯 JSON 格式同类对比映射表
├── README.md                          # 项目概览与使用指南
└── CHANGELOG.md                       # 开发与更新日志
```

---

## 🚀 快速使用指南

1. **运行首页**：双击直接在浏览器中打开 [index.html](file:///d:/self/work/aiproject/outputs/dnf_festival_price_analysis/index.html)。
2. **切换对比页面**：点击筛选栏中的 **`🏷️ 跨年同类对比`** Tab 页签，即可跳转至 [compare.html](file:///d:/self/work/aiproject/outputs/dnf_festival_price_analysis/compare.html) 进行跨年横向对比。
3. **内容联想搜索**：在搜索框中输入 `犬夜叉` 等词汇，即可触发智能下拉提示。
