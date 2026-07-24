export type AirlineDestination = { code: string; name: string; flightsPerWeek: number };
export type Airline = { name: string; iata: string; hubCode: string; hubName: string; destinations: AirlineDestination[] };
export type CountryAirlines = { country: string; flag: string; airlines: Airline[] };

// 便数(週)は主要路線のおおまかな目安であり、季節・年度により変動する概算値。
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
      { code: 'BKK', name: 'スワンナプーム国際空港', flightsPerWeek: 14 },
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
  { country: 'アメリカ', flag: '🇺🇸', airlines: [
    { name: 'American Airlines', iata: 'AA', hubCode: 'DFW', hubName: 'ダラス・フォートワース国際空港', destinations: [
      { code: 'LHR', name: 'ロンドン・ヒースロー空港', flightsPerWeek: 14 },
      { code: 'NRT', name: '成田国際空港', flightsPerWeek: 7 }
    ]},
    { name: 'Delta Air Lines', iata: 'DL', hubCode: 'ATL', hubName: 'ハーツフィールド・ジャクソン・アトランタ国際空港', destinations: [
      { code: 'CDG', name: 'シャルル・ド・ゴール空港', flightsPerWeek: 7 },
      { code: 'NRT', name: '成田国際空港', flightsPerWeek: 7 },
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
      { code: 'NRT', name: '成田国際空港', flightsPerWeek: 7 },
      { code: 'SIN', name: 'チャンギ空港(シンガポール)', flightsPerWeek: 7 },
      { code: 'DXB', name: 'ドバイ国際空港', flightsPerWeek: 14 }
    ]}
  ]},
  { country: 'フランス', flag: '🇫🇷', airlines: [
    { name: 'Air France', iata: 'AF', hubCode: 'CDG', hubName: 'シャルル・ド・ゴール空港', destinations: [
      { code: 'JFK', name: 'ジョン・F・ケネディ国際空港', flightsPerWeek: 14 },
      { code: 'NRT', name: '成田国際空港', flightsPerWeek: 7 },
      { code: 'ICN', name: '仁川国際空港(ソウル)', flightsPerWeek: 7 }
    ]}
  ]},
  { country: 'ドイツ', flag: '🇩🇪', airlines: [
    { name: 'Lufthansa', iata: 'LH', hubCode: 'FRA', hubName: 'フランクフルト空港', destinations: [
      { code: 'JFK', name: 'ジョン・F・ケネディ国際空港', flightsPerWeek: 14 },
      { code: 'NRT', name: '成田国際空港', flightsPerWeek: 7 },
      { code: 'PEK', name: '北京首都国際空港', flightsPerWeek: 7 },
      { code: 'SIN', name: 'チャンギ空港(シンガポール)', flightsPerWeek: 7 }
    ]}
  ]},
  { country: 'オランダ', flag: '🇳🇱', airlines: [
    { name: 'KLM', iata: 'KL', hubCode: 'AMS', hubName: 'スキポール空港', destinations: [
      { code: 'NRT', name: '成田国際空港', flightsPerWeek: 7 },
      { code: 'ICN', name: '仁川国際空港(ソウル)', flightsPerWeek: 7 },
      { code: 'JFK', name: 'ジョン・F・ケネディ国際空港', flightsPerWeek: 14 }
    ]}
  ]},
  { country: 'アラブ首長国連邦', flag: '🇦🇪', airlines: [
    { name: 'Emirates', iata: 'EK', hubCode: 'DXB', hubName: 'ドバイ国際空港', destinations: [
      { code: 'LHR', name: 'ロンドン・ヒースロー空港', flightsPerWeek: 21 },
      { code: 'NRT', name: '成田国際空港', flightsPerWeek: 7 },
      { code: 'JFK', name: 'ジョン・F・ケネディ国際空港', flightsPerWeek: 14 },
      { code: 'SYD', name: 'シドニー国際空港', flightsPerWeek: 7 },
      { code: 'SIN', name: 'チャンギ空港(シンガポール)', flightsPerWeek: 14 }
    ]}
  ]},
  { country: 'カタール', flag: '🇶🇦', airlines: [
    { name: 'Qatar Airways', iata: 'QR', hubCode: 'DOH', hubName: 'ハマド国際空港', destinations: [
      { code: 'LHR', name: 'ロンドン・ヒースロー空港', flightsPerWeek: 21 },
      { code: 'NRT', name: '成田国際空港', flightsPerWeek: 7 },
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
      { code: 'NRT', name: '成田国際空港', flightsPerWeek: 3 }
    ]}
  ]},
  { country: 'スペイン', flag: '🇪🇸', airlines: [
    { name: 'Iberia', iata: 'IB', hubCode: 'MAD', hubName: 'マドリード・バラハス空港', destinations: [
      { code: 'JFK', name: 'ジョン・F・ケネディ国際空港', flightsPerWeek: 14 },
      { code: 'LAX', name: 'ロサンゼルス国際空港', flightsPerWeek: 7 }
    ]}
  ]}
];
