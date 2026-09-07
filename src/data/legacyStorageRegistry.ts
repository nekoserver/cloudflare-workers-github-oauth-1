/**
 * 個別Cookie/localStorage乱立の整理用レジストリ。
 * SPEC.cloudflare-workers-github-oauth-1.20260907.user-preferences.md参照。
 *
 * ブラウザに実際に残っているCookie/localStorageの値が「どのページ・機能の
 * 設定なのか」「D1(user_preferences)への移行先が既にあるのか」を突き合わせる
 * ための静的な一覧。/legacy-storage-inventory ページがこれを使って
 * パージ可能/復元可能の判定を行う。
 *
 * `migratedPrefKey`が設定されているキーだけが、USER_PREFERENCE_KEYS(src/index.ts)
 * 側にも対応する許可リストエントリを持つ = D1への移行先が実在する。
 * それ以外は「まだ移行先が無い(移行未対応)」として、復元・パージのどちらの
 * ボタンも無効化する。
 */
export type LegacyStorageEntry = {
  key: string;
  // trueの場合、keyは前方一致で扱う(例: kw_pal_ は kw_pal_<keyword> という
  // キーワードごとの動的なCookie名のprefix)
  isPrefix?: boolean;
  storage: 'cookie' | 'localStorage';
  page: string;
  description: string;
  // USER_PREFERENCE_KEYS(src/index.ts)に対応するキーがある場合のみ設定する。
  // 設定されていれば「D1への移行先が実在する」= 復元/パージの判定対象になる。
  migratedPrefKey?: string;
};

