"""Export the checked-in user manual for the website. Run after editing the DOCX.

Usage: python3 scripts/export-user-guide.py
Only Python's standard library is required. The audit report is never published.
"""
import hashlib
import json
from pathlib import Path
import re
import shutil
import xml.etree.ElementTree as ET
from zipfile import ZipFile

ROOT = Path(__file__).resolve().parents[1]
NAME = 'Rainscales-Ticket-Huong-dan-su-dung-toan-bo-website.docx'
SOURCE = ROOT / 'docs' / NAME
NS = {'w': 'http://schemas.openxmlformats.org/wordprocessingml/2006/main'}
W = '{' + NS['w'] + '}'


def text(element):
    return ''.join(node.text or '' for node in element.iter(W + 't')).strip()


with ZipFile(SOURCE) as archive:
    body = ET.fromstring(archive.read('word/document.xml')).find('w:body', NS)
    styles = ET.fromstring(archive.read('word/styles.xml'))
    names = {}
    for style in styles.findall('w:style', NS):
        name = style.find('w:name', NS)
        if name is not None:
            names[style.get(W + 'styleId')] = name.get(W + 'val', '').lower()
    chapters = []
    for element in body:
        if element.tag == W + 'p':
            value = text(element)
            if not value:
                continue
            style = element.find('w:pPr/w:pStyle', NS)
            name = names.get(style.get(W + 'val') if style is not None else '', '')
            if name == 'heading 1':
                chapters.append({'title': value, 'blocks': []})
            elif chapters:
                kind = 'paragraph'
                if name in ['heading 2', 'heading 3']:
                    kind = 'heading'
                elif name == 'list bullet':
                    kind = 'bullet'
                chapters[-1]['blocks'].append({'type': kind, 'text': value})
        elif element.tag == W + 'tbl' and chapters:
            rows = [[text(cell) for cell in row.findall('w:tc', NS)]
                    for row in element.findall('w:tr', NS)]
            chapters[-1]['blocks'].append({'type': 'table', 'rows': rows})
    footer = '\n'.join(text(ET.fromstring(archive.read(name)))
                       for name in archive.namelist()
                       if re.fullmatch(r'word/footer\d+\.xml', name))

assert len(chapters) == 15, 'Expected 15 user guide chapters; check document headings.'
version = re.search(r'Phiên bản ([\d.]+)', footer)
updated = re.search(r'\d{2}/\d{2}/\d{4}', footer)
guide = {
    'fileName': NAME,
    'sourceSha256': hashlib.sha256(SOURCE.read_bytes()).hexdigest(),
    'version': version.group(1) if version else '',
    'updatedAt': updated.group() if updated else '',
    'chapters': chapters,
}
content = ROOT / 'src/features/help/user-guide.json'
content.parent.mkdir(parents=True, exist_ok=True)
content.write_text(json.dumps(guide, ensure_ascii=False, indent=2) + '\n')
public = ROOT / 'public/docs'
public.mkdir(parents=True, exist_ok=True)
shutil.copyfile(SOURCE, public / NAME)
print(f'Exported {len(chapters)} chapters and the original Word download.')
