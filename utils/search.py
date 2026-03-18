# -*- coding: utf-8 -*-
"""
搜索功能模块
"""

import re
from typing import List, Dict, Optional


def search_articles(
    articles: List[Dict],
    keyword: str = "",
    categories: Optional[List[str]] = None,
    tags: Optional[List[str]] = None,
    hooks: Optional[List[str]] = None,
    source: str = ""
) -> List[Dict]:
    """
    搜索文章

    Args:
        articles: 文章列表
        keyword: 搜索关键词（匹配标题）
        categories: 分类筛选列表
        tags: 标签筛选列表
        hooks: 爆点筛选列表
        source: 来源筛选

    Returns:
        匹配的文章列表
    """
    results = articles.copy()

    # 关键词搜索
    if keyword:
        keyword_lower = keyword.lower()
        results = [
            a for a in results
            if keyword_lower in a.get('title', '').lower()
            or keyword_lower in a.get('category', '').lower()
            or any(keyword_lower in tag.lower() for tag in a.get('tags', []))
            or any(keyword_lower in hook.lower() for hook in a.get('hooks', []))
        ]

    # 分类筛选
    if categories:
        results = [a for a in results if a.get('category') in categories]

    # 标签筛选
    if tags:
        results = [
            a for a in results
            if any(tag in a.get('tags', []) for tag in tags)
        ]

    # 爆点筛选
    if hooks:
        results = [
            a for a in results
            if any(hook in a.get('hooks', []) for hook in hooks)
        ]

    # 来源筛选
    if source:
        results = [a for a in results if source in a.get('source', '')]

    return results


def highlight_text(text: str, keyword: str) -> str:
    """高亮显示关键词"""
    if not keyword:
        return text

    pattern = re.compile(re.escape(keyword), re.IGNORECASE)
    return pattern.sub(f"**{keyword}**", text)


def get_category_stats(articles: List[Dict]) -> Dict[str, int]:
    """统计各分类文章数量"""
    stats = {}
    for article in articles:
        cat = article.get('category', '未分类')
        stats[cat] = stats.get(cat, 0) + 1
    return dict(sorted(stats.items(), key=lambda x: x[1], reverse=True))


def get_tag_stats(articles: List[Dict]) -> Dict[str, int]:
    """统计标签使用频率"""
    stats = {}
    for article in articles:
        for tag in article.get('tags', []) + article.get('hooks', []):
            stats[tag] = stats.get(tag, 0) + 1
    return dict(sorted(stats.items(), key=lambda x: x[1], reverse=True))


def get_source_stats(articles: List[Dict]) -> Dict[str, int]:
    """统计来源分布"""
    stats = {}
    for article in articles:
        source = article.get('source', '未知')
        if source:
            stats[source] = stats.get(source, 0) + 1
    return dict(sorted(stats.items(), key=lambda x: x[1], reverse=True))
