"""Publish the original Word manual for direct rendering on the website.

Usage: python3 scripts/export-user-guide.py
Only Python's standard library is required. No JSON content is generated.
"""
import shutil
from pathlib import Path
from zipfile import ZipFile

ROOT = Path(__file__).resolve().parents[1]
NAME = 'Rainscales-Ticket-Huong-dan-su-dung-toan-bo-website.docx'
SOURCE = ROOT / 'docs' / NAME

with ZipFile(SOURCE) as archive:
    if 'word/document.xml' not in archive.namelist():
        raise ValueError('The user guide must be a valid Word document.')

public = ROOT / 'public/docs'
public.mkdir(parents=True, exist_ok=True)
shutil.copyfile(SOURCE, public / NAME)
print('Published the original Word manual for rendering and download.')
