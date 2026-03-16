# Zanzibar 形式による権限モデル定義

**対象**: `cloudflare-workers-github-oauth-1` の GitHub App インストール権限を
Google Zanzibar のリレーションタプル形式で表現したもの。
D1 `installation_permissions` テーブルに保存されているデータを元にしている。

---

## 1. オブジェクトタイプと関係の定義

### スキーマ定義（Zanzibar DSL 擬似記法）

```
definition user {}

definition github_app {
  relation installation: installation
}

definition installation {
  relation admin: user
  relation target_repository: repository
  relation repository_selection_all: installation  // 自己参照: "all repos" フラグ
}

definition repository {
  relation installed_app: installation

  // GitHub App パーミッション（access level ごとに関係を分離）
  relation contents_read: installation
  relation contents_write: installation
  relation issues_read: installation
  relation issues_write: installation
  relation metadata_read: installation
  relation pull_requests_read: installation
  relation pull_requests_write: installation
  relation actions_read: installation
  relation actions_write: installation
  relation workflows_write: installation
  relation administration_read: installation
  relation administration_write: installation
  relation checks_read: installation
  relation checks_write: installation
  relation deployments_read: installation
  relation deployments_write: installation
  relation pages_read: installation
  relation pages_write: installation
  relation statuses_read: installation
  relation statuses_write: installation
  relation vulnerability_alerts_read: installation

  // 導出パーミッション
  permission can_read_contents = contents_read + contents_write
  permission can_write_contents = contents_write
  permission can_read_issues = issues_read + issues_write
  permission can_write_issues = issues_write
  permission can_read_pull_requests = pull_requests_read + pull_requests_write
  permission can_write_pull_requests = pull_requests_write
}
```

### 設計方針

| 方針 | 説明 |
|---|---|
| パーミッションの分解 | GitHub の `{ "contents": "read" }` を `contents_read` 関係に展開する |
| `write` は `read` を包含 | `contents_write` を持つ installation は `can_read_contents` も満たす |
| `repository_selection: all` | 個別リポジトリへの関係ではなく `repository_selection_all` 自己参照で表現する |
| `repository_selection: selected` | 対象リポジトリごとに個別のタプルを生成する |

---

## 2. タプル変換ルール

D1 の `installation_permissions` テーブルから Zanzibar タプルへの変換ルール:

### 2.1 基本タプル（常に生成）

```
github_app:cloudflare-workers-github-oauth-1#installation@installation:{installation_id}
```

### 2.2 `repository_selection = "all"` の場合

```
# "全リポジトリ" フラグ
installation:{installation_id}#repository_selection_all@installation:{installation_id}

# パーミッションは全リポジトリに適用される
# → 実際のリポジトリ列挙は GitHub API 側に委譲
# → チェック時は repository_selection_all の有無で判定
```

### 2.3 `repository_selection = "selected"` の場合

```
# リポジトリとインストールの関係
repository:{repo_name}#installed_app@installation:{installation_id}

# 各パーミッションを展開
# permissions JSON: { "contents": "read", "issues": "write", "metadata": "read" }
# ↓
repository:{repo_name}#contents_read@installation:{installation_id}
repository:{repo_name}#issues_write@installation:{installation_id}
repository:{repo_name}#metadata_read@installation:{installation_id}
```

---

## 3. サンプルタプル

以下は `installation_id = 12345`、`sender = nekoserver` のインストールを想定した具体例。

### 3.1 ケース A: 選択リポジトリ（`repository_selection = "selected"`）

対象リポジトリ: `my-api`, `my-frontend`
パーミッション: `{ "contents": "read", "issues": "write", "metadata": "read" }`

```
# App ↔ Installation
github_app:cloudflare-workers-github-oauth-1#installation@installation:12345

# 管理者
installation:12345#admin@user:nekoserver

# リポジトリ ↔ Installation
repository:my-api#installed_app@installation:12345
repository:my-frontend#installed_app@installation:12345

# パーミッション展開 — my-api
repository:my-api#contents_read@installation:12345
repository:my-api#issues_write@installation:12345
repository:my-api#metadata_read@installation:12345

# パーミッション展開 — my-frontend
repository:my-frontend#contents_read@installation:12345
repository:my-frontend#issues_write@installation:12345
repository:my-frontend#metadata_read@installation:12345
```

### 3.2 ケース B: 全リポジトリ（`repository_selection = "all"`）

パーミッション: `{ "contents": "write", "metadata": "read", "pull_requests": "write" }`

```
# App ↔ Installation
github_app:cloudflare-workers-github-oauth-1#installation@installation:12345

# 管理者
installation:12345#admin@user:nekoserver

# "全リポジトリ" フラグ
installation:12345#repository_selection_all@installation:12345

# パーミッション（全リポジトリに適用）
# → 個別リポジトリ名がないため、チェック時に repository_selection_all と組み合わせて判定
# → 具体的なリポジトリ列挙が必要な場合は GitHub API で取得後に展開する
```

### 3.3 ケース C: アンインストール（`action = "deleted"`）

```
# 以下のタプルをすべて削除
github_app:cloudflare-workers-github-oauth-1#installation@installation:12345
installation:12345#admin@user:nekoserver
installation:12345#repository_selection_all@installation:12345
repository:*#*@installation:12345   # 該当 installation の全タプル
```

---

## 4. チェック（認可判定）の例

Zanzibar の `Check` API に対応する問い合わせ例:

```
# 「installation:12345 は repository:my-api の contents を読めるか？」
Check(repository:my-api#can_read_contents@installation:12345)
→ true（contents_read タプルが存在するため）

# 「installation:12345 は repository:my-api の contents を書けるか？」
Check(repository:my-api#can_write_contents@installation:12345)
→ false（contents_read のみで contents_write タプルがないため）

# 「installation:12345 は全リポジトリ対象か？」
Check(installation:12345#repository_selection_all@installation:12345)
→ ケース A: false / ケース B: true
```

---

## 5. D1 テーブルとの対応

| D1 カラム | Zanzibar 要素 | 変換 |
|---|---|---|
| `installation_id` | `installation:{id}` | オブジェクト ID |
| `repo_name` (NOT NULL) | `repository:{repo_name}` | オブジェクト ID |
| `repo_name` (NULL) | `installation:{id}#repository_selection_all` | "all repos" フラグ |
| `repository_selection` | タプル生成パターンの分岐条件 | `all` / `selected` |
| `permissions` JSON のキー | 関係名のプレフィックス (`contents_`, `issues_` 等) | `{key}_{value}` に展開 |
| `permissions` JSON の値 | 関係名のサフィックス (`read`, `write`) | `{key}_{value}` に展開 |

---

## 6. 制約と注意事項

1. **`admin` 関係の元データ不在** — D1 `installation_permissions` テーブルには `sender`（操作者）が保存されていない。Webhook ペイロードの `sender.login` は通知時に使用されるのみで永続化されていないため、`admin` タプルの生成には Webhook 受信時に sender を保存するか、GitHub API から取得する必要がある
2. **`all` 選択時のリポジトリ展開** — `repository_selection = "all"` の場合、個別リポジトリへのタプルは生成しない設計としている。実際のリポジトリ列挙が必要な場合は GitHub API (`GET /installation/repositories`) で動的に展開する
3. **パーミッション名のマッピング** — GitHub API のパーミッション名にはハイフンを含むもの（`vulnerability-alerts`）がある。Zanzibar 関係名ではアンダースコアに変換する（`vulnerability_alerts_read`）
