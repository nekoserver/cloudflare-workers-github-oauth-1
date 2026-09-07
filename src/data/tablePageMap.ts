/**
 * D1の各テーブルが、src/index.ts のどのルート(ページ/API/Webhook)から
 * 参照されているかを静的解析した結果(自動生成)。
 * scripts/generate-table-page-map.ts の実行結果を書き出したもの。
 *
 * 正規表現ベースの近似解析であり、コメント内の言及等を誤って拾う場合がある。
 * テーブル名がこのマップに存在しない場合は、src/index.ts 内のルートからは
 * 参照が見つからなかったことを意味する(他ファイルからのみ参照、またはロジック上
 * 未使用のテーブルである可能性がある)。
 *
 * 再生成: npx tsx scripts/generate-table-page-map.ts
 */
export type TablePageRef = { method: string; path: string };
export const TABLE_PAGE_MAP: Record<string, TablePageRef[]> = {
  "user_sessions": [
    {
      "method": "POST",
      "path": "/api/admin/revoke-session"
    },
    {
      "method": "POST",
      "path": "/api/aichat"
    },
    {
      "method": "GET",
      "path": "/api/debug/d1"
    },
    {
      "method": "POST",
      "path": "/api/settings/idle-timeout"
    },
    {
      "method": "GET",
      "path": "/auth/github/callback"
    },
    {
      "method": "GET",
      "path": "/status"
    },
    {
      "method": "POST",
      "path": "/webhook/cf-auth"
    },
    {
      "method": "GET",
      "path": "/welcome"
    }
  ],
  "installation_permissions": [
    {
      "method": "GET",
      "path": "/status"
    },
    {
      "method": "POST",
      "path": "/webhook/github"
    }
  ],
  "commit_calendar_cache": [
    {
      "method": "POST",
      "path": "/api/repo-colors/sync"
    },
    {
      "method": "GET",
      "path": "/api/repositories/:owner/:repo/commit-months"
    },
    {
      "method": "GET",
      "path": "/api/repositories/:owner/:repo/commit-stats"
    },
    {
      "method": "GET",
      "path": "/api/repositories/:owner/:repo/commits-by-month"
    },
    {
      "method": "GET",
      "path": "/api/repositories/:owner/:repo/commits-calendar"
    },
    {
      "method": "GET",
      "path": "/api/repositories/this-month-commits"
    },
    {
      "method": "GET",
      "path": "/status"
    }
  ],
  "teams": [
    {
      "method": "GET",
      "path": "/api/uuid/count"
    }
  ],
  "workspaces": [
    {
      "method": "GET",
      "path": "/api/workspaces"
    },
    {
      "method": "POST",
      "path": "/api/workspaces/switch"
    }
  ],
  "team_members": [
    {
      "method": "GET",
      "path": "/status"
    }
  ],
  "commit_list_cache": [
    {
      "method": "POST",
      "path": "/api/repo-colors/sync"
    },
    {
      "method": "GET",
      "path": "/api/repositories/:owner/:repo/commit-months"
    },
    {
      "method": "GET",
      "path": "/api/repositories/:owner/:repo/commits-by-date"
    },
    {
      "method": "GET",
      "path": "/api/repositories/:owner/:repo/commits-by-month"
    },
    {
      "method": "GET",
      "path": "/api/repositories/:owner/:repo/commits-calendar"
    },
    {
      "method": "GET",
      "path": "/api/repositories/search/commits"
    },
    {
      "method": "GET",
      "path": "/api/repositories/this-month-commits"
    },
    {
      "method": "GET",
      "path": "/status"
    }
  ],
  "cache_stats": [
    {
      "method": "GET",
      "path": "/api/repositories/:owner/:repo/commits-by-date"
    },
    {
      "method": "GET",
      "path": "/status"
    }
  ],
  "cloudflare_setup_pending": [
    {
      "method": "GET",
      "path": "/api/cloudflare-setup-pending"
    },
    {
      "method": "POST",
      "path": "/api/cloudflare-setup-pending/:id/dismiss"
    },
    {
      "method": "POST",
      "path": "/api/cloudflare-setup-pending/dismiss-all"
    },
    {
      "method": "POST",
      "path": "/api/repositories"
    },
    {
      "method": "GET",
      "path": "/repositories"
    },
    {
      "method": "POST",
      "path": "/webhook/github"
    }
  ],
  "commit_search_history": [
    {
      "method": "GET",
      "path": "/api/repositories/search/commits"
    },
    {
      "method": "GET",
      "path": "/api/repositories/search/history"
    },
    {
      "method": "GET",
      "path": "/api/repositories/search/history/:id"
    },
    {
      "method": "GET",
      "path": "/api/repositories/search/keyword-stats"
    },
    {
      "method": "GET",
      "path": "/api/repositories/search/repo-keywords"
    },
    {
      "method": "GET",
      "path": "/api/repositories/search/repo-list"
    }
  ],
  "commit_search_repo_stats": [
    {
      "method": "GET",
      "path": "/api/repositories/search/commits"
    },
    {
      "method": "GET",
      "path": "/api/repositories/search/history/:id"
    },
    {
      "method": "GET",
      "path": "/api/repositories/search/keyword-stats"
    },
    {
      "method": "GET",
      "path": "/api/repositories/search/repo-keywords"
    },
    {
      "method": "GET",
      "path": "/api/repositories/search/repo-list"
    }
  ],
  "commit_search_hit_details": [
    {
      "method": "GET",
      "path": "/api/repositories/search/commits"
    }
  ],
  "commit_search_keyword_labels": [
    {
      "method": "GET",
      "path": "/api/repositories/search/commits"
    },
    {
      "method": "GET",
      "path": "/api/repositories/search/history"
    },
    {
      "method": "GET",
      "path": "/api/repositories/search/keyword-classify-check"
    },
    {
      "method": "POST",
      "path": "/api/repositories/search/keyword-label"
    },
    {
      "method": "GET",
      "path": "/api/repositories/search/keyword-multi-labels"
    },
    {
      "method": "GET",
      "path": "/api/repositories/search/repo-keywords"
    }
  ],
  "ai_summary_log": [
    {
      "method": "GET",
      "path": "/ai-summary/:id"
    },
    {
      "method": "GET",
      "path": "/api/ai-summary/:id"
    },
    {
      "method": "POST",
      "path": "/api/ai-summary/:id/feedback"
    },
    {
      "method": "POST",
      "path": "/api/ai-summary/:id/resolve"
    },
    {
      "method": "POST",
      "path": "/slack/interactions"
    },
    {
      "method": "GET",
      "path": "/status"
    },
    {
      "method": "GET",
      "path": "/view"
    },
    {
      "method": "POST",
      "path": "/webhook/github"
    }
  ],
  "repo_color_settings": [
    {
      "method": "POST",
      "path": "/api/admin/revoke-session"
    },
    {
      "method": "GET",
      "path": "/api/repo-colors"
    },
    {
      "method": "PATCH",
      "path": "/api/repo-colors/:repoName{.+}"
    },
    {
      "method": "POST",
      "path": "/api/repo-colors/sync"
    },
    {
      "method": "GET",
      "path": "/status"
    }
  ],
  "repo_groups": [
    {
      "method": "GET",
      "path": "/api/repo-groups"
    },
    {
      "method": "POST",
      "path": "/api/repo-groups"
    },
    {
      "method": "PATCH",
      "path": "/api/repo-groups/:id"
    },
    {
      "method": "DELETE",
      "path": "/api/repo-groups/:id"
    },
    {
      "method": "GET",
      "path": "/api/repo-oauth-apps"
    },
    {
      "method": "GET",
      "path": "/status"
    }
  ],
  "repo_group_members": [
    {
      "method": "GET",
      "path": "/api/repo-groups"
    },
    {
      "method": "POST",
      "path": "/api/repo-groups"
    },
    {
      "method": "PATCH",
      "path": "/api/repo-groups/:id"
    },
    {
      "method": "DELETE",
      "path": "/api/repo-groups/:id"
    },
    {
      "method": "GET",
      "path": "/api/repo-oauth-apps"
    },
    {
      "method": "GET",
      "path": "/status"
    }
  ],
  "ai_summary_reviews": [
    {
      "method": "GET",
      "path": "/ai-summary/:id"
    },
    {
      "method": "GET",
      "path": "/api/ai-summary/:id"
    },
    {
      "method": "POST",
      "path": "/api/ai-summary/:id/feedback"
    },
    {
      "method": "GET",
      "path": "/view"
    },
    {
      "method": "POST",
      "path": "/webhook/github"
    }
  ],
  "resend_webhook_sources": [
    {
      "method": "POST",
      "path": "/webhook/cf-wh1"
    },
    {
      "method": "POST",
      "path": "/webhook/resend/:sourceId"
    }
  ],
  "resend_webhook_log": [
    {
      "method": "POST",
      "path": "/webhook/cf-wh1"
    },
    {
      "method": "POST",
      "path": "/webhook/resend/:sourceId"
    }
  ],
  "slack_interaction_log": [
    {
      "method": "POST",
      "path": "/slack/interactions"
    }
  ],
  "commit_agent_log": [
    {
      "method": "POST",
      "path": "/api/aichat"
    },
    {
      "method": "GET",
      "path": "/api/status/tables/:table/group-er"
    },
    {
      "method": "GET",
      "path": "/status"
    },
    {
      "method": "POST",
      "path": "/webhook/github"
    }
  ],
  "table_catalog": [
    {
      "method": "GET",
      "path": "/api/status/tables/:table/group-er"
    },
    {
      "method": "GET",
      "path": "/api/status/tables/:table/rows"
    },
    {
      "method": "GET",
      "path": "/status"
    }
  ],
  "table_column_keys": [
    {
      "method": "GET",
      "path": "/api/status/tables/:table/group-er"
    }
  ],
  "group_oauth_apps": [
    {
      "method": "GET",
      "path": "/api/repo-groups/:id/oauth-apps"
    },
    {
      "method": "POST",
      "path": "/api/repo-groups/:id/oauth-apps"
    },
    {
      "method": "DELETE",
      "path": "/api/repo-groups/:id/oauth-apps/:appName"
    },
    {
      "method": "GET",
      "path": "/api/repo-oauth-apps"
    }
  ],
  "commit_stats_cache": [
    {
      "method": "GET",
      "path": "/api/repositories/:owner/:repo/commit-months"
    },
    {
      "method": "GET",
      "path": "/api/repositories/:owner/:repo/commit-stats"
    },
    {
      "method": "GET",
      "path": "/api/repositories/:owner/:repo/commits-by-month"
    }
  ],
  "ai_chat_shares": [
    {
      "method": "POST",
      "path": "/api/aichat"
    },
    {
      "method": "GET",
      "path": "/api/aichat/check-heritage-questions"
    },
    {
      "method": "GET",
      "path": "/api/aichat/daily-stats"
    },
    {
      "method": "GET",
      "path": "/api/aichat/image-branches"
    },
    {
      "method": "GET",
      "path": "/api/aichat/image-gallery-search"
    },
    {
      "method": "GET",
      "path": "/api/aichat/keyword-categories"
    },
    {
      "method": "PATCH",
      "path": "/api/aichat/keyword-categories/:id"
    },
    {
      "method": "POST",
      "path": "/api/aichat/keyword-category-map"
    },
    {
      "method": "GET",
      "path": "/api/aichat/keywords/monthly"
    },
    {
      "method": "POST",
      "path": "/api/aichat/moondream-analysis"
    },
    {
      "method": "GET",
      "path": "/api/aichat/search-history"
    },
    {
      "method": "GET",
      "path": "/api/aichat/search-impressions"
    },
    {
      "method": "GET",
      "path": "/api/aichat/search-keyword-analysis"
    },
    {
      "method": "GET",
      "path": "/api/aichat/search-log"
    },
    {
      "method": "POST",
      "path": "/api/aichat/search-log/open-modal"
    },
    {
      "method": "POST",
      "path": "/api/aichat/share"
    },
    {
      "method": "GET",
      "path": "/api/aichat/share-keywords"
    },
    {
      "method": "GET",
      "path": "/api/aichat/share-subquery-links"
    },
    {
      "method": "GET",
      "path": "/api/aichat/share-subquery-links/all"
    },
    {
      "method": "GET",
      "path": "/api/aichat/shares-by-question"
    },
    {
      "method": "GET",
      "path": "/api/aichat/shares-by-question-hash"
    },
    {
      "method": "GET",
      "path": "/api/aichat/shares/:id"
    },
    {
      "method": "DELETE",
      "path": "/api/aichat/shares/:id"
    },
    {
      "method": "GET",
      "path": "/api/aichat/shares/by-date"
    },
    {
      "method": "GET",
      "path": "/api/aichat/shares/by-keyword"
    },
    {
      "method": "GET",
      "path": "/api/aichat/shares/calendar"
    },
    {
      "method": "GET",
      "path": "/api/aichat/subqueries"
    },
    {
      "method": "GET",
      "path": "/api/aichat/subquery-keyword-questions"
    },
    {
      "method": "GET",
      "path": "/api/aichat/token-usage"
    },
    {
      "method": "POST",
      "path": "/api/aichat/vectorize-answer"
    },
    {
      "method": "GET",
      "path": "/api/heritage-area/travel-categories/:id/keywords"
    },
    {
      "method": "DELETE",
      "path": "/api/moondream-analyze-log/:id"
    },
    {
      "method": "GET",
      "path": "/api/repositories/search/keyword-multi-labels-all"
    },
    {
      "method": "GET",
      "path": "/moondream-analyze-log"
    },
    {
      "method": "GET",
      "path": "/s/:userHash/:shareToken"
    }
  ],
  "keyword_category_groups": [
    {
      "method": "GET",
      "path": "/api/repositories/search/category-group"
    },
    {
      "method": "POST",
      "path": "/api/repositories/search/category-group"
    },
    {
      "method": "PUT",
      "path": "/api/repositories/search/category-group/:id"
    },
    {
      "method": "DELETE",
      "path": "/api/repositories/search/category-group/:id"
    },
    {
      "method": "GET",
      "path": "/api/repositories/search/category-group/check-name"
    },
    {
      "method": "GET",
      "path": "/api/repositories/search/category-groups"
    }
  ],
  "keyword_multi_labels": [
    {
      "method": "GET",
      "path": "/api/repositories/search/keyword-multi-labels"
    },
    {
      "method": "POST",
      "path": "/api/repositories/search/keyword-multi-labels"
    },
    {
      "method": "GET",
      "path": "/api/repositories/search/keyword-multi-labels-all"
    }
  ],
  "aichat_search_log": [
    {
      "method": "GET",
      "path": "/aichat"
    },
    {
      "method": "GET",
      "path": "/api/aichat/all-keywords"
    },
    {
      "method": "PATCH",
      "path": "/api/aichat/keyword-categories/:id"
    },
    {
      "method": "POST",
      "path": "/api/aichat/keyword-category-map"
    },
    {
      "method": "GET",
      "path": "/api/aichat/keywords/monthly"
    },
    {
      "method": "POST",
      "path": "/api/aichat/moondream-analysis"
    },
    {
      "method": "GET",
      "path": "/api/aichat/search-impressions"
    },
    {
      "method": "GET",
      "path": "/api/aichat/search-log"
    },
    {
      "method": "POST",
      "path": "/api/aichat/search-log"
    },
    {
      "method": "POST",
      "path": "/api/aichat/search-log/approve"
    },
    {
      "method": "POST",
      "path": "/api/aichat/search-log/open-modal"
    },
    {
      "method": "GET",
      "path": "/api/aichat/share-keywords"
    },
    {
      "method": "GET",
      "path": "/api/aichat/share-subquery-links/all"
    },
    {
      "method": "GET",
      "path": "/api/aichat/shares/by-keyword"
    },
    {
      "method": "GET",
      "path": "/api/heritage-area/travel-categories/:id/keywords"
    }
  ],
  "aichat_search_history": [
    {
      "method": "GET",
      "path": "/api/aichat/check-heritage-questions"
    },
    {
      "method": "GET",
      "path": "/api/aichat/daily-stats"
    },
    {
      "method": "GET",
      "path": "/api/aichat/search-history"
    },
    {
      "method": "GET",
      "path": "/api/aichat/search-keyword-analysis"
    },
    {
      "method": "POST",
      "path": "/api/aichat/search-log"
    },
    {
      "method": "GET",
      "path": "/api/aichat/subqueries"
    },
    {
      "method": "GET",
      "path": "/api/aichat/subquery-keyword-questions"
    }
  ],
  "aichat_search_impressions": [
    {
      "method": "GET",
      "path": "/api/aichat/search-impressions"
    },
    {
      "method": "POST",
      "path": "/api/aichat/search-impressions"
    },
    {
      "method": "GET",
      "path": "/api/heritage-area/travel-categories/:id/keywords"
    }
  ],
  "aichat_subqueries": [
    {
      "method": "GET",
      "path": "/api/aichat/share-subquery-links"
    },
    {
      "method": "GET",
      "path": "/api/aichat/share-subquery-links/all"
    },
    {
      "method": "GET",
      "path": "/api/aichat/subqueries"
    },
    {
      "method": "POST",
      "path": "/api/aichat/subqueries"
    }
  ],
  "aichat_share_subquery_links": [
    {
      "method": "GET",
      "path": "/api/aichat/share-subquery-links"
    },
    {
      "method": "POST",
      "path": "/api/aichat/share-subquery-links"
    },
    {
      "method": "GET",
      "path": "/api/aichat/share-subquery-links/all"
    },
    {
      "method": "GET",
      "path": "/api/aichat/subqueries"
    },
    {
      "method": "GET",
      "path": "/api/aichat/subquery-keyword-questions"
    }
  ],
  "aichat_model_colors": [
    {
      "method": "GET",
      "path": "/aichat"
    },
    {
      "method": "GET",
      "path": "/aichat-image-gallery"
    },
    {
      "method": "GET",
      "path": "/answer-graph"
    }
  ],
  "d1_query_catalog": [
    {
      "method": "GET",
      "path": "/d1-query-catalog"
    }
  ],
  "user_preferences": [
    {
      "method": "POST",
      "path": "/api/preferences/:key"
    },
    {
      "method": "GET",
      "path": "/api/preferences/:key"
    },
    {
      "method": "POST",
      "path": "/api/settings/theme"
    },
    {
      "method": "GET",
      "path": "/d1-query-catalog"
    }
  ],
  "ts_repository": [
    {
      "method": "GET",
      "path": "/api/function-source"
    },
    {
      "method": "GET",
      "path": "/call-graph"
    },
    {
      "method": "GET",
      "path": "/function-changelog"
    }
  ],
  "ts_function_catalog": [
    {
      "method": "GET",
      "path": "/api/function-file-history"
    },
    {
      "method": "GET",
      "path": "/api/function-source"
    },
    {
      "method": "GET",
      "path": "/call-graph"
    },
    {
      "method": "GET",
      "path": "/function-changelog"
    }
  ],
  "ts_commit_log": [
    {
      "method": "GET",
      "path": "/api/file-deps"
    },
    {
      "method": "GET",
      "path": "/api/file-history"
    },
    {
      "method": "GET",
      "path": "/api/function-file-history"
    },
    {
      "method": "GET",
      "path": "/call-graph"
    }
  ],
  "ts_commit_function_map": [
    {
      "method": "GET",
      "path": "/api/file-deps"
    },
    {
      "method": "GET",
      "path": "/api/file-history"
    },
    {
      "method": "GET",
      "path": "/api/function-file-history"
    },
    {
      "method": "GET",
      "path": "/call-graph"
    }
  ],
  "ts_function_impact": [
    {
      "method": "GET",
      "path": "/function-changelog"
    }
  ],
  "ts_function_callers": [
    {
      "method": "GET",
      "path": "/call-graph"
    },
    {
      "method": "GET",
      "path": "/function-changelog"
    }
  ],
  "api_search_keywords": [
    {
      "method": "GET",
      "path": "/api/search-keywords"
    },
    {
      "method": "POST",
      "path": "/api/search-keywords"
    },
    {
      "method": "DELETE",
      "path": "/api/search-keywords/:id"
    }
  ],
  "api_search_keyword_sections": [
    {
      "method": "POST",
      "path": "/api/search-keywords"
    },
    {
      "method": "DELETE",
      "path": "/api/search-keywords/:id"
    }
  ],
  "webhook_log": [
    {
      "method": "POST",
      "path": "/webhook/cf-auth"
    }
  ],
  "uuid_history": [
    {
      "method": "GET",
      "path": "/api/uuid/count"
    },
    {
      "method": "DELETE",
      "path": "/api/uuid/history"
    },
    {
      "method": "POST",
      "path": "/api/uuid/save"
    },
    {
      "method": "GET",
      "path": "/api/uuid/search"
    }
  ],
  "heritage_cities": [
    {
      "method": "POST",
      "path": "/api/city-all-heritages"
    },
    {
      "method": "GET",
      "path": "/api/heritage-access-ranking"
    },
    {
      "method": "GET",
      "path": "/api/heritage-access/nearby-cities"
    },
    {
      "method": "GET",
      "path": "/api/heritage-cities"
    },
    {
      "method": "POST",
      "path": "/api/heritage-cities"
    },
    {
      "method": "POST",
      "path": "/api/heritage-city-heritages"
    },
    {
      "method": "POST",
      "path": "/api/heritage-country-city-stats"
    },
    {
      "method": "GET",
      "path": "/api/heritage-country-stats"
    },
    {
      "method": "POST",
      "path": "/api/heritage-country-unique-cities"
    }
  ],
  "heritage_city_fetched": [
    {
      "method": "GET",
      "path": "/api/heritage-cities"
    },
    {
      "method": "POST",
      "path": "/api/heritage-cities"
    },
    {
      "method": "GET",
      "path": "/api/heritage-city-fetched-list"
    },
    {
      "method": "POST",
      "path": "/api/heritage-country-city-stats"
    }
  ],
  "rail_station_cities": [
    {
      "method": "GET",
      "path": "/api/rail-station-cities"
    },
    {
      "method": "POST",
      "path": "/api/rail-station-cities"
    }
  ],
  "rail_station_fetched": [
    {
      "method": "GET",
      "path": "/api/rail-station-cities"
    },
    {
      "method": "POST",
      "path": "/api/rail-station-cities"
    },
    {
      "method": "GET",
      "path": "/api/rail-station-fetched-list"
    }
  ],
  "rail_station_nearby_points": [
    {
      "method": "GET",
      "path": "/api/rail-station-nearby"
    },
    {
      "method": "POST",
      "path": "/api/rail-station-nearby"
    }
  ],
  "rail_station_nearby_fetched": [
    {
      "method": "GET",
      "path": "/api/rail-station-nearby"
    },
    {
      "method": "POST",
      "path": "/api/rail-station-nearby"
    }
  ],
  "heritage_ai_question_masters": [
    {
      "method": "GET",
      "path": "/api/aichat/check-heritage-questions"
    }
  ],
  "heritage_question_view_log": [
    {
      "method": "GET",
      "path": "/api/aichat/check-heritage-questions"
    }
  ],
  "heritage_area_boxes": [
    {
      "method": "POST",
      "path": "/api/heritage-area-boxes"
    },
    {
      "method": "GET",
      "path": "/api/heritage-area-boxes"
    },
    {
      "method": "DELETE",
      "path": "/api/heritage-area-boxes/:areaSeq"
    },
    {
      "method": "GET",
      "path": "/api/heritage-area/areas/:areaSeq/items"
    },
    {
      "method": "GET",
      "path": "/api/heritage-area/max-area-seq"
    },
    {
      "method": "GET",
      "path": "/api/heritage-area/travel-categories/:id/keywords"
    }
  ],
  "heritage_area_items": [
    {
      "method": "POST",
      "path": "/api/heritage-area-boxes"
    },
    {
      "method": "GET",
      "path": "/api/heritage-area-boxes"
    },
    {
      "method": "DELETE",
      "path": "/api/heritage-area-boxes/:areaSeq"
    },
    {
      "method": "GET",
      "path": "/api/heritage-area/areas/:areaSeq/items"
    },
    {
      "method": "GET",
      "path": "/api/heritage-area/travel-categories/:id/keywords"
    }
  ],
  "slack_installations": [
    {
      "method": "GET",
      "path": "/api/repositories/search/keyword-multi-labels-all"
    },
    {
      "method": "GET",
      "path": "/auth/slack/install"
    },
    {
      "method": "GET",
      "path": "/auth/v1/callback"
    }
  ],
  "notification_settings": [
    {
      "method": "POST",
      "path": "/api/settings/email-confirm-login"
    },
    {
      "method": "POST",
      "path": "/api/settings/slack-notify"
    }
  ],
  "airport_nearby_heritage": [
    {
      "method": "POST",
      "path": "/api/airport-nearby-heritage"
    },
    {
      "method": "GET",
      "path": "/api/airport-nearby-heritage-airports"
    },
    {
      "method": "GET",
      "path": "/api/airport-nearby-heritage-ranking"
    }
  ],
  "airport_nearby_airport": [
    {
      "method": "POST",
      "path": "/api/airport-nearby-airports"
    }
  ],
  "unresolved_airport_keywords": [
    {
      "method": "DELETE",
      "path": "/api/heritage-area-boxes/:areaSeq"
    }
  ],
  "unresolved_castle_keywords": [
    {
      "method": "DELETE",
      "path": "/api/heritage-area-boxes/:areaSeq"
    }
  ],
  "unresolved_station_keywords": [
    {
      "method": "DELETE",
      "path": "/api/heritage-area-boxes/:areaSeq"
    }
  ],
  "harness_hook_log": [
    {
      "method": "GET",
      "path": "/galaxy"
    },
    {
      "method": "GET",
      "path": "/harness-log"
    },
    {
      "method": "POST",
      "path": "/internal/harness-hook-log"
    }
  ],
  "aichat_keyword_categories": [
    {
      "method": "GET",
      "path": "/api/aichat/all-keywords"
    },
    {
      "method": "GET",
      "path": "/api/aichat/keyword-categories"
    },
    {
      "method": "POST",
      "path": "/api/aichat/keyword-categories"
    },
    {
      "method": "GET",
      "path": "/api/aichat/keyword-categories-summary"
    },
    {
      "method": "PATCH",
      "path": "/api/aichat/keyword-categories/:id"
    },
    {
      "method": "POST",
      "path": "/api/aichat/keyword-category-map"
    },
    {
      "method": "POST",
      "path": "/api/aichat/keyword-category-suggest"
    },
    {
      "method": "GET",
      "path": "/api/heritage-area/travel-categories"
    }
  ],
  "aichat_keyword_category_map": [
    {
      "method": "GET",
      "path": "/api/aichat/all-keywords"
    },
    {
      "method": "GET",
      "path": "/api/aichat/category-groups"
    },
    {
      "method": "GET",
      "path": "/api/aichat/keyword-categories"
    },
    {
      "method": "GET",
      "path": "/api/aichat/keyword-categories-summary"
    },
    {
      "method": "PATCH",
      "path": "/api/aichat/keyword-categories/:id"
    },
    {
      "method": "POST",
      "path": "/api/aichat/keyword-category-map"
    },
    {
      "method": "POST",
      "path": "/api/aichat/keyword-category-suggest"
    },
    {
      "method": "GET",
      "path": "/api/aichat/share-keywords"
    },
    {
      "method": "GET",
      "path": "/api/aichat/shares-by-question-hash"
    },
    {
      "method": "GET",
      "path": "/api/heritage-area/travel-categories"
    },
    {
      "method": "GET",
      "path": "/api/heritage-area/travel-categories/:id/keywords"
    }
  ],
  "aichat_keyword_embeddings": [
    {
      "method": "PATCH",
      "path": "/api/aichat/keyword-categories/:id"
    },
    {
      "method": "POST",
      "path": "/api/aichat/keyword-category-map"
    },
    {
      "method": "POST",
      "path": "/api/aichat/keyword-category-suggest"
    },
    {
      "method": "POST",
      "path": "/api/aichat/keyword-embeddings/register"
    },
    {
      "method": "GET",
      "path": "/cheese-search"
    }
  ],
  "aichat_keyword_category_suggestions": [
    {
      "method": "POST",
      "path": "/api/aichat/keyword-category-map"
    },
    {
      "method": "POST",
      "path": "/api/aichat/keyword-category-suggest"
    }
  ],
  "aichat_answer_category_scores": [
    {
      "method": "PATCH",
      "path": "/api/aichat/keyword-categories/:id"
    }
  ],
  "aichat_answer_vectors": [
    {
      "method": "POST",
      "path": "/api/aichat"
    },
    {
      "method": "POST",
      "path": "/api/aichat/keyword-category-map"
    },
    {
      "method": "POST",
      "path": "/api/aichat/moondream-analysis"
    },
    {
      "method": "DELETE",
      "path": "/api/aichat/shares/:id"
    }
  ],
  "aichat_answer_keyword_vectors": [
    {
      "method": "POST",
      "path": "/api/aichat/keyword-category-map"
    }
  ],
  "moondream_analyze_log": [
    {
      "method": "DELETE",
      "path": "/api/moondream-analyze-log/:id"
    },
    {
      "method": "GET",
      "path": "/moondream-analyze-log"
    }
  ],
  "aichat_images": [
    {
      "method": "POST",
      "path": "/api/aichat/moondream-analysis"
    },
    {
      "method": "GET",
      "path": "/api/aichat/shares/by-date"
    },
    {
      "method": "GET",
      "path": "/api/aichat/shares/by-keyword"
    }
  ],
  "aichat_moondream_analyses": [
    {
      "method": "GET",
      "path": "/api/aichat/image-branches"
    },
    {
      "method": "GET",
      "path": "/api/aichat/image-gallery-search"
    },
    {
      "method": "POST",
      "path": "/api/aichat/moondream-analysis"
    },
    {
      "method": "GET",
      "path": "/api/aichat/shares/search"
    }
  ],
  "api_keys": [
    {
      "method": "GET",
      "path": "/api/api-keys"
    },
    {
      "method": "POST",
      "path": "/api/api-keys"
    },
    {
      "method": "POST",
      "path": "/api/api-keys/:id/revoke"
    }
  ],
  "wasm_module_startup_config": [
    {
      "method": "POST",
      "path": "/api/aichat"
    },
    {
      "method": "GET",
      "path": "/api/gh/pr-list"
    },
    {
      "method": "GET",
      "path": "/api/wasm-modules"
    },
    {
      "method": "POST",
      "path": "/api/wasm-modules"
    }
  ],
  "ts_file_dependencies": [
    {
      "method": "GET",
      "path": "/api/file-deps"
    }
  ],
  "cheese_fr": [
    {
      "method": "GET",
      "path": "/api/cheese-fr"
    },
    {
      "method": "GET",
      "path": "/api/file-history"
    }
  ],
  "workflow_registry": [
    {
      "method": "POST",
      "path": "/api/wine/bulk-register"
    },
    {
      "method": "GET",
      "path": "/api/workflow/:no"
    }
  ],
  "workflow_steps": [
    {
      "method": "POST",
      "path": "/api/wine/bulk-register"
    },
    {
      "method": "GET",
      "path": "/api/workflow/:no"
    }
  ],
  "workflow_hierarchy": [
    {
      "method": "POST",
      "path": "/api/wine/bulk-register"
    }
  ],
  "heritage_journey_registered_routes": [
    {
      "method": "POST",
      "path": "/api/heritage-journey/register-route"
    },
    {
      "method": "GET",
      "path": "/api/heritage-journey/registered-routes"
    },
    {
      "method": "GET",
      "path": "/api/heritage-journey/registered-starts-for-destination"
    },
    {
      "method": "GET",
      "path": "/api/heritage-journey/route-exists"
    }
  ],
  "heritage_journey_waypoint_sets": [
    {
      "method": "GET",
      "path": "/api/heritage-journey/latest-waypoint-set"
    },
    {
      "method": "GET",
      "path": "/api/heritage-journey/registered-routes"
    },
    {
      "method": "POST",
      "path": "/api/heritage-journey/save-waypoint-set"
    },
    {
      "method": "GET",
      "path": "/api/heritage-journey/waypoint-set-exists"
    }
  ],
  "countdown_events": [
    {
      "method": "POST",
      "path": "/api/aichat"
    },
    {
      "method": "GET",
      "path": "/api/countdown"
    },
    {
      "method": "POST",
      "path": "/api/countdown"
    },
    {
      "method": "DELETE",
      "path": "/api/countdown/:id"
    },
    {
      "method": "GET",
      "path": "/api/countdown/next"
    }
  ],
  "kimi_gemma_reviews": [
    {
      "method": "POST",
      "path": "/api/aichat/moondream-analysis"
    },
    {
      "method": "POST",
      "path": "/api/kimi-code/gemma-review"
    },
    {
      "method": "POST",
      "path": "/api/kimi-code/generate"
    }
  ],
  "kimi_code_generate_log": [
    {
      "method": "POST",
      "path": "/api/aichat/moondream-analysis"
    },
    {
      "method": "POST",
      "path": "/api/kimi-code/generate"
    }
  ],
  "user_public_keys": [
    {
      "method": "GET",
      "path": "/api/public-keys"
    },
    {
      "method": "POST",
      "path": "/api/public-keys"
    },
    {
      "method": "POST",
      "path": "/api/public-keys/:id/revoke"
    },
    {
      "method": "POST",
      "path": "/api/public-keys/challenge"
    },
    {
      "method": "POST",
      "path": "/api/public-keys/verify"
    },
    {
      "method": "POST",
      "path": "/auth/public-key/challenge"
    },
    {
      "method": "POST",
      "path": "/auth/public-key/verify"
    }
  ],
  "public_key_challenges": [
    {
      "method": "POST",
      "path": "/api/public-keys/challenge"
    },
    {
      "method": "POST",
      "path": "/api/public-keys/verify"
    },
    {
      "method": "POST",
      "path": "/auth/public-key/challenge"
    },
    {
      "method": "POST",
      "path": "/auth/public-key/verify"
    }
  ],
  "wine_embeddings": [
    {
      "method": "GET",
      "path": "/api/wine/:id"
    },
    {
      "method": "POST",
      "path": "/api/wine/search"
    },
    {
      "method": "GET",
      "path": "/cheese-search"
    }
  ],
  "wine_details": [
    {
      "method": "POST",
      "path": "/api/wine/search"
    },
    {
      "method": "GET",
      "path": "/cheese-search"
    }
  ],
  "wine_metadata": [
    {
      "method": "GET",
      "path": "/api/wine/:id"
    },
    {
      "method": "POST",
      "path": "/api/wine/search"
    },
    {
      "method": "GET",
      "path": "/cheese-search"
    }
  ]
};
