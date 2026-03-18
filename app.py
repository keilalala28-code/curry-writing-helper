# -*- coding: utf-8 -*-
"""
咖喱小助手 - 写作资源管理库
网文爆款素材管理工具
"""

import streamlit as st
import json
import os
from pathlib import Path
from datetime import datetime
import random

# 导入工具模块
from utils.indexer import build_index, read_file_content
from utils.search import search_articles, get_category_stats, get_tag_stats, get_source_stats
from utils.inspiration import get_random_inspiration, generate_creative_combo, get_daily_theme, get_writing_prompt
from utils.importer import (
    import_from_text, import_from_file, import_from_zip,
    import_from_folder, save_imported_articles, auto_extract_hooks
)

# 页面配置
st.set_page_config(
    page_title="咖喱小助手 - 写作资源库",
    page_icon="📚",
    layout="wide",
    initial_sidebar_state="expanded"
)

# 数据库路径
BASE_PATH = Path(__file__).parent
DB_PATH = BASE_PATH / "articles_db.json"


# ============== 数据库操作 ==============

@st.cache_data
def load_database():
    """加载数据库"""
    if DB_PATH.exists():
        with open(DB_PATH, 'r', encoding='utf-8') as f:
            return json.load(f)
    return {"articles": [], "categories": [], "tags": [], "total_count": 0}


def save_database(db):
    """保存数据库"""
    db['last_updated'] = datetime.now().strftime("%Y-%m-%d %H:%M:%S")
    with open(DB_PATH, 'w', encoding='utf-8') as f:
        json.dump(db, f, ensure_ascii=False, indent=2)
    # 清除缓存以重新加载
    load_database.clear()


def init_database():
    """初始化数据库（如果不存在）"""
    if not DB_PATH.exists():
        # 检测是否有原始文件可供构建索引
        has_source = any(
            os.path.exists(BASE_PATH / d) for d in ['11月爆款分类', '1月爆款分类']
        )
        if has_source:
            st.info("正在首次构建索引，请稍候...")
            db = build_index(str(BASE_PATH))
            st.success(f"索引构建完成！共 {db['total_count']} 篇文章")
            return db
        else:
            st.error("❌ 数据库文件不存在，请确保 articles_db.json 已上传")
            return {"articles": [], "categories": [], "tags": [], "total_count": 0}
    return load_database()


# ============== 页面组件 ==============

def render_article_card(article, show_preview=True):
    """渲染文章卡片"""
    with st.container():
        col1, col2 = st.columns([4, 1])

        with col1:
            st.markdown(f"### 📖 {article['title']}")
            st.caption(f"分类：{article['category']} | 字数：{article.get('word_count', 0):,} | 来源：{article.get('source', '未知')}")

            # 爆点标签
            hooks = article.get('hooks', [])
            if hooks:
                hook_html = " ".join([f"`{h}`" for h in hooks])
                st.markdown(f"🔥 爆点：{hook_html}")

            # 自定义标签
            tags = article.get('tags', [])
            if tags:
                tag_html = " ".join([f"`{t}`" for t in tags])
                st.markdown(f"🏷️ 标签：{tag_html}")

        with col2:
            if st.button("查看详情", key=f"view_{article['id']}"):
                st.session_state['selected_article'] = article
                st.session_state['current_page'] = '文章详情'
                st.rerun()

        st.divider()


def render_article_detail(article):
    """渲染文章详情页"""
    st.markdown(f"## 📖 {article['title']}")

    col1, col2, col3 = st.columns(3)
    with col1:
        st.metric("分类", article['category'])
    with col2:
        st.metric("字数", f"{article.get('word_count', 0):,}")
    with col3:
        st.metric("来源", article.get('source', '未知'))

    st.divider()

    # 爆点和标签
    col1, col2 = st.columns(2)
    with col1:
        st.markdown("#### 🔥 爆点标签")
        hooks = article.get('hooks', [])
        for hook in hooks:
            st.markdown(f"- {hook}")

    with col2:
        st.markdown("#### 🏷️ 自定义标签")
        tags = article.get('tags', [])
        for tag in tags:
            st.markdown(f"- {tag}")

    st.divider()

    # 阅读内容
    st.markdown("#### 📄 文章内容")
    full_path = article.get('full_path', '')
    if full_path and os.path.exists(full_path):
        content = read_file_content(full_path)
        with st.expander("展开阅读全文", expanded=False):
            st.text(content)
    else:
        st.info("📌 云端部署版本暂不支持查看原文，请在本地版本查看")

    # 写作提示
    st.divider()
    st.markdown("#### 💡 写作提示")
    st.info(get_writing_prompt(article))


