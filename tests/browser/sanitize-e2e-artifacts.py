"""Sanitize reports/trace ZIPs, including Playwright's embedded report ZIP.
Secrets arrive on stdin, never in argv, source, or a credential artifact.
"""
import base64
import io
import json
import pathlib
import re
import sys
import zipfile

root = pathlib.Path(sys.argv[1]).resolve()
secrets = [s for s in json.load(sys.stdin) if s]
jwt = re.compile(r"eyJ[A-Za-z0-9_-]+\.[A-Za-z0-9_-]+\.[A-Za-z0-9_-]+")
embedded = re.compile(r"data:application/zip;base64,([A-Za-z0-9+/=]+)")

def clean_text(text):
    text = jwt.sub("[REDACTED_JWT]", text)
    for secret in secrets:
        text = text.replace(secret, "[REDACTED]")
    return text

def clean_zip(data):
    source = zipfile.ZipFile(io.BytesIO(data))
    target = io.BytesIO()
    with zipfile.ZipFile(target, "w", zipfile.ZIP_DEFLATED) as archive:
        for entry in source.infolist():
            value = source.read(entry.filename)
            if entry.filename.endswith(".zip"):
                value = clean_zip(value)
            elif not entry.filename.endswith((".png", ".jpg", ".jpeg", ".webm", ".woff", ".woff2")):
                try:
                    value = clean_text(value.decode("utf-8")).encode("utf-8")
                except UnicodeDecodeError:
                    pass
            archive.writestr(entry, value)
    return target.getvalue()

for file in root.rglob("*"):
    if not file.is_file():
        continue
    if file.suffix == ".zip":
        file.write_bytes(clean_zip(file.read_bytes()))
    elif file.suffix in (".json", ".jsonl", ".trace", ".network", ".txt", ".log", ".html", ".csv", ".md"):
        text = file.read_text(encoding="utf-8", errors="strict")
        if file.suffix == ".html":
            text = embedded.sub(lambda match: "data:application/zip;base64," + base64.b64encode(clean_zip(base64.b64decode(match.group(1)))).decode(), text)
        file.write_text(clean_text(text), encoding="utf-8")
print("Sanitized local report and trace artifacts.")
