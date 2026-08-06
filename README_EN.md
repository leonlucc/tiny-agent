<div align="center">
<h1>Tiny Agent</h1>
<p>Build an AI agent from scratch, starting with a single LLM call</p>

<a href="https://github.com/leonlucc/tiny-agent/stargazers"><img src="https://img.shields.io/github/stars/leonlucc/tiny-agent?style=flat-square" alt="Stars"></a>
<a href="https://github.com/leonlucc/tiny-agent/blob/main/LICENSE"><img src="https://img.shields.io/badge/License-Apache_2.0-blue.svg?style=flat-square" alt="License"></a>
<a href="https://python.org"><img src="https://img.shields.io/badge/Python-3.12+-green.svg?style=flat-square" alt="Python"></a>

**English** | [简体中文](README.md) 
<br>
</div>

Tiny Agent is a lightweight open-source AI agent project and a progressive development tutorial that evolves alongside its source code. Following a **step-by-step, learn-by-building** approach, it avoids complex frameworks and starts with the simplest large language model call. You will progressively build an agent with perception, memory, planning, and action capabilities. It is ideal for developers with a foundation in Python who want to understand the underlying principles of AI agents.

## Highlights

* 🚀 **Minimal and lightweight:** No redundant abstractions. Complete code comments and easy-to-read single-file modules make every line approachable for learning.
* 🧩 **Modular and cohesive:** LLMs, vector stores, tool calling, and memory are fully decoupled, so each component can be replaced or extended independently.
* 🔧 **Monolithic architecture:** The frontend and backend run in a single process. No frontend build tool is required, making local debugging simple.
* 🤖 **Complete modern agent workflow:** Covers the full path from basic LLM conversations to ReAct, long-term memory, and multi-agent workflows.
* 📚 **Progressive tutorial versions:** Every Git tag is independently runnable. Follow each iteration hands-on to understand the principles as you build.

## Target Audience

* **Developers seeking deep understanding**: Tired of black-box frameworks like LangChain and ready to build ReAct, RAG, and Tool Calling from scratch.
* **Python learners wanting hands-on projects**: Have basic Python knowledge and want a clean, line-by-line debuggable repository to master AI Agents.
* **Engineers building rapid PoCs**: Want a zero-frontend-setup (no Vue/React/npm) environment with a single-command Web UI launch.

> ⚠️ **Note**: This project focuses on **educational concepts and source-code learning**. For ready-to-use production frameworks, consider LangChain, CrewAI, etc.
---

## Tech Stack

### Backend

* Python (3.12+) + FastAPI
* A lightweight web service with no heavyweight agent framework dependencies

### Frontend

* Native HTML + CSS + Vanilla JavaScript
* Avoids frameworks such as Vue and React to lower the frontend learning curve

---

## Quick Start

Clone the repository, install dependencies, configure the environment, and start the service:

```bash
# 1. Clone the repository
git clone git@github.com:leonlucc/tiny-agent.git
cd tiny-agent

# 2. Enter the backend directory and install dependencies
cd backend
pip install -r requirements.txt

# 3. Configure your LLM API key
cp .env.example .env
# Open .env and set values such as LLM_API_KEY for your LLM provider.

# 4. Start the web service
python -m app.main
```

Then open `http://127.0.0.1:8000` in your browser to send messages and view Server-Sent Events (SSE) streaming output.

![](./book/src/images/snapshot-v0.3.gif)

👉 See the [complete quick-start guide](doc/quick-start.md) (Chinese).

---

## Roadmap

Tiny Agent evolves progressively, with each release introducing one new core capability. Switch Git tags at any time and build the complete agent system from the ground up.

| Version | Topic | Core capabilities | UI changes |
|:---|:---|:---|:---|
| **v0.1** | Hello LLM | LLM SDK configuration and single-turn Q&A | No UI; CLI only |
| **v0.2** | Streaming Web | SSE streaming output and real-time web rendering | Minimal web page with token-by-token output |
| **v0.3** | Multi-turn Chat | Message-history management and continuous multi-turn conversations | Message list with conversation history |
| **v0.4** | Structured Output | Prompt templates and JSON Schema structured output | JSON rendering in the chat interface |
| **v0.5** | Basic RAG | Document chunking, embeddings, local vector storage, and a retrieval-generation loop | Shows document sources |
| **v0.6** | Tool Calling | Tool declarations, argument generation, execution, and result injection | Displays the tool-calling flow |
| **v0.7** | Agent Loop | ReAct loops, autonomous decisions, and termination control | Agent mode with execution-trace visualization |

👉 See the [full roadmap](book/src/roadmap.md) (Chinese).

---

## Design Principles

Tiny Agent prioritizes teaching and learning core principles over production-grade business complexity:

* **Separate principles from engineering:** Implement essential agent capabilities with the least code and fewest third-party dependencies. Developers can read the core execution flow directly, without black-box abstractions obscuring the underlying principles.
* **Deliberate UI iteration:** Each release adds only the frontend code needed to support its new capability, without unnecessary components. This lets developers compare backend and frontend changes to see how new backend features map to frontend interactions.
* **Progressive version evolution:** Every Git tag is a complete, runnable version with no missing intermediate code. Learn progressively by release, or switch to a specific version to focus on one capability and build a layered learning path.

## License

* **Source code** (files in `frontend` and `backend`): licensed under the **Apache License 2.0**.
* **Tutorial documentation** (documents in `book` and `doc`): all rights reserved and licensed under **CC BY-NC-ND 4.0**. Commercial use and modifications are prohibited.