# ============== 页面：首页 - 每日灵感 ==============

def page_home():
    st.title("🎯 每日灵感")

    # 每日主题
    st.markdown(f"### {get_daily_theme()}")
    st.divider()

    db = load_database()
    articles = db.get('articles', [])

    if not articles:
        st.warning("数据库为空，请先构建索引或导入文章")
        if st.button("🔄 构建索引"):
            db = build_index(str(BASE_PATH))
            save_database(db)
            st.rerun()
        return

    # 随机推荐
    col1, col2 = st.columns([3, 1])
    with col2:
        if st.button("🎲 刷新灵感", use_container_width=True):
            st.rerun()

    st.markdown("### 📚 今日推荐")

    inspirations = get_random_inspiration(articles, 3)
    for article in inspirations:
        render_article_card(article)

    # 创意组合
    st.divider()
    st.markdown("### 🎨 创意组合建议")

    combo_articles, suggestion = generate_creative_combo(articles)
    st.success(suggestion)

    with st.expander("查看组合文章"):
        for article in combo_articles:
            st.markdown(f"- **{article['title']}** ({article['category']})")


# ============== 页面：分类浏览 ==============

def page_browse():
    st.title("📂 分类浏览")

    db = load_database()
    articles = db.get('articles', [])
    categories = db.get('categories', [])

    if not articles:
        st.warning("数据库为空")
        return

    # 分类统计
    cat_stats = get_category_stats(articles)

    col1, col2 = st.columns([1, 3])

    with col1:
        st.markdown("### 分类列表")
        selected_cat = st.radio(
            "选择分类",
            options=["全部"] + list(cat_stats.keys()),
            format_func=lambda x: f"{x} ({cat_stats.get(x, len(articles))})" if x != "全部" else f"全部 ({len(articles)})"
        )

    with col2:
        st.markdown(f"### {selected_cat}")

        if selected_cat == "全部":
            filtered = articles
        else:
            filtered = [a for a in articles if a['category'] == selected_cat]

        # 分页
        per_page = 10
        total_pages = (len(filtered) - 1) // per_page + 1

        if 'browse_page' not in st.session_state:
            st.session_state.browse_page = 1

        page = st.number_input("页码", min_value=1, max_value=max(1, total_pages), value=st.session_state.browse_page)
        st.session_state.browse_page = page

        start = (page - 1) * per_page
        end = start + per_page

        st.caption(f"共 {len(filtered)} 篇，第 {page}/{total_pages} 页")

        for article in filtered[start:end]:
            render_article_card(article)


# ============== 页面：搜索 ==============

def page_search():
    st.title("🔍 搜索文章")

    db = load_database()
    articles = db.get('articles', [])
    categories = db.get('categories', [])
    tags = db.get('tags', [])

    col1, col2 = st.columns([2, 1])

    with col1:
        keyword = st.text_input("🔎 搜索关键词", placeholder="输入标题、分类或标签关键词")

    with col2:
        source_options = list(get_source_stats(articles).keys())
        source = st.selectbox("📅 来源", ["全部"] + source_options)

    col1, col2 = st.columns(2)
    with col1:
        selected_cats = st.multiselect("📂 分类筛选", categories)
    with col2:
        selected_hooks = st.multiselect("🔥 爆点筛选", tags)

    # 执行搜索
    results = search_articles(
        articles,
        keyword=keyword,
        categories=selected_cats if selected_cats else None,
        hooks=selected_hooks if selected_hooks else None,
        source="" if source == "全部" else source
    )

    st.divider()
    st.markdown(f"### 搜索结果 ({len(results)} 篇)")

    if not results:
        st.info("没有找到匹配的文章")
    else:
        for article in results[:50]:  # 限制显示数量
            render_article_card(article)


# ============== 页面：文章详情 ==============

