"""Rebuild the standalone Japanese policy guide using only Python's standard library."""
import html
import json
from pathlib import Path

ROOT = Path(__file__).resolve().parent.parent
CATALOG = ROOT / 'scripts/github-policy-guide-data.json'
OUTPUT = ROOT / 'public/github-policy-guide'


def esc(value):
    return html.escape(str(value), quote=True)


# Standalone assets use the same semantic palette as src/utils/theme.ts.
# Fixed color values occur only in the two palette definitions, never in components.
CSS = '''
:root{color-scheme:light;--nav-width:240px;--bg-primary:#f8fafc;--card-bg:#ffffff;--text-primary:#1a202c;--text-secondary:#2d3748;--text-muted:#718096;--bg-secondary:#f7fafc;--border-color:#e2e8f0;--input-bg:#ffffff;--input-border:#cbd5e0;--accent-color:#667eea;--code-bg:#edf2f7;--success-color:#48bb78;--danger-color:#e53e3e}
@media(prefers-color-scheme:dark){:root{color-scheme:dark;--bg-primary:#111827;--card-bg:#2d3748;--text-primary:#e2e8f0;--text-secondary:#cbd5e0;--text-muted:#a0aec0;--bg-secondary:#1a202c;--border-color:#4a5568;--input-bg:#1a202c;--input-border:#4a5568;--accent-color:#7f9cf5;--code-bg:#1a202c;--success-color:#48bb78;--danger-color:#fc8181}}
*{box-sizing:border-box}body{margin:0;background:var(--bg-primary);color:var(--text-primary);font-family:system-ui,-apple-system,BlinkMacSystemFont,"Segoe UI",sans-serif;line-height:1.75}a{color:var(--accent-color);text-underline-offset:3px}button,input{font:inherit}button{background:var(--bg-secondary);color:var(--text-primary);border:1px solid var(--border-color);border-radius:6px;padding:4px 10px;cursor:pointer}a:focus-visible,button:focus-visible,summary:focus-visible{outline:3px solid var(--accent-color);outline-offset:3px}p{margin:0 0 16px}h1{font-size:clamp(1.5rem,3vw,2rem);line-height:1.4;letter-spacing:-.025em;margin:8px 0 18px}h2{font-size:1.05rem;line-height:1.5;display:inline;margin:0}h3{font-size:1rem;margin:0 0 12px}.eyebrow{color:var(--accent-color);font-size:.76rem;font-weight:700;letter-spacing:.12em}.muted{color:var(--text-secondary);font-size:.88rem}.pill{display:inline-block;background:var(--code-bg);border:1px solid var(--border-color);border-radius:4px;padding:2px 8px;font-size:.72rem;line-height:1.7}.phase-details{border:1px solid var(--border-color);border-radius:10px;margin:20px 0;background:var(--card-bg);overflow:hidden}.phase-details>summary{padding:14px 18px;cursor:pointer;background:var(--bg-secondary)}.phase-details>summary::marker{color:var(--accent-color)}.section-body{padding:18px}.section-body>:last-child{margin-bottom:0}.summary-list{padding-left:1.3em;margin:0}.summary-list li+li{margin-top:12px}.note{border-left:3px solid var(--accent-color);background:var(--bg-secondary);padding:12px 16px;font-size:.86rem;color:var(--text-secondary)}.table-scroll{max-width:100%;overflow-x:auto}table{width:100%;border-collapse:collapse;font-size:.85rem}th,td{border-bottom:1px solid var(--border-color);padding:12px 10px;text-align:left;vertical-align:top;color:var(--text-primary)}th{background:var(--bg-secondary);white-space:nowrap}td:first-child{white-space:nowrap}td:nth-child(3){font-weight:650}code{background:var(--code-bg);padding:2px 5px;border-radius:3px}tr:target{background:var(--bg-secondary);outline:2px solid var(--accent-color);outline-offset:-2px}footer{color:var(--text-secondary);font-size:.78rem;border-top:1px solid var(--border-color);padding-top:20px;margin-top:30px}.document{max-width:1100px;padding:clamp(22px,4vw,52px);margin:auto}.source-links{padding-left:1.2em}.source-links li+li{margin-top:8px}
.topbar{height:44px;position:sticky;top:0;display:flex;align-items:center;gap:12px;padding:0 18px;background:var(--card-bg);border-bottom:1px solid var(--border-color);z-index:2}.brand{font-size:.84rem;font-weight:700}.topbar .meta{font-size:.7rem;color:var(--text-secondary)}#menu-toggle{display:none}.sidebar{position:fixed;top:44px;bottom:0;left:0;width:var(--nav-width);background:var(--card-bg);border-right:1px solid var(--border-color);overflow:auto;padding:22px 14px}.sidebar-intro{padding:0 8px 18px}.sidebar-intro p{font-size:.78rem;color:var(--text-secondary);margin:7px 0 0}.nav-group{border:0;border-radius:0;border-bottom:1px solid var(--border-color);margin:0;background:var(--card-bg)}.nav-group>summary{padding:12px 8px;background:var(--card-bg)}.nav-group h2{font-size:.79rem;font-weight:600}.nav-count{font-size:.68rem;color:var(--text-secondary);margin-left:6px}.nav-link{display:block;padding:7px 10px 10px 22px;font-size:.75rem;border-left:3px solid var(--border-color);text-decoration:none}.nav-link:hover,.nav-link[aria-current=page]{background:var(--bg-secondary);border-left-color:var(--accent-color);color:var(--text-primary)}.workspace{margin-left:var(--nav-width);height:calc(100vh - 44px);height:calc(100dvh - 44px);display:flex;flex-direction:column;min-width:0}.workspace-head{padding:12px 24px;background:var(--bg-secondary);border-bottom:1px solid var(--border-color);display:flex;align-items:center;gap:14px}.workspace-head strong{font-size:.84rem}.workspace-head p{font-size:.72rem;margin:0;color:var(--text-secondary)}iframe{border:0;width:100%;flex:1;min-height:0;background:var(--bg-primary)}.skip-link{position:fixed;top:-100px;left:12px;z-index:4;background:var(--card-bg);padding:8px}.skip-link:focus{top:4px}noscript p{padding:12px;background:var(--bg-secondary);margin:0;font-size:.8rem}
@media(max-width:800px){#menu-toggle{display:inline-block}.topbar{padding:0 12px;gap:8px}.topbar .meta{display:none}.sidebar{display:none;position:fixed;width:var(--nav-width);z-index:3;box-shadow:8px 0 0 var(--border-color)}body.menu-open .sidebar{display:block}.workspace{margin-left:0}.workspace-head{padding:10px 16px}.workspace-head p{display:none}.document{padding:22px 16px}th,td{padding:10px 8px}}
@media print{.topbar,.sidebar,.workspace-head{display:none}.workspace{margin:0;height:auto}iframe{min-height:100vh}.document{padding:0;max-width:none}.phase-details{break-inside:avoid}a{color:var(--text-primary)}}
'''


