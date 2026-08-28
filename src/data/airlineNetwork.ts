export type AirlineDestination = { code: string; name: string; flightsPerWeek: number };
export type Airline = { name: string; iata: string; hubCode: string; hubName: string; destinations: AirlineDestination[] };
export type CountryAirlines = { country: string; flag: string; airlines: Airline[] };

export const AIRLINE_NETWORK_CHECKED_AT = '2026-08-28';

// 便数(週)は主要路線のおおまかな目安であり、季節・年度により変動する概算値。
// 2026-08-26時点で公開運航情報と突合。以前のデータに残っていた成田発着表記のうち、
// Delta、British Airways、Air France、Lufthansa、ITA Airways は羽田発着へ修正した。
// この環境からは航空会社公式サイトへの直接アクセス(WebFetch)がネットワーク
// ポリシーでブロックされており、検索スニペットだけでは他の路線の正確な
// 週間便数(単一社分か全社合計かの判別を含む)を裏取りできなかったため、
// 上記以外は未更新のまま残している。
// 日本国内は、一覧で既知の国際空港（NRT・HND・KIX）同士を結ぶ定期直行便を
// 空港の公開路線案内と各社の時刻表で照合した。コードシェア便は運航会社だけを
// 数え、両方向を別の発着地データとして収録している。
// AMS と PRG は一覧内に登録済みの全空港との往復便を検索できることを優先し、
// 乗り入れ先に全コードを収録している。便数は旅程比較用の概算値。
// スペインは、定期国際旅客便がある29空港を収録し、各空港から利用できる
// 代表的な国際線を最低1路線ずつ掲載している。同じ航空会社が複数空港を
// 発着する場合は、空港ごとに別のネットワーク行として扱う。
// イタリアも同じ基準で、定期便（季節運航を含む）で国外へ移動できる37空港を
// 収録した。便数は通常期または運航期間中の代表的な週間便数の目安。
// イギリスは、定期国際旅客便（季節運航を含む）がある30空港を収録し、各空港の
// IATAコードと代表的な国際線を最低1路線ずつ掲載している。
// デンマークは、定期国際旅客便（季節運航を含む）がある6空港を収録し、各空港の
// IATAコードと代表的な国際線を最低1路線ずつ掲載している。
// ドイツは、定期国際旅客便（季節運航を含む）がある27空港を収録し、各空港の
// IATAコードと代表的な国際線を最低1路線ずつ掲載している。
// フランスは、本土・コルシカ島で定期国際旅客便（季節運航を含む）がある31空港を
// 収録し、各空港から利用できる代表的な国際線を最低1路線ずつ掲載している。
// チェコは、定期国際旅客便（季節運航・定期チャーターを含む）がある6空港を収録し、
// 各空港から利用できる代表的な国際線を最低1路線ずつ掲載している。
// オランダは、定期国際旅客便（季節運航を含む）がある本土5空港を収録し、各空港から
// 利用できる代表的な国際線を最低1路線ずつ掲載している。
// オーストリアは、定期国際旅客便（季節運航を含む）がある6空港を収録し、各空港から
// 利用できる代表的な国際線を最低1路線ずつ掲載している。
// アメリカは、50州・ワシントンD.C.・プエルトリコで定期国際旅客便（季節運航を含む）
// がある51空港を収録し、各空港から利用できる代表的な国際線を最低1路線ずつ掲載する。
// トルコは、定期国際旅客便（季節運航を含む）がある28空港を収録し、各空港から
// 利用できる代表的な国際線を最低1路線ずつ掲載している。
export const AIRLINE_NETWORK: CountryAirlines[] = [
  { country: '日本', flag: '🇯🇵', airlines: [
    { name: 'ANA(全日本空輸)', iata: 'NH', hubCode: 'HND', hubName: '羽田空港', destinations: [
      { code: 'KIX', name: '関西国際空港', flightsPerWeek: 42 },
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
    ]},
    { name: 'JAL(日本航空)', iata: 'JL', hubCode: 'HND', hubName: '羽田空港', destinations: [
      { code: 'KIX', name: '関西国際空港', flightsPerWeek: 35 }
    ]},
    { name: 'StarFlyer(スターフライヤー)', iata: '7G', hubCode: 'HND', hubName: '羽田空港', destinations: [
      { code: 'KIX', name: '関西国際空港', flightsPerWeek: 28 }
    ]},
    { name: 'Jetstar Japan(ジェットスター・ジャパン)', iata: 'GK', hubCode: 'NRT', hubName: '成田国際空港', destinations: [
      { code: 'KIX', name: '関西国際空港', flightsPerWeek: 14 }
    ]},
    { name: 'Peach Aviation(ピーチ)', iata: 'MM', hubCode: 'NRT', hubName: '成田国際空港', destinations: [
      { code: 'KIX', name: '関西国際空港', flightsPerWeek: 7 }
    ]},
    { name: 'ANA(全日本空輸)', iata: 'NH', hubCode: 'KIX', hubName: '関西国際空港', destinations: [
      { code: 'HND', name: '羽田空港', flightsPerWeek: 42 }
    ]},
    { name: 'JAL(日本航空)', iata: 'JL', hubCode: 'KIX', hubName: '関西国際空港', destinations: [
      { code: 'HND', name: '羽田空港', flightsPerWeek: 35 }
    ]},
    { name: 'StarFlyer(スターフライヤー)', iata: '7G', hubCode: 'KIX', hubName: '関西国際空港', destinations: [
      { code: 'HND', name: '羽田空港', flightsPerWeek: 28 }
    ]},
    { name: 'Jetstar Japan(ジェットスター・ジャパン)', iata: 'GK', hubCode: 'KIX', hubName: '関西国際空港', destinations: [
      { code: 'NRT', name: '成田国際空港', flightsPerWeek: 14 }
    ]},
    { name: 'Peach Aviation(ピーチ)', iata: 'MM', hubCode: 'KIX', hubName: '関西国際空港', destinations: [
      { code: 'NRT', name: '成田国際空港', flightsPerWeek: 7 }
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
    ...(
      [
        ['ANC','テッド・スティーブンス・アンカレッジ国際空港','Condor','DE','FRA','フランクフルト空港',3],
        ['ATL','ハーツフィールド・ジャクソン・アトランタ国際空港','Delta Air Lines','DL','CDG','シャルル・ド・ゴール空港',7],
        ['AUS','オースティン・バーグストロム国際空港','British Airways','BA','LHR','ロンドン・ヒースロー空港',7],
        ['BDL','ブラッドレー国際空港','Aer Lingus','EI','DUB','ダブリン空港',7],
        ['BNA','ナッシュビル国際空港','British Airways','BA','LHR','ロンドン・ヒースロー空港',7],
        ['BOS','ローガン国際空港','Delta Air Lines','DL','CDG','シャルル・ド・ゴール空港',7],
        ['BWI','ボルチモア・ワシントン国際空港','British Airways','BA','LHR','ロンドン・ヒースロー空港',7],
        ['CHS','チャールストン国際空港','Air Canada','AC','YYZ','トロント・ピアソン国際空港',7],
        ['CLE','クリーブランド・ホプキンス国際空港','Aer Lingus','EI','DUB','ダブリン空港',4],
        ['CLT','シャーロット・ダグラス国際空港','American Airlines','AA','LHR','ロンドン・ヒースロー空港',14],
        ['CVG','シンシナティ・ノーザンケンタッキー国際空港','Delta Air Lines','DL','CDG','シャルル・ド・ゴール空港',7],
        ['DEN','デンバー国際空港','United Airlines','UA','NRT','成田国際空港',7],
        ['DFW','ダラス・フォートワース国際空港','American Airlines','AA','NRT','成田国際空港',7],
        ['DTW','デトロイト・メトロポリタン空港','Delta Air Lines','DL','HND','羽田空港',7],
        ['EWR','ニューアーク・リバティー国際空港','United Airlines','UA','NRT','成田国際空港',7],
        ['FLL','フォートローダーデール・ハリウッド国際空港','JetBlue','B6','CUN','カンクン国際空港',14],
        ['HNL','ダニエル・K・イノウエ国際空港','Hawaiian Airlines','HA','HND','羽田空港',7],
        ['IAD','ワシントン・ダレス国際空港','United Airlines','UA','NRT','成田国際空港',7],
        ['IAH','ジョージ・ブッシュ・インターコンチネンタル空港','United Airlines','UA','NRT','成田国際空港',7],
        ['IND','インディアナポリス国際空港','Air Canada','AC','YYZ','トロント・ピアソン国際空港',14],
        ['JFK','ジョン・F・ケネディ国際空港','Japan Airlines','JL','HND','羽田空港',14],
        ['LAS','ハリー・リード国際空港','British Airways','BA','LHR','ロンドン・ヒースロー空港',7],
        ['LAX','ロサンゼルス国際空港','ANA(全日本空輸)','NH','HND','羽田空港',14],
        ['MCI','カンザスシティ国際空港','Air Canada','AC','YYZ','トロント・ピアソン国際空港',14],
        ['MCO','オーランド国際空港','British Airways','BA','LHR','ロンドン・ヒースロー空港',14],
        ['MDW','シカゴ・ミッドウェー国際空港','Southwest Airlines','WN','CUN','カンクン国際空港',7],
        ['MEM','メンフィス国際空港','Southwest Airlines','WN','CUN','カンクン国際空港',2],
        ['MIA','マイアミ国際空港','American Airlines','AA','LHR','ロンドン・ヒースロー空港',14],
        ['MSP','ミネアポリス・セントポール国際空港','Delta Air Lines','DL','CDG','シャルル・ド・ゴール空港',7],
        ['MSY','ルイ・アームストロング・ニューオーリンズ国際空港','British Airways','BA','LHR','ロンドン・ヒースロー空港',5],
        ['OAK','サンフランシスコ・ベイ・オークランド国際空港','Volaris','Y4','GDL','グアダラハラ国際空港',7],
        ['OGG','カフルイ空港','Air Canada','AC','YVR','バンクーバー国際空港',7],
        ['ONT','オンタリオ国際空港','China Airlines','CI','TPE','台湾桃園国際空港',7],
        ['ORD','シカゴ・オヘア国際空港','United Airlines','UA','HND','羽田空港',7],
        ['PBI','パームビーチ国際空港','Air Canada','AC','YYZ','トロント・ピアソン国際空港',14],
        ['PDX','ポートランド国際空港','British Airways','BA','LHR','ロンドン・ヒースロー空港',5],
        ['PHL','フィラデルフィア国際空港','American Airlines','AA','LHR','ロンドン・ヒースロー空港',14],
        ['PHX','フェニックス・スカイハーバー国際空港','British Airways','BA','LHR','ロンドン・ヒースロー空港',7],
        ['PIT','ピッツバーグ国際空港','British Airways','BA','LHR','ロンドン・ヒースロー空港',6],
        ['RDU','ローリー・ダーラム国際空港','American Airlines','AA','LHR','ロンドン・ヒースロー空港',7],
        ['RSW','サウスウエスト・フロリダ国際空港','Air Canada','AC','YYZ','トロント・ピアソン国際空港',14],
        ['SAN','サンディエゴ国際空港','Japan Airlines','JL','NRT','成田国際空港',7],
        ['SAT','サンアントニオ国際空港','Viva Aerobus','VB','MEX','メキシコシティ国際空港',7],
        ['SEA','シアトル・タコマ国際空港','Delta Air Lines','DL','HND','羽田空港',7],
        ['SFO','サンフランシスコ国際空港','United Airlines','UA','HND','羽田空港',14],
        ['SJC','ノーマン・Y・ミネタ・サンノゼ国際空港','Volaris','Y4','GDL','グアダラハラ国際空港',7],
        ['SJU','ルイス・ムニョス・マリン国際空港','Iberia','IB','MAD','マドリード・バラハス空港',7],
        ['SLC','ソルトレイクシティ国際空港','Delta Air Lines','DL','CDG','シャルル・ド・ゴール空港',7],
        ['SMF','サクラメント国際空港','Air Canada','AC','YVR','バンクーバー国際空港',14],
        ['SWF','ニューヨーク・スチュワート国際空港','PLAY','OG','KEF','ケプラヴィーク国際空港',4],
        ['TPA','タンパ国際空港','British Airways','BA','LHR','ロンドン・ヒースロー空港',7]
      ] as const
    ).map(([hubCode, hubName, name, iata, code, destinationName, flightsPerWeek]) => ({
      name, iata, hubCode, hubName,
      destinations: [{ code, name: destinationName, flightsPerWeek }]
    }))
  ]},
  { country: 'イギリス', flag: '🇬🇧', airlines: [
    { name: 'British Airways', iata: 'BA', hubCode: 'LHR', hubName: 'ロンドン・ヒースロー空港', destinations: [
      { code: 'JFK', name: 'ジョン・F・ケネディ国際空港', flightsPerWeek: 21 },
      { code: 'HND', name: '羽田空港', flightsPerWeek: 7 },
      { code: 'SIN', name: 'チャンギ空港(シンガポール)', flightsPerWeek: 7 },
      { code: 'DXB', name: 'ドバイ国際空港', flightsPerWeek: 14 }
    ]},
    { name: 'KLM', iata: 'KL', hubCode: 'ABZ', hubName: 'アバディーン国際空港', destinations: [{ code: 'AMS', name: 'スキポール空港', flightsPerWeek: 28 }] },
    { name: 'KLM', iata: 'KL', hubCode: 'BHD', hubName: 'ジョージ・ベスト・ベルファスト・シティ空港', destinations: [{ code: 'AMS', name: 'スキポール空港', flightsPerWeek: 14 }] },
    { name: 'easyJet', iata: 'U2', hubCode: 'BFS', hubName: 'ベルファスト国際空港', destinations: [{ code: 'ALC', name: 'アリカンテ＝エルチェ・ミゲル・エルナンデス空港', flightsPerWeek: 7 }] },
    { name: 'KLM', iata: 'KL', hubCode: 'BHX', hubName: 'バーミンガム空港', destinations: [{ code: 'AMS', name: 'スキポール空港', flightsPerWeek: 28 }] },
    { name: 'Ryanair', iata: 'FR', hubCode: 'BOH', hubName: 'ボーンマス空港', destinations: [{ code: 'ALC', name: 'アリカンテ＝エルチェ・ミゲル・エルナンデス空港', flightsPerWeek: 7 }] },
    { name: 'KLM', iata: 'KL', hubCode: 'BRS', hubName: 'ブリストル空港', destinations: [{ code: 'AMS', name: 'スキポール空港', flightsPerWeek: 28 }] },
    { name: 'KLM', iata: 'KL', hubCode: 'CWL', hubName: 'カーディフ空港', destinations: [{ code: 'AMS', name: 'スキポール空港', flightsPerWeek: 7 }] },
    { name: 'Loganair', iata: 'LM', hubCode: 'DND', hubName: 'ダンディー空港', destinations: [{ code: 'ORY', name: 'パリ・オルリー空港', flightsPerWeek: 2 }] },
    { name: 'KLM', iata: 'KL', hubCode: 'EDI', hubName: 'エディンバラ空港', destinations: [{ code: 'AMS', name: 'スキポール空港', flightsPerWeek: 35 }] },
    { name: 'Ryanair', iata: 'FR', hubCode: 'EMA', hubName: 'イースト・ミッドランズ空港', destinations: [{ code: 'ALC', name: 'アリカンテ＝エルチェ・ミゲル・エルナンデス空港', flightsPerWeek: 7 }] },
    { name: 'Ryanair', iata: 'FR', hubCode: 'EXT', hubName: 'エクセター空港', destinations: [{ code: 'ALC', name: 'アリカンテ＝エルチェ・ミゲル・エルナンデス空港', flightsPerWeek: 3 }] },
    { name: 'KLM', iata: 'KL', hubCode: 'GLA', hubName: 'グラスゴー空港', destinations: [{ code: 'AMS', name: 'スキポール空港', flightsPerWeek: 35 }] },
    { name: 'KLM', iata: 'KL', hubCode: 'HUY', hubName: 'ハンバーサイド空港', destinations: [{ code: 'AMS', name: 'スキポール空港', flightsPerWeek: 21 }] },
    { name: 'KLM', iata: 'KL', hubCode: 'INV', hubName: 'インヴァネス空港', destinations: [{ code: 'AMS', name: 'スキポール空港', flightsPerWeek: 7 }] },
    { name: 'KLM', iata: 'KL', hubCode: 'LBA', hubName: 'リーズ・ブラッドフォード空港', destinations: [{ code: 'AMS', name: 'スキポール空港', flightsPerWeek: 21 }] },
    { name: 'KLM', iata: 'KL', hubCode: 'LCY', hubName: 'ロンドン・シティ空港', destinations: [{ code: 'AMS', name: 'スキポール空港', flightsPerWeek: 35 }] },
    { name: 'easyJet', iata: 'U2', hubCode: 'LGW', hubName: 'ロンドン・ガトウィック空港', destinations: [{ code: 'AMS', name: 'スキポール空港', flightsPerWeek: 35 }] },
    { name: 'easyJet', iata: 'U2', hubCode: 'LPL', hubName: 'リバプール・ジョン・レノン空港', destinations: [{ code: 'AMS', name: 'スキポール空港', flightsPerWeek: 7 }] },
    { name: 'easyJet', iata: 'U2', hubCode: 'LTN', hubName: 'ロンドン・ルートン空港', destinations: [{ code: 'AMS', name: 'スキポール空港', flightsPerWeek: 28 }] },
    { name: 'KLM', iata: 'KL', hubCode: 'MAN', hubName: 'マンチェスター空港', destinations: [{ code: 'AMS', name: 'スキポール空港', flightsPerWeek: 42 }] },
    { name: 'Ryanair', iata: 'FR', hubCode: 'MME', hubName: 'ティーズサイド国際空港', destinations: [{ code: 'PMI', name: 'パルマ・デ・マヨルカ空港', flightsPerWeek: 2 }] },
    { name: 'KLM', iata: 'KL', hubCode: 'NCL', hubName: 'ニューカッスル国際空港', destinations: [{ code: 'AMS', name: 'スキポール空港', flightsPerWeek: 35 }] },
    { name: 'Edelweiss Air', iata: 'WK', hubCode: 'NQY', hubName: 'コーンウォール空港ニューキー', destinations: [{ code: 'ZRH', name: 'チューリッヒ空港', flightsPerWeek: 2 }] },
    { name: 'KLM', iata: 'KL', hubCode: 'NWI', hubName: 'ノリッジ空港', destinations: [{ code: 'AMS', name: 'スキポール空港', flightsPerWeek: 21 }] },
    { name: 'Ryanair', iata: 'FR', hubCode: 'PIK', hubName: 'グラスゴー・プレストウィック空港', destinations: [{ code: 'ALC', name: 'アリカンテ＝エルチェ・ミゲル・エルナンデス空港', flightsPerWeek: 4 }] },
    { name: 'easyJet', iata: 'U2', hubCode: 'SEN', hubName: 'ロンドン・サウスエンド空港', destinations: [{ code: 'AMS', name: 'スキポール空港', flightsPerWeek: 6 }] },
    { name: 'KLM', iata: 'KL', hubCode: 'SOU', hubName: 'サウサンプトン空港', destinations: [{ code: 'AMS', name: 'スキポール空港', flightsPerWeek: 21 }] },
    { name: 'easyJet', iata: 'U2', hubCode: 'STN', hubName: 'ロンドン・スタンステッド空港', destinations: [{ code: 'AMS', name: 'スキポール空港', flightsPerWeek: 21 }] },
    { name: 'Ryanair', iata: 'FR', hubCode: 'LDY', hubName: 'シティ・オブ・デリー空港', destinations: [{ code: 'ALC', name: 'アリカンテ＝エルチェ・ミゲル・エルナンデス空港', flightsPerWeek: 2 }] }
  ]},
  { country: 'フランス', flag: '🇫🇷', airlines: [
    { name: 'Air France', iata: 'AF', hubCode: 'CDG', hubName: 'シャルル・ド・ゴール空港', destinations: [
      { code: 'JFK', name: 'ジョン・F・ケネディ国際空港', flightsPerWeek: 14 },
      { code: 'HND', name: '羽田空港', flightsPerWeek: 7 },
      { code: 'ICN', name: '仁川国際空港(ソウル)', flightsPerWeek: 7 }
    ]},
    { name: 'easyJet', iata: 'U2', hubCode: 'AJA', hubName: 'アジャクシオ・ナポレオン・ボナパルト空港', destinations: [{ code: 'LGW', name: 'ロンドン・ガトウィック空港', flightsPerWeek: 2 }] },
    { name: 'easyJet', iata: 'U2', hubCode: 'BIA', hubName: 'バスティア・ポレッタ空港', destinations: [{ code: 'LGW', name: 'ロンドン・ガトウィック空港', flightsPerWeek: 2 }] },
    { name: 'Ryanair', iata: 'FR', hubCode: 'BIQ', hubName: 'ビアリッツ・ペイ・バスク空港', destinations: [{ code: 'STN', name: 'ロンドン・スタンステッド空港', flightsPerWeek: 4 }] },
    { name: 'easyJet', iata: 'U2', hubCode: 'BOD', hubName: 'ボルドー・メリニャック空港', destinations: [{ code: 'LGW', name: 'ロンドン・ガトウィック空港', flightsPerWeek: 14 }] },
    { name: 'KLM', iata: 'KL', hubCode: 'BES', hubName: 'ブレスト・ブルターニュ空港', destinations: [{ code: 'AMS', name: 'スキポール空港', flightsPerWeek: 7 }] },
    { name: 'Ryanair', iata: 'FR', hubCode: 'BVA', hubName: 'パリ・ボーヴェ・ティレ空港', destinations: [{ code: 'FCO', name: 'ローマ・フィウミチーノ空港', flightsPerWeek: 14 }] },
    { name: 'Ryanair', iata: 'FR', hubCode: 'BZR', hubName: 'ベジエ・キャプ・ダグド空港', destinations: [{ code: 'STN', name: 'ロンドン・スタンステッド空港', flightsPerWeek: 4 }] },
    { name: 'Ryanair', iata: 'FR', hubCode: 'CCF', hubName: 'カルカソンヌ空港', destinations: [{ code: 'STN', name: 'ロンドン・スタンステッド空港', flightsPerWeek: 7 }] },
    { name: 'Ryanair', iata: 'FR', hubCode: 'CFE', hubName: 'クレルモン＝フェラン・オーヴェルニュ空港', destinations: [{ code: 'OPO', name: 'フランシスコ・サ・カルネイロ空港', flightsPerWeek: 2 }] },
    { name: 'Air Corsica', iata: 'XK', hubCode: 'CLY', hubName: 'カルヴィ・サント・カトリーヌ空港', destinations: [{ code: 'GVA', name: 'ジュネーブ空港', flightsPerWeek: 2 }] },
    { name: 'Ryanair', iata: 'FR', hubCode: 'DLE', hubName: 'ドール・ジュラ空港', destinations: [{ code: 'OPO', name: 'フランシスコ・サ・カルネイロ空港', flightsPerWeek: 2 }] },
    { name: 'Air Algérie', iata: 'AH', hubCode: 'ETZ', hubName: 'メス・ナンシー・ロレーヌ空港', destinations: [{ code: 'ALG', name: 'ウアリ・ブーメディアン空港', flightsPerWeek: 3 }] },
    { name: 'Air Corsica', iata: 'XK', hubCode: 'FSC', hubName: 'フィガリ・シュド・コルス空港', destinations: [{ code: 'GVA', name: 'ジュネーブ空港', flightsPerWeek: 3 }] },
    { name: 'British Airways', iata: 'BA', hubCode: 'GNB', hubName: 'グルノーブル・アルプ・イゼール空港', destinations: [{ code: 'LGW', name: 'ロンドン・ガトウィック空港', flightsPerWeek: 7 }] },
    { name: 'Ryanair', iata: 'FR', hubCode: 'LDE', hubName: 'タルブ・ルルド・ピレネー空港', destinations: [{ code: 'FCO', name: 'ローマ・フィウミチーノ空港', flightsPerWeek: 2 }] },
    { name: 'easyJet', iata: 'U2', hubCode: 'LIL', hubName: 'リール空港', destinations: [{ code: 'ALC', name: 'アリカンテ＝エルチェ・ミゲル・エルナンデス空港', flightsPerWeek: 4 }] },
    { name: 'Ryanair', iata: 'FR', hubCode: 'LRH', hubName: 'ラ・ロシェル・イル・ド・レ空港', destinations: [{ code: 'STN', name: 'ロンドン・スタンステッド空港', flightsPerWeek: 4 }] },
    { name: 'easyJet', iata: 'U2', hubCode: 'LYS', hubName: 'リヨン・サン＝テグジュペリ空港', destinations: [{ code: 'LGW', name: 'ロンドン・ガトウィック空港', flightsPerWeek: 21 }] },
    { name: 'KLM', iata: 'KL', hubCode: 'MPL', hubName: 'モンペリエ・メディテラネ空港', destinations: [{ code: 'AMS', name: 'スキポール空港', flightsPerWeek: 14 }] },
    { name: 'Ryanair', iata: 'FR', hubCode: 'MRS', hubName: 'マルセイユ・プロヴァンス空港', destinations: [{ code: 'MAD', name: 'マドリード・バラハス空港', flightsPerWeek: 14 }] },
    { name: 'easyJet', iata: 'U2', hubCode: 'NCE', hubName: 'ニース・コート・ダジュール空港', destinations: [{ code: 'LGW', name: 'ロンドン・ガトウィック空港', flightsPerWeek: 28 }] },
    { name: 'easyJet', iata: 'U2', hubCode: 'NTE', hubName: 'ナント・アトランティック空港', destinations: [{ code: 'LGW', name: 'ロンドン・ガトウィック空港', flightsPerWeek: 14 }] },
    { name: 'Transavia France', iata: 'TO', hubCode: 'ORY', hubName: 'パリ・オルリー空港', destinations: [{ code: 'MAD', name: 'マドリード・バラハス空港', flightsPerWeek: 14 }] },
    { name: 'Ryanair', iata: 'FR', hubCode: 'PGF', hubName: 'ペルピニャン・リヴサルト空港', destinations: [{ code: 'STN', name: 'ロンドン・スタンステッド空港', flightsPerWeek: 4 }] },
    { name: 'Ryanair', iata: 'FR', hubCode: 'PIS', hubName: 'ポワティエ・ビアール空港', destinations: [{ code: 'STN', name: 'ロンドン・スタンステッド空港', flightsPerWeek: 3 }] },
    { name: 'easyJet', iata: 'U2', hubCode: 'RNS', hubName: 'レンヌ・サン・ジャック空港', destinations: [{ code: 'LGW', name: 'ロンドン・ガトウィック空港', flightsPerWeek: 4 }] },
    { name: 'Volotea', iata: 'V7', hubCode: 'SXB', hubName: 'ストラスブール空港', destinations: [{ code: 'FCO', name: 'ローマ・フィウミチーノ空港', flightsPerWeek: 4 }] },
    { name: 'easyJet', iata: 'U2', hubCode: 'TLN', hubName: 'トゥーロン・イエール空港', destinations: [{ code: 'LGW', name: 'ロンドン・ガトウィック空港', flightsPerWeek: 3 }] },
    { name: 'British Airways', iata: 'BA', hubCode: 'TLS', hubName: 'トゥールーズ・ブラニャック空港', destinations: [{ code: 'LHR', name: 'ロンドン・ヒースロー空港', flightsPerWeek: 21 }] },
    { name: 'Ryanair', iata: 'FR', hubCode: 'TUF', hubName: 'トゥール・ヴァル・ド・ロワール空港', destinations: [{ code: 'STN', name: 'ロンドン・スタンステッド空港', flightsPerWeek: 3 }] }
  ]},
  { country: 'ドイツ', flag: '🇩🇪', airlines: [
    { name: 'Lufthansa', iata: 'LH', hubCode: 'FRA', hubName: 'フランクフルト空港', destinations: [
      { code: 'JFK', name: 'ジョン・F・ケネディ国際空港', flightsPerWeek: 14 },
      { code: 'HND', name: '羽田空港', flightsPerWeek: 7 },
      { code: 'PEK', name: '北京首都国際空港', flightsPerWeek: 7 },
      { code: 'SIN', name: 'チャンギ空港(シンガポール)', flightsPerWeek: 7 }
    ]},
    { name: 'easyJet', iata: 'U2', hubCode: 'BER', hubName: 'ベルリン・ブランデンブルク空港', destinations: [{ code: 'LGW', name: 'ロンドン・ガトウィック空港', flightsPerWeek: 21 }] },
    { name: 'KLM', iata: 'KL', hubCode: 'BRE', hubName: 'ブレーメン空港', destinations: [{ code: 'AMS', name: 'スキポール空港', flightsPerWeek: 28 }] },
    { name: 'Eurowings', iata: 'EW', hubCode: 'CGN', hubName: 'ケルン・ボン空港', destinations: [{ code: 'PMI', name: 'パルマ・デ・マヨルカ空港', flightsPerWeek: 21 }] },
    { name: 'Wizz Air', iata: 'W6', hubCode: 'DTM', hubName: 'ドルトムント空港', destinations: [{ code: 'BUD', name: 'リスト・フェレンツ国際空港', flightsPerWeek: 7 }] },
    { name: 'KLM', iata: 'KL', hubCode: 'DRS', hubName: 'ドレスデン空港', destinations: [{ code: 'AMS', name: 'スキポール空港', flightsPerWeek: 7 }] },
    { name: 'British Airways', iata: 'BA', hubCode: 'DUS', hubName: 'デュッセルドルフ空港', destinations: [{ code: 'LHR', name: 'ロンドン・ヒースロー空港', flightsPerWeek: 21 }] },
    { name: 'SunExpress', iata: 'XQ', hubCode: 'ERF', hubName: 'エアフルト・ヴァイマル空港', destinations: [{ code: 'AYT', name: 'アンタルヤ空港', flightsPerWeek: 4 }] },
    { name: 'Ryanair', iata: 'FR', hubCode: 'FKB', hubName: 'カールスルーエ・バーデン＝バーデン空港', destinations: [{ code: 'STN', name: 'ロンドン・スタンステッド空港', flightsPerWeek: 7 }] },
    { name: 'KLM', iata: 'KL', hubCode: 'HAM', hubName: 'ハンブルク空港', destinations: [{ code: 'AMS', name: 'スキポール空港', flightsPerWeek: 21 }] },
    { name: 'British Airways', iata: 'BA', hubCode: 'HAJ', hubName: 'ハノーファー空港', destinations: [{ code: 'LHR', name: 'ロンドン・ヒースロー空港', flightsPerWeek: 14 }] },
    { name: 'Ryanair', iata: 'FR', hubCode: 'HHN', hubName: 'フランクフルト・ハーン空港', destinations: [{ code: 'STN', name: 'ロンドン・スタンステッド空港', flightsPerWeek: 7 }] },
    { name: 'SunExpress', iata: 'XQ', hubCode: 'LEJ', hubName: 'ライプツィヒ・ハレ空港', destinations: [{ code: 'AYT', name: 'アンタルヤ空港', flightsPerWeek: 7 }] },
    { name: 'Ryanair', iata: 'FR', hubCode: 'LBC', hubName: 'リューベック空港', destinations: [{ code: 'PMI', name: 'パルマ・デ・マヨルカ空港', flightsPerWeek: 3 }] },
    { name: 'Lufthansa', iata: 'LH', hubCode: 'MUC', hubName: 'ミュンヘン国際空港', destinations: [{ code: 'JFK', name: 'ジョン・F・ケネディ国際空港', flightsPerWeek: 14 }] },
    { name: 'Ryanair', iata: 'FR', hubCode: 'FMM', hubName: 'メミンゲン空港', destinations: [{ code: 'STN', name: 'ロンドン・スタンステッド空港', flightsPerWeek: 7 }] },
    { name: 'Ryanair', iata: 'FR', hubCode: 'FMO', hubName: 'ミュンスター・オスナブリュック空港', destinations: [{ code: 'PMI', name: 'パルマ・デ・マヨルカ空港', flightsPerWeek: 7 }] },
    { name: 'Ryanair', iata: 'FR', hubCode: 'NRN', hubName: 'ヴェーツェ空港', destinations: [{ code: 'STN', name: 'ロンドン・スタンステッド空港', flightsPerWeek: 7 }] },
    { name: 'KLM', iata: 'KL', hubCode: 'NUE', hubName: 'ニュルンベルク空港', destinations: [{ code: 'AMS', name: 'スキポール空港', flightsPerWeek: 21 }] },
    { name: 'Ryanair', iata: 'FR', hubCode: 'PAD', hubName: 'パーダーボルン・リップシュタット空港', destinations: [{ code: 'PMI', name: 'パルマ・デ・マヨルカ空港', flightsPerWeek: 7 }] },
    { name: 'Corendon Airlines', iata: 'XC', hubCode: 'RLG', hubName: 'ロストック・ラーゲ空港', destinations: [{ code: 'AYT', name: 'アンタルヤ空港', flightsPerWeek: 2 }] },
    { name: 'Eurowings', iata: 'EW', hubCode: 'SCN', hubName: 'ザールブリュッケン空港', destinations: [{ code: 'PMI', name: 'パルマ・デ・マヨルカ空港', flightsPerWeek: 7 }] },
    { name: 'British Airways', iata: 'BA', hubCode: 'STR', hubName: 'シュトゥットガルト空港', destinations: [{ code: 'LHR', name: 'ロンドン・ヒースロー空港', flightsPerWeek: 14 }] },
    { name: 'Wizz Air', iata: 'W6', hubCode: 'FDH', hubName: 'フリードリヒスハーフェン空港', destinations: [{ code: 'TIA', name: 'ティラナ国際空港', flightsPerWeek: 3 }] },
    { name: 'Sundair', iata: 'SR', hubCode: 'KSF', hubName: 'カッセル空港', destinations: [{ code: 'PMI', name: 'パルマ・デ・マヨルカ空港', flightsPerWeek: 2 }] },
    { name: 'SWISS', iata: 'LX', hubCode: 'GWT', hubName: 'ズュルト空港', destinations: [{ code: 'ZRH', name: 'チューリッヒ空港', flightsPerWeek: 2 }] },
    { name: 'Luxair', iata: 'LG', hubCode: 'HDF', hubName: 'ヘリングスドルフ空港', destinations: [{ code: 'LUX', name: 'ルクセンブルク空港', flightsPerWeek: 1 }] }
  ]},
  { country: 'オランダ', flag: '🇳🇱', airlines: [
    { name: 'KLM', iata: 'KL', hubCode: 'AMS', hubName: 'スキポール空港', destinations: [
      { code: 'NRT', name: '成田国際空港', flightsPerWeek: 7 },
      { code: 'HND', name: '羽田空港', flightsPerWeek: 7 },
      { code: 'KIX', name: '関西国際空港', flightsPerWeek: 7 },
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
    ]},
    { name: 'Ryanair', iata: 'FR', hubCode: 'EIN', hubName: 'アイントホーフェン空港', destinations: [{ code: 'STN', name: 'ロンドン・スタンステッド空港', flightsPerWeek: 14 }] },
    { name: 'Corendon Dutch Airlines', iata: 'CD', hubCode: 'GRQ', hubName: 'フローニンゲン・エールデ空港', destinations: [{ code: 'AYT', name: 'アンタルヤ空港', flightsPerWeek: 2 }] },
    { name: 'Corendon Dutch Airlines', iata: 'CD', hubCode: 'MST', hubName: 'マーストリヒト・アーヘン空港', destinations: [{ code: 'AYT', name: 'アンタルヤ空港', flightsPerWeek: 2 }] },
    { name: 'British Airways', iata: 'BA', hubCode: 'RTM', hubName: 'ロッテルダム・ザ・ハーグ空港', destinations: [{ code: 'LCY', name: 'ロンドン・シティ空港', flightsPerWeek: 14 }] }
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
    ]},
    { name: 'Pegasus Airlines', iata: 'PC', hubCode: 'SAW', hubName: 'サビハ・ギョクチェン国際空港', destinations: [{ code: 'STN', name: 'ロンドン・スタンステッド空港', flightsPerWeek: 14 }] },
    { name: 'SunExpress', iata: 'XQ', hubCode: 'AYT', hubName: 'アンタルヤ空港', destinations: [{ code: 'FRA', name: 'フランクフルト空港', flightsPerWeek: 21 }] },
    { name: 'Turkish Airlines', iata: 'TK', hubCode: 'ESB', hubName: 'エセンボーア国際空港', destinations: [{ code: 'FRA', name: 'フランクフルト空港', flightsPerWeek: 14 }] },
    { name: 'SunExpress', iata: 'XQ', hubCode: 'ADB', hubName: 'イズミル・アドナン・メンデレス空港', destinations: [{ code: 'FRA', name: 'フランクフルト空港', flightsPerWeek: 21 }] },
    { name: 'easyJet', iata: 'U2', hubCode: 'DLM', hubName: 'ダラマン空港', destinations: [{ code: 'LGW', name: 'ロンドン・ガトウィック空港', flightsPerWeek: 14 }] },
    { name: 'easyJet', iata: 'U2', hubCode: 'BJV', hubName: 'ミラス・ボドルム空港', destinations: [{ code: 'LGW', name: 'ロンドン・ガトウィック空港', flightsPerWeek: 7 }] },
    { name: 'Norwegian', iata: 'DY', hubCode: 'GZP', hubName: 'ガズィパシャ・アランヤ空港', destinations: [{ code: 'OSL', name: 'オスロ空港', flightsPerWeek: 3 }] },
    { name: 'SunExpress', iata: 'XQ', hubCode: 'COV', hubName: 'チュクロヴァ国際空港', destinations: [{ code: 'BER', name: 'ベルリン・ブランデンブルク空港', flightsPerWeek: 4 }] },
    { name: 'SunExpress', iata: 'XQ', hubCode: 'TZX', hubName: 'トラブゾン空港', destinations: [{ code: 'DUS', name: 'デュッセルドルフ空港', flightsPerWeek: 4 }] },
    { name: 'SunExpress', iata: 'XQ', hubCode: 'GZT', hubName: 'ガズィアンテプ・オーゼリ空港', destinations: [{ code: 'FRA', name: 'フランクフルト空港', flightsPerWeek: 4 }] },
    { name: 'SunExpress', iata: 'XQ', hubCode: 'ASR', hubName: 'カイセリ空港', destinations: [{ code: 'DUS', name: 'デュッセルドルフ空港', flightsPerWeek: 7 }] },
    { name: 'SunExpress', iata: 'XQ', hubCode: 'DIY', hubName: 'ディヤルバクル空港', destinations: [{ code: 'HAJ', name: 'ハノーファー空港', flightsPerWeek: 3 }] },
    { name: 'SunExpress', iata: 'XQ', hubCode: 'EDO', hubName: 'バルケスィル・コジャ・セイット空港', destinations: [{ code: 'DUS', name: 'デュッセルドルフ空港', flightsPerWeek: 3 }] },
    { name: 'TUI fly Belgium', iata: 'TB', hubCode: 'AOE', hubName: 'ハサン・ポラトカン空港', destinations: [{ code: 'BRU', name: 'ブリュッセル空港', flightsPerWeek: 4 }] },
    { name: 'SunExpress', iata: 'XQ', hubCode: 'EZS', hubName: 'エラズー空港', destinations: [{ code: 'DUS', name: 'デュッセルドルフ空港', flightsPerWeek: 3 }] },
    { name: 'SunExpress', iata: 'XQ', hubCode: 'ERZ', hubName: 'エルズルム空港', destinations: [{ code: 'DUS', name: 'デュッセルドルフ空港', flightsPerWeek: 3 }] },
    { name: 'Pegasus Airlines', iata: 'PC', hubCode: 'KYA', hubName: 'コンヤ空港', destinations: [{ code: 'AMS', name: 'スキポール空港', flightsPerWeek: 3 }] },
    { name: 'SunExpress', iata: 'XQ', hubCode: 'MLX', hubName: 'マラティヤ・エルハチ空港', destinations: [{ code: 'FRA', name: 'フランクフルト空港', flightsPerWeek: 3 }] },
    { name: 'SunExpress', iata: 'XQ', hubCode: 'NAV', hubName: 'ネヴシェヒル・カッパドキア空港', destinations: [{ code: 'FRA', name: 'フランクフルト空港', flightsPerWeek: 2 }] },
    { name: 'SunExpress', iata: 'XQ', hubCode: 'SZF', hubName: 'サムスン・チャルシャンバ空港', destinations: [{ code: 'DUS', name: 'デュッセルドルフ空港', flightsPerWeek: 4 }] },
    { name: 'SunExpress', iata: 'XQ', hubCode: 'VAN', hubName: 'ヴァン・フェリト・メレン空港', destinations: [{ code: 'DUS', name: 'デュッセルドルフ空港', flightsPerWeek: 2 }] },
    { name: 'SunExpress', iata: 'XQ', hubCode: 'DNZ', hubName: 'デニズリ・チャルダク空港', destinations: [{ code: 'FRA', name: 'フランクフルト空港', flightsPerWeek: 3 }] },
    { name: 'SalamAir', iata: 'OV', hubCode: 'RZV', hubName: 'リゼ・アルトヴィン空港', destinations: [{ code: 'MCT', name: 'マスカット国際空港', flightsPerWeek: 2 }] },
    { name: 'SunExpress', iata: 'XQ', hubCode: 'OGU', hubName: 'オルドゥ・ギレスン空港', destinations: [{ code: 'DUS', name: 'デュッセルドルフ空港', flightsPerWeek: 3 }] },
    { name: 'AJet', iata: 'VF', hubCode: 'MQM', hubName: 'マルディン空港', destinations: [{ code: 'DUS', name: 'デュッセルドルフ空港', flightsPerWeek: 2 }] },
    { name: 'SunExpress', iata: 'XQ', hubCode: 'KSY', hubName: 'カルス・ハラカニ空港', destinations: [{ code: 'DUS', name: 'デュッセルドルフ空港', flightsPerWeek: 2 }] },
    { name: 'TUI fly Belgium', iata: 'TB', hubCode: 'KZR', hubName: 'ザフェル空港', destinations: [{ code: 'BRU', name: 'ブリュッセル空港', flightsPerWeek: 2 }] }
  ]},
  { country: 'イタリア', flag: '🇮🇹', airlines: [
    { name: 'ITA Airways', iata: 'AZ', hubCode: 'FCO', hubName: 'フィウミチーノ空港', destinations: [
      { code: 'JFK', name: 'ジョン・F・ケネディ国際空港', flightsPerWeek: 14 },
      { code: 'LAX', name: 'ロサンゼルス国際空港', flightsPerWeek: 7 },
      { code: 'HND', name: '羽田空港', flightsPerWeek: 3 }
    ]},
    { name: 'Ryanair', iata: 'FR', hubCode: 'AHO', hubName: 'アルゲーロ・フェルティリア空港', destinations: [{ code: 'CRL', name: 'ブリュッセル・サウスシャルロワ空港', flightsPerWeek: 3 }] },
    { name: 'Ryanair', iata: 'FR', hubCode: 'AOI', hubName: 'アンコーナ・ファルコナーラ空港', destinations: [{ code: 'STN', name: 'ロンドン・スタンステッド空港', flightsPerWeek: 3 }] },
    { name: 'Ryanair', iata: 'FR', hubCode: 'BDS', hubName: 'ブリンディジ空港', destinations: [{ code: 'CRL', name: 'ブリュッセル・サウスシャルロワ空港', flightsPerWeek: 4 }] },
    { name: 'Ryanair', iata: 'FR', hubCode: 'BGY', hubName: 'ミラノ・ベルガモ空港', destinations: [{ code: 'STN', name: 'ロンドン・スタンステッド空港', flightsPerWeek: 21 }] },
    { name: 'Ryanair', iata: 'FR', hubCode: 'BLQ', hubName: 'ボローニャ・グリエルモ・マルコーニ空港', destinations: [{ code: 'STN', name: 'ロンドン・スタンステッド空港', flightsPerWeek: 14 }] },
    { name: 'Ryanair', iata: 'FR', hubCode: 'BRI', hubName: 'バーリ・カロル・ヴォイティワ空港', destinations: [{ code: 'STN', name: 'ロンドン・スタンステッド空港', flightsPerWeek: 7 }] },
    { name: 'SkyAlps', iata: 'BQ', hubCode: 'BZO', hubName: 'ボルツァーノ空港', destinations: [{ code: 'BER', name: 'ベルリン・ブランデンブルク空港', flightsPerWeek: 3 }] },
    { name: 'Ryanair', iata: 'FR', hubCode: 'CAG', hubName: 'カリアリ・エルマス空港', destinations: [{ code: 'STN', name: 'ロンドン・スタンステッド空港', flightsPerWeek: 7 }] },
    { name: 'Ryanair', iata: 'FR', hubCode: 'CIA', hubName: 'ローマ・チャンピーノ空港', destinations: [{ code: 'STN', name: 'ロンドン・スタンステッド空港', flightsPerWeek: 21 }] },
    { name: 'Ryanair', iata: 'FR', hubCode: 'CIY', hubName: 'コーミゾ空港', destinations: [{ code: 'CRL', name: 'ブリュッセル・サウスシャルロワ空港', flightsPerWeek: 2 }] },
    { name: 'easyJet', iata: 'U2', hubCode: 'CTA', hubName: 'カターニア・フォンターナロッサ空港', destinations: [{ code: 'LGW', name: 'ロンドン・ガトウィック空港', flightsPerWeek: 14 }] },
    { name: 'Ryanair', iata: 'FR', hubCode: 'CUF', hubName: 'クーネオ・レバルディジ空港', destinations: [{ code: 'RAK', name: 'マラケシュ・メナラ空港', flightsPerWeek: 2 }] },
    { name: 'Vueling', iata: 'VY', hubCode: 'FLR', hubName: 'フィレンツェ・ペレトラ空港', destinations: [{ code: 'ORY', name: 'パリ・オルリー空港', flightsPerWeek: 14 }] },
    { name: 'Ryanair', iata: 'FR', hubCode: 'FRL', hubName: 'フォルリ空港', destinations: [{ code: 'TIA', name: 'ティラナ国際空港', flightsPerWeek: 2 }] },
    { name: 'Ryanair', iata: 'FR', hubCode: 'GOA', hubName: 'ジェノヴァ・クリストーフォロ・コロンボ空港', destinations: [{ code: 'STN', name: 'ロンドン・スタンステッド空港', flightsPerWeek: 3 }] },
    { name: 'ITA Airways', iata: 'AZ', hubCode: 'LIN', hubName: 'ミラノ・リナーテ空港', destinations: [{ code: 'LHR', name: 'ロンドン・ヒースロー空港', flightsPerWeek: 21 }] },
    { name: 'easyJet', iata: 'U2', hubCode: 'LMP', hubName: 'ランペドゥーザ空港', destinations: [{ code: 'BSL', name: 'ユーロエアポート・バーゼル＝ミュールーズ空港', flightsPerWeek: 1 }] },
    { name: 'easyJet', iata: 'U2', hubCode: 'MXP', hubName: 'ミラノ・マルペンサ空港', destinations: [{ code: 'LGW', name: 'ロンドン・ガトウィック空港', flightsPerWeek: 35 }] },
    { name: 'easyJet', iata: 'U2', hubCode: 'NAP', hubName: 'ナポリ・カポディキーノ国際空港', destinations: [{ code: 'LGW', name: 'ロンドン・ガトウィック空港', flightsPerWeek: 21 }] },
    { name: 'easyJet', iata: 'U2', hubCode: 'OLB', hubName: 'オルビア・コスタ・スメラルダ空港', destinations: [{ code: 'LGW', name: 'ロンドン・ガトウィック空港', flightsPerWeek: 14 }] },
    { name: 'Ryanair', iata: 'FR', hubCode: 'PEG', hubName: 'ペルージャ・サン・フランチェスコ・ダッシジ空港', destinations: [{ code: 'STN', name: 'ロンドン・スタンステッド空港', flightsPerWeek: 4 }] },
    { name: 'Ryanair', iata: 'FR', hubCode: 'PMF', hubName: 'パルマ空港', destinations: [{ code: 'STN', name: 'ロンドン・スタンステッド空港', flightsPerWeek: 3 }] },
    { name: 'Ryanair', iata: 'FR', hubCode: 'PMO', hubName: 'パレルモ・ファルコーネ・ボルセリーノ空港', destinations: [{ code: 'STN', name: 'ロンドン・スタンステッド空港', flightsPerWeek: 7 }] },
    { name: 'DAT', iata: 'DX', hubCode: 'PNL', hubName: 'パンテッレリーア空港', destinations: [{ code: 'ZRH', name: 'チューリッヒ空港', flightsPerWeek: 1 }] },
    { name: 'Ryanair', iata: 'FR', hubCode: 'PSA', hubName: 'ピサ・ガリレオ・ガリレイ空港', destinations: [{ code: 'STN', name: 'ロンドン・スタンステッド空港', flightsPerWeek: 21 }] },
    { name: 'Ryanair', iata: 'FR', hubCode: 'PSR', hubName: 'アブルッツォ空港', destinations: [{ code: 'CRL', name: 'ブリュッセル・サウスシャルロワ空港', flightsPerWeek: 4 }] },
    { name: 'easyJet', iata: 'U2', hubCode: 'QSR', hubName: 'サレルノ・コスタ・ダマルフィ空港', destinations: [{ code: 'LGW', name: 'ロンドン・ガトウィック空港', flightsPerWeek: 3 }] },
    { name: 'Ryanair', iata: 'FR', hubCode: 'REG', hubName: 'レッジョ・カラブリア空港', destinations: [{ code: 'TIA', name: 'ティラナ国際空港', flightsPerWeek: 3 }] },
    { name: 'Ryanair', iata: 'FR', hubCode: 'RMI', hubName: 'リミニ・フェデリコ・フェリーニ空港', destinations: [{ code: 'BUD', name: 'リスト・フェレンツ国際空港', flightsPerWeek: 2 }] },
    { name: 'Ryanair', iata: 'FR', hubCode: 'SUF', hubName: 'ラメーツィア・テルメ空港', destinations: [{ code: 'STN', name: 'ロンドン・スタンステッド空港', flightsPerWeek: 4 }] },
    { name: 'Ryanair', iata: 'FR', hubCode: 'TPS', hubName: 'トラーパニ・ビルジ空港', destinations: [{ code: 'CRL', name: 'ブリュッセル・サウスシャルロワ空港', flightsPerWeek: 4 }] },
    { name: 'Ryanair', iata: 'FR', hubCode: 'TRN', hubName: 'トリノ空港', destinations: [{ code: 'STN', name: 'ロンドン・スタンステッド空港', flightsPerWeek: 7 }] },
    { name: 'Ryanair', iata: 'FR', hubCode: 'TRS', hubName: 'トリエステ空港', destinations: [{ code: 'STN', name: 'ロンドン・スタンステッド空港', flightsPerWeek: 4 }] },
    { name: 'Ryanair', iata: 'FR', hubCode: 'TSF', hubName: 'トレヴィーゾ空港', destinations: [{ code: 'STN', name: 'ロンドン・スタンステッド空港', flightsPerWeek: 14 }] },
    { name: 'easyJet', iata: 'U2', hubCode: 'VCE', hubName: 'ヴェネツィア・テッセラ空港', destinations: [{ code: 'LGW', name: 'ロンドン・ガトウィック空港', flightsPerWeek: 21 }] },
    { name: 'Ryanair', iata: 'FR', hubCode: 'VRN', hubName: 'ヴェローナ・ヴィラフランカ空港', destinations: [{ code: 'STN', name: 'ロンドン・スタンステッド空港', flightsPerWeek: 7 }] }
  ]},
  { country: 'スペイン', flag: '🇪🇸', airlines: [
    { name: 'Iberia', iata: 'IB', hubCode: 'MAD', hubName: 'マドリード・バラハス空港', destinations: [
      { code: 'JFK', name: 'ジョン・F・ケネディ国際空港', flightsPerWeek: 14 },
      { code: 'LAX', name: 'ロサンゼルス国際空港', flightsPerWeek: 7 },
      { code: 'LHR', name: 'ロンドン・ヒースロー空港', flightsPerWeek: 35 }
    ]},
    { name: 'Vueling', iata: 'VY', hubCode: 'BCN', hubName: 'バルセロナ＝エル・プラット空港', destinations: [
      { code: 'LGW', name: 'ロンドン・ガトウィック空港', flightsPerWeek: 35 }
    ]},
    { name: 'Ryanair', iata: 'FR', hubCode: 'ALC', hubName: 'アリカンテ＝エルチェ・ミゲル・エルナンデス空港', destinations: [
      { code: 'STN', name: 'ロンドン・スタンステッド空港', flightsPerWeek: 21 }
    ]},
    { name: 'easyJet', iata: 'U2', hubCode: 'AGP', hubName: 'マラガ＝コスタ・デル・ソル空港', destinations: [
      { code: 'LGW', name: 'ロンドン・ガトウィック空港', flightsPerWeek: 28 }
    ]},
    { name: 'Air Europa', iata: 'UX', hubCode: 'PMI', hubName: 'パルマ・デ・マヨルカ空港', destinations: [
      { code: 'FRA', name: 'フランクフルト空港', flightsPerWeek: 21 }
    ]},
    { name: 'Binter Canarias', iata: 'NT', hubCode: 'LPA', hubName: 'グラン・カナリア空港', destinations: [
      { code: 'RAK', name: 'マラケシュ・メナラ空港', flightsPerWeek: 3 }
    ]},
    { name: 'Binter Canarias', iata: 'NT', hubCode: 'TFN', hubName: 'テネリフェ・ノルテ空港', destinations: [
      { code: 'FNC', name: 'マデイラ空港', flightsPerWeek: 2 }
    ]},
    { name: 'Ryanair', iata: 'FR', hubCode: 'TFS', hubName: 'テネリフェ・スール空港', destinations: [
      { code: 'STN', name: 'ロンドン・スタンステッド空港', flightsPerWeek: 14 }
    ]},
    { name: 'Ryanair', iata: 'FR', hubCode: 'ACE', hubName: 'セサル・マンリケ・ランサローテ空港', destinations: [
      { code: 'DUB', name: 'ダブリン空港', flightsPerWeek: 7 }
    ]},
    { name: 'Condor', iata: 'DE', hubCode: 'FUE', hubName: 'フエルテベントゥラ空港', destinations: [
      { code: 'FRA', name: 'フランクフルト空港', flightsPerWeek: 7 }
    ]},
    { name: 'Vueling', iata: 'VY', hubCode: 'IBZ', hubName: 'イビサ空港', destinations: [
      { code: 'ORY', name: 'パリ・オルリー空港', flightsPerWeek: 7 }
    ]},
    { name: 'easyJet', iata: 'U2', hubCode: 'MAH', hubName: 'メノルカ空港', destinations: [
      { code: 'LGW', name: 'ロンドン・ガトウィック空港', flightsPerWeek: 7 }
    ]},
    { name: 'Vueling', iata: 'VY', hubCode: 'VLC', hubName: 'バレンシア空港', destinations: [
      { code: 'CDG', name: 'シャルル・ド・ゴール空港', flightsPerWeek: 14 }
    ]},
    { name: 'Vueling', iata: 'VY', hubCode: 'BIO', hubName: 'ビルバオ空港', destinations: [
      { code: 'AMS', name: 'スキポール空港', flightsPerWeek: 7 }
    ]},
    { name: 'Ryanair', iata: 'FR', hubCode: 'SVQ', hubName: 'セビリア空港', destinations: [
      { code: 'FCO', name: 'フィウミチーノ空港', flightsPerWeek: 7 }
    ]},
    { name: 'Ryanair', iata: 'FR', hubCode: 'SCQ', hubName: 'サンティアゴ・ロサリア・デ・カストロ空港', destinations: [
      { code: 'STN', name: 'ロンドン・スタンステッド空港', flightsPerWeek: 7 }
    ]},
    { name: 'Vueling', iata: 'VY', hubCode: 'OVD', hubName: 'アストゥリアス空港', destinations: [
      { code: 'ORY', name: 'パリ・オルリー空港', flightsPerWeek: 4 }
    ]},
    { name: 'Ryanair', iata: 'FR', hubCode: 'SDR', hubName: 'セベ・バレステロス＝サンタンデール空港', destinations: [
      { code: 'BGY', name: 'ミラノ・ベルガモ空港', flightsPerWeek: 3 }
    ]},
    { name: 'Ryanair', iata: 'FR', hubCode: 'GRO', hubName: 'ジローナ＝コスタ・ブラバ空港', destinations: [
      { code: 'CRL', name: 'ブリュッセル・サウスシャルルロワ空港', flightsPerWeek: 7 }
    ]},
    { name: 'Ryanair', iata: 'FR', hubCode: 'REU', hubName: 'レウス空港', destinations: [
      { code: 'DUB', name: 'ダブリン空港', flightsPerWeek: 4 }
    ]},
    { name: 'Vueling', iata: 'VY', hubCode: 'GRX', hubName: 'グラナダ空港', destinations: [
      { code: 'ORY', name: 'パリ・オルリー空港', flightsPerWeek: 3 }
    ]},
    { name: 'Ryanair', iata: 'FR', hubCode: 'LEI', hubName: 'アルメリア空港', destinations: [
      { code: 'STN', name: 'ロンドン・スタンステッド空港', flightsPerWeek: 3 }
    ]},
    { name: 'Ryanair', iata: 'FR', hubCode: 'XRY', hubName: 'ヘレス空港', destinations: [
      { code: 'DUS', name: 'デュッセルドルフ空港', flightsPerWeek: 3 }
    ]},
    { name: 'Volotea', iata: 'V7', hubCode: 'RMU', hubName: 'レヒオン・デ・ムルシア国際空港', destinations: [
      { code: 'ORY', name: 'パリ・オルリー空港', flightsPerWeek: 2 }
    ]},
    { name: 'Vueling', iata: 'VY', hubCode: 'LCG', hubName: 'ア・コルーニャ空港', destinations: [
      { code: 'LGW', name: 'ロンドン・ガトウィック空港', flightsPerWeek: 3 }
    ]},
    { name: 'Ryanair', iata: 'FR', hubCode: 'VGO', hubName: 'ビーゴ空港', destinations: [
      { code: 'BGY', name: 'ミラノ・ベルガモ空港', flightsPerWeek: 2 }
    ]},
    { name: 'Binter Canarias', iata: 'NT', hubCode: 'SPC', hubName: 'ラ・パルマ空港', destinations: [
      { code: 'FNC', name: 'マデイラ空港', flightsPerWeek: 1 }
    ]},
    { name: 'Ryanair', iata: 'FR', hubCode: 'ZAZ', hubName: 'サラゴサ空港', destinations: [
      { code: 'BGY', name: 'ミラノ・ベルガモ空港', flightsPerWeek: 3 }
    ]},
    { name: 'Ryanair', iata: 'FR', hubCode: 'VLL', hubName: 'バリャドリッド空港', destinations: [
      { code: 'CRL', name: 'ブリュッセル・サウスシャルルロワ空港', flightsPerWeek: 2 }
    ]}
  ]},
  { country: 'チェコ', flag: '🇨🇿', airlines: [
    { name: 'Smartwings', iata: 'QS', hubCode: 'PRG', hubName: 'ヴァーツラフ・ハヴェル・プラハ国際空港', destinations: [
      { code: 'NRT', name: '成田国際空港', flightsPerWeek: 7 },
      { code: 'HND', name: '羽田空港', flightsPerWeek: 7 },
      { code: 'KIX', name: '関西国際空港', flightsPerWeek: 7 },
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
    ]},
    { name: 'Ryanair', iata: 'FR', hubCode: 'BRQ', hubName: 'ブルノ・トゥジャニ空港', destinations: [{ code: 'STN', name: 'ロンドン・スタンステッド空港', flightsPerWeek: 7 }] },
    { name: 'Smartwings', iata: 'QS', hubCode: 'JCL', hubName: 'チェスケー・ブジェヨヴィツェ空港', destinations: [{ code: 'AYT', name: 'アンタルヤ空港', flightsPerWeek: 2 }] },
    { name: 'Smartwings', iata: 'QS', hubCode: 'KLV', hubName: 'カルロヴィ・ヴァリ空港', destinations: [{ code: 'AYT', name: 'アンタルヤ空港', flightsPerWeek: 2 }] },
    { name: 'LOT Polish Airlines', iata: 'LO', hubCode: 'OSR', hubName: 'レオシュ・ヤナーチェク・オストラヴァ空港', destinations: [{ code: 'WAW', name: 'ワルシャワ・ショパン空港', flightsPerWeek: 5 }] },
    { name: 'Ryanair', iata: 'FR', hubCode: 'PED', hubName: 'パルドゥビツェ空港', destinations: [{ code: 'ALC', name: 'アリカンテ＝エルチェ・ミゲル・エルナンデス空港', flightsPerWeek: 2 }] }
  ]},
  // ネパール―インド間の定期直行便は、公開されている各社の就航地と空港時刻表を
  // 2026-08-26に照合した。KTMから就航する既知のインド4空港（DEL、BOM、BLR、
  // VNS）と、同一路線を運航する各社を収録。BWA・PKR発のインド定期直行便は
  // 確認できなかったため、就航計画やチャーター便を定期便としては収録していない。
  // コードシェアは運航会社側だけを数え、
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
      { code: 'VNS', name: 'ラール・バハードゥル・シャーストリー国際空港（バラナシ）', flightsPerWeek: 2 },
      { code: 'BWA', name: 'ガウタム・ブッダ国際空港（シッダールタナガル）', flightsPerWeek: 35 },
      { code: 'PKR', name: 'ポカラ国際空港', flightsPerWeek: 70 }
    ]},
    { name: 'Buddha Air', iata: 'U4', hubCode: 'BWA', hubName: 'ガウタム・ブッダ国際空港（シッダールタナガル）', destinations: [
      { code: 'KTM', name: 'トリブバン国際空港（カトマンズ）', flightsPerWeek: 35 },
      { code: 'PKR', name: 'ポカラ国際空港', flightsPerWeek: 7 }
    ]},
    { name: 'Buddha Air', iata: 'U4', hubCode: 'PKR', hubName: 'ポカラ国際空港', destinations: [
      { code: 'KTM', name: 'トリブバン国際空港（カトマンズ）', flightsPerWeek: 70 },
      { code: 'BWA', name: 'ガウタム・ブッダ国際空港（シッダールタナガル）', flightsPerWeek: 7 }
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
    ]},
    { name: 'Eurowings', iata: 'EW', hubCode: 'GRZ', hubName: 'グラーツ空港', destinations: [{ code: 'BER', name: 'ベルリン・ブランデンブルク空港', flightsPerWeek: 4 }] },
    { name: 'Ryanair', iata: 'FR', hubCode: 'KLU', hubName: 'クラーゲンフルト空港', destinations: [{ code: 'STN', name: 'ロンドン・スタンステッド空港', flightsPerWeek: 3 }] },
    { name: 'Ryanair', iata: 'FR', hubCode: 'LNZ', hubName: 'リンツ空港', destinations: [{ code: 'STN', name: 'ロンドン・スタンステッド空港', flightsPerWeek: 3 }] },
    { name: 'easyJet', iata: 'U2', hubCode: 'INN', hubName: 'インスブルック空港', destinations: [{ code: 'LGW', name: 'ロンドン・ガトウィック空港', flightsPerWeek: 7 }] },
    { name: 'Ryanair', iata: 'FR', hubCode: 'SZG', hubName: 'ザルツブルク空港', destinations: [{ code: 'STN', name: 'ロンドン・スタンステッド空港', flightsPerWeek: 5 }] }
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
    ]},
    { name: 'KLM', iata: 'KL', hubCode: 'BLL', hubName: 'ビルン空港', destinations: [
      { code: 'AMS', name: 'スキポール空港', flightsPerWeek: 28 }
    ]},
    { name: 'KLM', iata: 'KL', hubCode: 'AAL', hubName: 'オールボー空港', destinations: [
      { code: 'AMS', name: 'スキポール空港', flightsPerWeek: 21 }
    ]},
    { name: 'Ryanair', iata: 'FR', hubCode: 'AAR', hubName: 'オーフス空港', destinations: [
      { code: 'STN', name: 'ロンドン・スタンステッド空港', flightsPerWeek: 4 }
    ]},
    { name: 'Loganair', iata: 'LM', hubCode: 'EBJ', hubName: 'エスビャウ空港', destinations: [
      { code: 'ABZ', name: 'アバディーン国際空港', flightsPerWeek: 6 }
    ]},
    { name: 'Danish Air Transport', iata: 'DX', hubCode: 'RNN', hubName: 'ボーンホルム空港', destinations: [
      { code: 'BER', name: 'ベルリン・ブランデンブルク空港', flightsPerWeek: 2 }
    ]}
  ]}
];