def page_detail():
    if 'selected_article' not in st.session_state:
        st.warning("请先选择一篇文章")
        return

    article = st.session_state['selected_article']

    # 返回按钮
    if st.button("← 返回"):
        st.session_state.pop('selected_article', None)
        st.rerun()

    render_article_detail(article)

    # 编辑标签
    st.divider()
    st.markdown("### ✏️ 编辑标签")

    db = load_database()
    all_tags = db.get('tags', [])

    # 当前标签
    current_tags = article.get('tags', [])

    # 添加新标签
    col1, col2 = st.columns([3, 1])
    with col1:
        new_tag = st.text_input("添加新标签", key="new_tag_input")
    with col2:
        if st.button("添加", key="add_tag_btn"):
            if new_tag and new_tag not in current_tags:
                # 更新文章
                for a in db['articles']:
                    if a['id'] == article['id']:
                        a['tags'] = a.get('tags', []) + [new_tag]
                        st.session_state['selected_article'] = a
                        break
                # 更新全局标签
                if new_tag not in db['tags']:
                    db['tags'].append(new_tag)
                save_database(db)
                st.success(f"已添加标签：{new_tag}")
                st.rerun()

    # 从已有标签选择
    available_tags = [t for t in all_tags if t not in current_tags]
    if available_tags:
        selected_existing = st.multiselect("或从已有标签选择", available_tags)
        if st.button("添加选中标签"):
            if selected_existing:
                for a in db['articles']:
                    if a['id'] == article['id']:
                        a['tags'] = a.get('tags', []) + selected_existing
                        st.session_state['selected_article'] = a
                        break
                save_database(db)
                st.success("标签已添加")
                st.rerun()


# ============== 页面：标签管理 ==============

def page_tags():
    st.title("🏷️ 标签管理")

    db = load_database()
    articles = db.get('articles', [])

    # 标签统计
    tag_stats = get_tag_stats(articles)

    col1, col2 = st.columns([1, 2])

    with col1:
        st.markdown("### 添加新标签")
        new_tag = st.text_input("标签名称")
        if st.button("添加到标签库"):
            if new_tag and new_tag not in db['tags']:
                db['tags'].append(new_tag)
                save_database(db)
                st.success(f"已添加：{new_tag}")
                st.rerun()
            elif new_tag in db['tags']:
                st.warning("标签已存在")

    with col2:
        st.markdown("### 标签统计")

        # 按使用次数排序
        st.dataframe(
            {
                "标签": list(tag_stats.keys()),
                "使用次数": list(tag_stats.values())
            },
            use_container_width=True,
            hide_index=True
        )


# ============== 页面：数据统计 ==============

