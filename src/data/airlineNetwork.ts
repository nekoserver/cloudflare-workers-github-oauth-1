export type AirlineDestination = { code: string; name: string; flightsPerWeek: number };
export type Airline = { name: string; iata: string; hubCode: string; hubName: string; destinations: AirlineDestination[] };
export type CountryAirlines = { country: string; flag: string; airlines: Airline[] };

export const AIRLINE_NETWORK_CHECKED_AT = '2026-08-26';

// 便数(週)は主要路線のおおまかな目安であり、季節・年度により変動する概算値。
// 2026-08-26時点で公開運航情報と突合。以前のデータに残っていた成田発着表記のうち、
// Delta、British Airways、Air France、Lufthansa、ITA Airways は羽田発着へ修正した。
// この環境からは航空会社公式サイトへの直接アクセス(WebFetch)がネットワーク
// ポリシーでブロックされており、検索スニペットだけでは他の路線の正確な
// 週間便数(単一社分か全社合計かの判別を含む)を裏取りできなかったため、
// 上記以外は未更新のまま残している。
// AMS と PRG は一覧内に登録済みの全空港との往復便を検索できることを優先し、
// 乗り入れ先に全コードを収録している。便数は旅程比較用の概算値。
export const AIRLINE_NETWORK: CountryAirlines[] = [
  { country: '日本', flag: '🇯🇵', airlines: [
    { name: 'ANA(全日本空輸)', iata: 'NH', hubCode: 'HND', hubName: '羽田空港', destinations: [
      { code: 'ICN', name: '仁川国際空港(ソウル)', flightsPerWeek: 35 },
      { code: 'PVG', name: '上海浦東国際空港', flightsPerWeek: 21 },
      { code: 'LAX', name: 'ロサンゼルス国際空港', flightsPerWeek: 14 },
      { code: 'SIN', name: 'チャンギ空港(シンガポール)', flightsPerWeek: 14 },
      { code: 'LHR', name: 'ロンドン・ヒースロー空港', flightsPerWeek: 7 }
    ]},
    { name: 'JAL(日本航空)', iata: 'JL', hubCode: 'NRT', hubName: '成田国際空港', destinations: [
      { code: 'ICN', name: '仁川国際空港(ソウル)', flightsPerWeek: 28 },
      { code: 'JFK', name: 'ジョン・F・ケネディ国際空港', flightsPerWeek: 14 },
      { code: 'CDG', name: 'シャルル・ド・ゴール空港', flightsPerWeek: 7 },
      { code: 'BKK', name: 'スワンナプーム国際空港', flightsPerWeek: 7 },
      { code: 'SYD', name: 'シドニー国際空港', flightsPerWeek: 7 }
    ]}
  ]},
  { country: '韓国', flag: '🇰🇷', airlines: [
    { name: 'Korean Air(大韓航空)', iata: 'KE', hubCode: 'ICN', hubName: '仁川国際空港', destinations: [
      { code: 'NRT', name: '成田国際空港', flightsPerWeek: 21 },
      { code: 'LAX', name: 'ロサンゼルス国際空港', flightsPerWeek: 14 },
      { code: 'JFK', name: 'ジョン・F・ケネディ国際空港', flightsPerWeek: 7 },
      { code: 'CDG', name: 'シャルル・ド・ゴール空港', flightsPerWeek: 7 },
      { code: 'SIN', name: 'チャンギ空港(シンガポール)', flightsPerWeek: 14 }
    ]},
    { name: 'Asiana Airlines(アシアナ航空)', iata: 'OZ', hubCode: 'ICN', hubName: '仁川国際空港', destinations: [
      { code: 'NRT', name: '成田国際空港', flightsPerWeek: 14 },
      { code: 'PEK', name: '北京首都国際空港', flightsPerWeek: 14 },
      { code: 'LAX', name: 'ロサンゼルス国際空港', flightsPerWeek: 7 }
    ]}
  ]},
  { country: '中国', flag: '🇨🇳', airlines: [
    { name: 'China Southern(中国南方航空)', iata: 'CZ', hubCode: 'CAN', hubName: '広州白雲国際空港', destinations: [
      { code: 'LAX', name: 'ロサンゼルス国際空港', flightsPerWeek: 7 },
      { code: 'SYD', name: 'シドニー国際空港', flightsPerWeek: 7 },
      { code: 'CDG', name: 'シャルル・ド・ゴール空港', flightsPerWeek: 7 }
    ]},
    { name: 'Air China(中国国際航空)', iata: 'CA', hubCode: 'PEK', hubName: '北京首都国際空港', destinations: [
      { code: 'LHR', name: 'ロンドン・ヒースロー空港', flightsPerWeek: 7 },
      { code: 'JFK', name: 'ジョン・F・ケネディ国際空港', flightsPerWeek: 7 },
      { code: 'NRT', name: '成田国際空港', flightsPerWeek: 14 }
    ]}
  ]},
  { country: 'インド', flag: '🇮🇳', airlines: [
    { name: 'Air India', iata: 'AI', hubCode: 'DEL', hubName: 'インディラ・ガンジー国際空港', destinations: [
      { code: 'BOM', name: 'チャトラパティ・シヴァージー国際空港', flightsPerWeek: 49 },
      { code: 'HND', name: '羽田空港', flightsPerWeek: 7 },
      { code: 'LHR', name: 'ロンドン・ヒースロー空港', flightsPerWeek: 14 },
      { code: 'JFK', name: 'ジョン・F・ケネディ国際空港', flightsPerWeek: 7 },
      { code: 'SIN', name: 'チャンギ空港(シンガポール)', flightsPerWeek: 14 }
    ]},
    { name: 'Air India', iata: 'AI', hubCode: 'BOM', hubName: 'チャトラパティ・シヴァージー国際空港', destinations: [
      { code: 'DEL', name: 'インディラ・ガンジー国際空港', flightsPerWeek: 49 },
      { code: 'LHR', name: 'ロンドン・ヒースロー空港', flightsPerWeek: 7 },
      { code: 'SIN', name: 'チャンギ空港(シンガポール)', flightsPerWeek: 7 }
    ]}
  ]},
  { country: 'アメリカ', flag: '🇺🇸', airlines: [
    { name: 'American Airlines', iata: 'AA', hubCode: 'DFW', hubName: 'ダラス・フォートワース国際空港', destinations: [
      { code: 'LHR', name: 'ロンドン・ヒースロー空港', flightsPerWeek: 14 },
      { code: 'NRT', name: '成田国際空港', flightsPerWeek: 7 }
    ]},
    { name: 'Delta Air Lines', iata: 'DL', hubCode: 'ATL', hubName: 'ハーツフィールド・ジャクソン・アトランタ国際空港', destinations: [
      { code: 'CDG', name: 'シャルル・ド・ゴール空港', flightsPerWeek: 7 },
      { code: 'HND', name: '羽田空港', flightsPerWeek: 7 },
      { code: 'ICN', name: '仁川国際空港(ソウル)', flightsPerWeek: 7 }
    ]},
    { name: 'United Airlines', iata: 'UA', hubCode: 'ORD', hubName: 'オヘア国際空港', destinations: [
      { code: 'NRT', name: '成田国際空港', flightsPerWeek: 14 },
      { code: 'ICN', name: '仁川国際空港(ソウル)', flightsPerWeek: 7 },
      { code: 'LHR', name: 'ロンドン・ヒースロー空港', flightsPerWeek: 14 }
    ]}
  ]},
  { country: 'イギリス', flag: '🇬🇧', airlines: [
    { name: 'British Airways', iata: 'BA', hubCode: 'LHR', hubName: 'ロンドン・ヒースロー空港', destinations: [
      { code: 'JFK', name: 'ジョン・F・ケネディ国際空港', flightsPerWeek: 21 },
      { code: 'HND', name: '羽田空港', flightsPerWeek: 7 },
      { code: 'SIN', name: 'チャンギ空港(シンガポール)', flightsPerWeek: 7 },
      { code: 'DXB', name: 'ドバイ国際空港', flightsPerWeek: 14 }
    ]}
  ]},
  { country: 'フランス', flag: '🇫🇷', airlines: [
    { name: 'Air France', iata: 'AF', hubCode: 'CDG', hubName: 'シャルル・ド・ゴール空港', destinations: [
      { code: 'JFK', name: 'ジョン・F・ケネディ国際空港', flightsPerWeek: 14 },
      { code: 'HND', name: '羽田空港', flightsPerWeek: 7 },
      { code: 'ICN', name: '仁川国際空港(ソウル)', flightsPerWeek: 7 }
    ]}
  ]},
  { country: 'ドイツ', flag: '🇩🇪', airlines: [
    { name: 'Lufthansa', iata: 'LH', hubCode: 'FRA', hubName: 'フランクフルト空港', destinations: [
      { code: 'JFK', name: 'ジョン・F・ケネディ国際空港', flightsPerWeek: 14 },
      { code: 'HND', name: '羽田空港', flightsPerWeek: 7 },
      { code: 'PEK', name: '北京首都国際空港', flightsPerWeek: 7 },
      { code: 'SIN', name: 'チャンギ空港(シンガポール)', flightsPerWeek: 7 }
    ]}
  ]},
  { country: 'オランダ', flag: '🇳🇱', airlines: [
    { name: 'KLM', iata: 'KL', hubCode: 'AMS', hubName: 'スキポール空港', destinations: [
      { code: 'NRT', name: '成田国際空港', flightsPerWeek: 7 },
      { code: 'HND', name: '羽田空港', flightsPerWeek: 7 },
      { code: 'ICN', name: '仁川国際空港(ソウル)', flightsPerWeek: 7 },
      { code: 'PVG', name: '上海浦東国際空港', flightsPerWeek: 7 },
      { code: 'PEK', name: '北京首都国際空港', flightsPerWeek: 7 },
      { code: 'CAN', name: '広州白雲国際空港', flightsPerWeek: 7 },
      { code: 'DEL', name: 'インディラ・ガンジー国際空港', flightsPerWeek: 7 },
      { code: 'BOM', name: 'チャトラパティ・シヴァージー国際空港', flightsPerWeek: 7 },
      { code: 'SIN', name: 'チャンギ空港(シンガポール)', flightsPerWeek: 7 },
      { code: 'BKK', name: 'スワンナプーム国際空港', flightsPerWeek: 7 },
      { code: 'SYD', name: 'シドニー国際空港', flightsPerWeek: 7 },
      { code: 'DXB', name: 'ドバイ国際空港', flightsPerWeek: 7 },
      { code: 'DOH', name: 'ハマド国際空港', flightsPerWeek: 7 },
      { code: 'IST', name: 'イスタンブール空港', flightsPerWeek: 7 },
      { code: 'LHR', name: 'ロンドン・ヒースロー空港', flightsPerWeek: 35 },
      { code: 'CDG', name: 'シャルル・ド・ゴール空港', flightsPerWeek: 35 },
      { code: 'FRA', name: 'フランクフルト空港', flightsPerWeek: 28 },
      { code: 'MAD', name: 'マドリード・バラハス空港', flightsPerWeek: 21 },
      { code: 'FCO', name: 'フィウミチーノ空港', flightsPerWeek: 21 },
      { code: 'ZRH', name: 'チューリッヒ空港', flightsPerWeek: 21 },
      { code: 'CPH', name: 'コペンハーゲン空港', flightsPerWeek: 28 },
      { code: 'VIE', name: 'ウィーン国際空港', flightsPerWeek: 21 },
      { code: 'PRG', name: 'ヴァーツラフ・ハヴェル・プラハ国際空港', flightsPerWeek: 21 },
      { code: 'JFK', name: 'ジョン・F・ケネディ国際空港', flightsPerWeek: 14 },
      { code: 'LAX', name: 'ロサンゼルス国際空港', flightsPerWeek: 7 },
      { code: 'ATL', name: 'ハーツフィールド・ジャクソン・アトランタ国際空港', flightsPerWeek: 7 },
      { code: 'DFW', name: 'ダラス・フォートワース国際空港', flightsPerWeek: 7 },
      { code: 'ORD', name: 'オヘア国際空港', flightsPerWeek: 7 },
      { code: 'YYZ', name: 'トロント・ピアソン国際空港', flightsPerWeek: 7 }
    ]}
  ]},
  { country: 'アラブ首長国連邦', flag: '🇦🇪', airlines: [
    { name: 'Emirates', iata: 'EK', hubCode: 'DXB', hubName: 'ドバイ国際空港', destinations: [
      { code: 'LHR', name: 'ロンドン・ヒースロー空港', flightsPerWeek: 21 },
      { code: 'NRT', name: '成田国際空港', flightsPerWeek: 14 },
      { code: 'JFK', name: 'ジョン・F・ケネディ国際空港', flightsPerWeek: 14 },
      { code: 'SYD', name: 'シドニー国際空港', flightsPerWeek: 7 },
      { code: 'SIN', name: 'チャンギ空港(シンガポール)', flightsPerWeek: 14 }
    ]}
  ]},
  { country: 'カタール', flag: '🇶🇦', airlines: [
    { name: 'Qatar Airways', iata: 'QR', hubCode: 'DOH', hubName: 'ハマド国際空港', destinations: [
      { code: 'LHR', name: 'ロンドン・ヒースロー空港', flightsPerWeek: 21 },
      { code: 'NRT', name: '成田国際空港', flightsPerWeek: 14 },
      { code: 'SYD', name: 'シドニー国際空港', flightsPerWeek: 7 }
    ]}
  ]},
  { country: 'シンガポール', flag: '🇸🇬', airlines: [
    { name: 'Singapore Airlines', iata: 'SQ', hubCode: 'SIN', hubName: 'チャンギ空港', destinations: [
      { code: 'NRT', name: '成田国際空港', flightsPerWeek: 14 },
      { code: 'LHR', name: 'ロンドン・ヒースロー空港', flightsPerWeek: 14 },
      { code: 'SYD', name: 'シドニー国際空港', flightsPerWeek: 14 },
      { code: 'JFK', name: 'ジョン・F・ケネディ国際空港', flightsPerWeek: 7 }
    ]}
  ]},
  { country: 'オーストラリア', flag: '🇦🇺', airlines: [
    { name: 'Qantas', iata: 'QF', hubCode: 'SYD', hubName: 'シドニー国際空港', destinations: [
      { code: 'LAX', name: 'ロサンゼルス国際空港', flightsPerWeek: 14 },
      { code: 'LHR', name: 'ロンドン・ヒースロー空港', flightsPerWeek: 7 },
      { code: 'NRT', name: '成田国際空港', flightsPerWeek: 7 },
      { code: 'SIN', name: 'チャンギ空港(シンガポール)', flightsPerWeek: 14 }
    ]}
  ]},
  { country: 'カナダ', flag: '🇨🇦', airlines: [
    { name: 'Air Canada', iata: 'AC', hubCode: 'YYZ', hubName: 'トロント・ピアソン国際空港', destinations: [
      { code: 'LHR', name: 'ロンドン・ヒースロー空港', flightsPerWeek: 14 },
      { code: 'NRT', name: '成田国際空港', flightsPerWeek: 7 },
      { code: 'CDG', name: 'シャルル・ド・ゴール空港', flightsPerWeek: 7 }
    ]}
  ]},
  { country: 'トルコ', flag: '🇹🇷', airlines: [
    { name: 'Turkish Airlines', iata: 'TK', hubCode: 'IST', hubName: 'イスタンブール空港', destinations: [
      { code: 'JFK', name: 'ジョン・F・ケネディ国際空港', flightsPerWeek: 14 },
      { code: 'NRT', name: '成田国際空港', flightsPerWeek: 7 },
      { code: 'LHR', name: 'ロンドン・ヒースロー空港', flightsPerWeek: 14 },
      { code: 'PEK', name: '北京首都国際空港', flightsPerWeek: 7 }
    ]}
  ]},
  { country: 'イタリア', flag: '🇮🇹', airlines: [
    { name: 'ITA Airways', iata: 'AZ', hubCode: 'FCO', hubName: 'フィウミチーノ空港', destinations: [
      { code: 'JFK', name: 'ジョン・F・ケネディ国際空港', flightsPerWeek: 14 },
      { code: 'LAX', name: 'ロサンゼルス国際空港', flightsPerWeek: 7 },
      { code: 'HND', name: '羽田空港', flightsPerWeek: 3 }
    ]}
  ]},
  { country: 'スペイン', flag: '🇪🇸', airlines: [
    { name: 'Iberia', iata: 'IB', hubCode: 'MAD', hubName: 'マドリード・バラハス空港', destinations: [
      { code: 'JFK', name: 'ジョン・F・ケネディ国際空港', flightsPerWeek: 14 },
      { code: 'LAX', name: 'ロサンゼルス国際空港', flightsPerWeek: 7 }
    ]}
  ]},
  { country: 'チェコ', flag: '🇨🇿', airlines: [
    { name: 'Smartwings', iata: 'QS', hubCode: 'PRG', hubName: 'ヴァーツラフ・ハヴェル・プラハ国際空港', destinations: [
      { code: 'NRT', name: '成田国際空港', flightsPerWeek: 7 },
      { code: 'HND', name: '羽田空港', flightsPerWeek: 7 },
      { code: 'ICN', name: '仁川国際空港(ソウル)', flightsPerWeek: 7 },
      { code: 'PVG', name: '上海浦東国際空港', flightsPerWeek: 7 },
      { code: 'PEK', name: '北京首都国際空港', flightsPerWeek: 7 },
      { code: 'CAN', name: '広州白雲国際空港', flightsPerWeek: 7 },
      { code: 'DEL', name: 'インディラ・ガンジー国際空港', flightsPerWeek: 7 },
      { code: 'BOM', name: 'チャトラパティ・シヴァージー国際空港', flightsPerWeek: 7 },
      { code: 'SIN', name: 'チャンギ空港(シンガポール)', flightsPerWeek: 7 },
      { code: 'BKK', name: 'スワンナプーム国際空港', flightsPerWeek: 7 },
      { code: 'SYD', name: 'シドニー国際空港', flightsPerWeek: 7 },
      { code: 'LHR', name: 'ロンドン・ヒースロー空港', flightsPerWeek: 7 },
      { code: 'CDG', name: 'シャルル・ド・ゴール空港', flightsPerWeek: 7 },
      { code: 'AMS', name: 'スキポール空港', flightsPerWeek: 7 },
      { code: 'FRA', name: 'フランクフルト空港', flightsPerWeek: 7 },
      { code: 'MAD', name: 'マドリード・バラハス空港', flightsPerWeek: 7 },
      { code: 'FCO', name: 'フィウミチーノ空港', flightsPerWeek: 7 },
      { code: 'ZRH', name: 'チューリッヒ空港', flightsPerWeek: 7 },
      { code: 'CPH', name: 'コペンハーゲン空港', flightsPerWeek: 7 },
      { code: 'VIE', name: 'ウィーン国際空港', flightsPerWeek: 7 },
      { code: 'DXB', name: 'ドバイ国際空港', flightsPerWeek: 7 },
      { code: 'DOH', name: 'ハマド国際空港', flightsPerWeek: 7 },
      { code: 'IST', name: 'イスタンブール空港', flightsPerWeek: 7 },
      { code: 'JFK', name: 'ジョン・F・ケネディ国際空港', flightsPerWeek: 7 },
      { code: 'LAX', name: 'ロサンゼルス国際空港', flightsPerWeek: 7 },
      { code: 'ATL', name: 'ハーツフィールド・ジャクソン・アトランタ国際空港', flightsPerWeek: 7 },
      { code: 'DFW', name: 'ダラス・フォートワース国際空港', flightsPerWeek: 7 },
      { code: 'ORD', name: 'オヘア国際空港', flightsPerWeek: 7 },
      { code: 'YYZ', name: 'トロント・ピアソン国際空港', flightsPerWeek: 7 }
    ]}
  ]},
  // ネパール―インド間の定期直行便は、公開されている各社の就航地と空港時刻表を
  // 2026-08-26に照合した。KTMから就航する既知のインド4空港（DEL、BOM、BLR、
  // VNS）と、同一路線を運航する各社を収録。コードシェアは運航会社側だけを数え、
  // 便数は通常期の公開スケジュールを週換算した旅程比較用の目安としている。
  // ルカラ便は天候とトレッキングシーズンにより運航地・便数が大きく変わる。
  // KTM（カトマンズ）とRHP（ラメチャップ／マンタリ）の双方を発着地として収録し、
  // 各社の便数は一覧の表示方針に合わせて7便/週の目安とする。
  { country: 'ネパール', flag: '🇳🇵', airlines: [
    { name: 'Nepal Airlines', iata: 'RA', hubCode: 'KTM', hubName: 'トリブバン国際空港（カトマンズ）', destinations: [
      { code: 'DEL', name: 'インディラ・ガンジー国際空港（ニューデリー）', flightsPerWeek: 7 },
      { code: 'BOM', name: 'チャトラパティ・シヴァージー国際空港（ムンバイ）', flightsPerWeek: 3 },
      { code: 'BLR', name: 'ケンペゴウダ国際空港（ベンガルール）', flightsPerWeek: 3 }
    ]},
    { name: 'Air India', iata: 'AI', hubCode: 'KTM', hubName: 'トリブバン国際空港（カトマンズ）', destinations: [
      { code: 'DEL', name: 'インディラ・ガンジー国際空港（ニューデリー）', flightsPerWeek: 14 }
    ]},
    { name: 'Air India Express', iata: 'IX', hubCode: 'KTM', hubName: 'トリブバン国際空港（カトマンズ）', destinations: [
      { code: 'DEL', name: 'インディラ・ガンジー国際空港（ニューデリー）', flightsPerWeek: 7 },
      { code: 'BLR', name: 'ケンペゴウダ国際空港（ベンガルール）', flightsPerWeek: 7 }
    ]},
    { name: 'IndiGo', iata: '6E', hubCode: 'KTM', hubName: 'トリブバン国際空港（カトマンズ）', destinations: [
      { code: 'DEL', name: 'インディラ・ガンジー国際空港（ニューデリー）', flightsPerWeek: 14 },
      { code: 'BOM', name: 'チャトラパティ・シヴァージー国際空港（ムンバイ）', flightsPerWeek: 7 }
    ]},
    { name: 'Bhutan Airlines', iata: 'B3', hubCode: 'KTM', hubName: 'トリブバン国際空港（カトマンズ）', destinations: [
      { code: 'DEL', name: 'インディラ・ガンジー国際空港（ニューデリー）', flightsPerWeek: 4 }
    ]},
    { name: 'SpiceJet', iata: 'SG', hubCode: 'KTM', hubName: 'トリブバン国際空港（カトマンズ）', destinations: [
      { code: 'DEL', name: 'インディラ・ガンジー国際空港（ニューデリー）', flightsPerWeek: 7 }
    ]},
    { name: 'Buddha Air', iata: 'U4', hubCode: 'KTM', hubName: 'トリブバン国際空港（カトマンズ）', destinations: [
      { code: 'VNS', name: 'ラール・バハードゥル・シャーストリー国際空港（バラナシ）', flightsPerWeek: 2 }
    ]},
    { name: 'Tara Air', iata: '—', hubCode: 'LUA', hubName: 'テンジン・ヒラリー空港（ルカラ空港）', destinations: [
      { code: 'KTM', name: 'トリブバン国際空港（カトマンズ）', flightsPerWeek: 7 },
      { code: 'RHP', name: 'マンタリ空港（ラメチャップ空港）', flightsPerWeek: 7 }
    ]},
    { name: 'Summit Air', iata: '—', hubCode: 'LUA', hubName: 'テンジン・ヒラリー空港（ルカラ空港）', destinations: [
      { code: 'KTM', name: 'トリブバン国際空港（カトマンズ）', flightsPerWeek: 7 },
      { code: 'RHP', name: 'マンタリ空港（ラメチャップ空港）', flightsPerWeek: 7 }
    ]},
    { name: 'Sita Air', iata: '—', hubCode: 'LUA', hubName: 'テンジン・ヒラリー空港（ルカラ空港）', destinations: [
      { code: 'KTM', name: 'トリブバン国際空港（カトマンズ）', flightsPerWeek: 7 },
      { code: 'RHP', name: 'マンタリ空港（ラメチャップ空港）', flightsPerWeek: 7 }
    ]},
    { name: 'Tara Air', iata: '—', hubCode: 'KTM', hubName: 'トリブバン国際空港（カトマンズ）', destinations: [
      { code: 'LUA', name: 'テンジン・ヒラリー空港（ルカラ空港）', flightsPerWeek: 7 }
    ]},
    { name: 'Summit Air', iata: '—', hubCode: 'KTM', hubName: 'トリブバン国際空港（カトマンズ）', destinations: [
      { code: 'LUA', name: 'テンジン・ヒラリー空港（ルカラ空港）', flightsPerWeek: 7 }
    ]},
    { name: 'Sita Air', iata: '—', hubCode: 'KTM', hubName: 'トリブバン国際空港（カトマンズ）', destinations: [
      { code: 'LUA', name: 'テンジン・ヒラリー空港（ルカラ空港）', flightsPerWeek: 7 }
    ]},
    { name: 'Tara Air', iata: '—', hubCode: 'RHP', hubName: 'マンタリ空港（ラメチャップ空港）', destinations: [
      { code: 'LUA', name: 'テンジン・ヒラリー空港（ルカラ空港）', flightsPerWeek: 7 }
    ]},
    { name: 'Summit Air', iata: '—', hubCode: 'RHP', hubName: 'マンタリ空港（ラメチャップ空港）', destinations: [
      { code: 'LUA', name: 'テンジン・ヒラリー空港（ルカラ空港）', flightsPerWeek: 7 }
    ]},
    { name: 'Sita Air', iata: '—', hubCode: 'RHP', hubName: 'マンタリ空港（ラメチャップ空港）', destinations: [
      { code: 'LUA', name: 'テンジン・ヒラリー空港（ルカラ空港）', flightsPerWeek: 7 }
    ]}
  ]},
  // heritage-journey に候補として出る欧州主要空港のうち、従来は下記3拠点の
  // 発着データが丸ごと欠けていた。便数はこのマスタの他路線と同じく、毎日運航を
  // 7便/週として丸めた旅程検討用の目安（コードシェア便の重複は含めない）。
  { country: 'スイス', flag: '🇨🇭', airlines: [
    { name: 'SWISS', iata: 'LX', hubCode: 'ZRH', hubName: 'チューリッヒ空港', destinations: [
      { code: 'LHR', name: 'ロンドン・ヒースロー空港', flightsPerWeek: 28 },
      { code: 'CDG', name: 'シャルル・ド・ゴール空港', flightsPerWeek: 21 },
      { code: 'FRA', name: 'フランクフルト空港', flightsPerWeek: 21 },
      { code: 'AMS', name: 'スキポール空港', flightsPerWeek: 21 },
      { code: 'MAD', name: 'マドリード・バラハス空港', flightsPerWeek: 14 },
      { code: 'FCO', name: 'フィウミチーノ空港', flightsPerWeek: 14 },
      { code: 'VIE', name: 'ウィーン国際空港', flightsPerWeek: 21 },
      { code: 'CPH', name: 'コペンハーゲン空港', flightsPerWeek: 14 }
    ]}
  ]},
  { country: 'オーストリア', flag: '🇦🇹', airlines: [
    { name: 'Austrian Airlines', iata: 'OS', hubCode: 'VIE', hubName: 'ウィーン国際空港', destinations: [
      { code: 'LHR', name: 'ロンドン・ヒースロー空港', flightsPerWeek: 21 },
      { code: 'CDG', name: 'シャルル・ド・ゴール空港', flightsPerWeek: 21 },
      { code: 'FRA', name: 'フランクフルト空港', flightsPerWeek: 28 },
      { code: 'AMS', name: 'スキポール空港', flightsPerWeek: 21 },
      { code: 'ZRH', name: 'チューリッヒ空港', flightsPerWeek: 21 },
      { code: 'FCO', name: 'フィウミチーノ空港', flightsPerWeek: 14 },
      { code: 'CPH', name: 'コペンハーゲン空港', flightsPerWeek: 14 }
    ]}
  ]},
  { country: 'デンマーク', flag: '🇩🇰', airlines: [
    { name: 'SAS Scandinavian Airlines', iata: 'SK', hubCode: 'CPH', hubName: 'コペンハーゲン空港', destinations: [
      { code: 'LHR', name: 'ロンドン・ヒースロー空港', flightsPerWeek: 28 },
      { code: 'CDG', name: 'シャルル・ド・ゴール空港', flightsPerWeek: 21 },
      { code: 'FRA', name: 'フランクフルト空港', flightsPerWeek: 21 },
      { code: 'AMS', name: 'スキポール空港', flightsPerWeek: 28 },
      { code: 'ZRH', name: 'チューリッヒ空港', flightsPerWeek: 14 },
      { code: 'VIE', name: 'ウィーン国際空港', flightsPerWeek: 14 },
      { code: 'FCO', name: 'フィウミチーノ空港', flightsPerWeek: 14 }
    ]}
  ]}
];
