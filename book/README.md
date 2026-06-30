# 说明
本路径为项目配套书籍，基于 **mdBook** 构建。

### 1. 安装环境
打开终端并运行以下命令：
```bash
brew install mdbook
```

### 2. 本地运行
进入`book`目录并启动本地实时预览服务器：
```bash
mdbook serve
```
启动后，在浏览器中访问：[http://localhost:3000](http://localhost:3000)

### 3. 构建静态网页
如果你需要生成用于发布的静态 HTML 文件，请运行：
```bash
mdbook build
```
生成的文件将存放在 `book/` 目录下

## 🛠️ 导出电子书 (可选)

支持导出为 PDF 和 EPUB 格式。

1. **安装依赖**：
   ```bash
   brew install rust
   cargo install mdbook-pdf mdbook-epub
   ```
2. **执行导出**：
   运行 `mdbook build` 后，可在 `book/pdf/` 和 `book/epub/` 目录下找到对应的电子书文件。