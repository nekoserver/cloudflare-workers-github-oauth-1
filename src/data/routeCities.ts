export interface RouteCity {
  name: string;
  label: string;
  lat: number;
  lon: number;
  // country: 都市が属する国名(日本語表記)。flag: その国の国旗絵文字。
  // 「出発地から見た目的地別プラン分布」セクションの各都市ボタンの行頭に
  // 表示する国旗の出所として使う(src/views/heritageJourney.ts の
  // renderNightsDistribution/computeDestinationNightsDistribution参照)。
  // src/data/heritageList.ts の HeritageItem.f(国旗)/c(国名)と同じ絵文字を
  // 国ごとに再利用し、表記ゆれのない一意な絵文字を採用している。
  country: string;
  flag: string;
}

export const ROUTE_CITIES: RouteCity[] = [
  { name: "Paris", label: "パリ", lat: 48.8566, lon: 2.3522, country: "フランス", flag: "🇫🇷" },
  { name: "Prague", label: "プラハ", lat: 50.0755, lon: 14.4378, country: "チェコ", flag: "🇨🇿" },
  { name: "London", label: "ロンドン", lat: 51.5074, lon: -0.1278, country: "イギリス", flag: "🇬🇧" },
  { name: "Amsterdam", label: "アムステルダム", lat: 52.3676, lon: 4.9041, country: "オランダ", flag: "🇳🇱" },
  { name: "Brussels", label: "ブリュッセル", lat: 50.8503, lon: 4.3517, country: "ベルギー", flag: "🇧🇪" },
  { name: "Berlin", label: "ベルリン", lat: 52.52, lon: 13.405, country: "ドイツ", flag: "🇩🇪" },
  { name: "Munich", label: "ミュンヘン", lat: 48.1351, lon: 11.582, country: "ドイツ", flag: "🇩🇪" },
  { name: "Vienna", label: "ウィーン", lat: 48.2082, lon: 16.3738, country: "オーストリア", flag: "🇦🇹" },
  { name: "Zurich", label: "チューリッヒ", lat: 47.3769, lon: 8.5417, country: "スイス", flag: "🇨🇭" },
  { name: "Geneva", label: "ジュネーブ", lat: 46.2044, lon: 6.1432, country: "スイス", flag: "🇨🇭" },
  { name: "Lyon", label: "リヨン", lat: 45.764, lon: 4.8357, country: "フランス", flag: "🇫🇷" },
  { name: "Marseille", label: "マルセイユ", lat: 43.2965, lon: 5.3698, country: "フランス", flag: "🇫🇷" },
  { name: "Barcelona", label: "バルセロナ", lat: 41.3851, lon: 2.1734, country: "スペイン", flag: "🇪🇸" },
  { name: "Madrid", label: "マドリード", lat: 40.4168, lon: -3.7038, country: "スペイン", flag: "🇪🇸" },
  { name: "Milan", label: "ミラノ", lat: 45.4642, lon: 9.19, country: "イタリア", flag: "🇮🇹" },
  { name: "Rome", label: "ローマ", lat: 41.9028, lon: 12.4964, country: "イタリア", flag: "🇮🇹" },
  { name: "Florence", label: "フィレンツェ", lat: 43.7696, lon: 11.2558, country: "イタリア", flag: "🇮🇹" },
  { name: "Naples", label: "ナポリ", lat: 40.8518, lon: 14.2681, country: "イタリア", flag: "🇮🇹" },
  { name: "Venice", label: "ヴェネツィア", lat: 45.4408, lon: 12.3155, country: "イタリア", flag: "🇮🇹" },
  { name: "Turin", label: "トリノ", lat: 45.0703, lon: 7.6869, country: "イタリア", flag: "🇮🇹" },
  { name: "Frankfurt", label: "フランクフルト", lat: 50.1109, lon: 8.6821, country: "ドイツ", flag: "🇩🇪" },
  { name: "Hamburg", label: "ハンブルク", lat: 53.5511, lon: 9.9937, country: "ドイツ", flag: "🇩🇪" },
  { name: "Warsaw", label: "ワルシャワ", lat: 52.2297, lon: 21.0122, country: "ポーランド", flag: "🇵🇱" },
  { name: "Budapest", label: "ブダペスト", lat: 47.4979, lon: 19.0402, country: "ハンガリー", flag: "🇭🇺" },
  { name: "Bratislava", label: "ブラチスラヴァ", lat: 48.1486, lon: 17.1077, country: "スロバキア", flag: "🇸🇰" },
  { name: "Zagreb", label: "ザグレブ", lat: 45.815, lon: 15.9819, country: "クロアチア", flag: "🇭🇷" },
  { name: "Ljubljana", label: "リュブリャナ", lat: 46.0569, lon: 14.5058, country: "スロベニア", flag: "🇸🇮" },
  { name: "Bern", label: "ベルン", lat: 46.948, lon: 7.4474, country: "スイス", flag: "🇨🇭" },
  { name: "Stuttgart", label: "シュトゥットガルト", lat: 48.7758, lon: 9.1829, country: "ドイツ", flag: "🇩🇪" },
  { name: "Cologne", label: "ケルン", lat: 50.9333, lon: 6.95, country: "ドイツ", flag: "🇩🇪" },
  { name: "Bordeaux", label: "ボルドー", lat: 44.8378, lon: -0.5792, country: "フランス", flag: "🇫🇷" },
  { name: "Toulouse", label: "トゥールーズ", lat: 43.6047, lon: 1.4442, country: "フランス", flag: "🇫🇷" },
  { name: "Nice", label: "ニース", lat: 43.7102, lon: 7.262, country: "フランス", flag: "🇫🇷" },
  { name: "Bologna", label: "ボローニャ", lat: 44.4949, lon: 11.3426, country: "イタリア", flag: "🇮🇹" },
  { name: "Genoa", label: "ジェノヴァ", lat: 44.4056, lon: 8.9463, country: "イタリア", flag: "🇮🇹" },
  { name: "Lisbon", label: "リスボン", lat: 38.7223, lon: -9.1393, country: "ポルトガル", flag: "🇵🇹" },
  { name: "Sarajevo", label: "サラエボ", lat: 43.8476, lon: 18.3564, country: "ボスニア・ヘルツェゴビナ", flag: "🇧🇦" },
  { name: "Krakow", label: "クラクフ", lat: 50.0647, lon: 19.945, country: "ポーランド", flag: "🇵🇱" },
  { name: "Wroclaw", label: "ヴロツワフ", lat: 51.1079, lon: 17.0385, country: "ポーランド", flag: "🇵🇱" },
  { name: "Dresden", label: "ドレスデン", lat: 51.0509, lon: 13.7381, country: "ドイツ", flag: "🇩🇪" },
  { name: "Leipzig", label: "ライプツィヒ", lat: 51.3397, lon: 12.3731, country: "ドイツ", flag: "🇩🇪" },
  { name: "Nuremberg", label: "ニュルンベルク", lat: 49.4521, lon: 11.0767, country: "ドイツ", flag: "🇩🇪" },
  { name: "Linz", label: "リンツ", lat: 48.3069, lon: 14.2858, country: "オーストリア", flag: "🇦🇹" },
  { name: "Brno", label: "ブルノ", lat: 49.1951, lon: 16.6068, country: "チェコ", flag: "🇨🇿" },
  { name: "Poznan", label: "ポズナン", lat: 52.4064, lon: 16.9252, country: "ポーランド", flag: "🇵🇱" },
  { name: "Copenhagen", label: "コペンハーゲン", lat: 55.6761, lon: 12.5683, country: "デンマーク", flag: "🇩🇰" },
  { name: "Gdansk", label: "グダニスク", lat: 54.352, lon: 18.6466, country: "ポーランド", flag: "🇵🇱" },
  { name: "Riga", label: "リガ", lat: 56.946, lon: 24.1059, country: "ラトビア", flag: "🇱🇻" },
  { name: "Vilnius", label: "ヴィリニュス", lat: 54.6872, lon: 25.2797, country: "リトアニア", flag: "🇱🇹" },
  { name: "Minsk", label: "ミンスク", lat: 53.9045, lon: 27.5615, country: "ベラルーシ", flag: "🇧🇾" },
  { name: "Kyiv", label: "キーウ", lat: 50.4501, lon: 30.5234, country: "ウクライナ", flag: "🇺🇦" },
  { name: "Lviv", label: "リヴィウ", lat: 49.8397, lon: 24.0297, country: "ウクライナ", flag: "🇺🇦" },
  { name: "Athens", label: "アテネ", lat: 37.9838, lon: 23.7275, country: "ギリシャ", flag: "🇬🇷" },
  { name: "Bucharest", label: "ブカレスト", lat: 44.4268, lon: 26.1025, country: "ルーマニア", flag: "🇷🇴" },
  { name: "Sofia", label: "ソフィア", lat: 42.6977, lon: 23.3219, country: "ブルガリア", flag: "🇧🇬" },
  { name: "Belgrade", label: "ベオグラード", lat: 44.8176, lon: 20.4633, country: "セルビア", flag: "🇷🇸" },
];
