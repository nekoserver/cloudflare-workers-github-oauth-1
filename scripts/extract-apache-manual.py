#!/usr/bin/env python3
# Apache httpd のソースアーカイブから、モジュールのマニュアル(英語版)を本体ワーカーの
# 静的アセット(public/apache-manual/<版>/)へ展開する。/cf-containers のApacheモジュール一覧で、
# モジュール名から開くヘルプ(iframe)と説明・設定項目(modules.json)に使う。ユーザー指定(2026-11-15)。
#
# 使い方(取得物は空のディレクトリに置き、このスクリプトはリポジトリから -I で実行する):
#   curl -fsSLO https://downloads.apache.org/httpd/httpd-<版>.tar.bz2
#   curl -fsSLO https://downloads.apache.org/httpd/httpd-<版>.tar.bz2.sha512
#   python3 -I scripts/extract-apache-manual.py <dir>/httpd-<版>.tar.bz2 <dir>/httpd-<版>.tar.bz2.sha512 public/apache-manual
#
# - アーカイブは配布元が公開する .sha512 と照合し、一致しなければ何も書かずに止める(CLAUDE.md コンテナビルドのルール2)。
# - 展開するのは docs/manual/mod/*.html.en(拡張子 .html に改名)、表示に要る style/ と images/、LICENSE・NOTICE だけ。
# - mod/ の外(用語集・howto など)へのリンクは公式のオンライン版(https://httpd.apache.org/docs/2.4/)に張り替え、
#   外部リンクは新しいタブで開くようにする(iframe の中で外部サイトへ移動させない)。
# - modules.json には、モジュール名(識別子から _module を除いたもの。apache2ctl -M の表記と同じ)ごとに、
#   説明・状態・識別子・ソースファイル・互換性と、そのページで定義されたディレクティブ(構文・既定値・文脈)を入れる。
import hashlib
import html
import json
import os
import re
import shutil
import sys
import tarfile

ONLINE = 'https://httpd.apache.org/docs/2.4/'


def fail(message):
    sys.stderr.write('extract-apache-manual: ' + message + '\n')
    sys.exit(1)


def text_of(fragment):
    without_tags = re.sub(r'<[^>]+>', '', fragment)
    return re.sub(r'\s+', ' ', html.unescape(without_tags)).strip()


def rows_of(table_html):
    rows = {}
    for th, td in re.findall(r'<tr><th>(.*?)</th><td>(.*?)</td></tr>', table_html, re.S):
        rows[text_of(th).rstrip(':').replace(' ', ' ')] = text_of(td)
    return rows


def rewrite_links(page):
    def fix(match):
        attr, url = match.group(1), match.group(2)
        if url.startswith(('../mod/', '../style/', '../images/')):
            return match.group(0)
        if url.startswith('../en/mod/'):
            return '%s="%s"' % (attr, url[len('../en/'):].replace('mod/', '', 1))
        if url.startswith('../'):
            return '%s="%s"' % (attr, ONLINE + url[3:])
        return match.group(0)

    page = re.sub(r'\b(href|src)="([^"]*)"', fix, page)

    def external(match):
        tag = match.group(0)
        if 'target=' in tag:
            return tag
        rel = re.search(r'\brel="([^"]*)"', tag)
        if rel:
            merged = rel.group(1) + ' noopener noreferrer'
            return tag[:rel.start()] + 'rel="' + merged + '"' + tag[rel.end():-1] + ' target="_blank">'
        return tag[:-1] + ' target="_blank" rel="noopener noreferrer">'

    return re.sub(r'<a\b[^>]*\bhref="https?://[^"]*"[^>]*>', external, page)


