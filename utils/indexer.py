# -*- coding: utf-8 -*-
"""
索引构建模块 - 扫描txt文件并建立索引
"""

import os
import json
import uuid
import re
from pathlib import Path
from datetime import datetime
import chardet

# 基础爆点关键词库
HOOK_KEYWORDS = {
    "逆袭": ["逆袭", "翻身", "崛起", "打脸"],
    "重生": ["重生", "穿越", "回到", "重来"],
    "复仇": ["复仇", "报仇", "报复", "清算"],
    "虐心": ["虐", "泪目", "心碎", "痛哭"],
    "甜宠": ["甜", "宠", "溺爱", "娇妻"],
    "身份反转": ["真千金", "假千金", "身份", "认亲"],
    "豪门": ["豪门", "财阀", "总裁", "首富"],
    "追妻": ["追妻", "后悔", "挽回", "求和"],
    "出轨": ["出轨", "背叛", "第三者", "小三"],
    "亲情": ["亲情", "父母", "孩子", "家人"],
    "悬疑": ["悬疑", "真相", "秘密", "隐藏"],
    "爽文": ["爽", "打脸", "啪啪", "反击"],
    "心声": ["心声", "读心", "内心", "想法"],
    "死人文学": ["死后", "坟前", "葬礼", "遗言"],
}


def detect_encoding(file_path):
    """检测文件编码"""
    with open(file_path, 'rb') as f:
        raw = f.read(10000)
    result = chardet.detect(raw)
    return result['encoding'] or 'gbk'


def read_file_content(file_path):
    """读取文件内容，自动检测编码"""
    encodings = ['utf-8', 'gbk', 'gb2312', 'gb18030', 'big5']

    for enc in encodings:
        try:
            with open(file_path, 'r', encoding=enc) as f:
                content = f.read()
            return content
        except (UnicodeDecodeError, UnicodeError):
            continue

    # 使用chardet检测
    encoding = detect_encoding(file_path)
    try:
        with open(file_path, 'r', encoding=encoding, errors='ignore') as f:
            return f.read()
    except:
        return ""


def extract_title_from_filename(filename):
    """从文件名提取标题"""
    name = Path(filename).stem

    # 移除常见前缀
    prefixes = [r'^\d+[-_.]?\s*', r'^【.*?】\s*', r'^《', r'》$']
    for prefix in prefixes:
        name = re.sub(prefix, '', name)

    # 提取书名号内容
    match = re.search(r'《(.+?)》', name)
    if match:
        return match.group(1)

    # 截取到括号前
    name = re.split(r'[（(]', name)[0].strip()

    return name if name else Path(filename).stem


def extract_hooks_from_text(title, content, category):
    """从标题和内容提取爆点标签"""
    hooks = set()

    # 从分类提取
    for hook, keywords in HOOK_KEYWORDS.items():
        if any(kw in category for kw in keywords):
            hooks.add(hook)

    # 从标题提取
    for hook, keywords in HOOK_KEYWORDS.items():
        if any(kw in title for kw in keywords):
            hooks.add(hook)

    # 从内容前500字提取
    preview = content[:500] if content else ""
    for hook, keywords in HOOK_KEYWORDS.items():
        if any(kw in preview for kw in keywords):
            hooks.add(hook)

    return list(hooks) if hooks else ["待分析"]


def count_words(content):
    """统计中文字数"""
    chinese_chars = re.findall(r'[\u4e00-\u9fff]', content)
    return len(chinese_chars)


def scan_articles(base_path):
    """扫描所有txt文件并建立索引"""
    articles = []
    categories = set()
    all_tags = set()

    base_path = Path(base_path).resolve()

    for txt_file in base_path.rglob('*.txt'):
        # 跳过MACOSX文件夹和非爆款分类目录
        if '__MACOSX' in str(txt_file):
            continue
        # 只处理爆款分类目录下的文件
        if '爆款分类' not in str(txt_file):
            continue

        # 获取相对路径
        rel_path = txt_file.relative_to(base_path)
        parts = rel_path.parts

        # 提取分类（取最深层目录名）
        category = "未分类"
        for part in reversed(parts[:-1]):  # 排除文件名
            if part and not part.endswith('爆款分类'):
                category = part
                break

        # 提取来源月份
        source = ""
        for part in parts:
            if '月' in part and '爆款' in part:
                source = part.replace('爆款分类', '').strip()
                break

        # 读取内容
        content = read_file_content(txt_file)

        # 提取标题
        title = extract_title_from_filename(txt_file.name)

        # 提取爆点
        hooks = extract_hooks_from_text(title, content, category)

        # 统计字数
        word_count = count_words(content)

        article = {
            "id": str(uuid.uuid4()),
            "title": title,
            "file_path": str(rel_path),
            "full_path": str(txt_file.resolve()),
            "category": category,
            "tags": [],
            "hooks": hooks,
            "word_count": word_count,
            "source": source,
            "import_date": datetime.now().strftime("%Y-%m-%d")
        }

        articles.append(article)
        categories.add(category)
        all_tags.update(hooks)

    return articles, list(categories), list(all_tags)


def build_index(base_path, output_file="articles_db.json"):
    """构建完整索引并保存"""
    print(f"开始扫描目录: {base_path}")

    articles, categories, tags = scan_articles(base_path)

    db = {
        "articles": articles,
        "categories": sorted(categories),
        "tags": sorted(tags),
        "last_updated": datetime.now().strftime("%Y-%m-%d %H:%M:%S"),
        "total_count": len(articles)
    }

    output_path = Path(base_path) / output_file
    with open(output_path, 'w', encoding='utf-8') as f:
        json.dump(db, f, ensure_ascii=False, indent=2)

    print(f"索引构建完成！")
    print(f"  - 文章总数: {len(articles)}")
    print(f"  - 分类数量: {len(categories)}")
    print(f"  - 标签数量: {len(tags)}")
    print(f"  - 保存到: {output_path}")

    return db


if __name__ == "__main__":
    import sys
    base = sys.argv[1] if len(sys.argv) > 1 else "."
    build_index(base)
