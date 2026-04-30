"""
Regenerate every embedded JS module that mirrors the on-disk core/ and
sketches/ folders. Run this whenever a .s file under core/ or sketches/
changes — the GitHub Pages deploy serves the generated *-fs.js files,
not the underlying .s sources.

Run: python build/build.py
"""
import build_core_fs
import build_sketches_fs

build_core_fs.main()
build_sketches_fs.main()
