"""Build the downloadable English Word guide from the web guide (stdlib only)."""
from html.parser import HTMLParser
from pathlib import Path
import re
from xml.sax.saxutils import escape
from zipfile import ZipFile, ZIP_DEFLATED

ROOT = Path(__file__).resolve().parents[1]
DOCS = ROOT / "public" / "docs"


class Node:
    def __init__(self, tag):
        self.tag, self.children = tag, []

    def text(self):
        return "".join(child.text() if isinstance(child, Node) else child for child in self.children)


class DocumentParser(HTMLParser):
    def __init__(self):
        super().__init__()
        self.root = Node("root")
        self.stack = [self.root]

    def handle_starttag(self, tag, attrs):
        node = Node(tag)
        self.stack[-1].children.append(node)
        if tag not in {"meta", "br", "hr", "img", "link"}:
            self.stack.append(node)

    def handle_endtag(self, tag):
        if self.stack[-1].tag == tag:
            self.stack.pop()

    def handle_data(self, data):
        self.stack[-1].children.append(data)


def paragraph(text, style="Normal"):
    text = re.sub(r"\s+", " ", text).strip()
    return f'<w:p><w:pPr><w:pStyle w:val="{style}"/></w:pPr><w:r><w:t xml:space="preserve">{escape(text)}</w:t></w:r></w:p>'


def render(node):
    if not isinstance(node, Node) or node.tag == "head":
        return ""
    if node.tag in {"h1", "h2", "p", "li"}:
        style = {"h1": "Heading1", "h2": "Heading2"}.get(node.tag, "Normal")
        prefix = "• " if node.tag == "li" else ""
        return paragraph(prefix + node.text(), style)
    content = "".join(render(child) for child in node.children)
    if node.tag in {"td", "th"}:
        return f'<w:tc><w:tcPr><w:tcW w:w="3000" w:type="dxa"/></w:tcPr>{paragraph(node.text())}</w:tc>'
    if node.tag == "tr":
        return f"<w:tr>{content}</w:tr>"
    if node.tag == "table":
        return f'<w:tbl><w:tblPr><w:tblW w:w="0" w:type="auto"/></w:tblPr>{content}</w:tbl>'
    return content


parser = DocumentParser()
parser.feed((DOCS / "Rainscales-Ticket-User-Guide.html").read_text(encoding="utf-8"))
namespace = "http://schemas.openxmlformats.org/wordprocessingml/2006/main"
document = f'<?xml version="1.0" encoding="UTF-8" standalone="yes"?><w:document xmlns:w="{namespace}"><w:body>{render(parser.root)}<w:sectPr><w:pgSz w:w="11906" w:h="16838"/><w:pgMar w:top="1134" w:right="1134" w:bottom="1134" w:left="1134"/></w:sectPr></w:body></w:document>'
styles = f'''<w:styles xmlns:w="{namespace}">
<w:style w:type="paragraph" w:default="1" w:styleId="Normal"><w:name w:val="Normal"/><w:rPr><w:rFonts w:ascii="Calibri" w:hAnsi="Calibri"/><w:sz w:val="22"/><w:lang w:val="en-GB"/></w:rPr></w:style>
<w:style w:type="paragraph" w:styleId="Heading1"><w:name w:val="heading 1"/><w:basedOn w:val="Normal"/><w:pPr><w:outlineLvl w:val="0"/><w:pageBreakBefore/></w:pPr><w:rPr><w:b/><w:sz w:val="32"/></w:rPr></w:style>
<w:style w:type="paragraph" w:styleId="Heading2"><w:name w:val="heading 2"/><w:basedOn w:val="Normal"/><w:pPr><w:outlineLvl w:val="1"/></w:pPr><w:rPr><w:b/><w:sz w:val="26"/></w:rPr></w:style></w:styles>'''
with ZipFile(DOCS / "Rainscales-Ticket-User-Guide.docx", "w", ZIP_DEFLATED) as archive:
    archive.writestr("[Content_Types].xml", '<Types xmlns="http://schemas.openxmlformats.org/package/2006/content-types"><Default Extension="rels" ContentType="application/vnd.openxmlformats-package.relationships+xml"/><Default Extension="xml" ContentType="application/xml"/><Override PartName="/word/document.xml" ContentType="application/vnd.openxmlformats-officedocument.wordprocessingml.document.main+xml"/><Override PartName="/word/styles.xml" ContentType="application/vnd.openxmlformats-officedocument.wordprocessingml.styles+xml"/></Types>')
    archive.writestr("_rels/.rels", '<Relationships xmlns="http://schemas.openxmlformats.org/package/2006/relationships"><Relationship Id="rId1" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/officeDocument" Target="word/document.xml"/></Relationships>')
    archive.writestr("word/_rels/document.xml.rels", '<Relationships xmlns="http://schemas.openxmlformats.org/package/2006/relationships"><Relationship Id="rId1" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/styles" Target="styles.xml"/></Relationships>')
    archive.writestr("word/document.xml", document)
    archive.writestr("word/styles.xml", styles)
print("Built English guide: 15 chapters.")
