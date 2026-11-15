/**
 * /cf-containers のApacheモジュール一覧で開くヘルプ(静的アセット)の版と置き場所。
 * public/apache-manual/<版>/ は scripts/extract-apache-manual.py がApacheのソースアーカイブから作る。
 * 版はコンテナのApache(containers/demo/Dockerfile の ARG APACHE_VERSION)と揃える
 * (src/apache-manual-assets.test.ts が検査する)。ユーザー指定(2026-11-15)。
 */
export const APACHE_MANUAL_VERSION = '2.4.71';
export const APACHE_MANUAL_BASE = `/apache-manual/${APACHE_MANUAL_VERSION}`;
