#!/usr/bin/env python3
"""Reusable container-only Apache SSI setup; does not depend on lib."""
from pathlib import Path
import subprocess

SSI_CONF = '''<Directory /var/www/html/lib>
    Require all granted
    AllowOverride None
    Options +Includes -Indexes -MultiViews
    AddType text/html .shtml .shtm
    AddOutputFilter INCLUDES .shtml .shtm
</Directory>
'''

def configure_container(root=Path('/'), run=subprocess.run):
    """Enable SSI for an optional /lib tree and nowhere else."""
    root=Path(root)
    conf=root/'etc/apache2/conf-available/container-ssi.conf'
    conf.parent.mkdir(parents=True,exist_ok=True)
    conf.write_text(SSI_CONF)
    for cmd in (['a2enmod','include'],['a2enconf','container-ssi']):
        run(cmd,check=True)

if __name__ == '__main__':
    configure_container()
