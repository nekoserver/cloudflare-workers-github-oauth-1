export type RailStation = { name: string; lat: number; lon: number; flag?: string; country?: string };
export type RailLine = { name: string; flag: string; country: string; stations: RailStation[] };

export const RAIL_LINES: RailLine[] = [
  { name:'東海道新幹線', flag:'🇯🇵', country:'日本', stations:[
    {name:'東京駅', lat:35.681, lon:139.767},
    {name:'新横浜駅', lat:35.507, lon:139.617},
    {name:'名古屋駅', lat:35.170, lon:136.881},
    {name:'京都駅', lat:34.985, lon:135.759},
    {name:'新大阪駅', lat:34.734, lon:135.500}
  ]},
  { name:'TGV南東線(パリ～マルセイユ)', flag:'🇫🇷', country:'フランス', stations:[
    {name:'パリ・リヨン駅', lat:48.844, lon:2.374},
    {name:'リヨン・パールデュー駅', lat:45.760, lon:4.860},
    {name:'アヴィニヨンTGV駅', lat:43.921, lon:4.786},
    {name:'マルセイユ・サンシャルル駅', lat:43.303, lon:5.380}
  ]},
  { name:'ユーロスター(ロンドン～パリ)', flag:'🇬🇧', country:'イギリス・フランス', stations:[
    {name:'ロンドン・セントパンクラス駅', lat:51.530, lon:-0.126, flag:'🇬🇧', country:'イギリス'},
    {name:'アシュフォード国際駅', lat:51.140, lon:0.874, flag:'🇬🇧', country:'イギリス'},
    {name:'カレー・フレテュン駅', lat:50.922, lon:1.826, flag:'🇫🇷', country:'フランス'},
    {name:'リール・ヨーロップ駅', lat:50.639, lon:3.075, flag:'🇫🇷', country:'フランス'},
    {name:'パリ北駅', lat:48.880, lon:2.355, flag:'🇫🇷', country:'フランス'}
  ]},
  { name:'ICE(ハンブルク～ミュンヘン)', flag:'🇩🇪', country:'ドイツ', stations:[
    {name:'ハンブルク中央駅', lat:53.553, lon:10.007},
    {name:'フランクフルト中央駅', lat:50.107, lon:8.663},
    {name:'マンハイム中央駅', lat:49.479, lon:8.469},
    {name:'ミュンヘン中央駅', lat:48.140, lon:11.558}
  ]},
  { name:'フレッチャロッサ(ミラノ～ナポリ)', flag:'🇮🇹', country:'イタリア', stations:[
    {name:'ミラノ中央駅', lat:45.486, lon:9.204},
    {name:'ボローニャ中央駅', lat:44.506, lon:11.343},
    {name:'フィレンツェSMN駅', lat:43.776, lon:11.248},
    {name:'ローマ・テルミニ駅', lat:41.901, lon:12.502},
    {name:'ナポリ中央駅', lat:40.853, lon:14.272}
  ]},
  { name:'AVE(マドリード～バルセロナ)', flag:'🇪🇸', country:'スペイン', stations:[
    {name:'マドリード・アトーチャ駅', lat:40.407, lon:-3.690},
    {name:'サラゴサ・デリシアス駅', lat:41.656, lon:-0.911},
    {name:'バルセロナ・サンツ駅', lat:41.379, lon:2.140}
  ]},
  { name:'氷河特急(ツェルマット～サンモリッツ)', flag:'🇨🇭', country:'スイス', stations:[
    {name:'ツェルマット駅', lat:46.021, lon:7.749},
    {name:'ブリーク駅', lat:46.319, lon:7.988},
    {name:'アンデルマット駅', lat:46.635, lon:8.594},
    {name:'クール駅', lat:46.852, lon:9.530},
    {name:'サンモリッツ駅', lat:46.498, lon:9.838}
  ]},
  { name:'アセラ特急(ボストン～ワシントン)', flag:'🇺🇸', country:'アメリカ', stations:[
    {name:'ボストン・サウス駅', lat:42.352, lon:-71.055},
    {name:'ニューヨーク・ペン駅', lat:40.750, lon:-73.994},
    {name:'フィラデルフィア30丁目駅', lat:39.956, lon:-75.182},
    {name:'ワシントン・ユニオン駅', lat:38.897, lon:-77.006}
  ]},
  { name:'KTX(ソウル～釜山)', flag:'🇰🇷', country:'韓国', stations:[
    {name:'ソウル駅', lat:37.556, lon:126.972},
    {name:'大田駅', lat:36.332, lon:127.434},
    {name:'大邱駅', lat:35.879, lon:128.628},
    {name:'釜山駅', lat:35.115, lon:129.041}
  ]},
  { name:'インディアン・パシフィック(シドニー～パース)', flag:'🇦🇺', country:'オーストラリア', stations:[
    {name:'シドニー中央駅', lat:-33.883, lon:151.207},
    {name:'ブロークンヒル駅', lat:-31.958, lon:141.467},
    {name:'アデレード・パークランズ駅', lat:-34.917, lon:138.596},
    {name:'パース駅', lat:-31.953, lon:115.861}
  ]},
  { name:'VIA鉄道コリドー線(トロント～モントリオール)', flag:'🇨🇦', country:'カナダ', stations:[
    {name:'トロント・ユニオン駅', lat:43.645, lon:-79.380},
    {name:'キングストン駅', lat:44.231, lon:-76.486},
    {name:'モントリオール中央駅', lat:45.500, lon:-73.567}
  ]},
  { name:'ハラマイン高速鉄道(メディナ～マッカ)', flag:'🇸🇦', country:'サウジアラビア', stations:[
    {name:'メディナ駅', lat:24.468, lon:39.621},
    {name:'キング・アブドラ経済都市駅', lat:22.406, lon:39.093},
    {name:'ジッダ(空港)駅', lat:21.694, lon:39.157},
    {name:'マッカ駅', lat:21.474, lon:39.826}
  ]},
  { name:'エティハド鉄道(アブダビ～フジャイラ)', flag:'🇦🇪', country:'アラブ首長国連邦', stations:[
    {name:'アブダビ駅', lat:24.454, lon:54.377},
    {name:'ドバイ駅', lat:25.205, lon:55.271},
    {name:'シャルジャ駅', lat:25.346, lon:55.421},
    {name:'フジャイラ駅', lat:25.129, lon:56.327}
  ]},
  { name:'ドーハメトロ・レッドライン(アル・ワクラ～ルサイル)', flag:'🇶🇦', country:'カタール', stations:[
    {name:'アル・ワクラ駅', lat:25.166, lon:51.602},
    {name:'ハマド国際空港駅', lat:25.261, lon:51.614},
    {name:'ムシェリーブ駅', lat:25.287, lon:51.533},
    {name:'ルサイル駅', lat:25.399, lon:51.493}
  ]}
];
