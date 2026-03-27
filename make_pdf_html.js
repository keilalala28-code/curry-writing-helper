const fs = require('fs');
const path = require('path');

const base = path.join(__dirname);
const files = ['ss_login','ss_home','ss_writing','ss_browse','ss_detail','ss_import','ss_framework','ss_stats'];
const b64 = {};
for (const f of files) {
  const p = path.join(base, f + '.png');
  if (fs.existsSync(p)) {
    b64[f] = fs.readFileSync(p).toString('base64');
    console.log('loaded', f, b64[f].length);
  } else {
    console.log('missing', p);
  }
}

const img = (key, alt) => b64[key]
  ? `<img src="data:image/png;base64,${b64[key]}" alt="${alt}" style="width:100%;border-radius:8px;border:1px solid #eee;margin:12px 0;">`
  : `<div style="background:#f5f5f5;padding:20px;text-align:center;color:#999">[截图：${alt}]</div>`;

const html = `<!DOCTYPE html>
<html lang="zh-CN">
<head>
<meta charset="UTF-8">
<style>
  * { box-sizing: border-box; margin: 0; padding: 0; }
  @page { size: A4; margin: 20mm 18mm; }
  body { font-family: 'PingFang SC', 'Microsoft YaHei', sans-serif; font-size: 13px; color: #222; line-height: 1.7; }

  /* Cover */
  .cover { display:flex; flex-direction:column; align-items:center; justify-content:center; min-height:90vh; text-align:center; page-break-after:always; }
  .cover-logo { font-size:64px; margin-bottom:16px; }
  .cover-title { font-size:32px; font-weight:700; color:#e85d4a; margin-bottom:8px; }
  .cover-sub { font-size:16px; color:#888; margin-bottom:32px; }
  .cover-date { font-size:13px; color:#bbb; margin-top:40px; }
  .cover-toc { text-align:left; background:#fafafa; border-radius:12px; padding:24px 32px; margin-top:24px; min-width:320px; }
  .cover-toc h3 { font-size:14px; color:#555; margin-bottom:12px; }
  .cover-toc li { list-style:none; padding:4px 0; color:#666; font-size:13px; border-bottom:1px dashed #eee; }
  .cover-toc li:last-child { border:none; }
  .cover-toc .num { color:#e85d4a; font-weight:600; margin-right:8px; }

  /* Section */
  .section { page-break-before: always; margin-bottom: 32px; }
  .section:first-of-type { page-break-before: avoid; }
  .section-header { display:flex; align-items:center; gap:12px; margin-bottom:20px; padding-bottom:10px; border-bottom:2px solid #f0f0f0; }
  .section-num { background:#e85d4a; color:#fff; width:28px; height:28px; border-radius:50%; display:flex; align-items:center; justify-content:center; font-size:13px; font-weight:700; flex-shrink:0; }
  .section-title { font-size:20px; font-weight:700; color:#1a1a1a; }

  /* Content */
  h3 { font-size:14px; color:#e85d4a; margin: 18px 0 6px; font-weight:600; }
  p { margin-bottom: 8px; color: #444; }
  .tip { background:#fff8f7; border-left:3px solid #e85d4a; padding:10px 14px; border-radius:0 6px 6px 0; margin:12px 0; color:#555; font-size:12px; }
  .tip strong { color:#e85d4a; }
  .tag { display:inline-block; background:#f5f5f7; border-radius:4px; padding:2px 8px; font-size:11px; color:#666; margin:2px; }
  .tag.red { background:#fff0ee; color:#e85d4a; }
  .two-col { display:grid; grid-template-columns:1fr 1fr; gap:16px; margin:12px 0; }
  .box { background:#f9f9f9; border-radius:8px; padding:12px 16px; }
  .box-title { font-size:12px; color:#999; margin-bottom:4px; }
  .box-val { font-size:16px; font-weight:700; color:#e85d4a; }
  ul { padding-left:18px; color:#444; margin:8px 0; }
  ul li { margin-bottom:4px; }
  .step { display:flex; gap:10px; margin:10px 0; align-items:flex-start; }
  .step-num { background:#e85d4a; color:#fff; min-width:22px; height:22px; border-radius:50%; display:flex; align-items:center; justify-content:center; font-size:11px; font-weight:700; flex-shrink:0; margin-top:1px; }
  .step-text { color:#444; font-size:13px; }
  .caption { font-size:11px; color:#aaa; text-align:center; margin-top:4px; margin-bottom:16px; }
  .warn { background:#fffbf0; border:1px solid #fde8b0; border-radius:6px; padding:10px 14px; margin:12px 0; font-size:12px; color:#7a6020; }
  .ai-badge { display:inline-block; background:#e85d4a; color:#fff; border-radius:4px; padding:1px 6px; font-size:10px; font-weight:600; margin-left:4px; vertical-align:middle; }
</style>
</head>
<body>

<!-- COVER -->
<div class="cover">
  <div class="cover-logo">🍛</div>
  <div class="cover-title">咖喱小助手</div>
  <div class="cover-sub">写作资源管理库 · 用户使用指南</div>
  <div class="cover-toc">
    <h3>📋 目录</h3>
    <ul>
      <li><span class="num">01</span>登录系统</li>
      <li><span class="num">02</span>每日灵感 — 主题推荐与文章发现</li>
      <li><span class="num">03</span>码字计划 — 每日写作目标追踪</li>
      <li><span class="num">04</span>分类浏览 — 文章管理与筛选</li>
      <li><span class="num">05</span>文章详情 — 查看与编辑</li>
      <li><span class="num">06</span>导入文章 — 手动与批量上传</li>
      <li><span class="num">07</span>故事框架生成器 — AI 创作辅助</li>
      <li><span class="num">08</span>数据统计 — 资源库全貌</li>
      <li><span class="num">09</span>附录：功能与 AI 依赖关系说明</li>
    </ul>
  </div>
  <div class="cover-date">生成日期：2026年3月</div>
</div>

<!-- 01 登录 -->
<div class="section">
  <div class="section-header">
    <div class="section-num">1</div>
    <div class="section-title">🔐 登录系统</div>
  </div>

  ${img('ss_login', '登录页面')}
  <p class="caption">▲ 登录页面</p>

  <div class="two-col">
    <div class="box"><div class="box-title">默认用户名</div><div class="box-val">carly</div></div>
    <div class="box"><div class="box-title">默认密码</div><div class="box-val">carly</div></div>
  </div>

  <div class="tip">✅ 登录状态保持 <strong>7 天</strong>，无需频繁重新登录。关闭浏览器后重新打开仍保持登录。</div>
</div>

<!-- 02 每日灵感 -->
<div class="section">
  <div class="section-header">
    <div class="section-num">2</div>
    <div class="section-title">🎯 每日灵感</div>
  </div>
  <p>系统每天自动推荐一个写作主题，并关联展示相关参考文章，帮助快速进入创作状态。</p>

  ${img('ss_home', '每日灵感页面')}
  <p class="caption">▲ 每日灵感主页，右上角显示随机鼓励语</p>

  <h3>主题操作</h3>
  <ul>
    <li><strong>换个主题 →</strong>：随机切换写作主题，同时刷新下方推荐文章</li>
    <li><strong>换一批推荐 →</strong>：保持当前主题，替换推荐文章（显示第 N 批）</li>
    <li><strong>❤️ / 🤍 按钮</strong>：标记喜欢当前主题，系统将优先推荐类似风格</li>
    <li><strong>✨ AI 扩充主题库</strong><span class="ai-badge">AI</span>：调用 AI 根据文章库风格生成 20 个新主题</li>
  </ul>

  <h3>推荐文章</h3>
  <p>每次展示 6 篇与主题相关的文章，点击任意文章进入详情页阅读。</p>

  <div class="tip">💡 <strong>每次刷新</strong>页面，右上角的鼓励语会随机更换，共 30 条。</div>
</div>

<!-- 03 码字计划 -->
<div class="section">
  <div class="section-header">
    <div class="section-num">3</div>
    <div class="section-title">✍️ 码字计划</div>
  </div>
  <p>追踪每日与每月的码字量，帮助建立稳定的写作习惯。所有数据云端保存，不会因清除浏览器缓存而丢失。</p>

  ${img('ss_writing', '码字计划页面')}
  <p class="caption">▲ 码字计划页面：今日进度（左）+ 月历热图（右）</p>

  <h3>⚙ 设置目标</h3>
  <p>点击右上角「设置目标」按钮，填写本月总目标和每日目标字数，按月独立保存。</p>

  <h3>录入今日字数</h3>
  <div class="step"><div class="step-num">1</div><div class="step-text">在左侧「今日码字」卡片下方的输入框填入实际字数</div></div>
  <div class="step"><div class="step-num">2</div><div class="step-text">点击「保存」按钮，或直接按 Enter 键提交</div></div>
  <div class="step"><div class="step-num">3</div><div class="step-text">仪表盘进度和圆点热力图立即更新</div></div>

  <h3>日历与补录</h3>
  <p>右侧月历显示每天字数，点击<strong>任意过去日期</strong>可弹出输入框补录。点击 <strong>‹ ›</strong> 箭头切换历史月份查看。</p>

  <h3>图表说明</h3>
  <div class="two-col">
    <div class="box"><div class="box-title">日历颜色</div><div>黑底 = 达标 &nbsp;粉色 = 未达标 &nbsp;灰色 = 未记录</div></div>
    <div class="box"><div class="box-title">圆点热力图</div><div>红点 = 达标 &nbsp;浅粉 = 部分 &nbsp;灰色 = 未写</div></div>
  </div>
</div>

<!-- 04 分类浏览 -->
<div class="section">
  <div class="section-header">
    <div class="section-num">4</div>
    <div class="section-title">📂 分类浏览</div>
  </div>
  <p>浏览和管理全部文章库，当前收录 <strong>702 篇</strong>文章，支持多维度筛选。</p>

  ${img('ss_browse', '分类浏览页面')}
  <p class="caption">▲ 左侧固定筛选栏 + 右侧文章列表（悬停显示删除按钮）</p>

  <h3>左侧筛选栏（固定不滚动）</h3>
  <ul>
    <li>按<strong>分类</strong>筛选（如：中篇爆款、知乎风、白眼狼文学）</li>
    <li>按<strong>来源</strong>筛选（1月、11月等）</li>
    <li>按<strong>爆点标签</strong>筛选</li>
    <li>关键词<strong>搜索</strong>文章标题</li>
  </ul>

  <h3>文章操作</h3>
  <ul>
    <li><strong>单篇删除</strong>：悬停文章卡片，右上角出现 🗑 按钮，点击删除</li>
    <li><strong>批量管理</strong>：点击「批量管理」进入批量模式，勾选后可批量删除或修改分类</li>
    <li><strong>翻页</strong>：底部「上一页 / 下一页」导航，共 71 页</li>
  </ul>
</div>

<!-- 05 文章详情 -->
<div class="section">
  <div class="section-header">
    <div class="section-num">5</div>
    <div class="section-title">📄 文章详情</div>
  </div>
  <p>查看文章完整信息，并可在线编辑标签和分类。</p>

  ${img('ss_detail', '文章详情页面')}
  <p class="caption">▲ 文章详情页：标题、分类、爆点标签、用户标签、正文内容</p>

  <h3>可操作内容</h3>
  <ul>
    <li><strong>爆点标签</strong>：由 AI 分析生成，显示为橙色标签</li>
    <li><strong>用户标签</strong>：点击已有标签旁的 × 删除；底部输入框添加自定义标签</li>
    <li><strong>AI 分析</strong><span class="ai-badge">AI</span>：让 AI 自动识别分类和爆点，填充到文章中</li>
    <li><strong>删除文章</strong>：页面底部红色删除按钮，确认后永久删除</li>
  </ul>

  <div class="tip">← 点击「返回」按钮回到上一页列表。</div>
</div>

<!-- 06 导入文章 -->
<div class="section">
  <div class="section-header">
    <div class="section-num">6</div>
    <div class="section-title">📥 导入文章</div>
  </div>
  <p>支持两种导入方式，适合不同场景。</p>

  ${img('ss_import', '导入文章页面')}
  <p class="caption">▲ 导入页面：粘贴文本（左侧标签）/ 批量上传 TXT（右侧标签）</p>

  <h3>方式一：粘贴文本（单篇）</h3>
  <div class="step"><div class="step-num">1</div><div class="step-text">选中「✏️ 粘贴文本」标签</div></div>
  <div class="step"><div class="step-num">2</div><div class="step-text">填写标题（必填）、来源、分类，粘贴正文内容</div></div>
  <div class="step"><div class="step-num">3</div><div class="step-text">点击「✨ AI 智能分析」自动提取分类和爆点，或直接点击「导入文章」</div></div>

  <h3>方式二：批量上传 TXT（推荐）<span class="ai-badge">AI</span></h3>
  <div class="step"><div class="step-num">1</div><div class="step-text">选中「📄 批量上传 TXT」标签</div></div>
  <div class="step"><div class="step-num">2</div><div class="step-text">点击选择文件，一次可选多个 .txt 文件（自动识别 UTF-8 / GBK 编码）</div></div>
  <div class="step"><div class="step-num">3</div><div class="step-text">确认文件列表后，点击「✨ 开始 AI 分析并导入」</div></div>
  <div class="step"><div class="step-num">4</div><div class="step-text">进度条实时显示每篇处理状态，完成后文章自动入库</div></div>

  <div class="warn">⚠️ 批量 TXT 导入消耗 AI token，文章越多消耗越大。如 token 不足，已分析的文章会保存，未处理的重新上传重试即可。</div>
</div>

<!-- 07 故事框架 -->
<div class="section">
  <div class="section-header">
    <div class="section-num">7</div>
    <div class="section-title">🎬 故事框架生成器 <span class="ai-badge">AI</span></div>
  </div>
  <p>根据你设定的故事参数，AI 生成完整的短篇网文写作框架，符合付费阅读平台规格。</p>

  ${img('ss_framework', '故事框架生成器')}
  <p class="caption">▲ 故事框架生成器：填写参数（左）→ 生成结果（右）</p>

  <h3>参数填写</h3>
  <div class="two-col">
    <div class="box"><div class="box-title">题材 / 分类（必填）</div><div>如：末世、穿越古代、职场逆袭</div></div>
    <div class="box"><div class="box-title">视角</div><div>女主视角 / 男主视角 / 双主视角</div></div>
    <div class="box"><div class="box-title">风格</div><div>虐心向 / 甜宠向 / 爽文向 / 悬疑向 / 慢热深情</div></div>
    <div class="box"><div class="box-title">爆点标签（可多选）</div><div>经典爆点 / 人设类型 / 婚恋设定 / 题材分类</div></div>
  </div>

  <h3>生成结果包含</h3>
  <ul>
    <li>📌 <strong>3 个备选标题</strong></li>
    <li>📝 <strong>导语全文</strong>（200-400 字，可直接使用）</li>
    <li>📖 <strong>8-10 节正文大纲</strong>（第 1-4 节免费 / 第 5 节起付费）</li>
    <li>🔒 <strong>第 4 节付费钩子</strong>（100-150 字可直接使用的悬念段落）</li>
    <li>💡 <strong>核心真相</strong>（付费部分情节揭示思路）</li>
    <li>✏️ <strong>写作技巧</strong>（3 条针对该类型的具体建议）</li>
  </ul>

  <div class="tip">💡 生成后可点击「复制全部内容」一键复制完整框架到剪贴板。</div>
</div>

<!-- 08 数据统计 -->
<div class="section">
  <div class="section-header">
    <div class="section-num">8</div>
    <div class="section-title">📊 数据统计</div>
  </div>
  <p>查看整个资源库的全局数据，了解文章分布情况。</p>

  ${img('ss_stats', '数据统计页面')}
  <p class="caption">▲ 数据统计：总览数字 + 分类饼图 + 来源分布 + 分类排行</p>

  <div class="two-col">
    <div class="box"><div class="box-title">文章总数</div><div class="box-val">702 篇</div></div>
    <div class="box"><div class="box-title">分类数量</div><div class="box-val">102 个</div></div>
    <div class="box"><div class="box-title">用户标签</div><div class="box-val">750 个</div></div>
    <div class="box"><div class="box-title">总字数</div><div class="box-val">771.8 万字</div></div>
  </div>
</div>

<!-- 09 附录 -->
<div class="section">
  <div class="section-header">
    <div class="section-num">9</div>
    <div class="section-title">📋 附录：AI 功能依赖说明</div>
  </div>
  <p>以下功能依赖 AI API Key，当 Key 额度用完时会受到影响。其余功能不受影响，可正常使用。</p>

  <h3>❌ 受影响功能（需要 AI）</h3>
  <ul>
    <li><strong>故事框架生成器</strong>：完全不可用</li>
    <li><strong>AI 智能分析（单篇）</strong>：文章详情页 / 导入页的分析按钮失效</li>
    <li><strong>批量上传 TXT → AI 分析</strong>：TXT 可上传，AI 分析步骤会失败</li>
    <li><strong>批量分析（未分析文章）</strong>：无法运行</li>
    <li><strong>AI 扩充主题库</strong>：每日灵感页的扩充按钮失效</li>
  </ul>

  <h3>✅ 不受影响功能（纯数据库）</h3>
  <ul>
    <li>每日灵感 — 主题推荐、换主题、喜欢主题、推荐文章</li>
    <li>码字计划 — 全部功能（目标设置、记录、日历、统计）</li>
    <li>分类浏览 — 搜索、筛选、删除、批量管理</li>
    <li>文章详情 — 阅读正文、手动编辑标签/分类</li>
    <li>导入文章 — 手动粘贴文本导入</li>
    <li>数据统计 / 标签管理 — 完全正常</li>
  </ul>

  <div class="tip">🎯 <strong>结论：</strong>API Key 用完后，系统仍可作为「写作资源库 + 码字计划」正常使用，只是无法调用 AI 生成新内容。</div>

  <h3>常见问题</h3>
  <ul>
    <li><strong>文章正文显示乱码？</strong> — 部分文件为 GBK 编码，系统已自动识别。若仍乱码，请将文件另存为 UTF-8 后重新上传。</li>
    <li><strong>AI 分析结果不准确？</strong> — 进入文章详情页手动修改标签和分类，支持自由编辑。</li>
    <li><strong>码字数据会丢失吗？</strong> — 不会，数据存储在云端数据库，与浏览器缓存无关。</li>
    <li><strong>忘记记录当天字数？</strong> — 点击日历上过去的日期，可随时补录历史记录。</li>
  </ul>
</div>

</body>
</html>`;

fs.writeFileSync(path.join(base, 'user_guide.html'), html);
console.log('HTML generated at', path.join(base, 'user_guide.html'));
