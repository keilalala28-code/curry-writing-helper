# -*- coding: utf-8 -*-
"""
文章导入模块
"""

import os
import re
import uuid
import zipfile
import tempfile
import shutil
from pathlib import Path
from datetime import datetime
from typing import List, Dict, Optional, Tuple
import chardet


def detect_encoding(content: bytes) -> str:
    """检测编码"""
    result = chardet.detect(content)
    return result['encoding'] or 'utf-8'


def read_txt_content(file_path: str = None, content_bytes: bytes = None) -> str:
    """读取txt内容，自动处理编码"""
    if content_bytes is None and file_path:
        with open(file_path, 'rb') as f:
            content_bytes = f.read()

    if content_bytes is None:
        return ""

    # 尝试多种编码
    encodings = ['utf-8', 'gbk', 'gb2312', 'gb18030', 'big5']

    for enc in encodings:
        try:
            return content_bytes.decode(enc)
        except (UnicodeDecodeError, UnicodeError):
            continue

    # 使用检测到的编码
    detected = detect_encoding(content_bytes)
    try:
        return content_bytes.decode(detected, errors='ignore')
    except:
        return content_bytes.decode('utf-8', errors='ignore')


def extract_title_from_content(content: str, filename: str = "") -> str:
    """从内容或文件名提取标题"""
    # 先尝试从文件名提取
    if filename:
        name = Path(filename).stem
        # 提取书名号内容
        match = re.search(r'《(.+?)》', name)
        if match:
            return match.group(1)
        # 移除常见前缀后缀
        name = re.sub(r'^\d+[-_.]?\s*', '', name)
        name = re.split(r'[（(]', name)[0].strip()
        if len(name) > 2:
            return name

    # 从内容提取
    lines = content.strip().split('\n')
    for line in lines[:10]:
        line = line.strip()
        # 跳过版权声明等
        if '小说' in line or '版权' in line or '删掉' in line:
            continue
        if line.startswith('═') or line.startswith('─'):
            continue
        # 找到有意义的第一行
        if len(line) > 2 and len(line) < 50:
            return line

    return filename or "未命名文章"


def count_chinese_chars(text: str) -> int:
    """统计中文字数"""
    return len(re.findall(r'[\u4e00-\u9fff]', text))


def check_duplicate(new_title: str, existing_articles: List[Dict], threshold: float = 0.8) -> Optional[Dict]:
    """
    检查是否有重复文章

    Args:
        new_title: 新文章标题
        existing_articles: 现有文章列表
        threshold: 相似度阈值

    Returns:
        找到的重复文章，或None
    """
    new_title_clean = re.sub(r'[^\u4e00-\u9fff]', '', new_title)

    for article in existing_articles:
        existing_title = article.get('title', '')
        existing_clean = re.sub(r'[^\u4e00-\u9fff]', '', existing_title)

        # 完全相同
        if new_title_clean == existing_clean:
            return article

        # 一个包含另一个
        if len(new_title_clean) > 3 and len(existing_clean) > 3:
            if new_title_clean in existing_clean or existing_clean in new_title_clean:
                return article

    return None


def auto_extract_hooks(title: str, content: str, category: str) -> List[str]:
    """自动提取爆点标签"""
    hooks = set()

    # 爆点关键词库
    hook_keywords = {
        "逆袭": ["逆袭", "翻身", "崛起", "打脸", "反击"],
        "重生": ["重生", "穿越", "回到", "重来", "前世"],
        "复仇": ["复仇", "报仇", "报复", "清算", "还债"],
        "虐心": ["虐", "泪目", "心碎", "痛哭", "绝望"],
        "甜宠": ["甜", "宠", "溺爱", "娇妻", "宝贝"],
        "身份反转": ["真千金", "假千金", "身份", "认亲", "冒充"],
        "豪门": ["豪门", "财阀", "总裁", "首富", "集团"],
        "追妻": ["追妻", "后悔", "挽回", "求和", "跪下"],
        "出轨": ["出轨", "背叛", "第三者", "小三", "情人"],
        "亲情": ["亲情", "父母", "孩子", "家人", "骨肉"],
        "悬疑": ["悬疑", "真相", "秘密", "隐藏", "谜团"],
        "心声": ["心声", "读心", "内心", "想法", "听到"],
        "死人文学": ["死后", "坟前", "葬礼", "遗言", "离世"],
        "白眼狼": ["白眼狼", "忘恩负义", "恩将仇报"],
        "高位打脸": ["高位", "打脸", "啪啪", "当场"],
    }

    text = f"{title} {category} {content[:500]}"

    for hook, keywords in hook_keywords.items():
        if any(kw in text for kw in keywords):
            hooks.add(hook)

    return list(hooks) if hooks else ["待分析"]


def import_from_text(
    content: str,
    title: str,
    category: str,
    existing_articles: List[Dict]
) -> Tuple[Optional[Dict], str]:
    """
    从文本导入单篇文章

    Returns:
        (文章数据, 状态消息)
    """
    if not content.strip():
        return None, "内容为空"

    # 检查重复
    duplicate = check_duplicate(title, existing_articles)
    if duplicate:
        return None, f"发现重复文章：《{duplicate.get('title')}》"

    # 提取爆点
    hooks = auto_extract_hooks(title, content, category)

    article = {
        "id": str(uuid.uuid4()),
        "title": title,
        "file_path": "",
        "full_path": "",
        "category": category,
        "tags": [],
        "hooks": hooks,
        "word_count": count_chinese_chars(content),
        "source": "手动导入",
        "import_date": datetime.now().strftime("%Y-%m-%d"),
        "content": content  # 临时存储，保存时处理
    }

    return article, "导入成功"


