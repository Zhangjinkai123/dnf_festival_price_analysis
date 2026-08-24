# Project Guidelines & Rules

- **功能可用性与自我验证原则**：对于后续所有的功能需求开发，必要前提是保持原功能的可用性。在向用户反馈结果之前，必须先在沙盒环境中自行完成验证。
- **物价数据录入标准规范**：当用户提供物价图片或文本要求导入/更新数据时，请严格参考 [DATA_IMPORT_GUIDE.md](../DATA_IMPORT_GUIDE.md)，同步写入 `data/price_data.json` 与 `js/data.js` 并按“万金币”统一换算。