def shell(title, body, scripts=''):
    return '<!doctype html>\n<html lang="ja"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><meta name="color-scheme" content="light dark"><meta name="referrer" content="no-referrer"><title>' + esc(title) + '</title><style>' + CSS + '</style></head><body>' + body + scripts + '</body></html>\n'


def section(title, body):
    return '<details class="phase-details" open><summary><h2>' + esc(title) + '</h2></summary><div class="section-body">' + body + '</div></details>'


def external(url, label):
    return '<a href="' + esc(url) + '" target="_blank" rel="noopener noreferrer">' + esc(label) + '</a>'


def group_page(group, questions, date):
    body = '<main class="document"><div class="eyebrow">GITHUB POLICY / ' + esc(group['group_id']) + '</div><h1>' + esc(group['name']) + '</h1>'
    body += '<p class="muted">特定リポジトリの規約適合性を確認するための日本語要約</p><p><span class="pill">' + esc(group['role']) + '</span> <span class="pill">' + str(len(questions)) + ' 判定文</span></p>'
    body += '<p class="note">この要約はGitHubの公式訳ではありません。対象リポジトリの実査や合否判定は行っていません。適用条件と例外は原文で確認してください。</p>'
    body += section('日本語要約', '<ul class="summary-list">' + ''.join('<li>' + esc(s) + '</li>' for s in group['summary']) + '</ul>')
    body += section('リポジトリを確認する観点', '<p>' + esc(group['objective']) + '</p>')
    body += section('確認する証拠', '<p>' + esc(group['evidence']) + '</p>')
    body += section('判断の限界', '<p>' + esc(group['limitation']) + '</p><p>実査では「適合」「不適合」「未確認」「適用外」を区別します。証拠がない項目を適合とは扱いません。</p>')
    table = '<p class="muted">Yes／Noは「規約の記述として正しいか」の解答です。対象リポジトリの適合・不適合の判定結果ではありません。</p><div class="table-scroll"><table><thead><tr><th scope="col">ID</th><th scope="col">判定文</th><th scope="col">規約の記述としての正解</th><th scope="col">根拠</th></tr></thead><tbody>'
    for q in questions:
        table += '<tr id="' + esc(q['id']) + '"><td>' + esc(q['id']) + '</td><td>' + esc(q['statement']) + '</td><td>' + esc(q['expected_answer']) + '</td><td>' + external(q['source_url'], q['basis']) + '</td></tr>'
    body += section('対応する二値判定文', table + '</tbody></table></div>')
    links = dict.fromkeys((q['source_url'], q['basis']) for q in questions)
    body += section('公式原文', '<ul class="source-links">' + ''.join('<li>' + external(url, label) + '</li>' for url, label in links) + '</ul>')
    body += '<footer>原文確認日：' + esc(date) + ' / 分類・要約は本ページ独自の編集です。<br>' + external('../', '分類メニューを別タブで開く') + '</footer></main>'
    return shell(group['name'] + ' | GitHub規約ガイド', body)


