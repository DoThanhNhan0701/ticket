"""Fill the UI-downloaded template; preserve its headers and workbook structure.

Standard library only. This prepares a local upload file, never calls the API.
"""
import re
import sys
from zipfile import ZipFile, ZIP_DEFLATED
from xml.etree import ElementTree as ET

source, target, marker = sys.argv[1:]
ns = {'s': 'http://schemas.openxmlformats.org/spreadsheetml/2006/main'}
uri = ns['s']
with ZipFile(source) as archive:
    files = {name: archive.read(name) for name in archive.namelist()}
strings = []
if 'xl/sharedStrings.xml' in files:
    strings = [''.join(node.itertext()) for node in ET.fromstring(files['xl/sharedStrings.xml']).findall('s:si', ns)]
sheet = ET.fromstring(files['xl/worksheets/sheet1.xml'])
data = sheet.find('s:sheetData', ns)
headers = {}
header_row = 0
for row in data.findall('s:row', ns):
    for cell in row.findall('s:c', ns):
        value = cell.find('s:v', ns)
        text = (strings[int(value.text)] if cell.get('t') == 's' and value is not None
                else ''.join(x.text or '' for x in cell.findall('.//s:t', ns)))
        text = text.strip().rstrip('*').strip()
        if text.lower() == 'stt':
            text = 'STT'
        if text in ('STT', 'Nội dung', 'Số lượng'):
            headers[text] = re.sub(r'\d', '', cell.get('r'))
            header_row = max(header_row, int(row.get('r')))
if not {'Nội dung', 'Số lượng'} <= headers.keys():
    raise ValueError(f'Unexpected downloaded template headers: {headers}')
for row in list(data):
    if int(row.get('r', '0')) > header_row:
        data.remove(row)
for offset, number in enumerate((0, 2), 1):
    index = header_row + offset
    row = ET.SubElement(data, f'{{{uri}}}row', r=str(index))
    for title, col in sorted(headers.items(), key=lambda item: (len(item[1]), item[1])):
        value = f'{marker} Excel {offset}' if title == 'Nội dung' else str(offset if title == 'STT' else number)
        cell = ET.SubElement(row, f'{{{uri}}}c', r=f'{col}{index}')
        if title == 'Nội dung':
            cell.set('t', 'inlineStr')
            ET.SubElement(ET.SubElement(cell, f'{{{uri}}}is'), f'{{{uri}}}t').text = value
        else:
            ET.SubElement(cell, f'{{{uri}}}v').text = value
dimension = sheet.find('s:dimension', ns)
if dimension is not None:
    start, end = dimension.get('ref').split(':')
    dimension.set('ref', f"{start}:{re.sub(r'[0-9]', '', end)}{header_row + 2}")
files['xl/worksheets/sheet1.xml'] = ET.tostring(sheet, encoding='utf-8', xml_declaration=True)
with ZipFile(target, 'w', ZIP_DEFLATED) as archive:
    for name, content in files.items():
        archive.writestr(name, content)