export const LEGACY_STORAGE_ENTRIES: LegacyStorageEntry[] = [
  { key: 'd1_query_catalog_sort', storage: 'cookie', page: '/d1-query-catalog', description: '帯の並び替え順(旧実装、既にuser_preferencesへ移行済み)', migratedPrefKey: 'd1_query_catalog_sort' },
  { key: 'user_theme', storage: 'cookie', page: '全ページ共通', description: 'ダーク/ライトテーマ' },
  { key: 'user_timezone', storage: 'cookie', page: '/settings', description: '表示タイムゾーン(D1のuser_sessionsが優先、Cookieはフォールバック)' },
  { key: 'user_session_duration', storage: 'cookie', page: '/settings', description: 'セッション有効期限(D1のuser_sessionsが優先、Cookieはフォールバック)' },
  { key: 'user_recent_commits_count', storage: 'cookie', page: '/settings', description: '最終コミット一覧の表示件数' },
  { key: 'user_toast_duration', storage: 'cookie', page: '/settings', description: 'トースト通知の表示時間' },
  { key: 'user_search_label_mode', storage: 'cookie', page: '/settings', description: '検索結果のラベル表示モード' },
  { key: 'user_apis_desc_mode', storage: 'cookie', page: '/apis', description: 'APIリファレンスの説明表示モード' },
  { key: 'user_apis_nav_flash', storage: 'cookie', page: '/apis', description: 'APIリファレンスのナビゲーション点滅設定' },
  { key: 'user_apis_sidebar_accordion', storage: 'cookie', page: '/apis', description: 'APIリファレンスのサイドバーアコーディオン開閉状態' },
  { key: 'user_apis_sidebar_open', storage: 'cookie', page: '/apis', description: 'APIリファレンスのサイドバー開閉状態' },
  { key: 'apis_desc_panel_gi', storage: 'cookie', page: '/apis', description: 'APIリファレンスの説明パネル表示状態' },
  { key: 'user_status_chart_mode', storage: 'cookie', page: '/status', description: 'ステータスページのグラフ表示モード' },
  { key: 'user_status_chart_sort_order', storage: 'cookie', page: '/status', description: 'ステータスページのグラフ並び順' },
  { key: 'user_status_commit_cache_sort_mode', storage: 'cookie', page: '/status', description: 'ステータスページのコミットキャッシュ並び順' },
  { key: 'user_status_table_autodetect', storage: 'cookie', page: '/status', description: 'テーブル自動検出の有効/無効' },
  { key: 'user_status_show_autodetected_tables', storage: 'cookie', page: '/status', description: '自動検出テーブルの表示/非表示' },
  { key: 'user_status_ignore_unknown_unclassified_warning', storage: 'cookie', page: '/status', description: '未分類警告を無視する設定' },
  { key: 'er_tablelist_expand', storage: 'cookie', page: '/status', description: 'ER図テーブル一覧の開閉状態' },
  { key: 'er_header_tap_mode', storage: 'cookie', page: '/er-diagram', description: 'ER図ヘッダーのタップ動作モード' },
  { key: 'er_json_include_group', storage: 'cookie', page: '/er-diagram', description: 'ER図JSON出力にグループを含めるか' },
  { key: 'er_legend_visible', storage: 'cookie', page: '/er-diagram', description: 'ER図の凡例表示/非表示' },
  { key: 'er_tilt_enabled', storage: 'cookie', page: '/er-diagram', description: 'ER図の傾斜表示の有効/無効' },
  { key: 'aichat_history_preview_mode', storage: 'cookie', page: '/aichat', description: '履歴プレビューの表示モード(サイド/下部パネル)' },
  { key: 'aichat_show_lang_mode', storage: 'cookie', page: '/aichat', description: '言語表示モード' },
  { key: 'aichat_show_model_name', storage: 'cookie', page: '/aichat', description: 'モデル名表示の有効/無効' },
  { key: 'aichat_sidebar_tap_close', storage: 'cookie', page: '/aichat', description: 'サイドバーのタップ閉じ動作' },
  { key: 'aichat_zt_overview_chart_visible', storage: 'cookie', page: '/aichat', description: '概要グラフの表示/非表示' },
  { key: 'cg_group_off_clears_badges', storage: 'cookie', page: '/aichat', description: 'カテゴリグループOFF時にバッジをクリアする設定' },
  { key: 'commit_history_merge_filter', storage: 'cookie', page: '/settings', description: 'コミット履歴のマージフィルタ' },
  { key: 'history_incr_search', storage: 'cookie', page: '/settings', description: '履歴のインクリメンタルサーチ設定' },
  { key: 'keyword_badge_count', storage: 'cookie', page: '/settings', description: 'キーワードバッジの件数表示設定' },
  { key: 'keyword_classify_debug', storage: 'cookie', page: '/settings', description: 'キーワード分類のデバッグ表示' },
  { key: 'kp_hide_zero_hits', storage: 'cookie', page: '/settings', description: 'ヒット数0件のキーワードを隠す設定' },
  { key: 'kw_panel_no_all_focus', storage: 'cookie', page: '/settings', description: 'キーワードパネルの全選択フォーカス無効化' },
  { key: 'kw_panel_tap_close', storage: 'cookie', page: '/settings', description: 'キーワードパネルのタップ閉じ動作' },
  { key: 'kw_pal_', isPrefix: true, storage: 'cookie', page: '/answer-graph', description: 'キーワードごとのパレット選択(動的キー、末尾がキーワード)' },
  { key: 'airline_network_', isPrefix: true, storage: 'cookie', page: '/airline-network', description: '就航先・拠点空港・表示モード等の絞り込み設定(動的キー、airline_network_で始まるものは全て/airline-network由来)' },
  { key: 'airline_network_', isPrefix: true, storage: 'localStorage', page: '/airline-network', description: '拠点空港選択状態などの保存値(動的キー、airline_network_で始まるものは全て/airline-network由来)' },
  { key: 'heritage_journey_dest_country_filter', storage: 'cookie', page: '/heritage-journey', description: '到達国フィルタ' },
  { key: 'heritage_journey_start_city', storage: 'cookie', page: '/heritage-journey', description: '出発地の選択都市' },
  { key: 'heritage_journey_end_city', storage: 'cookie', page: '/heritage-journey', description: '到着地の選択都市' },
  { key: 'oauth_state', storage: 'cookie', page: 'GitHub OAuthログインフロー', description: 'OAuth CSRF対策state(短命、ログイン完了後は不要)' },
  { key: 'oauth_pkce', storage: 'cookie', page: 'GitHub OAuthログインフロー', description: 'OAuth PKCE verifier(短命、ログイン完了後は不要)' },
  { key: 'slack_oauth_state', storage: 'cookie', page: 'Slack連携フロー', description: 'Slack OAuth CSRF対策state(短命)' },
  { key: 'heritageAreaLayout', storage: 'localStorage', page: '/heritage-area', description: 'エリアマップのレイアウト設定' },
  { key: 'wfSidebarCollapsed', storage: 'localStorage', page: '/workflow', description: 'サイドバー折りたたみ状態' },
  { key: 'wfSidebarViewMode', storage: 'localStorage', page: '/workflow', description: 'サイドバー表示モード' },
  { key: 'wfbBadgebarCollapsed', storage: 'localStorage', page: '/wf-browser', description: 'バッジバー折りたたみ状態' },
];