def parse_module(page, file_name):
    table = re.search(r'<table class="module">(.*?)</table>', page, re.S)
    if not table:
        return None
    info = rows_of(table.group(1))
    identifier = info.get('Module Identifier', '')
    if not identifier.endswith('_module'):
        return None
    directives = []
    for section in re.findall(r'<div class="directive-section">(.*?)</table>', page, re.S):
        name = re.search(r'<span id="([^"]+)">', section)
        anchor = re.search(r'<h2 id="([^"]+)"', section)
        dtable = re.search(r'<table class="directive">(.*)', section, re.S)
        if not (name and dtable):
            continue
        rows = rows_of(dtable.group(1))
        directives.append({
            'name': html.unescape(name.group(1)),
            'anchor': anchor.group(1) if anchor else '',
            'description': rows.get('Description', ''),
            'syntax': rows.get('Syntax', ''),
            'default': rows.get('Default', ''),
            'context': rows.get('Context', ''),
        })
    return identifier[:-len('_module')], {
        'title': text_of(re.search(r'<h1>(.*?)</h1>', page, re.S).group(1)),
        'file': 'mod/' + file_name,
        'description': info.get('Description', ''),
        'status': info.get('Status', ''),
        'identifier': identifier,
        'sourceFile': info.get('Source File', ''),
        'compatibility': info.get('Compatibility', ''),
        'directives': directives,
    }


def main():
    if len(sys.argv) != 4:
        fail('使い方: extract-apache-manual.py <httpd-版.tar.bz2> <httpd-版.tar.bz2.sha512> <出力先(public/apache-manual)>')
    archive, sha_file, out_root = sys.argv[1:]
    match = re.search(r'httpd-(\d+\.\d+\.\d+)\.tar\.bz2$', archive)
    if not match:
        fail('アーカイブ名が httpd-<版>.tar.bz2 ではありません: ' + archive)
    version = match.group(1)
    with open(sha_file, encoding='ascii') as f:
        expected = f.read().split()[0].lower()
    digest = hashlib.sha512()
    with open(archive, 'rb') as f:
        for chunk in iter(lambda: f.read(1 << 20), b''):
            digest.update(chunk)
    if digest.hexdigest() != expected:
        fail('sha512 が配布元の値と一致しません')

    prefix = 'httpd-%s/' % version
    manual = prefix + 'docs/manual/'
    pages, assets = {}, {}
    with tarfile.open(archive, 'r:bz2') as tar:
        for member in tar.getmembers():
            if not member.isfile():
                continue
            name = member.name
            data = None
            if name.startswith(manual + 'mod/') and name.endswith('.html.en'):
                data = tar.extractfile(member).read()
                pages[os.path.basename(name)[:-len('.en')]] = data.decode('utf-8')
            elif name.startswith((manual + 'style/css/', manual + 'style/scripts/', manual + 'images/')):
                assets[name[len(manual):]] = tar.extractfile(member).read()
            elif name in (prefix + 'LICENSE', prefix + 'NOTICE'):
                assets[os.path.basename(name)] = tar.extractfile(member).read()
    if not pages:
        fail('docs/manual/mod/*.html.en が見つかりません')

    used_images = set()
    for page in pages.values():
        used_images.update(re.findall(r'src="\.\./(images/[^"]+)"', page))
        used_images.update(re.findall(r'href="\.\./(images/[^"]+)"', page))

    out = os.path.join(out_root, version)
    if os.path.exists(out):
        shutil.rmtree(out)
    os.makedirs(os.path.join(out, 'mod'))

    modules = {}
    for file_name, page in sorted(pages.items()):
        with open(os.path.join(out, 'mod', file_name), 'w', encoding='utf-8') as f:
            f.write(rewrite_links(page))
        parsed = parse_module(page, file_name)
        if parsed:
            key, entry = parsed
            modules[key] = entry

    for rel, data in sorted(assets.items()):
        if rel.startswith('images/') and rel not in used_images:
            continue
        dest = os.path.join(out, rel)
        os.makedirs(os.path.dirname(dest), exist_ok=True)
        with open(dest, 'wb') as f:
            f.write(data)

    index = {
        'apacheVersion': version,
        'source': 'https://downloads.apache.org/httpd/httpd-%s.tar.bz2' % version,
        'sha512': expected,
        'online': ONLINE,
        'modules': dict(sorted(modules.items())),
    }
    with open(os.path.join(out, 'modules.json'), 'w', encoding='utf-8') as f:
        json.dump(index, f, ensure_ascii=False, indent=1)
        f.write('\n')
    print('%s: %d pages, %d modules -> %s' % (version, len(pages), len(modules), out))


if __name__ == '__main__':
    main()
