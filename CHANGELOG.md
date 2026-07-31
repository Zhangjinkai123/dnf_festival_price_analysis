# 毒奶粉节日礼包物价分析系统 - 变更与开发日志 (CHANGELOG)

**更新日期**：2026年7月31日  
**主入口文件**：[index.html](file:///d:/self/work/aiproject/outputs/dnf_festival_price_analysis/index.html) | [compare.html](file:///d:/self/work/aiproject/outputs/dnf_festival_price_analysis/compare.html)  

---

## 📌 项目概述
本项目为毒奶粉节日礼包（耕耘、春节、夏日、金秋）历年道具价格的录入、跨年对比分析、OCR 截图提取及数据管理系统。

---

## 🚀 最新更新（多页面解耦拆分与页面切换 Tab）

### 1. 🌐 页面解耦独立化 (`index.html` & `compare.html`)
- **`index.html`**：首页专注于展示【原始物价明细表格】数据，默认界面简洁高效。
- **`compare.html`**：独立拆分出的【跨年同类对比分析】页面，以卡片分组、年份降序、历史水位柱展示同类产物横向对比。

### 2. 🔗 Tab 页签无缝切换 (`.navTabs`)
- 在两页面的筛选工具栏中增设高质感 Tab 选项卡（`📋 原始物价明细` / `🏷️ 跨年同类对比`），支持点击快速跨页面跳转。

### 3. 🔍 搜索框内容联想下拉框 (`#searchSuggest`)
- 支持在搜索框中输入 `犬夜叉`、`称号` 等关键字弹出智能关联列表。
- 支持键盘 `↑/↓/Enter` 上下导航选定与高亮显示。

### 4. 📊 动态数据数量统计徽章 (`#tableStatCount`)
- 在明细表格右上角加入卡片样式的筛选数量实时统计：`已筛选出 42 条记录 (全库 186 条)`。

---

## 📁 多页面架构文件结构

```text
dnf_festival_price_analysis/
├── index.html                        # 首页：原始物价明细页面
├── compare.html                      # 页面：跨年同类对比页面
├── css/
│   └── style.css                     # 独立 CSS 样式文件
├── js/
│   ├── data.js                       # 备用降级数据模块
│   └── app.js                        # 核心控制与智能渲染引擎
├── data/
│   ├── price_data.json               # 纯 JSON 格式物价种子数据
│   └── category_map.json             # 纯 JSON 格式同类对比映射表
├── README.md                          # 项目概览与使用指南
└── CHANGELOG.md                       # 开发与更新日志
```
