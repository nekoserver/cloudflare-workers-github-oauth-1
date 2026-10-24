/** Native Redmine navigation without embedding API keys or assuming browser login. */
export function getSecuremineRedmineFeaturesScript(): string {
  return `function renderRedmineFeatures(account, project) {
    const root = document.getElementById('redmineFeaturesLinks');
    const status = document.getElementById('redmineFeaturesStatus');
    root.replaceChildren();
    if (!account) {
      status.textContent = 'Redmineに接続すると利用できます。操作デモからは実サーバーを開きません。';
      return;
    }
    let base;
    try {
      base = new URL(account.url);
      if (base.protocol !== 'https:' || base.username || base.password || base.search || base.hash) throw new Error();
    } catch (_) {
      status.textContent = '接続先URLを確認してください。';
      return;
    }
    const prefix = base.pathname.replace(/\\/+$/, '');
    function group(title, entries) {
      const heading = document.createElement('h3'); heading.textContent = title;
      const list = document.createElement('div'); list.className = 'redmine-feature-list';
      for (const [id, label, path] of entries) {
        const url = new URL(base.href); url.pathname = prefix + path;
        const link = document.createElement('a');
        link.dataset.redmineFeature = id; link.href = url.href;
        link.textContent = label; link.target = '_blank'; link.rel = 'noopener noreferrer';
        link.title = label + 'をRedmineで開く'; list.append(link);
      }
      root.append(heading, list);
    }
    status.textContent = 'Redmine本体の画面を別のタブで開きます。Redmineへのログインが必要になる場合があります。利用権限はRedmine側で確認されます。';
    group('全体・個人設定', [
      ['my-page', 'マイページ', '/my/page'], ['projects', 'プロジェクト', '/projects'],
      ['issues', '課題', '/issues'], ['activity', '活動', '/activity'],
      ['time', '作業時間', '/time_entries'], ['gantt', 'ガントチャート', '/issues/gantt'],
      ['calendar', 'カレンダー', '/issues/calendar'], ['news', 'ニュース', '/news'],
      ['account', '個人設定・APIキー', '/my/account']
    ]);
    const id = project && Number.isSafeInteger(project.id) && project.id > 0 ? String(project.id) : null;
    const identifier = project && typeof project.identifier === 'string' && /^[a-z0-9][a-z0-9_-]*$/i.test(project.identifier) ? project.identifier : id;
    if (identifier) {
      const path = '/projects/' + encodeURIComponent(identifier);
      group(String(project.name || '選択中のプロジェクト'), [
        ['project', '概要', path], ['project-issues', '課題', path + '/issues'],
        ['project-activity', '活動', path + '/activity'], ['project-time', '作業時間', path + '/time_entries'],
        ['project-gantt', 'ガントチャート', path + '/issues/gantt'], ['project-calendar', 'カレンダー', path + '/issues/calendar'],
        ['roadmap', 'ロードマップ・バージョン', path + '/roadmap'], ['wiki', 'Wiki', path + '/wiki'],
        ['project-news', 'ニュース', path + '/news'], ['documents', '文書', path + '/documents'],
        ['files', 'ファイル', path + '/files'], ['boards', 'フォーラム', path + '/boards'],
        ['repository', 'リポジトリ', path + '/repository'], ['project-settings', 'プロジェクト設定', path + '/settings']
      ]);
    }
    if (account.user && account.user.admin === true) group('管理者', [['administration', '管理', '/admin']]);
  }`;
}
