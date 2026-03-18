# -*- coding: utf-8 -*-
"""
灵感生成模块
"""

import random
from typing import List, Dict, Tuple


def get_random_inspiration(articles: List[Dict], count: int = 3) -> List[Dict]:
    """
    随机推荐指定数量的文章

    Args:
        articles: 文章列表
        count: 推荐数量

    Returns:
        随机选取的文章列表（尽量不同分类）
    """
    if not articles:
        return []

    # 按分类分组
    by_category = {}
    for article in articles:
        cat = article.get('category', '未分类')
        if cat not in by_category:
            by_category[cat] = []
        by_category[cat].append(article)

    # 优先从不同分类选取
    categories = list(by_category.keys())
    random.shuffle(categories)

    selected = []
    used_categories = set()

    # 第一轮：每个分类选一篇
    for cat in categories:
        if len(selected) >= count:
            break
        if cat not in used_categories:
            article = random.choice(by_category[cat])
            selected.append(article)
            used_categories.add(cat)

    # 如果还不够，随机补充
    while len(selected) < count and len(selected) < len(articles):
        article = random.choice(articles)
        if article not in selected:
            selected.append(article)

    return selected


def generate_creative_combo(articles: List[Dict], count: int = 2) -> Tuple[List[Dict], str]:
    """
    生成创意组合建议

    Args:
        articles: 文章列表
        count: 组合数量

    Returns:
        (选中的文章列表, 组合建议文字)
    """
    selected = get_random_inspiration(articles, count)

    if len(selected) < 2:
        return selected, "文章数量不足，无法生成组合"

    # 提取分类和爆点
    categories = [a.get('category', '') for a in selected]
    all_hooks = []
    for a in selected:
        all_hooks.extend(a.get('hooks', []))

    # 生成组合建议
    combo_templates = [
        f"尝试将【{categories[0]}】的情感冲突与【{categories[1]}】的情节设定结合",
        f"创意火花：{categories[0]} × {categories[1]}",
        f"把【{selected[0].get('title', '')}】的开头嫁接到【{categories[1]}】类型中",
        f"用【{categories[0]}】的人设，走【{categories[1]}】的剧情线",
    ]

    if all_hooks:
        hook_combo = random.sample(all_hooks, min(2, len(all_hooks)))
        combo_templates.append(f"爆点组合：{' + '.join(hook_combo)}")

    suggestion = random.choice(combo_templates)

    return selected, suggestion


def get_daily_theme() -> str:
    """获取每日写作主题"""
    themes = [
        "今日主题：反转！试试在第一章就来个大反转",
        "今日主题：极端情绪！写一个让读者心碎的场景",
        "今日主题：打脸爽文！坏人被当众揭穿",
        "今日主题：身份悬念！主角的真实身份是什么？",
        "今日主题：久别重逢！多年后的再次相遇",
        "今日主题：绝地反击！在最绝望时翻盘",
        "今日主题：误会升级！让误会变得更深",
        "今日主题：真相大白！藏了很久的秘密揭开",
        "今日主题：选择困境！两难的抉择",
        "今日主题：过去的伤痛！童年/往事的阴影",
    ]
    return random.choice(themes)


def get_writing_prompt(article: Dict) -> str:
    """根据文章生成写作提示"""
    title = article.get('title', '')
    category = article.get('category', '')
    hooks = article.get('hooks', [])

    prompts = [
        f"如果把《{title}》的主角换成男性/女性，故事会怎么发展？",
        f"《{title}》中最戳人的是哪个场景？能否放大这个情绪点？",
        f"【{category}】类型中，这篇的独特之处是什么？",
        f"如果给《{title}》写续集，你会怎么写？",
        f"这篇的爆点是【{'/'.join(hooks)}】，能否叠加更多冲突？",
    ]

    return random.choice(prompts)
