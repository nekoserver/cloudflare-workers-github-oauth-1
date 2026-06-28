export function getTdfPage(): string {
  return `<!DOCTYPE html>
<html lang="ja">
<head>
<meta charset="UTF-8">
<meta name="viewport" content="width=device-width,initial-scale=1">
<title>Tour de France 2026</title>
<style>
:root {
  --bg:#0d1117; --surface:#161b22; --surface2:#1c2128; --border:#30363d;
  --text:#e6edf3; --muted:#8b949e; --accent:#e3b341;
}
* { margin:0; padding:0; box-sizing:border-box; }
body { background:var(--bg); color:var(--text); font-family:'Segoe UI','Hiragino Sans',sans-serif; overflow:hidden; height:100vh; }

#hdr {
  height:44px; background:var(--surface); border-bottom:1px solid var(--border);
  display:flex; align-items:center; gap:16px; padding:0 18px;
  position:relative; z-index:30;
}
#hdr h1 { font-size:15px; font-weight:700; color:var(--accent); white-space:nowrap; }
#hdr .sub { font-size:11px; color:var(--muted); }

#main { display:flex; height:calc(100vh - 44px); }

/* ---- left: map ---- */
#map-panel { flex:1; position:relative; overflow:hidden; min-width:0; }
#map-panel canvas { display:block; cursor:grab; }

#legend {
  position:absolute; bottom:12px; right:12px;
  background:rgba(22,27,34,0.92); border:1px solid var(--border);
  border-radius:8px; padding:10px 14px; font-size:11px; line-height:2;
  backdrop-filter:blur(4px); z-index:10;
}
#legend h3 { font-size:11px; color:var(--muted); margin-bottom:4px; font-weight:400; }
.leg-row { display:flex; align-items:center; gap:7px; }
.leg-line { width:22px; height:3px; border-radius:2px; flex-shrink:0; }
.leg-dot  { width:9px; height:9px; border-radius:50%; flex-shrink:0; }

#map-tooltip {
  position:absolute; pointer-events:none; z-index:20;
  background:rgba(13,17,23,0.97); border:1px solid #e3b34166;
  border-radius:8px; padding:10px 14px; font-size:12px;
  display:none; max-width:270px; line-height:1.7;
}
#map-tooltip .tt-stage  { font-weight:700; color:var(--accent); margin-bottom:2px; }
#map-tooltip .tt-route  { color:var(--text); }
#map-tooltip .tt-detail { color:var(--muted); font-size:11px; margin-top:3px; }
#map-tooltip .tt-climbs { color:#ff7b72; font-size:11px; margin-top:2px; }

#map-info {
  position:absolute; bottom:12px; left:12px;
  font-size:11px; color:var(--muted);
  background:rgba(22,27,34,0.88); border:1px solid var(--border);
  border-radius:6px; padding:6px 11px; backdrop-filter:blur(4px);
}

/* ---- right: schedule ---- */
#sched-panel {
  width:360px; flex-shrink:0; display:flex; flex-direction:column;
  border-left:1px solid var(--border); background:var(--bg); overflow:hidden;
}

#sched-list {
  flex-shrink:0; overflow-y:auto; max-height:55%;
  border-bottom:1px solid var(--border);
}

.srow {
  display:grid; grid-template-columns:30px 66px 1fr 52px;
  align-items:center; gap:6px; padding:5px 10px;
  cursor:pointer; border-bottom:1px solid #21262d;
  transition:background .12s;
}
.srow:hover { background:var(--surface2); }
.srow.selected { background:#1c2330; border-left:2px solid var(--accent); padding-left:8px; }
.srow-rest {
  display:grid; grid-template-columns:30px 66px 1fr;
  align-items:center; gap:6px; padding:5px 10px;
  cursor:pointer; border-bottom:1px solid #21262d;
  transition:background .12s; color:var(--muted);
}
.srow-rest:hover { background:var(--surface2); }
.srow-rest.selected { background:#1c2330; border-left:2px solid #444; padding-left:8px; }

.srow-badge {
  width:26px; height:26px; border-radius:5px; display:flex;
  align-items:center; justify-content:center;
  font-size:11px; font-weight:700; flex-shrink:0;
}
.sb-flat     { background:#1a2f1a; color:#3fb950; }
.sb-hilly    { background:#2f2010; color:#ffa657; }
.sb-mountain { background:#2f1010; color:#ff7b72; }
.sb-ttt      { background:#101a2f; color:#79c0ff; }
.sb-itt      { background:#101a2f; color:#79c0ff; }
.sb-rest     { font-size:14px; background:none; color:var(--muted); }

.srow-date { font-size:10px; color:var(--muted); line-height:1.4; }
.srow-route { font-size:11px; color:var(--text); white-space:nowrap; overflow:hidden; text-overflow:ellipsis; }
.srow-rest-label { font-size:11px; color:var(--muted); }
.srow-km { font-size:10px; font-weight:700; color:var(--accent); text-align:right; white-space:nowrap; }

#sched-detail { flex:1; overflow-y:auto; }
#sched-detail-inner { padding:14px 12px; font-size:12px; line-height:1.8; }

.det-empty { color:var(--muted); font-size:11px; padding:20px 0; text-align:center; }
.det-head { margin-bottom:10px; }
.det-stage-num { font-size:22px; font-weight:700; color:var(--accent); }
.det-route { font-size:13px; font-weight:600; margin-top:2px; }
.det-sub { font-size:11px; color:var(--muted); margin-top:2px; }
.det-badge {
  display:inline-block; padding:2px 8px; border-radius:4px;
  font-size:10px; font-weight:700; margin-left:6px; vertical-align:middle;
}
.det-grid { display:grid; grid-template-columns:1fr 1fr; gap:5px 14px; margin-top:10px; }
.det-grid dt { color:var(--muted); font-size:10px; }
.det-grid dd { color:var(--text); font-size:11px; }
.det-climbs { margin-top:9px; color:#d2a8ff; font-size:11px; padding:7px 10px; background:#1a1428; border-radius:6px; }
.det-rest { color:var(--muted); font-size:13px; padding:20px 0; text-align:center; }
.city-link {
  color:#79c0ff; text-decoration:none; cursor:pointer;
  background:none; border:none; font:inherit; padding:0;
}
.city-link:hover { color:#a5d6ff; }
</style>
</head>
<body>
<div id="hdr">
  <h1>🚴 Tour de France 2026</h1>
  <span class="sub">7月4日〜26日 &nbsp;|&nbsp; <button class="city-link" onclick="dropPin(41.3851,2.1734)">バルセロナ</button> → <button class="city-link" onclick="dropPin(48.8698,2.3078)">パリ</button> &nbsp;|&nbsp; 全21ステージ &nbsp;約3,333km</span>
</div>
<div id="main">
  <!-- left: route map -->
  <div id="map-panel">
    <canvas id="c"></canvas>
    <div id="legend">
      <h3>ステージ種別</h3>
      <div class="leg-row"><div class="leg-line" style="background:#3fb950"></div><span>平坦</span></div>
      <div class="leg-row"><div class="leg-line" style="background:#ffa657"></div><span>丘陵</span></div>
      <div class="leg-row"><div class="leg-line" style="background:#ff7b72"></div><span>山岳</span></div>
      <div class="leg-row"><div class="leg-line" style="background:#79c0ff;height:2px"></div><span>タイムトライアル</span></div>
      <div style="margin-top:5px;border-top:1px solid #30363d;padding-top:5px;">
      <div class="leg-row"><div class="leg-dot" style="background:#ff7b72;box-shadow:0 0 5px #ff7b72"></div><span>スタート/ゴール</span></div>
      <div class="leg-row"><div class="leg-dot" style="background:#d2a8ff;width:7px;height:7px"></div><span>主要峠（HC/1級）</span></div>
      </div>
    </div>
    <div id="map-tooltip">
      <div class="tt-stage" id="tt-stage"></div>
      <div class="tt-route" id="tt-route"></div>
      <div class="tt-detail" id="tt-detail"></div>
      <div class="tt-climbs" id="tt-climbs"></div>
    </div>
    <div id="map-info">ドラッグ: パン &nbsp;|&nbsp; ホイール: ズーム &nbsp;|&nbsp; ステージ線ホバー: 詳細</div>
  </div>

  <!-- right: schedule -->
  <div id="sched-panel">
    <div id="sched-list"></div>
    <div id="sched-detail">
      <div id="sched-detail-inner"><div class="det-empty">← 行をタップして詳細表示</div></div>
    </div>
  </div>
</div><!-- /main -->

<script>
var SCHED = [
  { type:"stage", n:1, date:"7/4(土)", stype:"TTT", from:"バルセロナ", to:"バルセロナ", km:19.7,
    sub:"カタルーニャ州都・地中海の港湾都市 — モンジュイック丘上サーキット",
    rows:[
      ["スタート","17:05 CEST（JST 翌00:05）"],
      ["最終チーム出走","〜18:55 CEST"],
      ["スタート都市","バルセロナ — スペイン第2の都市、ガウディ建築で世界的に知られるカタルーニャの文化首都"],
      ["注目ポイント","1971年以来のグランデパール・チームTT"]
    ], climbs:"" },
  { type:"stage", n:2, date:"7/5(日)", stype:"hilly", from:"タラゴナ", to:"バルセロナ", km:169.2,
    sub:"ローマ時代の古都 → モンジュイック丘アップヒルフィニッシュ",
    rows:[
      ["スタート","〜13:05 CEST（JST 20:05）"],
      ["フィニッシュ予想","〜17:00 CEST"],
      ["スタート都市","タラゴナ — ローマ帝国属州の首都タラコとして栄えた古都。円形劇場・城壁が世界遺産"],
      ["獲得標高","約2,500m"]
    ], climbs:"モンジュイック（フィニッシュ）" },
  { type:"stage", n:3, date:"7/6(月)", stype:"mountain", from:"グラノリェルス", to:"レ・サングル 🏔", km:196.2,
    sub:"バルセロナ郊外の工業都市 → ピレネー越えでフランス入り",
    rows:[
      ["スタート","〜12:15 CEST（JST 19:15）"],
      ["フィニッシュ予想","〜17:30 CEST"],
      ["フィニッシュ地点","レ・サングル — アリエージュ県の山岳集落（標高約1,300m）"],
      ["獲得標高","約3,850m"]
    ], climbs:"コル・デ・トセス（1,800m） › コル・デュ・カルヴェール › レ・サングル山頂" },
  { type:"stage", n:4, date:"7/7(火)", stype:"hilly", from:"カルカソンヌ", to:"フォワ", km:182.4,
    sub:"世界遺産の城塞都市 → カタリ派ゆかりの中世城塞町",
    rows:[
      ["スタート","〜13:05 CEST（JST 20:05）"],
      ["フィニッシュ予想","〜17:30 CEST"],
      ["スタート都市","カルカソンヌ — ユネスコ世界遺産の二重城壁を持つ中世城塞都市"],
      ["フィニッシュ都市","フォワ — 岩山に建つフォワ城、12〜13世紀カタリ派の本拠地"]
    ], climbs:"" },
  { type:"stage", n:5, date:"7/8(水)", stype:"flat", from:"ランヌメザン", to:"ポー", km:158.3,
    sub:"ピレネー山麓の小都市 → ベアルン地方の歴史ある王都へ",
    rows:[
      ["スタート","〜13:30 CEST（JST 20:30）"],
      ["フィニッシュ予想","〜17:00 CEST"],
      ["フィニッシュ都市","ポー — アンリ4世生誕の地。断崖上のポー城からピレネーを一望"],
      ["コース概要","ほぼ平坦。集団スプリント有力"]
    ], climbs:"" },
  { type:"stage", n:6, date:"7/9(木)", stype:"mountain", from:"ポー", to:"ガヴァルニー＝ジェドル 🏔", km:186.4,
    sub:"ベアルン王都 → ユネスコ世界遺産の圏谷（カール）フィニッシュ",
    rows:[
      ["スタート","〜12:00 CEST（JST 19:00）"],
      ["フィニッシュ予想","〜17:30 CEST"],
      ["フィニッシュ地点","ガヴァルニー＝ジェドル — 氷河が削り出した世界遺産の巨大圏谷、落差423mの大瀑布"],
      ["獲得標高","約4,600m"]
    ], climbs:"コル・ダスパン（1,489m） › コル・デュ・トゥールマレー（2,115m）🏔 › ガヴァルニー圏谷" },
  { type:"stage", n:7, date:"7/10(金)", stype:"flat", from:"アジェトモー", to:"ボルドー", km:175.0,
    sub:"ガスコーニュの小都市 → 世界遺産のワイン交易港湾都市へ",
    rows:[
      ["スタート","〜13:30 CEST（JST 20:30）"],
      ["フィニッシュ予想","〜17:00 CEST"],
      ["フィニッシュ都市","ボルドー — 「月の港」として世界遺産登録、フランス最大のワイン産地"],
      ["コース概要","ランド地方の平地を北上。集団スプリント"]
    ], climbs:"" },
  { type:"stage", n:8, date:"7/11(土)", stype:"flat", from:"ペリグー", to:"ベルジュラック", km:180.4,
    sub:"トリュフとフォワグラの美食都市 → シラノ・ド・ベルジュラック生誕の地",
    rows:[
      ["スタート","〜13:30 CEST（JST 20:30）"],
      ["フィニッシュ予想","〜17:00 CEST"],
      ["スタート都市","ペリグー — ペリゴール・ノワール地方の中心、トリュフ・フォワグラの美食産地"],
      ["フィニッシュ都市","ベルジュラック — ドルドーニュ川沿いのワイン産地、シラノの名で世界的に有名"]
    ], climbs:"" },
  { type:"stage", n:9, date:"7/12(日)", stype:"hilly", from:"マルモール", to:"ユッセル", km:185.5,
    sub:"コレーズの渓谷町 → マッシフ・サントラルの高原都市へ",
    rows:[
      ["スタート","〜13:05 CEST（JST 20:05）"],
      ["フィニッシュ予想","〜17:30 CEST"],
      ["スタート都市","マルモール — コレーズ川とドルドーニュ川の合流点近くの渓谷の町"],
      ["フィニッシュ都市","ユッセル — マッシフ・サントラルの高台に位置する農業・牧畜の小都市"]
    ], climbs:"" },
  { type:"rest", date:"7/13(月)", label:"第1休息日 — カンタル地方" },
  { type:"stage", n:10, date:"7/14(火)", stype:"mountain", from:"オーリヤック", to:"ル・リオラン 🏔", km:166.6,
    sub:"カンタル県都・チーズの町 → 革命記念日の火山高地フィニッシュ",
    rows:[
      ["スタート","〜12:15 CEST（JST 19:15）"],
      ["フィニッシュ予想","〜17:00 CEST"],
      ["スタート都市","オーリヤック — AOCチーズ「カンタル」の産地、カンタル火山群に囲まれた城壁都市"],
      ["フィニッシュ地点","ル・リオラン — カンタル火山群中腹（標高約1,160m）の小スキーリゾート村"]
    ], climbs:"プラン・デュ・カンタル › ル・リオラン山頂フィニッシュ（1,160m）" },
  { type:"stage", n:11, date:"7/15(水)", stype:"flat", from:"ヴィシー", to:"ヌヴェール", km:161.3,
    sub:"ヨーロッパ屈指の温泉保養地 → ロワール川沿いの陶器の街へ",
    rows:[
      ["スタート","〜13:30 CEST（JST 20:30）"],
      ["フィニッシュ予想","〜17:00 CEST"],
      ["スタート都市","ヴィシー — ベル・エポック期の優雅な建築と温泉施設で知られるヨーロッパ屈指の保養地"],
      ["フィニッシュ都市","ヌヴェール — ロワール川畔、ヌヴェール焼（ファイアンス陶器）の産地"]
    ], climbs:"" },
  { type:"stage", n:12, date:"7/16(木)", stype:"flat", from:"マニークール", to:"シャロン＝シュル＝ソーヌ", km:179.1,
    sub:"フランスF1グランプリの舞台 → ブルゴーニュワインの集散地へ",
    rows:[
      ["スタート","〜13:30 CEST（JST 20:30）"],
      ["フィニッシュ予想","〜17:00 CEST"],
      ["スタート地点","マニークール — フランスF1グランプリ（ニヴェルネ）の開催地サーキット"],
      ["フィニッシュ都市","シャロン＝シュル＝ソーヌ — ソーヌ川沿いのワイン集散・水運の要衝"]
    ], climbs:"" },
  { type:"stage", n:13, date:"7/17(金)", stype:"hilly", from:"ドール", to:"ベルフォール", km:205.8,
    sub:"パスツール生誕の塩の交易都市 → 難攻不落の要塞都市へ（最長ステージ）",
    rows:[
      ["スタート","〜12:30 CEST（JST 19:30）"],
      ["フィニッシュ予想","〜18:00 CEST"],
      ["スタート都市","ドール — 細菌学者パスツールの生誕地、かつてフランシュ＝コンテ地方の首都"],
      ["フィニッシュ都市","ベルフォール — 普仏戦争に耐えた要塞都市「ライオンの町」、岩山の巨大ライオン像が象徴"]
    ], climbs:"" },
  { type:"stage", n:14, date:"7/18(土)", stype:"mountain", from:"ミュルーズ", to:"マルクシュタイン・フェレラン 🏔", km:155.3,
    sub:"アルザスの工業都市 → ヴォージュ山地の尾根リゾートへ",
    rows:[
      ["スタート","〜12:15 CEST（JST 19:15）"],
      ["フィニッシュ予想","〜17:00 CEST"],
      ["スタート都市","ミュルーズ — 自動車・鉄道の産業博物館で知られる多文化工業都市、独・スイス国境近傍"],
      ["フィニッシュ地点","マルクシュタイン・フェレラン — ヴォージュ山地の尾根（1,267m）スキーリゾート"]
    ], climbs:"グラン・バロン方面 › マルクシュタイン山頂フィニッシュ（1,267m）" },
  { type:"stage", n:15, date:"7/19(日)", stype:"mountain", from:"シャンパニョール", to:"プラトー・ド・ソレゾン 🏔", km:183.9,
    sub:"ジュラのチーズ産地 → ツール史上初登場の高原フィニッシュ",
    rows:[
      ["スタート","〜12:00 CEST（JST 19:00）"],
      ["フィニッシュ予想","〜17:30 CEST"],
      ["スタート都市","シャンパニョール — コンテチーズの産地、時計製造の伝統工業を受け継ぐ高原都市"],
      ["フィニッシュ地点","プラトー・ド・ソレゾン — サヴォワ県アラヴィ山塊の高原（1,450m）、ツール史上初登場"]
    ], climbs:"コル・ド・ラ・コロンビエール（1,613m） › プラトー・ド・ソレゾン山頂フィニッシュ（1,450m）" },
  { type:"rest", date:"7/20(月)", label:"第2休息日 — エヴィアン＝レ＝バン周辺" },
  { type:"stage", n:16, date:"7/21(火)", stype:"ITT", from:"エヴィアン＝レ＝バン", to:"トノン＝レ＝バン", km:26.1,
    sub:"世界的ミネラルウォーターの町 → レマン湖南岸のリゾート都市へ",
    rows:[
      ["第1走者スタート","12:30 CEST（JST 19:30）"],
      ["GCリーダー予想","〜17:30 CEST"],
      ["スタート都市","エヴィアン＝レ＝バン — G8サミット開催地、「エヴィアン」採水地の温泉保養都市"],
      ["フィニッシュ都市","トノン＝レ＝バン — レマン湖に面したリゾート都市、対岸にスイス・ローザンヌを望む"]
    ], climbs:"" },
  { type:"stage", n:17, date:"7/22(水)", stype:"flat", from:"シャンベリー", to:"ヴォワロン", km:174.7,
    sub:"サヴォワの古都 → グルノーブル経由・イゼール渓谷の小都市へ",
    rows:[
      ["スタート","〜13:30 CEST（JST 20:30）"],
      ["フィニッシュ予想","〜17:00 CEST"],
      ["スタート都市","シャンベリー — かつてサヴォイア公国の首都として栄えた中世の古都"],
      ["コース概要","アルプス前の平坦。スプリンター最後のチャンス"]
    ], climbs:"" },
  { type:"stage", n:18, date:"7/23(木)", stype:"mountain", from:"ヴォワロン", to:"オルシエール＝メルレット 🏔", km:185.2,
    sub:"イゼールの小都市 → エクラン国立公園麓のスキーリゾート山頂",
    rows:[
      ["スタート","〜12:00 CEST（JST 19:00）"],
      ["フィニッシュ予想","〜17:30 CEST"],
      ["フィニッシュ地点","オルシエール＝メルレット — エクラン国立公園麓のスキーリゾート（1,825m）7.1km 平均6.7%"],
      ["獲得標高","約4,800m"]
    ], climbs:"コル・デュ・ノワエ › オルシエール＝メルレット山頂フィニッシュ（1,825m）" },
  { type:"stage", n:19, date:"7/24(金)", stype:"mountain", from:"ガップ", to:"アルプ・デュエズ 🏔", km:127.9,
    sub:"ナポレオン街道の拠点 → 21ヘアピンの伝説の山頂へ",
    rows:[
      ["スタート","〜12:30 CEST（JST 19:30）"],
      ["フィニッシュ予想","〜17:00 CEST"],
      ["スタート都市","ガップ — オート＝ザルプ県の県都、「ナポレオン街道」の百日天下ルート上の都市"],
      ["フィニッシュ地点","アルプ・デュエズ — 21ヘアピンに歴代優勝者の名を刻む13.8km・平均8.1%の超難関クライム（1,860m）"]
    ], climbs:"コル・デュ・ガリビエ（2,642m）🏔 › アルプ・デュエズ21ヘアピン（1,860m）" },
  { type:"stage", n:20, date:"7/25(土)", stype:"mountain", from:"ル・ブール＝ドワザン", to:"アルプ・デュエズ（逆走） 🏔", km:170.9,
    sub:"ロメランシュ渓谷の小村 → 史上初・2日連続アルプ・デュエズ逆走コース",
    rows:[
      ["スタート","〜11:30 CEST（JST 18:30）"],
      ["フィニッシュ予想","〜17:30 CEST"],
      ["歴史的意義","ツール史上初・2日連続のアルプ・デュエズ山頂フィニッシュ"],
      ["獲得標高","約4,500m"]
    ], climbs:"コル・ド・サレンヌ（1,999m） › アルプ・デュエズ逆走コース（1,860m）" },
  { type:"stage", n:21, date:"7/26(日)", stype:"flat", from:"トワリー", to:"パリ（シャンゼリゼ）", km:133.0,
    sub:"イル＝ド＝フランスの城塞町 → モンマルトル経由でシャンゼリゼへ凱旋",
    rows:[
      ["スタート","16:30 CEST（JST 23:30）"],
      ["フィニッシュ予想","〜20:00 CEST（JST 翌03:00）"],
      ["フィニッシュ","シャンゼリゼ — 凱旋門からコンコルド広場へ続く世界最有名な大通り"],
      ["コース概要","モンマルトル石畳を3周回したのちシャンゼリゼへ"]
    ], climbs:"モンマルトル（石畳コース×3周） › シャンゼリゼ凱旋ゴール" }
];

var TYPE_BADGE_LABEL = { flat:"平坦", hilly:"丘陵", mountain:"山岳", TTT:"TTT", ITT:"ITT" };
var TYPE_COLOR_HEX = { flat:"#3fb950", hilly:"#ffa657", mountain:"#ff7b72", TTT:"#79c0ff", ITT:"#79c0ff" };

function buildSchedList() {
  var list = document.getElementById("sched-list");
  var parts = [];
  for(var i=0; i<SCHED.length; i++) {
    var item = SCHED[i];
    if(item.type === "rest") {
      parts.push(
        '<div class="srow srow-rest" onclick="showDetail(' + i + ')" id="srow-' + i + '">' +
        '<div class="srow-badge sb-rest">🛌</div>' +
        '<div class="srow-date">' + item.date + '</div>' +
        '<div class="srow-rest-label">休息日</div>' +
        '</div>'
      );
    } else {
      var sc = "sb-" + item.stype.toLowerCase();
      var fn = '<button class="city-link" onclick="dropPinStage(' + item.n + ',true);event.stopPropagation()">' + item.from + '</button>';
      var tn = '<button class="city-link" onclick="dropPinStage(' + item.n + ',false);event.stopPropagation()">' + item.to + '</button>';
      parts.push(
        '<div class="srow" onclick="showDetail(' + i + ')" id="srow-' + i + '">' +
        '<div class="srow-badge ' + sc + '">' + item.n + '</div>' +
        '<div class="srow-date">' + item.date + '</div>' +
        '<div class="srow-route">' + fn + ' → ' + tn + '</div>' +
        '<div class="srow-km">' + item.km + ' km</div>' +
        '</div>'
      );
    }
  }
  list.innerHTML = parts.join("");
}

function showDetail(idx) {
  var rowEls = document.querySelectorAll("#sched-list .srow, #sched-list .srow-rest");
  for(var i=0; i<rowEls.length; i++) rowEls[i].classList.remove("selected");
  var selEl = document.getElementById("srow-" + idx);
  if(selEl) selEl.classList.add("selected");

  var item = SCHED[idx];
  var inner = document.getElementById("sched-detail-inner");
  if(item.type === "rest") {
    inner.innerHTML = '<div class="det-rest">🛌&nbsp; ' + item.label + '</div>';
    return;
  }

  focusStage(item.n);

  var mapSt = null;
  for(var j=0; j<STAGES.length; j++) if(STAGES[j].n===item.n){mapSt=STAGES[j];break;}

  var badgeCls = "sb-" + item.stype.toLowerCase();
  var badgeLabel = TYPE_BADGE_LABEL[item.stype] || item.stype;
  var stageRows = "";
  for(var r=0; r<item.rows.length; r++) {
    stageRows += "<dt>" + item.rows[r][0] + "</dt><dd>" + item.rows[r][1] + "</dd>";
  }
  var climbsHtml = item.climbs
    ? '<div class="det-climbs">⛰ ' + item.climbs + '</div>'
    : "";

  var fromHtml, toHtml;
  if(mapSt) {
    fromHtml = '<button class="city-link" onclick="dropPin(' + mapSt.s[0] + ',' + mapSt.s[1] + ')">' + item.from + '</button>';
    toHtml   = '<button class="city-link" onclick="dropPin(' + mapSt.e[0] + ',' + mapSt.e[1] + ')">' + item.to   + '</button>';
  } else {
    fromHtml = item.from;
    toHtml   = item.to;
  }

  inner.innerHTML =
    '<div class="det-head">' +
      '<span class="det-stage-num">S' + item.n + '</span>' +
      '<span class="det-badge ' + badgeCls + '">' + badgeLabel + '</span>' +
    '</div>' +
    '<div class="det-route">' + fromHtml + ' → ' + toHtml + '</div>' +
    '<div class="det-sub">' + item.sub + '</div>' +
    '<dl class="det-grid">' + stageRows + '</dl>' +
    climbsHtml;
}

buildSchedList();

// ---- pin state ----
var pinLat = 0, pinLon = 0, pinActive = false;
function dropPin(lat, lon) {
  pinLat = lat; pinLon = lon; pinActive = true;
}
function dropPinStage(n, isStart) {
  for(var i=0; i<STAGES.length; i++) {
    if(STAGES[i].n===n) {
      var coord = isStart ? STAGES[i].s : STAGES[i].e;
      dropPin(coord[0], coord[1]); return;
    }
  }
}

// ---- focus map on stage ----
function focusStage(n) {
  var st = null;
  for(var i=0; i<STAGES.length; i++) if(STAGES[i].n===n){st=STAGES[i];break;}
  if(!st) return;
  var via = st.via || [];
  var mid = Math.floor(via.length / 2);
  var midLat = via.length > 0 ? (st.s[0]+st.e[0])/2 : (st.s[0]+st.e[0])/2;
  var midLon = via.length > 0 ? (st.s[1]+st.e[1])/2 : (st.s[1]+st.e[1])/2;
  if(via.length > 0){ midLat=via[mid][0]; midLon=via[mid][1]; }
  var targetZoom = 6.0;
  var aspect = (LON_MAX - LON_MIN) / (LAT_MAX - LAT_MIN);
  var tpx = W/2 - ox - (midLon - LON_MIN)/(LON_MAX - LON_MIN)*scale*aspect*targetZoom;
  var tpy = H/2 - oy - (1-(midLat - LAT_MIN)/(LAT_MAX - LAT_MIN))*scale*targetZoom;
  var sz=zoom, spx=panX, spy=panY, t=0, dur=35;
  function step(){
    t++;
    var p=t/dur; p=p<0.5?2*p*p:-1+(4-2*p)*p;
    zoom=sz+(targetZoom-sz)*p; panX=spx+(tpx-spx)*p; panY=spy+(tpy-spy)*p;
    if(t<dur) requestAnimationFrame(step);
  }
  requestAnimationFrame(step);
}

// ---- route map ----
var STAGES = [
  { n:1,  date:"7/4(土)",  type:"TTT",     from:"バルセロナ", to:"バルセロナ", km:19.7,
    s:[41.3851,2.1734], e:[41.4200,2.1900],
    via:[[41.3851,2.1734],[41.3700,2.1500],[41.3500,2.1000],[41.3200,2.0800],[41.3500,2.1500],[41.3851,2.1734]],
    climbs:["モンジュイック（サーキット）"] },
  { n:2,  date:"7/5(日)",  type:"hilly",   from:"タラゴナ", to:"バルセロナ", km:169.2,
    s:[41.1189,1.2445], e:[41.3851,2.1734],
    via:[[41.1189,1.2445],[41.1800,1.5500],[41.2200,1.7800],[41.3500,1.9800],[41.3651,2.0800],[41.3851,2.1734]],
    climbs:["モンジュイック（フィニッシュ）"] },
  { n:3,  date:"7/6(月)", type:"mountain", from:"グラノリェルス", to:"レ・サングル", km:196.2,
    s:[41.6087,2.2873], e:[42.5619,2.0442],
    via:[[41.6087,2.2873],[41.8000,2.1500],[42.0500,1.9500],[42.2700,1.9900],[42.4500,2.0200],[42.5619,2.0442]],
    climbs:["コル・デ・トセス（1,800m）","コル・ドゥ・カルヴェール"] },
  { n:4,  date:"7/7(火)", type:"hilly",   from:"カルカソンヌ", to:"フォワ", km:182.4,
    s:[43.2119,2.3536], e:[42.9639,1.6053],
    via:[[43.2119,2.3536],[43.1100,2.0500],[43.0200,1.8500],[42.9639,1.6053]],
    climbs:[] },
  { n:5,  date:"7/8(水)", type:"flat",    from:"ランヌメザン", to:"ポー", km:158.3,
    s:[43.1261,0.3840], e:[43.2951,-0.3708],
    via:[[43.1261,0.3840],[43.1800,0.1500],[43.2500,-0.1000],[43.2951,-0.3708]],
    climbs:[] },
  { n:6,  date:"7/9(木)", type:"mountain", from:"ポー", to:"ガヴァルニー＝ジェドル", km:186.4,
    s:[43.2951,-0.3708], e:[42.7322,-0.0131],
    via:[[43.2951,-0.3708],[43.0500,0.1000],[42.9650,0.3610],[42.8670,0.1430],[42.7800,0.0500],[42.7322,-0.0131]],
    climbs:["コル・ダスパン（1,489m）","コル・デュ・トゥールマレー（2,115m）🏔"] },
  { n:7,  date:"7/10(金)", type:"flat",   from:"アジェトモー", to:"ボルドー", km:175.0,
    s:[43.6597,-0.5890], e:[44.8378,-0.5792],
    via:[[43.6597,-0.5890],[43.7100,-1.0500],[44.0300,-1.0000],[44.3500,-0.8000],[44.8378,-0.5792]],
    climbs:[] },
  { n:8,  date:"7/11(土)", type:"flat",   from:"ペリグー", to:"ベルジュラック", km:180.4,
    s:[45.1844,0.7212], e:[44.8500,0.4833],
    via:[[45.1844,0.7212],[45.0500,0.6000],[44.8500,0.4833]],
    climbs:[] },
  { n:9,  date:"7/12(日)", type:"hilly",  from:"マルモール", to:"ユッセル", km:185.5,
    s:[45.1667,1.5500], e:[45.5500,2.3167],
    via:[[45.1667,1.5500],[45.2700,1.7700],[45.3800,2.0000],[45.5500,2.3167]],
    climbs:["コレーズ丘陵"] },
  { n:10, date:"7/14(火)", type:"mountain", from:"オーリヤック", to:"ル・リオラン", km:166.6,
    s:[44.9281,2.4400], e:[45.1000,2.7500],
    via:[[44.9281,2.4400],[45.0000,2.5500],[45.0500,2.6500],[45.1000,2.7500]],
    climbs:["コル・ド・キュレビエール","プラン・デュ・カンタル（山頂フィニッシュ）"] },
  { n:11, date:"7/15(水)", type:"flat",   from:"ヴィシー", to:"ヌヴェール", km:161.3,
    s:[46.1278,3.4267], e:[46.9897,3.1578],
    via:[[46.1278,3.4267],[46.3500,3.3000],[46.6500,3.2000],[46.9897,3.1578]],
    climbs:[] },
  { n:12, date:"7/16(木)", type:"flat",   from:"マニークール", to:"シャロン＝シュル＝ソーヌ", km:179.1,
    s:[46.8633,3.1639], e:[46.7806,4.8539],
    via:[[46.8633,3.1639],[46.8500,3.6000],[46.8200,4.1500],[46.7806,4.8539]],
    climbs:[] },
  { n:13, date:"7/17(金)", type:"hilly",  from:"ドール", to:"ベルフォール", km:205.8,
    s:[47.0919,5.4939], e:[47.6369,6.8628],
    via:[[47.0919,5.4939],[47.2400,6.0200],[47.5000,6.5000],[47.6369,6.8628]],
    climbs:["ジュラ丘陵"] },
  { n:14, date:"7/18(土)", type:"mountain", from:"ミュルーズ", to:"マルクシュタイン・フェレラン", km:155.3,
    s:[47.7508,7.3359], e:[47.9000,7.0167],
    via:[[47.7508,7.3359],[47.8200,7.2000],[47.8800,7.1000],[47.9000,7.0167]],
    climbs:["ヴォージュ山地（グラン・バロン方面）"] },
  { n:15, date:"7/19(日)", type:"mountain", from:"シャンパニョール", to:"プラトー・ド・ソレゾン", km:183.9,
    s:[46.7450,5.9058], e:[46.0833,6.4833],
    via:[[46.7450,5.9058],[46.5500,6.0500],[46.3800,6.2000],[46.1500,6.3800],[46.0833,6.4833]],
    climbs:["コル・ド・ラ・コロンビエール（1,613m）","プラトー・ド・ソレゾン（山頂フィニッシュ）🏔"] },
  { n:16, date:"7/21(火)", type:"ITT",    from:"エヴィアン＝レ＝バン", to:"トノン＝レ＝バン", km:26.1,
    s:[46.4003,6.5880], e:[46.3708,6.4789],
    via:[[46.4003,6.5880],[46.3900,6.5400],[46.3708,6.4789]],
    climbs:["レマン湖畔（個人TT）"] },
  { n:17, date:"7/22(水)", type:"flat",   from:"シャンベリー", to:"ヴォワロン", km:174.7,
    s:[45.5646,5.9178], e:[45.3633,5.5908],
    via:[[45.5646,5.9178],[45.5000,5.8000],[45.4200,5.7000],[45.3633,5.5908]],
    climbs:["グルノーブル経由"] },
  { n:18, date:"7/23(木)", type:"mountain", from:"ヴォワロン", to:"オルシエール＝メルレット", km:185.2,
    s:[45.3633,5.5908], e:[44.6833,6.3167],
    via:[[45.3633,5.5908],[45.1900,5.7200],[44.9500,5.9000],[44.7800,6.1500],[44.6833,6.3167]],
    climbs:["コル・デュ・ノワエ","オルシエール＝メルレット（山頂フィニッシュ）🏔"] },
  { n:19, date:"7/24(金)", type:"mountain", from:"ガップ", to:"アルプ・デュエズ", km:127.9,
    s:[44.5594,6.0797], e:[45.0900,6.0700],
    via:[[44.5594,6.0797],[44.7500,6.1500],[44.9500,6.1800],[45.0300,6.0700],[45.0900,6.0700]],
    climbs:["コル・デュ・ガリビエ（2,642m）","アルプ・デュエズ（21ヘアピン）🏔"] },
  { n:20, date:"7/25(土)", type:"mountain", from:"ル・ブール＝ドワザン", to:"アルプ・デュエズ（逆走）", km:170.9,
    s:[45.0550,6.0197], e:[45.0900,6.0700],
    via:[[45.0550,6.0197],[45.0200,6.0800],[45.0333,6.1330],[45.0500,6.1200],[45.0900,6.0700]],
    climbs:["コル・ド・サレンヌ（1,999m）","アルプ・デュエズ（逆走コース）🏔"] },
  { n:21, date:"7/26(日)", type:"flat",   from:"トワリー", to:"パリ（シャンゼリゼ）", km:133.0,
    s:[48.9614,1.8478], e:[48.8698,2.3078],
    via:[[48.9614,1.8478],[48.8714,2.1200],[48.8850,2.2000],[48.8800,2.2800],[48.8698,2.3078]],
    climbs:["モンマルトル（3周回）","シャンゼリゼ（フィニッシュ）"] },
];

var CLIMBS = [
  { name:"コル・デュ・トゥールマレー", lat:42.867, lon:0.143,  elev:2115 },
  { name:"コル・ダスパン",             lat:42.965, lon:0.361,  elev:1489 },
  { name:"コル・ド・トセス",           lat:42.270, lon:1.990,  elev:1800 },
  { name:"コル・ド・ラ・コロンビエール", lat:45.983, lon:6.467,  elev:1613 },
  { name:"コル・デュ・ガリビエ",       lat:45.064, lon:6.408,  elev:2642 },
  { name:"コル・ド・サレンヌ",         lat:45.033, lon:6.133,  elev:1999 },
  { name:"アルプ・デュエズ",           lat:45.090, lon:6.070,  elev:1860 },
  { name:"プラトー・ド・ソレゾン",      lat:46.083, lon:6.483,  elev:1450 },
  { name:"オルシエール＝メルレット",    lat:44.683, lon:6.317,  elev:1825 },
  { name:"ガヴァルニー",               lat:42.732, lon:-0.013, elev:1365 },
  { name:"ル・リオラン",               lat:45.100, lon:2.750,  elev:1160 },
  { name:"マルクシュタイン",           lat:47.900, lon:7.017,  elev:1267 },
];

var TYPE_COLOR = { flat:"#3fb950", hilly:"#ffa657", mountain:"#ff7b72", TTT:"#79c0ff", ITT:"#79c0ff" };
var TYPE_LABEL = { flat:"平坦", hilly:"丘陵", mountain:"山岳", TTT:"チームTT", ITT:"個人TT" };
var LON_MIN = -2.0, LON_MAX = 8.5, LAT_MIN = 41.0, LAT_MAX = 50.5;

var canvas = document.getElementById("c");
var ctx = canvas.getContext("2d");
var mapPanel = document.getElementById("map-panel");
var tooltip  = document.getElementById("map-tooltip");
var ttStage  = document.getElementById("tt-stage");
var ttRoute  = document.getElementById("tt-route");
var ttDetail = document.getElementById("tt-detail");
var ttClimbs = document.getElementById("tt-climbs");

var W, H, scale, ox, oy;
var panX = 0, panY = 0, zoom = 1;
var dragging = false, dragStart, panStart;
var hoveredStage = null;

function resize() {
  W = canvas.width  = mapPanel.clientWidth;
  H = canvas.height = mapPanel.clientHeight;
  var aspect = (LON_MAX - LON_MIN) / (LAT_MAX - LAT_MIN);
  var pad = 48;
  if ((W - pad*2) / aspect < H - pad*2) {
    scale = (W - pad*2) / aspect;
    ox = pad; oy = (H - scale) / 2;
  } else {
    scale = H - pad*2;
    ox = (W - scale * aspect) / 2; oy = pad;
  }
}

function toScreen(lat, lon) {
  var aspect = (LON_MAX - LON_MIN) / (LAT_MAX - LAT_MIN);
  return {
    x: ox + (lon - LON_MIN) / (LON_MAX - LON_MIN) * scale * aspect * zoom + panX,
    y: oy + (1 - (lat - LAT_MIN) / (LAT_MAX - LAT_MIN)) * scale * zoom + panY
  };
}

function ptNearPolyline(mx, my, pts) {
  var best = 99999;
  for (var i = 0; i < pts.length-1; i++) {
    var ax=pts[i].x, ay=pts[i].y, bx=pts[i+1].x, by=pts[i+1].y;
    var dx=bx-ax, dy=by-ay, len2=dx*dx+dy*dy;
    if (len2===0) { best=Math.min(best,Math.hypot(mx-ax,my-ay)); continue; }
    var t=Math.max(0,Math.min(1,((mx-ax)*dx+(my-ay)*dy)/len2));
    best=Math.min(best,Math.hypot(mx-(ax+t*dx),my-(ay+t*dy)));
  }
  return best;
}

var FRANCE = [
  [51.09,-2.0],[50.95,1.86],[50.72,1.60],[50.12,1.85],[49.50,0.18],
  [48.84,-1.55],[48.02,-1.83],[47.60,-2.55],[47.29,-2.38],[46.90,-2.10],
  [45.78,-1.36],[45.22,-0.64],[43.47,-1.79],[43.39,-1.65],[43.36,0.70],
  [42.56,1.73],[42.44,3.17],[43.24,3.26],[43.57,4.19],[43.43,4.88],
  [43.55,5.40],[43.12,6.04],[43.47,7.42],[43.86,7.60],[44.24,7.26],
  [44.87,6.89],[45.10,6.76],[45.65,7.20],[45.93,7.17],[46.45,7.63],
  [46.41,8.80],[47.00,8.22],[47.61,7.60],[48.00,7.48],[48.97,8.20],
  [49.46,8.03],[49.98,6.36],[50.12,5.82],[50.42,4.85],[50.82,4.24],
  [51.09,2.50],[51.09,-2.0]
];
var SPAIN = [
  [43.39,-1.79],[43.36,0.70],[42.56,1.73],[42.44,3.17],[40.45,0.78],
  [37.42,-1.65],[36.05,-5.35],[36.00,-5.61],[36.40,-6.05],[37.43,-7.51],
  [37.03,-8.85],[38.00,-8.85],[39.00,-9.39],[41.40,-8.90],[41.90,-8.70],
  [42.02,-7.00],[42.80,-6.78],[43.79,-7.62],[43.79,-5.00],[43.60,-4.00],
  [43.57,-3.00],[43.48,-2.00],[43.39,-1.79]
];

function drawCountry(pts, fill) {
  ctx.save();
  ctx.beginPath();
  var p0=toScreen(pts[0][0],pts[0][1]); ctx.moveTo(p0.x,p0.y);
  for(var i=1;i<pts.length;i++){var p=toScreen(pts[i][0],pts[i][1]);ctx.lineTo(p.x,p.y);}
  ctx.closePath();
  ctx.fillStyle=fill; ctx.fill();
  ctx.strokeStyle="#30363d"; ctx.lineWidth=1; ctx.stroke();
  ctx.restore();
}

function draw() {
  ctx.clearRect(0,0,W,H);
  ctx.fillStyle="#0d1117"; ctx.fillRect(0,0,W,H);
  drawCountry(SPAIN,  "#161b22");
  drawCountry(FRANCE, "#1c2128");

  var stagePts = STAGES.map(function(st) {
    var pts = [];
    pts.push(toScreen(st.s[0],st.s[1]));
    (st.via||[]).forEach(function(v){pts.push(toScreen(v[0],v[1]));});
    pts.push(toScreen(st.e[0],st.e[1]));
    return pts;
  });

  STAGES.forEach(function(st, idx) {
    var pts = stagePts[idx];
    var color = TYPE_COLOR[st.type] || "#8b949e";
    var isHover = hoveredStage && hoveredStage.n === st.n;
    if (isHover) {
      ctx.save();
      ctx.beginPath();
      ctx.moveTo(pts[0].x,pts[0].y);
      for(var i=1;i<pts.length;i++) ctx.lineTo(pts[i].x,pts[i].y);
      ctx.strokeStyle=color; ctx.lineWidth=14; ctx.globalAlpha=0.18; ctx.stroke();
      ctx.restore();
    }
    ctx.save();
    ctx.beginPath();
    ctx.moveTo(pts[0].x,pts[0].y);
    for(var i=1;i<pts.length;i++) ctx.lineTo(pts[i].x,pts[i].y);
    ctx.strokeStyle=color;
    ctx.lineWidth=isHover?4.5:2.5;
    ctx.globalAlpha=isHover?1:0.8;
    if(st.type==="TTT"||st.type==="ITT") ctx.setLineDash([7,4]);
    ctx.lineJoin="round"; ctx.lineCap="round";
    ctx.stroke();
    ctx.restore();

    var mid=Math.floor(pts.length/2);
    var mx=(pts[mid].x+(pts[mid>0?mid-1:0].x))/2;
    var my=(pts[mid].y+(pts[mid>0?mid-1:0].y))/2;
    if(zoom>0.85){
      ctx.save();
      ctx.beginPath(); ctx.arc(mx,my,8,0,Math.PI*2);
      ctx.fillStyle=isHover?color:"#21262d"; ctx.fill();
      ctx.strokeStyle=color; ctx.lineWidth=1.5; ctx.stroke();
      ctx.fillStyle=isHover?"#0d1117":color;
      ctx.font="700 8px 'Segoe UI',sans-serif";
      ctx.textAlign="center"; ctx.textBaseline="middle";
      ctx.fillText(st.n, mx, my);
      ctx.restore();
    }
  });

  if(zoom>1.0) {
    CLIMBS.forEach(function(cl) {
      var sc=toScreen(cl.lat,cl.lon);
      ctx.save();
      ctx.beginPath(); ctx.arc(sc.x,sc.y,4,0,Math.PI*2);
      ctx.fillStyle="#d2a8ff"; ctx.fill();
      ctx.strokeStyle="#0d1117"; ctx.lineWidth=1; ctx.stroke();
      if(zoom>1.6){
        ctx.font="9px 'Segoe UI',sans-serif";
        ctx.fillStyle="#d2a8ff"; ctx.globalAlpha=0.85;
        ctx.fillText(cl.name+"("+cl.elev+"m)", sc.x+6, sc.y+3);
      }
      ctx.restore();
    });
  }

  var seen = {};
  STAGES.forEach(function(st) {
    [[st.s[0],st.s[1],st.from,true],[st.e[0],st.e[1],st.to,st.type==="mountain"]].forEach(function(d) {
      var key=d[0].toFixed(2)+","+d[1].toFixed(2);
      if(seen[key]) return; seen[key]=true;
      var sc=toScreen(d[0],d[1]);
      var isAnchor=(d[2]==="バルセロナ"||d[2]==="パリ（シャンゼリゼ）");
      var r=isAnchor?6:3.5;
      var color=isAnchor?"#ff7b72":(d[3]?"#ffa657":"#8b949e");
      if(isAnchor){
        var g=ctx.createRadialGradient(sc.x,sc.y,0,sc.x,sc.y,r*3);
        g.addColorStop(0,"#ff7b7266"); g.addColorStop(1,"transparent");
        ctx.save(); ctx.beginPath(); ctx.arc(sc.x,sc.y,r*3,0,Math.PI*2);
        ctx.fillStyle=g; ctx.fill(); ctx.restore();
      }
      ctx.beginPath(); ctx.arc(sc.x,sc.y,r,0,Math.PI*2);
      ctx.fillStyle=color; ctx.fill();
      if(isAnchor||zoom>1.5){
        ctx.save();
        ctx.font=(isAnchor?"700":"400")+" "+(isAnchor?12:10)+"px 'Segoe UI',sans-serif";
        ctx.fillStyle=isAnchor?"#ff7b72":"#8b949e"; ctx.globalAlpha=0.9;
        ctx.fillText(d[2],sc.x+r+4,sc.y+4);
        ctx.restore();
      }
    });
  });

  if(pinActive) {
    var ps = toScreen(pinLat, pinLon);
    ctx.save();
    ctx.font = "22px serif";
    ctx.textAlign = "center";
    ctx.textBaseline = "bottom";
    ctx.fillText("📍", ps.x, ps.y);
    ctx.restore();
  }

  requestAnimationFrame(draw);
}

function showTooltipAt(st, cx, cy) {
  ttStage.textContent="ステージ "+st.n+"  "+st.date;
  ttRoute.textContent=st.from+"  →  "+st.to;
  ttDetail.textContent=st.km+" km  |  "+TYPE_LABEL[st.type];
  ttClimbs.textContent=st.climbs&&st.climbs.length?"⛰ "+st.climbs.join(" › "):"";
  tooltip.style.display="block";
  var tx=cx+16, ty=cy-10;
  if(tx+270>W) tx=cx-280;
  if(ty+80>H) ty=H-90;
  if(ty<0) ty=8;
  tooltip.style.left=tx+"px"; tooltip.style.top=ty+"px";
}

function findStageAt(mx, my) {
  for(var i=0;i<STAGES.length;i++){
    var st=STAGES[i];
    var pts=[];
    pts.push(toScreen(st.s[0],st.s[1]));
    (st.via||[]).forEach(function(v){pts.push(toScreen(v[0],v[1]));});
    pts.push(toScreen(st.e[0],st.e[1]));
    if(ptNearPolyline(mx,my,pts)<14) return st;
  }
  return null;
}

canvas.addEventListener("mousemove", function(e) {
  if(dragging){
    panX=panStart.x+(e.clientX-dragStart.x);
    panY=panStart.y+(e.clientY-dragStart.y); return;
  }
  var rect=canvas.getBoundingClientRect();
  var mx=e.clientX-rect.left, my=e.clientY-rect.top;
  hoveredStage=findStageAt(mx,my);
  if(hoveredStage){
    canvas.style.cursor="pointer";
    showTooltipAt(hoveredStage, e.clientX-rect.left, e.clientY-rect.top);
  } else {
    canvas.style.cursor="grab";
    tooltip.style.display="none";
  }
});
canvas.addEventListener("mousedown",function(e){
  dragging=true; dragStart={x:e.clientX,y:e.clientY}; panStart={x:panX,y:panY};
  canvas.style.cursor="grabbing"; tooltip.style.display="none";
});
window.addEventListener("mouseup",function(){dragging=false;canvas.style.cursor="grab";});
canvas.addEventListener("wheel",function(e){
  e.preventDefault();
  var f=e.deltaY<0?1.12:0.89;
  var rect=canvas.getBoundingClientRect();
  var mx=e.clientX-rect.left, my=e.clientY-rect.top;
  panX=mx+(panX-mx)*f; panY=my+(panY-my)*f;
  zoom=Math.max(0.4,Math.min(zoom*f,12));
},{passive:false});

// touch support
var touchStartX, touchStartY, touchPinchDist=0, isTap=false;
canvas.addEventListener("touchstart",function(e){
  e.preventDefault();
  if(e.touches.length===1){
    var t=e.touches[0];
    dragStart={x:t.clientX,y:t.clientY};
    panStart={x:panX,y:panY};
    touchStartX=t.clientX; touchStartY=t.clientY;
    dragging=true; isTap=true;
  } else if(e.touches.length===2){
    isTap=false;
    var dx=e.touches[0].clientX-e.touches[1].clientX;
    var dy=e.touches[0].clientY-e.touches[1].clientY;
    touchPinchDist=Math.hypot(dx,dy);
    dragging=false;
  }
  tooltip.style.display="none";
},{passive:false});

canvas.addEventListener("touchmove",function(e){
  e.preventDefault();
  if(e.touches.length===1 && dragging){
    var t=e.touches[0];
    var dx=t.clientX-touchStartX, dy=t.clientY-touchStartY;
    if(Math.hypot(dx,dy)>6) isTap=false;
    panX=panStart.x+(t.clientX-dragStart.x);
    panY=panStart.y+(t.clientY-dragStart.y);
  } else if(e.touches.length===2){
    isTap=false;
    var dx=e.touches[0].clientX-e.touches[1].clientX;
    var dy=e.touches[0].clientY-e.touches[1].clientY;
    var dist=Math.hypot(dx,dy);
    var f=dist/(touchPinchDist||dist);
    var cx=(e.touches[0].clientX+e.touches[1].clientX)/2;
    var cy=(e.touches[0].clientY+e.touches[1].clientY)/2;
    var rect=canvas.getBoundingClientRect();
    var mx=cx-rect.left, my=cy-rect.top;
    panX=mx+(panX-mx)*f; panY=my+(panY-my)*f;
    zoom=Math.max(0.4,Math.min(zoom*f,12));
    touchPinchDist=dist;
  }
},{passive:false});

canvas.addEventListener("touchend",function(e){
  e.preventDefault();
  dragging=false;
  if(isTap && e.changedTouches.length===1){
    var t=e.changedTouches[0];
    var rect=canvas.getBoundingClientRect();
    var mx=t.clientX-rect.left, my=t.clientY-rect.top;
    var st=findStageAt(mx,my);
    if(st){
      if(hoveredStage && hoveredStage.n===st.n && tooltip.style.display==="block"){
        tooltip.style.display="none"; hoveredStage=null;
      } else {
        hoveredStage=st; showTooltipAt(st,mx,my);
      }
    } else {
      hoveredStage=null; tooltip.style.display="none";
    }
  }
  isTap=false;
},{passive:false});

window.addEventListener("resize",function(){resize();});

resize();
draw();
</script>
</body>
</html>`;
}
