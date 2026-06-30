# 导读

## 第一部分：初探大模型（基础篇）


### 第一章：认识 LLM API：环境搭建与极简单轮问答

* **对应版本**：`v0.0.1 Hello LLM`
* **定位**：项目起步，建立最小闭环认知
* **核心能力**：LLM API 基础调用与单轮问答，环境变量配置与基础异常处理（API Key / Timeout / Model Error）
* **UI演进**：无 UI，仅 CLI 终端输出
* **工程导读**：

  * 【代码 Diff】：从 0 到 1 调用 `chat.completions.create`
  * 【前后端对照】：CLI直连 LLM vs 后端代理调用模型
  * 【架构反思】：为什么必须从 CLI 开始？UI 为什么会掩盖 LLM 本质？



### 第二章：多轮对话设计：聊天历史与流式响应

* **对应版本**：`v0.1.0 Chat`
* **定位**：从单轮问答走向连续对话
* **核心能力**：Chat History 构建、多轮上下文拼装、SSE 流式输出
* **UI演进**：单页 Chat 聊天界面（输入框 + 消息列表 + 流式输出）
* **工程导读**：

  * 【代码 Diff】：`List[Message]` 构建上下文与 FastAPI StreamingResponse
  * 【前后端对照】：SSE流式输出 vs fetch stream 渲染
  * 【架构反思】：LLM 无状态 vs “伪记忆”的实现方式



## 第二部分：构建 Agent 控制能力（进阶篇）



### 第三章：提示词工程：系统提示词与结构化输出

* **对应版本**：`v0.2.0 Prompt Engineering`
* **定位**：控制模型行为的第一性能力
* **核心能力**：System Prompt、Prompt Template、上下文管理、JSON结构化输出
* **UI演进**：Prompt 配置面板（System Prompt / Temperature / Model）
* **工程导读**：

  * 【代码 Diff】：Prompt拼装 + Pydantic结构化输出
  * 【前后端对照】：前端参数配置 → 后端动态Prompt构建
  * 【架构反思】：Prompt 从“技巧”走向“系统接口”



### 第四章：外挂知识库：Embedding 与 RAG 最小实现

* **对应版本**：`v0.3.0 RAG`
* **定位**：引入外部知识增强模型能力
* **核心能力**：Embedding、向量检索、Chunking、RAG链路（检索→拼接→生成）
* **UI演进**：本地知识库上传与文档管理界面
* **工程导读**：

  * 【代码 Diff】：最小向量检索（cosine similarity）
  * 【前后端对照】：文件上传 → 切片 → 向量化 → 检索流程
  * 【架构反思】：RAG ≠ 搜索，是“上下文重构机制”



### 第五章：工具能力：Function Calling 与 MCP 接入

* **对应版本**：`v0.4.0 Tool Calling`
* **定位**：赋予 Agent 执行外部能力
* **核心能力**：Function Calling、Tool Schema、MCP协议适配、工具执行链路
* **UI演进**：Tool调用链路可视化（调用→参数→结果）
* **工程导读**：

  * 【代码 Diff】：函数 → JSON Schema → tool_calls 执行
  * 【前后端对照】：Tool调用时间线展示
  * 【架构反思】：工具规模化后为何必须引入统一协议（MCP）



### 第六章：Agent核心循环：ReAct 循环引擎

* **对应版本**：`v0.5.0 Agent Loop`
* **定位**：Agent“思考与执行”的核心机制
* **核心能力**：ReAct、Think-Act-Observe循环、状态机控制
* **UI演进**：Agent执行状态可视化（Thinking / Acting / Observing）
* **工程导读**：

  * 【代码 Diff】：while循环状态机 + tool injection
  * 【前后端对照】：SSE驱动逐步执行展示
  * 【架构反思】：循环控制与Token膨胀问题



## 第三部分：构建完整 Agent 系统（核心篇）



### 第七章：极简 MVP：完整 Agent 生命周期组装

* **对应版本**：`v1.0.0 Tiny Agent MVP`
* **定位**：完整 Agent 生命周期里程碑（系统首次成型）
* **核心能力**：LLM + Prompt + Tool + RAG + Loop 全链路集成
* **UI演进**：完整 Agent 控制面板（对话 + 执行链路 + 配置统一）
* **工程导读**：

  * 【代码 Diff】：模块化重组（Agent / ToolManager / Context）
  * 【前后端对照】：统一Dashboard驱动完整生命周期
  * 【架构反思】：从“能力拼接”到“Agent系统成型”



### 第八章：技能管理：Skills 动态注册与编排

* **对应版本**：`v1.1.0 Skills`
* **定位**：工具体系扩展与插件化
* **核心能力**：Skills注册、发现、动态加载、编排执行
* **UI演进**：Skills管理界面（启用 / 禁用 / 调用统计）
* **工程导读**：

  * 【代码 Diff】：插件扫描 + 动态加载机制
  * 【前后端对照】：技能开关 → Tool列表动态更新
  * 【架构反思】：工具数量爆炸后的治理方式



### 第九章：记忆系统：长短期记忆与摘要压缩机制

* **对应版本**：`v1.2.0 Memory`
* **定位**：突破上下文窗口限制
* **核心能力**：记忆存储、检索、摘要压缩、长期记忆
* **UI演进**：Memory管理界面（查看 / 编辑 / 检索）
* **工程导读**：

  * 【代码 Diff】：MemoryManager + summary pipeline
  * 【前后端对照】：历史 → 压缩 → 向量化存储
  * 【架构反思】：记忆不是历史，而是“信息筛选系统”



### 第十章：多智能体系统：角色协作与任务分发

* **对应版本**：`v1.3.0 Multi-Agent`
* **定位**：多 Agent 协作系统
* **核心能力**：Agent分工、Router调度、Supervisor机制
* **UI演进**：多Agent状态面板（任务流转与协作展示）
* **工程导读**：

  * 【代码 Diff】：Router + Planner + Worker结构拆分
  * 【前后端对照】：任务分发与状态流转展示
  * 【架构反思】：多智能体系统的通信成本与框架价值
