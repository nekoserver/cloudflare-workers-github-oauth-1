export type F1Circuit = {
  gp: string;
  circuit: string;
  flag: string;
  country: string;
  date: string;
  lat: number;
  lon: number;
};

export const F1_CIRCUITS: F1Circuit[] = [
  { gp: 'オーストラリアGP', circuit: 'アルバートパーク・サーキット', flag: '🇦🇺', country: 'オーストラリア', date: '2026-03-08', lat: -37.8497, lon: 144.9680 },
  { gp: '中国GP', circuit: '上海国際サーキット', flag: '🇨🇳', country: '中国', date: '2026-03-15', lat: 31.3389, lon: 121.2200 },
  { gp: '日本GP', circuit: '鈴鹿サーキット', flag: '🇯🇵', country: '日本', date: '2026-03-29', lat: 34.8431, lon: 136.5410 },
  { gp: 'マイアミGP', circuit: 'マイアミ・インターナショナル・オートドローム', flag: '🇺🇸', country: 'アメリカ', date: '2026-05-03', lat: 25.9581, lon: -80.2389 },
  { gp: 'カナダGP', circuit: 'ジル・ヴィルヌーヴ・サーキット', flag: '🇨🇦', country: 'カナダ', date: '2026-05-24', lat: 45.5000, lon: -73.5228 },
  { gp: 'モナコGP', circuit: 'モンテカルロ市街地サーキット', flag: '🇲🇨', country: 'モナコ', date: '2026-06-07', lat: 43.7347, lon: 7.4206 },
  { gp: 'バルセロナ・カタルーニャGP', circuit: 'カタルーニャ・サーキット', flag: '🇪🇸', country: 'スペイン', date: '2026-06-14', lat: 41.5700, lon: 2.2611 },
  { gp: 'オーストリアGP', circuit: 'レッドブル・リンク', flag: '🇦🇹', country: 'オーストリア', date: '2026-06-28', lat: 47.2197, lon: 14.7647 },
  { gp: 'イギリスGP', circuit: 'シルバーストン・サーキット', flag: '🇬🇧', country: 'イギリス', date: '2026-07-05', lat: 52.0786, lon: -1.0169 },
  { gp: 'ベルギーGP', circuit: 'スパ・フランコルシャン・サーキット', flag: '🇧🇪', country: 'ベルギー', date: '2026-07-19', lat: 50.4372, lon: 5.9714 },
  { gp: 'ハンガリーGP', circuit: 'ハンガロリンク', flag: '🇭🇺', country: 'ハンガリー', date: '2026-07-26', lat: 47.5789, lon: 19.2486 },
  { gp: 'オランダGP', circuit: 'ザントフォールト・サーキット', flag: '🇳🇱', country: 'オランダ', date: '2026-08-23', lat: 52.3888, lon: 4.5409 },
  { gp: 'イタリアGP', circuit: 'モンツァ・サーキット', flag: '🇮🇹', country: 'イタリア', date: '2026-09-06', lat: 45.6156, lon: 9.2811 },
  { gp: 'スペイン(マドリード)GP', circuit: 'マドリング・サーキット', flag: '🇪🇸', country: 'スペイン', date: '2026-09-13', lat: 40.4650, lon: -3.6089 },
  { gp: 'アゼルバイジャンGP', circuit: 'バクー市街地サーキット', flag: '🇦🇿', country: 'アゼルバイジャン', date: '2026-09-27', lat: 40.3725, lon: 49.8533 },
  { gp: 'シンガポールGP', circuit: 'マリーナベイ市街地サーキット', flag: '🇸🇬', country: 'シンガポール', date: '2026-10-11', lat: 1.2914, lon: 103.8640 },
  { gp: 'アメリカGP', circuit: 'サーキット・オブ・ジ・アメリカズ', flag: '🇺🇸', country: 'アメリカ', date: '2026-10-25', lat: 30.1328, lon: -97.6411 },
  { gp: 'メキシコGP', circuit: 'エルマノス・ロドリゲス・サーキット', flag: '🇲🇽', country: 'メキシコ', date: '2026-11-01', lat: 19.4042, lon: -99.0907 },
  { gp: 'ブラジルGP', circuit: 'インテルラゴス・サーキット', flag: '🇧🇷', country: 'ブラジル', date: '2026-11-08', lat: -23.7036, lon: -46.6997 },
  { gp: 'ラスベガスGP', circuit: 'ラスベガス・ストリップ・サーキット', flag: '🇺🇸', country: 'アメリカ', date: '2026-11-21', lat: 36.1147, lon: -115.1728 },
  { gp: 'カタールGP', circuit: 'ロサイル・インターナショナル・サーキット', flag: '🇶🇦', country: 'カタール', date: '2026-11-29', lat: 25.4900, lon: 51.4542 },
  { gp: 'アブダビGP', circuit: 'ヤス・マリーナ・サーキット', flag: '🇦🇪', country: 'アラブ首長国連邦', date: '2026-12-06', lat: 24.4672, lon: 54.6031 },
];
