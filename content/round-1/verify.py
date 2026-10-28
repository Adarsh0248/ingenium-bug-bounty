"""Compatibility entry point for the trusted Round 1 content checks."""
import runpy
from pathlib import Path
import sys
sys.argv.insert(1, "--round=1")
runpy.run_path(str(Path(__file__).resolve().parent.parent / "verify.py"), run_name="__main__")