def index_page(catalog):
    groups = catalog['groups']
    first = groups[0]
    body = '<a class="skip-link" href="#policy-main">規約本文へ移動</a><header class="topbar"><button id="menu-toggle" type="button" aria-controls="policy-navigation" aria-expanded="false">分類</button><span class="brand">GitHub規約ガイド</span><span class="meta">14分類 · 234判定文 · 日本語要約</span></header>'
    body += '<nav id="policy-navigation" class="sidebar" aria-label="規約の分類"><div class="sidebar-intro"><div class="eyebrow">REPOSITORY POLICY</div><p>分類を開き、日本語要約を選択してください。</p></div>'
    for group in groups:
        current = ' aria-current="page"' if group is first else ''
        body += '<details class="phase-details nav-group" open><summary><h2>' + esc(group['group_id']) + ' ' + esc(group['name']) + '</h2><span class="nav-count">' + str(len(group['question_ids'])) + '</span></summary><a class="nav-link" data-group="' + esc(group['group_id']) + '" href="./' + esc(group['slug']) + '/" target="policy-content"' + current + '>日本語要約を開く</a></details>'
    body += '</nav><main id="policy-main" class="workspace" tabindex="-1"><div class="workspace-head"><strong id="policy-content-heading">' + esc(first['name']) + '</strong><p>各分類の要約と確認項目</p></div><noscript><style>@media(max-width:800px){.sidebar{display:block;position:static;width:100%;box-shadow:none;max-height:40vh}.workspace{height:80vh}#menu-toggle{display:none}}</style><p>左のリンクから要約を開けます。JavaScriptが無効のため、選択中の分類名とURLは更新されません。</p></noscript><iframe name="policy-content" id="policy-content" title="' + esc(first['name']) + 'の日本語要約" src="./' + esc(first['slug']) + '/"></iframe></main>'
    # The allowlist prevents untrusted URL hashes from becoming iframe URLs.
    model = '<script id="policy-navigation-model">\nvar policyGroupIds=' + json.dumps([g['group_id'] for g in groups]) + ';\nfunction resolvePolicyGroup(hash){var id=hash.slice(1);return policyGroupIds.indexOf(id)!==-1?id:policyGroupIds[0];}\n</script>'
    behavior = '''<script>
(function(){
  var links=Array.from(document.querySelectorAll('a[data-group]'));
  var frame=document.getElementById('policy-content');
  var heading=document.getElementById('policy-content-heading');
  var menu=document.getElementById('menu-toggle');
  function closeMenu(){document.body.classList.remove('menu-open');menu.setAttribute('aria-expanded','false');}
  function selectGroup(id,navigate){
    var link=links.find(function(item){return item.dataset.group===id;});
    links.forEach(function(item){if(item===link){item.setAttribute('aria-current','page');}else{item.removeAttribute('aria-current');}});
    var name=link.closest('details').querySelector('h2').textContent;
    heading.textContent=name;
    frame.title=name+'の日本語要約';
    link.closest('details').open=true;
    if(navigate){frame.src=link.getAttribute('href');}
  }
  links.forEach(function(link){link.addEventListener('click',function(event){
    if(event.button!==0||event.ctrlKey||event.metaKey||event.shiftKey||event.altKey){return;}
    var id=link.dataset.group;
    history.replaceState(null,'','#'+id);
    selectGroup(id,false);
    closeMenu();
  });});
  menu.addEventListener('click',function(){var opened=document.body.classList.toggle('menu-open');menu.setAttribute('aria-expanded',String(opened));});
  document.addEventListener('keydown',function(event){if(event.key==='Escape'&&document.body.classList.contains('menu-open')){closeMenu();menu.focus();}});
  window.addEventListener('hashchange',function(){selectGroup(resolvePolicyGroup(location.hash),true);});
  selectGroup(resolvePolicyGroup(location.hash),location.hash!=='');
})();
</script>'''
    return shell('GitHub規約ガイド | リポジトリ適合性の確認', body, model + behavior)


def main():
    catalog = json.loads(CATALOG.read_text())
    groups = catalog['groups']
    assert len(groups) == 14
    members = [qid for g in groups for qid in g['question_ids']]
    assert len(members) == len(set(members)) == 234
    questions = {q['id']: q for q in catalog['questions']}
    assert set(members) == set(questions)
    assert len({g['slug'] for g in groups}) == 14
    OUTPUT.mkdir(parents=True, exist_ok=True)
    (OUTPUT / 'index.html').write_text(index_page(catalog))
    for group in groups:
        directory = OUTPUT / group['slug']
        directory.mkdir(parents=True, exist_ok=True)
        (directory / 'index.html').write_text(group_page(group, [questions[qid] for qid in group['question_ids']], catalog['checked_on']))
    print('Generated 15 standalone HTML pages with 14 groups and 234 statements.')


if __name__ == '__main__':
    main()
