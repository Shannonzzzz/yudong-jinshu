"""Build the self-contained site from the checked-in template, code and text data."""
from pathlib import Path
import argparse
import json

ROOT = Path(__file__).resolve().parent.parent
SOURCE = ROOT / 'src'
OUTPUT = ROOT / 'docs' / 'index.html'


def build():
    data = json.loads((SOURCE / 'data.json').read_text(encoding='utf-8'))
    entries = data.get('entries', [])
    if len(entries) != 144 or len({entry['key'] for entry in entries}) != 144:
        raise ValueError('数据必须包含 144 个不同的原文条目。')
    if not all(all(entry.get(field) for field in ('key', 'tune', 'grade', 'poem', 'judgment')) for entry in entries):
        raise ValueError('原文条目缺少必要字段。')
    payload = json.dumps(data, ensure_ascii=False, indent=2).replace('<', '\\u003c')
    html = (SOURCE / 'template.html').read_text(encoding='utf-8')
    for marker, value in [('__STYLE__', (SOURCE / 'style.css').read_text(encoding='utf-8')),
                          ('__DATA__', payload),
                          ('__CORE__', (SOURCE / 'core.js').read_text(encoding='utf-8')),
                          ('__UI__', (SOURCE / 'ui.js').read_text(encoding='utf-8'))]:
        if html.count(marker) != 1:
            raise ValueError(f'模板标记缺失或重复：{marker}')
        html = html.replace(marker, value)
    return html


def main():
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument('--check', action='store_true', help='仅检查页面与源文件是否一致')
    args = parser.parse_args()
    html = build()
    if args.check:
        if not OUTPUT.exists() or OUTPUT.read_text(encoding='utf-8') != html:
            raise SystemExit('页面与源文件不一致，请运行 python scripts/build.py。')
        print('构建产物与源文件一致。')
    else:
        OUTPUT.parent.mkdir(parents=True, exist_ok=True)
        OUTPUT.write_text(html, encoding='utf-8', newline='\n')
        print(f'已生成 {OUTPUT.relative_to(ROOT)}。')


if __name__ == '__main__':
    main()