def import_from_file(
    file_content: bytes,
    filename: str,
    category: str,
    existing_articles: List[Dict]
) -> Tuple[Optional[Dict], str]:
    """
    从上传的文件导入

    Returns:
        (文章数据, 状态消息)
    """
    content = read_txt_content(content_bytes=file_content)

    if not content.strip():
        return None, "文件内容为空"

    title = extract_title_from_content(content, filename)

    return import_from_text(content, title, category, existing_articles)


def import_from_zip(
    zip_content: bytes,
    default_category: str,
    existing_articles: List[Dict],
    use_folder_as_category: bool = True
) -> Tuple[List[Dict], List[str]]:
    """
    从ZIP压缩包导入

    Args:
        zip_content: ZIP文件内容
        default_category: 默认分类
        existing_articles: 现有文章
        use_folder_as_category: 是否使用文件夹名作为分类

    Returns:
        (成功导入的文章列表, 错误消息列表)
    """
    imported = []
    errors = []

    with tempfile.TemporaryDirectory() as tmpdir:
        zip_path = Path(tmpdir) / "upload.zip"
        with open(zip_path, 'wb') as f:
            f.write(zip_content)

        try:
            with zipfile.ZipFile(zip_path, 'r') as zf:
                zf.extractall(tmpdir)
        except zipfile.BadZipFile:
            return [], ["无效的ZIP文件"]

        # 扫描解压后的txt文件
        for txt_file in Path(tmpdir).rglob('*.txt'):
            if '__MACOSX' in str(txt_file):
                continue

            # 确定分类
            if use_folder_as_category:
                parts = txt_file.relative_to(tmpdir).parts
                category = default_category
                for part in reversed(parts[:-1]):
                    if part and not part.startswith('_'):
                        category = part
                        break
            else:
                category = default_category

            # 读取并导入
            try:
                with open(txt_file, 'rb') as f:
                    file_content = f.read()
                article, msg = import_from_file(
                    file_content,
                    txt_file.name,
                    category,
                    existing_articles + imported
                )
                if article:
                    imported.append(article)
                else:
                    errors.append(f"{txt_file.name}: {msg}")
            except Exception as e:
                errors.append(f"{txt_file.name}: {str(e)}")

    return imported, errors


def import_from_folder(
    folder_path: str,
    default_category: str,
    existing_articles: List[Dict],
    use_folder_as_category: bool = True
) -> Tuple[List[Dict], List[str]]:
    """
    从本地文件夹导入

    Returns:
        (成功导入的文章列表, 错误消息列表)
    """
    imported = []
    errors = []

    folder = Path(folder_path)
    if not folder.exists():
        return [], [f"文件夹不存在: {folder_path}"]

    for txt_file in folder.rglob('*.txt'):
        if '__MACOSX' in str(txt_file):
            continue

        # 确定分类
        if use_folder_as_category:
            parts = txt_file.relative_to(folder).parts
            category = default_category
            for part in reversed(parts[:-1]):
                if part and not part.startswith('_'):
                    category = part
                    break
        else:
            category = default_category

        try:
            with open(txt_file, 'rb') as f:
                file_content = f.read()
            article, msg = import_from_file(
                file_content,
                txt_file.name,
                category,
                existing_articles + imported
            )
            if article:
                # 保存文件路径
                article['file_path'] = str(txt_file.relative_to(folder))
                article['full_path'] = str(txt_file)
                imported.append(article)
            else:
                errors.append(f"{txt_file.name}: {msg}")
        except Exception as e:
            errors.append(f"{txt_file.name}: {str(e)}")

    return imported, errors


def save_imported_articles(
    articles: List[Dict],
    db: Dict,
    save_content_to_file: bool = False,
    output_folder: str = ""
) -> Dict:
    """
    保存导入的文章到数据库

    Args:
        articles: 要保存的文章列表
        db: 数据库字典
        save_content_to_file: 是否将内容保存为txt文件
        output_folder: 保存txt的目录

    Returns:
        更新后的数据库
    """
    for article in articles:
        # 如果需要保存内容到文件
        if save_content_to_file and output_folder and 'content' in article:
            cat_folder = Path(output_folder) / article['category']
            cat_folder.mkdir(parents=True, exist_ok=True)

            filename = f"{article['title']}.txt"
            file_path = cat_folder / filename
            with open(file_path, 'w', encoding='utf-8') as f:
                f.write(article['content'])

            article['file_path'] = str(file_path.relative_to(output_folder))
            article['full_path'] = str(file_path)

        # 移除临时内容
        article.pop('content', None)

        # 添加到数据库
        db['articles'].append(article)

        # 更新分类和标签列表
        if article['category'] not in db['categories']:
            db['categories'].append(article['category'])

        for hook in article.get('hooks', []):
            if hook not in db['tags']:
                db['tags'].append(hook)

    db['categories'] = sorted(db['categories'])
    db['tags'] = sorted(db['tags'])
    db['total_count'] = len(db['articles'])
    db['last_updated'] = datetime.now().strftime("%Y-%m-%d %H:%M:%S")

    return db
