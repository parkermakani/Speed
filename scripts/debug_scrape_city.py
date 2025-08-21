#!/usr/bin/env python
"""Wrapper script located at project_root/scripts for convenience.

This forwards execution to `backend/scripts/debug_scrape_city.py`, allowing you
to run:

    python scripts/debug_scrape_city.py [--city N]

instead of specifying the backend path.
"""
from importlib import import_module


def main() -> None:
    mod = import_module("backend.scripts.debug_scrape_city")
    mod.main()  # type: ignore[attr-defined]


if __name__ == "__main__":
    main()
