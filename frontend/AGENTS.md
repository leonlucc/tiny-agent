### 1. 设计目标
- 纯原生 JavaScript，无框架依赖
- HTML 预定义结构，JS 负责交互与更新

### 2. 项目结构
```
index.html
css/
├── base.css              # 全局变量与基础样式
├── sidebar.css           # 对应 components/sidebar.js
└── chat.css              # 对应 components/chat-ui.js
js/
├── app.js                 # 入口、状态中心、统一调度
├── components/
│   ├── sidebar.js         # 侧边栏（对话列表 + 新建）
│   └── chat-ui.js         # 聊天区（消息列表 + 输入框）
├── services/
│   ├── api.js             # API
│   └── sse.js             # 流式数据处理工具
```

### 3. 设计原则

- **HTML 预定义框架**：`index.html` 直接写出侧边栏、消息区、输入区的 DOM 结构，样式与布局完全独立。
- **app.js 作为唯一调度中心**：启动时获取所有 DOM 节点，分发给组件；持有全局状态（对话列表、当前对话、消息），所有状态变更均在此完成，然后统一驱动界面更新。
- **独立组件**：每个组件只负责接收容器 DOM、绑定事件、暴露初始化、局部更新函数，内部不存储业务数据。
- **单向数据流**：用户操作 → 回调至 app.js → 修改状态 → 调用组件局部更新函数 → 重绘对应区域。