def page_stats():
    st.title("📊 数据统计")

    db = load_database()
    articles = db.get('articles', [])

    if not articles:
        st.warning("数据库为空")
        return

    # 概览
    col1, col2, col3, col4 = st.columns(4)
    with col1:
        st.metric("文章总数", len(articles))
    with col2:
        st.metric("分类数量", len(db.get('categories', [])))
    with col3:
        st.metric("标签数量", len(db.get('tags', [])))
    with col4:
        total_words = sum(a.get('word_count', 0) for a in articles)
        st.metric("总字数", f"{total_words:,}")

    st.divider()

    # 分类分布
    col1, col2 = st.columns(2)

    with col1:
        st.markdown("### 📂 分类分布")
        cat_stats = get_category_stats(articles)

        # 使用plotly绑饼图
        try:
            import plotly.express as px
            fig = px.pie(
                values=list(cat_stats.values()),
                names=list(cat_stats.keys()),
                title="分类分布"
            )
            fig.update_traces(textposition='inside', textinfo='percent+label')
            st.plotly_chart(fig, use_container_width=True)
        except ImportError:
            # 回退到简单表格
            st.dataframe({"分类": list(cat_stats.keys()), "数量": list(cat_stats.values())})

    with col2:
        st.markdown("### 📅 来源分布")
        source_stats = get_source_stats(articles)
        st.dataframe({"来源": list(source_stats.keys()), "数量": list(source_stats.values())})

    st.divider()

    # 爆点词云
    st.markdown("### 🔥 爆点标签热度")
    tag_stats = get_tag_stats(articles)

    # 显示为标签云样式
    tags_html = ""
    for tag, count in list(tag_stats.items())[:30]:
        size = min(24, 12 + count // 5)
        tags_html += f'<span style="font-size:{size}px; margin:5px; display:inline-block; background:#f0f2f6; padding:5px 10px; border-radius:15px;">{tag} ({count})</span>'

    st.markdown(tags_html, unsafe_allow_html=True)


# ============== 页面：导入爆文 ==============

def page_import():
    st.title("📥 导入爆文")

    db = load_database()
    articles = db.get('articles', [])
    categories = db.get('categories', [])

    # 导入方式选择
    import_method = st.radio(
        "选择导入方式",
        ["📄 上传TXT文件", "📦 上传ZIP压缩包", "📝 粘贴文本", "📁 扫描本地文件夹"],
        horizontal=True
    )

    st.divider()

    # 分类选择
    col1, col2 = st.columns([2, 1])
    with col1:
        category = st.selectbox("选择分类", ["新建分类..."] + categories)
    with col2:
        if category == "新建分类...":
            category = st.text_input("输入新分类名称")

    st.divider()

    # ===== 上传TXT文件 =====
    if import_method == "📄 上传TXT文件":
        uploaded_files = st.file_uploader(
            "上传TXT文件",
            type=['txt'],
            accept_multiple_files=True
        )

        if uploaded_files and category:
            st.markdown("### 预览")

            preview_articles = []
            for file in uploaded_files:
                content = file.read()
                article, msg = import_from_file(content, file.name, category, articles + preview_articles)
                if article:
                    preview_articles.append(article)
                    with st.expander(f"✅ {article['title']}"):
                        st.write(f"分类：{article['category']}")
                        st.write(f"爆点：{', '.join(article.get('hooks', []))}")
                        st.write(f"字数：{article.get('word_count', 0)}")
                else:
                    st.warning(f"❌ {file.name}: {msg}")

            if preview_articles:
                if st.button(f"✅ 确认导入 {len(preview_articles)} 篇", type="primary"):
                    db = save_imported_articles(preview_articles, db)
                    save_database(db)
                    st.success(f"成功导入 {len(preview_articles)} 篇文章！")
                    st.balloons()

    # ===== 上传ZIP =====
    elif import_method == "📦 上传ZIP压缩包":
        use_folder_cat = st.checkbox("使用文件夹名作为分类", value=True)

        uploaded_zip = st.file_uploader("上传ZIP压缩包", type=['zip'])

        if uploaded_zip and category:
            if st.button("🔍 解析压缩包"):
                with st.spinner("正在解析..."):
                    zip_content = uploaded_zip.read()
                    imported, errors = import_from_zip(
                        zip_content, category, articles, use_folder_cat
                    )

                    if imported:
                        st.session_state['pending_import'] = imported
                        st.success(f"发现 {len(imported)} 篇可导入文章")

                    if errors:
                        with st.expander(f"⚠️ {len(errors)} 个问题"):
                            for err in errors:
                                st.write(err)

            if 'pending_import' in st.session_state and st.session_state['pending_import']:
                pending = st.session_state['pending_import']
                st.markdown(f"### 预览 ({len(pending)} 篇)")

                for article in pending[:10]:
                    st.markdown(f"- **{article['title']}** ({article['category']})")

                if len(pending) > 10:
                    st.caption(f"...还有 {len(pending) - 10} 篇")

                if st.button(f"✅ 确认导入全部 {len(pending)} 篇", type="primary"):
                    db = save_imported_articles(pending, db)
                    save_database(db)
                    st.session_state.pop('pending_import', None)
                    st.success(f"成功导入 {len(pending)} 篇文章！")
                    st.balloons()

    # ===== 粘贴文本 =====
    elif import_method == "📝 粘贴文本":
        title = st.text_input("文章标题")
        content = st.text_area("粘贴文章内容", height=300)

        if title and content and category:
            # 预览
            hooks = auto_extract_hooks(title, content, category)
            st.markdown("### 预览")
            st.write(f"标题：{title}")
            st.write(f"分类：{category}")
            st.write(f"自动提取爆点：{', '.join(hooks)}")

            # 手动修改爆点
            edited_hooks = st.text_input("修改爆点（逗号分隔）", value=", ".join(hooks))

            if st.button("✅ 确认导入", type="primary"):
                article, msg = import_from_text(content, title, category, articles)
                if article:
                    article['hooks'] = [h.strip() for h in edited_hooks.split(",") if h.strip()]
                    db = save_imported_articles([article], db)
                    save_database(db)
                    st.success("导入成功！")
                    st.balloons()
                else:
                    st.error(msg)

    # ===== 扫描文件夹 =====
    elif import_method == "📁 扫描本地文件夹":
        folder_path = st.text_input("输入文件夹路径", placeholder="例如：D:/小说素材/新爆款")
        use_folder_cat = st.checkbox("使用子文件夹名作为分类", value=True)

        if folder_path and category:
            if st.button("🔍 扫描文件夹"):
                with st.spinner("正在扫描..."):
                    imported, errors = import_from_folder(
                        folder_path, category, articles, use_folder_cat
                    )

                    if imported:
                        st.session_state['pending_import'] = imported
                        st.success(f"发现 {len(imported)} 篇可导入文章")

                    if errors:
                        with st.expander(f"⚠️ {len(errors)} 个问题"):
                            for err in errors[:20]:
                                st.write(err)

            if 'pending_import' in st.session_state and st.session_state['pending_import']:
                pending = st.session_state['pending_import']
                st.markdown(f"### 预览 ({len(pending)} 篇)")

                for article in pending[:10]:
                    st.markdown(f"- **{article['title']}** ({article['category']})")

                if len(pending) > 10:
                    st.caption(f"...还有 {len(pending) - 10} 篇")

                if st.button(f"✅ 确认导入全部 {len(pending)} 篇", type="primary"):
                    db = save_imported_articles(pending, db)
                    save_database(db)
                    st.session_state.pop('pending_import', None)
                    st.success(f"成功导入 {len(pending)} 篇文章！")
                    st.balloons()


# ============== 页面：重建索引 ==============

def page_rebuild():
    st.title("🔄 重建索引")

    db = load_database()
    st.info(f"当前数据库：{db.get('total_count', 0)} 篇文章，最后更新：{db.get('last_updated', '未知')}")

    # 检测是否在云端环境
    is_cloud = os.environ.get('STREAMLIT_SHARING_MODE') or not any(
        os.path.exists(BASE_PATH / d) for d in ['11月爆款分类', '1月爆款分类']
    )

    if is_cloud:
        st.warning("☁️ 云端部署版本不支持重建索引，请在本地版本操作")
    else:
        st.warning("重建索引将重新扫描所有文件，现有的手动标签可能会丢失。")
        if st.button("🔄 重建索引", type="primary"):
            with st.spinner("正在扫描文件..."):
                new_db = build_index(str(BASE_PATH))
                save_database(new_db)
            st.success(f"索引重建完成！共 {new_db['total_count']} 篇文章")
            st.balloons()


# ============== 侧边栏导航 ==============

def main():
    # 初始化数据库
    db = init_database()

    # 侧边栏
    with st.sidebar:
        st.title("📚 咖喱小助手")
        st.caption("写作资源管理库")

        st.divider()

        # 导航菜单
        pages = {
            "🎯 每日灵感": page_home,
            "📂 分类浏览": page_browse,
            "🔍 搜索文章": page_search,
            "📖 文章详情": page_detail,
            "🏷️ 标签管理": page_tags,
            "📊 数据统计": page_stats,
            "📥 导入爆文": page_import,
            "🔄 重建索引": page_rebuild,
        }

        # 使用session_state记录当前页面
        if 'current_page' not in st.session_state:
            st.session_state['current_page'] = "🎯 每日灵感"

        for page_name in pages.keys():
            if st.button(page_name, use_container_width=True):
                st.session_state['current_page'] = page_name
                st.rerun()

        st.divider()

        # 数据库信息
        st.caption(f"📊 文章总数：{db.get('total_count', 0)}")
        st.caption(f"📂 分类数量：{len(db.get('categories', []))}")
        st.caption(f"🕐 更新时间：{db.get('last_updated', '未知')}")

    # 渲染当前页面
    current_page = st.session_state.get('current_page', "🎯 每日灵感")

    # 特殊处理文章详情页
    if current_page == "文章详情" or current_page == "📖 文章详情":
        page_detail()
    else:
        # 查找并执行对应页面函数
        for page_name, page_func in pages.items():
            if page_name == current_page:
                page_func()
                break


if __name__ == "__main__":
    main()
