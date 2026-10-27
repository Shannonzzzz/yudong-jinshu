"""Check generated data, self-contained resources and the public site entry."""
from pathlib import Path
import json
import re

ROOT = Path(__file__).resolve().parent.parent
html = (ROOT / 'docs' / 'index.html').read_text(encoding='utf-8')
data = json.loads((ROOT / 'src' / 'data.json').read_text(encoding='utf-8'))
match = re.search(r'<script type="application/json" id="source-data">(.*?)</script>', html, re.S)
assert match, '页面中缺少原文数据'
assert json.loads(match.group(1)) == data, '页面内嵌数据与源数据不一致'
assert len(data['entries']) == 144
assert not re.search(r'<(?:script|link|img)[^>]+(?:src|href)=["\']https?://', html, re.I)
assert 'fetch(' not in html
assert all(marker not in html for marker in ['__STYLE__', '__DATA__', '__CORE__', '__UI__'])
assert (ROOT / 'docs' / '.nojekyll').is_file()
print('144 条内嵌原文数据与源数据一致；静态页面不依赖外部网络资源。')
