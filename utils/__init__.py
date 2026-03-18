# -*- coding: utf-8 -*-
"""
咖喱小助手 - 写作资源管理工具集
"""

from .indexer import build_index, read_file_content, extract_title_from_filename
from .search import search_articles, get_category_stats, get_tag_stats, highlight_text
from .inspiration import get_random_inspiration, generate_creative_combo, get_daily_theme
from .importer import (
    import_from_text,
    import_from_file,
    import_from_zip,
    import_from_folder,
    save_imported_articles,
    check_duplicate,
    auto_extract_hooks
)

__all__ = [
    'build_index',
    'read_file_content',
    'extract_title_from_filename',
    'search_articles',
    'get_category_stats',
    'get_tag_stats',
    'highlight_text',
    'get_random_inspiration',
    'generate_creative_combo',
    'get_daily_theme',
    'import_from_text',
    'import_from_file',
    'import_from_zip',
    'import_from_folder',
    'save_imported_articles',
    'check_duplicate',
    'auto_extract_hooks',
]
