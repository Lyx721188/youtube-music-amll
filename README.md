# YouTube Music AMLL Lyrics

一个 Chromium 扩展，在 YouTube Music 歌词页面中显示 [AMLL](https://github.com/amll-dev/applemusic-like-lyrics)（Apple Music-like Lyrics）高质量滚动歌词。

## 功能

- **逐字歌词滚动** — 基于 AMLL 核心的流畅逐字动画
- **多歌词源支持** — 自动从多个来源搜索并加载歌词：
  1. AMLL-DB（NCM 网易云音乐 TTML）
  2. AMLL-DB（Apple Music TTML）
  3. LRCLIB（同步 LRC 歌词）
  4. LRCLIB（任意匹配）
  5. LRCLIB（仅标题匹配）
- **纯黑背景** — 关闭流体/模糊封面效果，专注歌词阅读
- **HarmonyOS Sans SC 字体** — 自动加载并注入
- **聚焦行居中** — 当前歌词行居中显示
- **工具栏可隐藏** — 隐藏后右上角红点恢复
- **智能歌曲识别** — 多级 fallback 识别当前播放歌曲

## 安装

### 从源码构建

```bash
cd extension
npm install
node esbuild.config.mjs
```

### 加载到浏览器

1. 打开 `chrome://extensions/`
2. 开启右上角「开发者模式」
3. 点击「加载已解压的扩展程序」
4. 选择 `extension/dist/` 目录

## 使用

1. 在 YouTube Music 中播放任意歌曲
2. 点击播放器右下角的「歌词」标签页
3. 歌词将自动搜索并显示

## 技术细节

- 使用 esbuild 打包为 IIFE 格式
- 通过 pixi/gl-matrix stub 实现纯 DOM 歌词渲染（无需 WebGL）
- 跨域请求通过 service worker (background script) 中转
- 修改了 AMLL core 的非活跃行透明度（0.2 → 0.55）和滚动回正时间（5s → 3s）

## 致谢

- [AMLL (Apple Music-like Lyrics)](https://github.com/amll-dev/applemusic-like-lyrics) — 歌词渲染核心
- [LRCLIB](https://lrclib.net/) — LRC 歌词数据库
- [HarmonyOS Sans](https://developer.harmonyos.com/) — 字体

## License

AGPL-3.0
