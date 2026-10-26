# 图分宝 · DSH 侧栏插件

把图片人工偏好评分放进 DeepSeek Harness 的左侧栏。安装后，侧栏出现「图片评分」，点开即可完成目录选择、五图对比、胜负标注和 `scores.json` 写入。

不依赖原来的独立网页，也不需要单独启动 8765 端口：图片读取、目录浏览和 JSON 写入都由 DSH Host 插件在同一进程内完成。

![DSH 中的五图评分](screenshots/dsh-selected.png)

## 安装到当前 DSH

插件包目录：

```text
/home/video408/Project/img_process/dsh-plugin
```

在 DSH Web GUI 中：

1. 左侧栏点击 **插件**。
2. 点击 **添加插件 → 安装第三方插件**。
3. 在包名/本地路径输入框中填入：
   ```text
   /home/video408/Project/img_process/dsh-plugin
   ```
4. 点击 **安装**，完成后点击 **立即启用**。
5. 左侧栏出现 **图片评分**，点击进入。

安装后如果侧栏没有立即出现，刷新一次页面。插件属于当前 `web` profile，可以在插件管理器中随时停用或卸载。

> 也可以把 `../dist/dsh-image-scorer-0.1.2.tgz`（绝对路径）作为本地包路径安装。

## 使用

1. 输入或浏览选择包含 **5 个子文件夹** 的根目录，点击「开始评分」。
2. 每组 5 张图并排展示，图下方固定标注子文件夹名称；点图片可看大图。
3. 点击某张图的「胜者」和另一张图的「败者」，再点「保存并下一组」。
4. 没有明确偏好时点「丢弃本组」：不写入 JSON；若原来已有记录，会删除对应记录。
5. 点「汇总」查看已记录/未记录数量，下载 JSON，或跳到未记录组。

可以先用内置演示数据熟悉流程。

## 数据要求

```text
根目录/
├── 子文件夹 A/
│   ├── 0001.jpg
│   ├── 0002.jpg
│   └── ...
├── 子文件夹 B/
├── 子文件夹 C/
├── 子文件夹 D/
├── 子文件夹 E/
└── scores.json       # 保存后自动生成
```

- 根目录下必须有且仅有 5 个非隐藏子文件夹。
- 5 个文件夹中的图片数量必须相同且大于 0。
- 图片按文件名自然排序，每个文件夹的第 N 张配成第 N 组。
- 支持 `.jpg` `.jpeg` `.png` `.webp` `.bmp` `.gif` `.avif`。
- 隐藏文件/文件夹、非图片文件会被忽略。

## 输出 JSON

文件写入所选根目录下的 `scores.json`：

```json
{
  "01_valley": {
    "win": "Ours",
    "lose": "Baseline"
  }
}
```

- `win` / `lose` 为子文件夹名称。
- 记录名默认取五张图共享的文件名（不含扩展名）。
- 文件名不一致时取第一个子文件夹的文件名；重名自动追加 `__2`。
- 丢弃的组不写入；若已有记录，丢弃会删除对应键。
- 写入使用原子替换，避免中断产生半个 JSON。

## 架构

- **Host (`index.js` + `core.js`)**：注册 DSH 认证的 exact Fetch 路由，负责目录扫描、图片流、记录校验与原子 JSON 写入。
- **Client (`client.js`)**：在 `sidebar.panellist` 和顶层 `main` slot 注册原生 React 页面，使用 DSH 主题 token。
- **Bundle (`cordis.patch.yml`)**：插入一条 `image-scorer` 插件行。
- 演示数据随插件打包在 `demo_data/`。

## 开发与测试

```bash
cd /home/video408/Project/img_process/dsh-plugin
node --test test/core.test.js
node --check index.js
node --check client.js
```

当前测试覆盖：五文件夹校验、数量校验、自然排序、记录名冲突、原子写入、并发写入、丢弃删除、目录浏览。

## 当前范围

已包含完整的人工评分 UI 与 JSON 读写。后续可在这个 Host 插件上继续注册 Agent 工具，让我直接读取 `scores.json`、统计各子文件夹胜率或生成报告。

## 更新记录

### 0.1.2

- 品牌名称由「五图鉴」改为「图分宝」。

### 0.1.1

- 修复「丢弃本组」点击无响应：`Scoring` 组件漏解构 `setBusyText`，点击时抛出 `TypeError`，现已补齐。
- 已验证无记录时直接跳到下一组；已有记录时弹出确认，确认后删除对应 JSON 键并跳转。
