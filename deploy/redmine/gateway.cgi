#!/usr/bin/python3
"""Run the same HMAC gateway with Apache mod_cgid (no mod_wsgi required)."""
import importlib.machinery
import importlib.util
from pathlib import Path
from wsgiref.handlers import CGIHandler

loader = importlib.machinery.SourceFileLoader("redmine_hmac", str(Path(__file__).with_name("gateway.wsgi")))
spec = importlib.util.spec_from_loader(loader.name, loader)
module = importlib.util.module_from_spec(spec)
loader.exec_module(module)
CGIHandler().run(module.application)
