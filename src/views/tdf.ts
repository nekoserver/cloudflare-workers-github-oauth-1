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
  width:360px; flex-shrink:0; overflow-y:auto;
  border-left:1px solid var(--border); background:var(--bg);
}
#sched-inner { padding:12px 10px 32px; }

.sched-legend {
  display:flex; gap:10px; flex-wrap:wrap; margin-bottom:12px;
  font-size:10px; color:var(--muted);
}
.sched-legend span { display:flex; align-items:center; gap:5px; }
.lbadge { display:inline-block; padding:1px 7px; border-radius:4px; font-size:9px; font-weight:700; }

.rest-day {
  background:var(--surface2); border:1px solid var(--border); border-radius:7px;
  padding:9px 12px; margin-bottom:6px; display:flex; align-items:center; gap:10px;
  font-size:12px; color:var(--muted);
}
.rest-day .rdate { min-width:72px; font-size:10px; }

.sc {
  background:var(--surface2); border:1px solid var(--border); border-radius:7px;
  margin-bottom:6px; overflow:hidden; transition:border-color .15s;
}
.sc:hover { border-color:var(--accent); }
.sc-head {
  display:grid; grid-template-columns:40px 78px 1fr auto; align-items:center; gap:8px;
  padding:9px 12px; cursor:pointer;
}
.sc-num  { font-size:16px; font-weight:700; color:var(--accent); text-align:center; }
.sc-date { font-size:10px; color:var(--muted); line-height:1.5; }
.sc-rt   { }
.sc-rt .ft { font-size:12px; font-weight:600; }
.sc-rt .sb { font-size:10px; color:var(--muted); margin-top:2px; }
.sc-km   { text-align:right; font-size:12px; font-weight:700; white-space:nowrap; }

.type-badge {
  display:inline-block; padding:1px 6px; border-radius:4px;
  font-size:9px; font-weight:700; margin-left:5px;
}
.t-flat     { background:#1a2f1a; color:#3fb950; border:1px solid #3fb95044; }
.t-hilly    { background:#2f2010; color:#ffa657; border:1px solid #ffa65744; }
.t-mountain { background:#2f1010; color:#ff7b72; border:1px solid #ff7b7244; }
.t-ttt      { background:#101a2f; color:#79c0ff; border:1px solid #79c0ff44; }
.t-itt      { background:#101a2f; color:#79c0ff; border:1px solid #79c0ff44; }

.sc-detail {
  border-top:1px solid var(--border);
  padding:10px 12px; font-size:11px; line-height:1.8; display:none;
  background:#13181e;
}
.sc-detail.open { display:block; }
.dg { display:grid; grid-template-columns:1fr 1fr; gap:6px 18px; }
.dg dt { color:var(--muted); font-size:10px; }
.dg dd { color:var(--text); }
.climbs { margin-top:7px; color:#d2a8ff; font-size:10px; }
.climbs::before { content:'⛰ '; }
</style>
</head>
<body>
<div id="hdr">
  <h1>🚴 Tour de France 2026</h1>
  <span class="sub">7月4日〜26日 &nbsp;|&nbsp; バルセロナ → パリ &nbsp;|&nbsp; 全21ステージ &nbsp;約3,333km</span>
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
    <div id="sched-inner">
    <div class="sched-legend">
      <span><span class="lbadge t-flat">平坦</span></span>
      <span><span class="lbadge t-hilly">丘陵</span></span>
      <span><span class="lbadge t-mountain">山岳</span></span>
      <span><span class="lbadge t-ttt">TTT</span></span>
      <span><span class="lbadge t-itt">ITT</span></span>
      <span style="color:var(--muted)">🏔=山頂F</span>
      <span style="color:var(--muted)">時刻=CEST</span>
    </div>

<!-- S1 -->
<div class="sc">
  <div class="sc-head" onclick="tog(this)">
    <div class="sc-num">1</div>
    <div class="sc-date">7月4日（土）<br>バルセロナ</div>
    <div class="sc-rt">
      <div class="ft">バルセロナ → バルセロナ <span class="type-badge t-ttt">TTT</span></div>
      <div class="sb">カタルーニャ州都・地中海の港湾都市 — モンジュイック丘上サーキット</div>
    </div>
    <div class="sc-km">19.7 km</div>
  </div>
  <div class="sc-detail">
    <div class="dg">
      <div><dt>スタート</dt><dd>17:05 CEST（JST 翌00:05）</dd></div>
      <div><dt>最終チーム出走</dt><dd>〜18:55 CEST</dd></div>
      <div><dt>スタート都市</dt><dd>バルセロナ — スペイン第2の都市、ガウディ建築で世界的に知られるカタルーニャの文化首都</dd></div>
      <div><dt>注目ポイント</dt><dd>1971年以来のグランデパール・チームTT</dd></div>
    </div>
  </div>
</div>

<!-- S2 -->
<div class="sc">
  <div class="sc-head" onclick="tog(this)">
    <div class="sc-num">2</div>
    <div class="sc-date">7月5日（日）<br>カタルーニャ</div>
    <div class="sc-rt">
      <div class="ft">タラゴナ → バルセロナ <span class="type-badge t-hilly">丘陵</span></div>
      <div class="sb">ローマ時代の古都 → モンジュイック丘アップヒルフィニッシュ</div>
    </div>
    <div class="sc-km">169.2 km</div>
  </div>
  <div class="sc-detail">
    <div class="dg">
      <div><dt>スタート</dt><dd>〜13:05 CEST（JST 20:05）</dd></div>
      <div><dt>フィニッシュ予想</dt><dd>〜17:00 CEST</dd></div>
      <div><dt>スタート都市</dt><dd>タラゴナ — ローマ帝国属州の首都タラコとして栄えた古都。円形劇場・城壁が世界遺産</dd></div>
      <div><dt>獲得標高</dt><dd>約2,500m</dd></div>
    </div>
    <div class="climbs">モンジュイック（フィニッシュ）</div>
  </div>
</div>

<!-- S3 -->
<div class="sc">
  <div class="sc-head" onclick="tog(this)">
    <div class="sc-num">3</div>
    <div class="sc-date">7月6日（月）<br>スペイン→フランス</div>
    <div class="sc-rt">
      <div class="ft">グラノリェルス → レ・サングル 🏔 <span class="type-badge t-mountain">山岳</span></div>
      <div class="sb">バルセロナ郊外の工業都市 → ピレネー越えでフランス入り</div>
    </div>
    <div class="sc-km">196.2 km</div>
  </div>
  <div class="sc-detail">
    <div class="dg">
      <div><dt>スタート</dt><dd>〜12:15 CEST（JST 19:15）</dd></div>
      <div><dt>フィニッシュ予想</dt><dd>〜17:30 CEST</dd></div>
      <div><dt>フィニッシュ地点</dt><dd>レ・サングル — アリエージュ県の山岳集落（標高約1,300m）</dd></div>
      <div><dt>獲得標高</dt><dd>約3,850m</dd></div>
    </div>
    <div class="climbs">コル・デ・トセス（1,800m） › コル・デュ・カルヴェール › レ・サングル山頂</div>
  </div>
</div>

<!-- S4 -->
<div class="sc">
  <div class="sc-head" onclick="tog(this)">
    <div class="sc-num">4</div>
    <div class="sc-date">7月7日（火）<br>オクシタニー</div>
    <div class="sc-rt">
      <div class="ft">カルカソンヌ → フォワ <span class="type-badge t-hilly">丘陵</span></div>
      <div class="sb">世界遺産の城塞都市 → カタリ派ゆかりの中世城塞町</div>
    </div>
    <div class="sc-km">182.4 km</div>
  </div>
  <div class="sc-detail">
    <div class="dg">
      <div><dt>スタート</dt><dd>〜13:05 CEST（JST 20:05）</dd></div>
      <div><dt>フィニッシュ予想</dt><dd>〜17:30 CEST</dd></div>
      <div><dt>スタート都市</dt><dd>カルカソンヌ — ユネスコ世界遺産の二重城壁を持つ中世城塞都市</dd></div>
      <div><dt>フィニッシュ都市</dt><dd>フォワ — 岩山に建つフォワ城、12〜13世紀カタリ派の本拠地</dd></div>
    </div>
  </div>
</div>

<!-- S5 -->
<div class="sc">
  <div class="sc-head" onclick="tog(this)">
    <div class="sc-num">5</div>
    <div class="sc-date">7月8日（水）<br>ガスコーニュ</div>
    <div class="sc-rt">
      <div class="ft">ランヌメザン → ポー <span class="type-badge t-flat">平坦</span></div>
      <div class="sb">ピレネー山麓の小都市 → ベアルン地方の歴史ある王都へ</div>
    </div>
    <div class="sc-km">158.3 km</div>
  </div>
  <div class="sc-detail">
    <div class="dg">
      <div><dt>スタート</dt><dd>〜13:30 CEST（JST 20:30）</dd></div>
      <div><dt>フィニッシュ予想</dt><dd>〜17:00 CEST</dd></div>
      <div><dt>フィニッシュ都市</dt><dd>ポー — アンリ4世生誕の地。断崖上のポー城からピレネーを一望</dd></div>
      <div><dt>コース概要</dt><dd>ほぼ平坦。集団スプリント有力</dd></div>
    </div>
  </div>
</div>

<!-- S6 -->
<div class="sc">
  <div class="sc-head" onclick="tog(this)">
    <div class="sc-num">6</div>
    <div class="sc-date">7月9日（木）<br>ピレネー</div>
    <div class="sc-rt">
      <div class="ft">ポー → ガヴァルニー＝ジェドル 🏔 <span class="type-badge t-mountain">山岳</span></div>
      <div class="sb">ベアルン王都 → ユネスコ世界遺産の圏谷（カール）フィニッシュ</div>
    </div>
    <div class="sc-km">186.4 km</div>
  </div>
  <div class="sc-detail">
    <div class="dg">
      <div><dt>スタート</dt><dd>〜12:00 CEST（JST 19:00）</dd></div>
      <div><dt>フィニッシュ予想</dt><dd>〜17:30 CEST</dd></div>
      <div><dt>フィニッシュ地点</dt><dd>ガヴァルニー＝ジェドル — 氷河が削り出した世界遺産の巨大圏谷、落差423mの大瀑布</dd></div>
      <div><dt>獲得標高</dt><dd>約4,600m</dd></div>
    </div>
    <div class="climbs">コル・ダスパン（1,489m） › コル・デュ・トゥールマレー（2,115m）🏔 › ガヴァルニー圏谷</div>
  </div>
</div>

<!-- S7 -->
<div class="sc">
  <div class="sc-head" onclick="tog(this)">
    <div class="sc-num">7</div>
    <div class="sc-date">7月10日（金）<br>ガスコーニュ→ボルドー</div>
    <div class="sc-rt">
      <div class="ft">アジェトモー → ボルドー <span class="type-badge t-flat">平坦</span></div>
      <div class="sb">ガスコーニュの小都市 → 世界遺産のワイン交易港湾都市へ</div>
    </div>
    <div class="sc-km">175.0 km</div>
  </div>
  <div class="sc-detail">
    <div class="dg">
      <div><dt>スタート</dt><dd>〜13:30 CEST（JST 20:30）</dd></div>
      <div><dt>フィニッシュ予想</dt><dd>〜17:00 CEST</dd></div>
      <div><dt>フィニッシュ都市</dt><dd>ボルドー — 「月の港」として世界遺産登録、フランス最大のワイン産地</dd></div>
      <div><dt>コース概要</dt><dd>ランド地方の平地を北上。集団スプリント</dd></div>
    </div>
  </div>
</div>

<!-- S8 -->
<div class="sc">
  <div class="sc-head" onclick="tog(this)">
    <div class="sc-num">8</div>
    <div class="sc-date">7月11日（土）<br>ドルドーニュ</div>
    <div class="sc-rt">
      <div class="ft">ペリグー → ベルジュラック <span class="type-badge t-flat">平坦</span></div>
      <div class="sb">トリュフとフォワグラの美食都市 → シラノ・ド・ベルジュラック生誕の地</div>
    </div>
    <div class="sc-km">180.4 km</div>
  </div>
  <div class="sc-detail">
    <div class="dg">
      <div><dt>スタート</dt><dd>〜13:30 CEST（JST 20:30）</dd></div>
      <div><dt>フィニッシュ予想</dt><dd>〜17:00 CEST</dd></div>
      <div><dt>スタート都市</dt><dd>ペリグー — ペリゴール・ノワール地方の中心、トリュフ・フォワグラの美食産地</dd></div>
      <div><dt>フィニッシュ都市</dt><dd>ベルジュラック — ドルドーニュ川沿いのワイン産地、「シラノ」の名で世界的に有名</dd></div>
    </div>
  </div>
</div>

<!-- S9 -->
<div class="sc">
  <div class="sc-head" onclick="tog(this)">
    <div class="sc-num">9</div>
    <div class="sc-date">7月12日（日）<br>コレーズ</div>
    <div class="sc-rt">
      <div class="ft">マルモール → ユッセル <span class="type-badge t-hilly">丘陵</span></div>
      <div class="sb">コレーズの渓谷町 → マッシフ・サントラルの高原都市へ</div>
    </div>
    <div class="sc-km">185.5 km</div>
  </div>
  <div class="sc-detail">
    <div class="dg">
      <div><dt>スタート</dt><dd>〜13:05 CEST（JST 20:05）</dd></div>
      <div><dt>フィニッシュ予想</dt><dd>〜17:30 CEST</dd></div>
      <div><dt>スタート都市</dt><dd>マルモール — コレーズ川とドルドーニュ川の合流点近くの渓谷の町</dd></div>
      <div><dt>フィニッシュ都市</dt><dd>ユッセル — マッシフ・サントラルの高台に位置する農業・牧畜の小都市</dd></div>
    </div>
  </div>
</div>

<div class="rest-day">
  <div class="rdate">7月13日（月）</div>
  <div>🛌 第1休息日 — カンタル地方</div>
</div>

<!-- S10 -->
<div class="sc">
  <div class="sc-head" onclick="tog(this)">
    <div class="sc-num">10</div>
    <div class="sc-date">7月14日（火）<br>カンタル（革命記念日）</div>
    <div class="sc-rt">
      <div class="ft">オーリヤック → ル・リオラン 🏔 <span class="type-badge t-mountain">山岳</span></div>
      <div class="sb">カンタル県都・チーズの町 → 革命記念日の火山高地フィニッシュ</div>
    </div>
    <div class="sc-km">166.6 km</div>
  </div>
  <div class="sc-detail">
    <div class="dg">
      <div><dt>スタート</dt><dd>〜12:15 CEST（JST 19:15）</dd></div>
      <div><dt>フィニッシュ予想</dt><dd>〜17:00 CEST</dd></div>
      <div><dt>スタート都市</dt><dd>オーリヤック — AOCチーズ「カンタル」の産地、カンタル火山群に囲まれた城壁都市</dd></div>
      <div><dt>フィニッシュ地点</dt><dd>ル・リオラン — カンタル火山群中腹（標高約1,160m）の小スキーリゾート村</dd></div>
    </div>
    <div class="climbs">プラン・デュ・カンタル › ル・リオラン山頂フィニッシュ（1,160m）</div>
  </div>
</div>

<!-- S11 -->
<div class="sc">
  <div class="sc-head" onclick="tog(this)">
    <div class="sc-num">11</div>
    <div class="sc-date">7月15日（水）<br>オーヴェルニュ</div>
    <div class="sc-rt">
      <div class="ft">ヴィシー → ヌヴェール <span class="type-badge t-flat">平坦</span></div>
      <div class="sb">ヨーロッパ屈指の温泉保養地 → ロワール川沿いの陶器の街へ</div>
    </div>
    <div class="sc-km">161.3 km</div>
  </div>
  <div class="sc-detail">
    <div class="dg">
      <div><dt>スタート</dt><dd>〜13:30 CEST（JST 20:30）</dd></div>
      <div><dt>フィニッシュ予想</dt><dd>〜17:00 CEST</dd></div>
      <div><dt>スタート都市</dt><dd>ヴィシー — ベル・エポック期の優雅な建築と温泉施設で知られるヨーロッパ屈指の保養地</dd></div>
      <div><dt>フィニッシュ都市</dt><dd>ヌヴェール — ロワール川畔、ヌヴェール焼（ファイアンス陶器）の産地</dd></div>
    </div>
  </div>
</div>

<!-- S12 -->
<div class="sc">
  <div class="sc-head" onclick="tog(this)">
    <div class="sc-num">12</div>
    <div class="sc-date">7月16日（木）<br>ブルゴーニュ</div>
    <div class="sc-rt">
      <div class="ft">マニークール → シャロン＝シュル＝ソーヌ <span class="type-badge t-flat">平坦</span></div>
      <div class="sb">フランスF1グランプリの舞台 → ブルゴーニュワインの集散地へ</div>
    </div>
    <div class="sc-km">179.1 km</div>
  </div>
  <div class="sc-detail">
    <div class="dg">
      <div><dt>スタート</dt><dd>〜13:30 CEST（JST 20:30）</dd></div>
      <div><dt>フィニッシュ予想</dt><dd>〜17:00 CEST</dd></div>
      <div><dt>スタート地点</dt><dd>マニークール — フランスF1グランプリ（ニヴェルネ）の開催地サーキット</dd></div>
      <div><dt>フィニッシュ都市</dt><dd>シャロン＝シュル＝ソーヌ — ソーヌ川沿いのワイン集散・水運の要衝</dd></div>
    </div>
  </div>
</div>

<!-- S13 -->
<div class="sc">
  <div class="sc-head" onclick="tog(this)">
    <div class="sc-num">13</div>
    <div class="sc-date">7月17日（金）<br>ジュラ→アルザス</div>
    <div class="sc-rt">
      <div class="ft">ドール → ベルフォール <span class="type-badge t-hilly">丘陵</span></div>
      <div class="sb">パスツール生誕の塩の交易都市 → 難攻不落の要塞都市へ（最長ステージ）</div>
    </div>
    <div class="sc-km">205.8 km</div>
  </div>
  <div class="sc-detail">
    <div class="dg">
      <div><dt>スタート</dt><dd>〜12:30 CEST（JST 19:30）</dd></div>
      <div><dt>フィニッシュ予想</dt><dd>〜18:00 CEST</dd></div>
      <div><dt>スタート都市</dt><dd>ドール — 細菌学者パスツールの生誕地、かつてフランシュ＝コンテ地方の首都</dd></div>
      <div><dt>フィニッシュ都市</dt><dd>ベルフォール — 普仏戦争に耐えた要塞都市「ライオンの町」、岩山の巨大ライオン像が象徴</dd></div>
    </div>
  </div>
</div>

<!-- S14 -->
<div class="sc">
  <div class="sc-head" onclick="tog(this)">
    <div class="sc-num">14</div>
    <div class="sc-date">7月18日（土）<br>ヴォージュ</div>
    <div class="sc-rt">
      <div class="ft">ミュルーズ → マルクシュタイン・フェレラン 🏔 <span class="type-badge t-mountain">山岳</span></div>
      <div class="sb">アルザスの工業都市 → ヴォージュ山地の尾根リゾートへ</div>
    </div>
    <div class="sc-km">155.3 km</div>
  </div>
  <div class="sc-detail">
    <div class="dg">
      <div><dt>スタート</dt><dd>〜12:15 CEST（JST 19:15）</dd></div>
      <div><dt>フィニッシュ予想</dt><dd>〜17:00 CEST</dd></div>
      <div><dt>スタート都市</dt><dd>ミュルーズ — 自動車・鉄道の産業博物館で知られる多文化工業都市、独・スイス国境近傍</dd></div>
      <div><dt>フィニッシュ地点</dt><dd>マルクシュタイン・フェレラン — ヴォージュ山地の尾根（1,267m）スキーリゾート</dd></div>
    </div>
    <div class="climbs">グラン・バロン方面 › マルクシュタイン山頂フィニッシュ（1,267m）</div>
  </div>
</div>

<!-- S15 -->
<div class="sc">
  <div class="sc-head" onclick="tog(this)">
    <div class="sc-num">15</div>
    <div class="sc-date">7月19日（日）<br>ジュラ→アルプス</div>
    <div class="sc-rt">
      <div class="ft">シャンパニョール → プラトー・ド・ソレゾン 🏔 <span class="type-badge t-mountain">山岳</span></div>
      <div class="sb">ジュラのチーズ産地 → ツール史上初登場の高原フィニッシュ</div>
    </div>
    <div class="sc-km">183.9 km</div>
  </div>
  <div class="sc-detail">
    <div class="dg">
      <div><dt>スタート</dt><dd>〜12:00 CEST（JST 19:00）</dd></div>
      <div><dt>フィニッシュ予想</dt><dd>〜17:30 CEST</dd></div>
      <div><dt>スタート都市</dt><dd>シャンパニョール — コンテチーズの産地、時計製造の伝統工業を受け継ぐ高原都市</dd></div>
      <div><dt>フィニッシュ地点</dt><dd>プラトー・ド・ソレゾン — サヴォワ県アラヴィ山塊の高原（1,450m）、ツール史上初登場</dd></div>
    </div>
    <div class="climbs">コル・ド・ラ・コロンビエール（1,613m） › プラトー・ド・ソレゾン山頂フィニッシュ（1,450m）</div>
  </div>
</div>

<div class="rest-day">
  <div class="rdate">7月20日（月）</div>
  <div>🛌 第2休息日 — エヴィアン＝レ＝バン周辺</div>
</div>

<!-- S16 -->
<div class="sc">
  <div class="sc-head" onclick="tog(this)">
    <div class="sc-num">16</div>
    <div class="sc-date">7月21日（火）<br>レマン湖畔</div>
    <div class="sc-rt">
      <div class="ft">エヴィアン＝レ＝バン → トノン＝レ＝バン <span class="type-badge t-itt">ITT</span></div>
      <div class="sb">世界的ミネラルウォーターの町 → レマン湖南岸のリゾート都市へ</div>
    </div>
    <div class="sc-km">26.1 km</div>
  </div>
  <div class="sc-detail">
    <div class="dg">
      <div><dt>第1走者スタート</dt><dd>12:30 CEST（JST 19:30）</dd></div>
      <div><dt>GCリーダー予想</dt><dd>〜17:30 CEST</dd></div>
      <div><dt>スタート都市</dt><dd>エヴィアン＝レ＝バン — G8サミット開催地、「エヴィアン」採水地の温泉保養都市</dd></div>
      <div><dt>フィニッシュ都市</dt><dd>トノン＝レ＝バン — レマン湖に面したリゾート都市、対岸にスイス・ローザンヌを望む</dd></div>
    </div>
  </div>
</div>

<!-- S17 -->
<div class="sc">
  <div class="sc-head" onclick="tog(this)">
    <div class="sc-num">17</div>
    <div class="sc-date">7月22日（水）<br>サヴォワ→イゼール</div>
    <div class="sc-rt">
      <div class="ft">シャンベリー → ヴォワロン <span class="type-badge t-flat">平坦</span></div>
      <div class="sb">サヴォワの古都 → グルノーブル経由・イゼール渓谷の小都市へ</div>
    </div>
    <div class="sc-km">174.7 km</div>
  </div>
  <div class="sc-detail">
    <div class="dg">
      <div><dt>スタート</dt><dd>〜13:30 CEST（JST 20:30）</dd></div>
      <div><dt>フィニッシュ予想</dt><dd>〜17:00 CEST</dd></div>
      <div><dt>スタート都市</dt><dd>シャンベリー — かつてサヴォイア公国の首都として栄えた中世の古都</dd></div>
      <div><dt>コース概要</dt><dd>アルプス前の平坦。スプリンター最後のチャンス</dd></div>
    </div>
  </div>
</div>

<!-- S18 -->
<div class="sc">
  <div class="sc-head" onclick="tog(this)">
    <div class="sc-num">18</div>
    <div class="sc-date">7月23日（木）<br>イゼール→オート＝ザルプ</div>
    <div class="sc-rt">
      <div class="ft">ヴォワロン → オルシエール＝メルレット 🏔 <span class="type-badge t-mountain">山岳</span></div>
      <div class="sb">イゼールの小都市 → エクラン国立公園麓のスキーリゾート山頂</div>
    </div>
    <div class="sc-km">185.2 km</div>
  </div>
  <div class="sc-detail">
    <div class="dg">
      <div><dt>スタート</dt><dd>〜12:00 CEST（JST 19:00）</dd></div>
      <div><dt>フィニッシュ予想</dt><dd>〜17:30 CEST</dd></div>
      <div><dt>フィニッシュ地点</dt><dd>オルシエール＝メルレット — エクラン国立公園麓のスキーリゾート（1,825m）7.1km 平均6.7%</dd></div>
      <div><dt>獲得標高</dt><dd>約4,800m</dd></div>
    </div>
    <div class="climbs">コル・デュ・ノワエ › オルシエール＝メルレット山頂フィニッシュ（1,825m）</div>
  </div>
</div>

<!-- S19 -->
<div class="sc">
  <div class="sc-head" onclick="tog(this)">
    <div class="sc-num">19</div>
    <div class="sc-date">7月24日（金）<br>オート＝ザルプ</div>
    <div class="sc-rt">
      <div class="ft">ガップ → アルプ・デュエズ 🏔 <span class="type-badge t-mountain">山岳</span></div>
      <div class="sb">ナポレオン街道の拠点 → 21ヘアピンの伝説の山頂へ</div>
    </div>
    <div class="sc-km">127.9 km</div>
  </div>
  <div class="sc-detail">
    <div class="dg">
      <div><dt>スタート</dt><dd>〜12:30 CEST（JST 19:30）</dd></div>
      <div><dt>フィニッシュ予想</dt><dd>〜17:00 CEST</dd></div>
      <div><dt>スタート都市</dt><dd>ガップ — オート＝ザルプ県の県都、「ナポレオン街道」の百日天下ルート上の都市</dd></div>
      <div><dt>フィニッシュ地点</dt><dd>アルプ・デュエズ — 21ヘアピンに歴代優勝者の名を刻む13.8km・平均8.1%の超難関クライム（1,860m）</dd></div>
    </div>
    <div class="climbs">コル・デュ・ガリビエ（2,642m）🏔 › アルプ・デュエズ21ヘアピン（1,860m）</div>
  </div>
</div>

<!-- S20 -->
<div class="sc">
  <div class="sc-head" onclick="tog(this)">
    <div class="sc-num">20</div>
    <div class="sc-date">7月25日（土）<br>イゼール</div>
    <div class="sc-rt">
      <div class="ft">ル・ブール＝ドワザン → アルプ・デュエズ（逆走） 🏔 <span class="type-badge t-mountain">山岳</span></div>
      <div class="sb">ロメランシュ渓谷の小村 → 史上初・2日連続アルプ・デュエズ逆走コース</div>
    </div>
    <div class="sc-km">170.9 km</div>
  </div>
  <div class="sc-detail">
    <div class="dg">
      <div><dt>スタート</dt><dd>〜11:30 CEST（JST 18:30）</dd></div>
      <div><dt>フィニッシュ予想</dt><dd>〜17:30 CEST</dd></div>
      <div><dt>歴史的意義</dt><dd>ツール史上初・2日連続のアルプ・デュエズ山頂フィニッシュ</dd></div>
      <div><dt>獲得標高</dt><dd>約4,500m</dd></div>
    </div>
    <div class="climbs">コル・ド・サレンヌ（1,999m） › アルプ・デュエズ逆走コース（1,860m）</div>
  </div>
</div>

<!-- S21 -->
<div class="sc">
  <div class="sc-head" onclick="tog(this)">
    <div class="sc-num">21</div>
    <div class="sc-date">7月26日（日）<br>パリ</div>
    <div class="sc-rt">
      <div class="ft">トワリー → パリ（シャンゼリゼ） <span class="type-badge t-flat">平坦</span></div>
      <div class="sb">イル＝ド＝フランスの城塞町 → モンマルトル経由でシャンゼリゼへ凱旋</div>
    </div>
    <div class="sc-km">133.0 km</div>
  </div>
  <div class="sc-detail">
    <div class="dg">
      <div><dt>スタート</dt><dd>16:30 CEST（JST 23:30）</dd></div>
      <div><dt>フィニッシュ予想</dt><dd>〜20:00 CEST（JST 翌03:00）</dd></div>
      <div><dt>フィニッシュ</dt><dd>シャンゼリゼ — 凱旋門からコンコルド広場へ続く世界最有名な大通り</dd></div>
      <div><dt>コース概要</dt><dd>モンマルトル石畳を3周回したのちシャンゼリゼへ</dd></div>
    </div>
    <div class="climbs">モンマルトル（石畳コース×3周） › シャンゼリゼ凱旋ゴール</div>
  </div>
</div>

    </div><!-- /sched-inner -->
  </div><!-- /sched-panel -->
</div><!-- /main -->

<script>
function tog(head) {
  head.nextElementSibling.classList.toggle('open');
}

// ---- route map ----
var STAGES = [
  { n:1,  date:'7/4(土)',  type:'TTT',     from:'バルセロナ', to:'バルセロナ', km:19.7,
    s:[41.3851,2.1734], e:[41.4200,2.1900],
    via:[[41.3851,2.1734],[41.3700,2.1500],[41.3500,2.1000],[41.3200,2.0800],[41.3500,2.1500],[41.3851,2.1734]],
    climbs:['モンジュイック（サーキット）'] },
  { n:2,  date:'7/5(日)',  type:'hilly',   from:'タラゴナ', to:'バルセロナ', km:169.2,
    s:[41.1189,1.2445], e:[41.3851,2.1734],
    via:[[41.1189,1.2445],[41.1800,1.5500],[41.2200,1.7800],[41.3500,1.9800],[41.3651,2.0800],[41.3851,2.1734]],
    climbs:['モンジュイック（フィニッシュ）'] },
  { n:3,  date:'7/6(月)', type:'mountain', from:'グラノリェルス', to:'レ・サングル', km:196.2,
    s:[41.6087,2.2873], e:[42.5619,2.0442],
    via:[[41.6087,2.2873],[41.8000,2.1500],[42.0500,1.9500],[42.2700,1.9900],[42.4500,2.0200],[42.5619,2.0442]],
    climbs:['コル・デ・トセス（1,800m）','コル・ドゥ・カルヴェール'] },
  { n:4,  date:'7/7(火)', type:'hilly',   from:'カルカソンヌ', to:'フォワ', km:182.4,
    s:[43.2119,2.3536], e:[42.9639,1.6053],
    via:[[43.2119,2.3536],[43.1100,2.0500],[43.0200,1.8500],[42.9639,1.6053]],
    climbs:[] },
  { n:5,  date:'7/8(水)', type:'flat',    from:'ランヌメザン', to:'ポー', km:158.3,
    s:[43.1261,0.3840], e:[43.2951,-0.3708],
    via:[[43.1261,0.3840],[43.1800,0.1500],[43.2500,-0.1000],[43.2951,-0.3708]],
    climbs:[] },
  { n:6,  date:'7/9(木)', type:'mountain', from:'ポー', to:'ガヴァルニー＝ジェドル', km:186.4,
    s:[43.2951,-0.3708], e:[42.7322,-0.0131],
    via:[[43.2951,-0.3708],[43.0500,0.1000],[42.9650,0.3610],[42.8670,0.1430],[42.7800,0.0500],[42.7322,-0.0131]],
    climbs:['コル・ダスパン（1,489m）','コル・デュ・トゥールマレー（2,115m）🏔'] },
  { n:7,  date:'7/10(金)', type:'flat',   from:'アジェトモー', to:'ボルドー', km:175.0,
    s:[43.6597,-0.5890], e:[44.8378,-0.5792],
    via:[[43.6597,-0.5890],[43.7100,-1.0500],[44.0300,-1.0000],[44.3500,-0.8000],[44.8378,-0.5792]],
    climbs:[] },
  { n:8,  date:'7/11(土)', type:'flat',   from:'ペリグー', to:'ベルジュラック', km:180.4,
    s:[45.1844,0.7212], e:[44.8500,0.4833],
    via:[[45.1844,0.7212],[45.0500,0.6000],[44.8500,0.4833]],
    climbs:[] },
  { n:9,  date:'7/12(日)', type:'hilly',  from:'マルモール', to:'ユッセル', km:185.5,
    s:[45.1667,1.5500], e:[45.5500,2.3167],
    via:[[45.1667,1.5500],[45.2700,1.7700],[45.3800,2.0000],[45.5500,2.3167]],
    climbs:['コレーズ丘陵'] },
  { n:10, date:'7/14(火)', type:'mountain', from:'オーリヤック', to:'ル・リオラン', km:166.6,
    s:[44.9281,2.4400], e:[45.1000,2.7500],
    via:[[44.9281,2.4400],[45.0000,2.5500],[45.0500,2.6500],[45.1000,2.7500]],
    climbs:['コル・ド・キュレビエール','プラン・デュ・カンタル（山頂フィニッシュ）'] },
  { n:11, date:'7/15(水)', type:'flat',   from:'ヴィシー', to:'ヌヴェール', km:161.3,
    s:[46.1278,3.4267], e:[46.9897,3.1578],
    via:[[46.1278,3.4267],[46.3500,3.3000],[46.6500,3.2000],[46.9897,3.1578]],
    climbs:[] },
  { n:12, date:'7/16(木)', type:'flat',   from:'マニークール', to:'シャロン＝シュル＝ソーヌ', km:179.1,
    s:[46.8633,3.1639], e:[46.7806,4.8539],
    via:[[46.8633,3.1639],[46.8500,3.6000],[46.8200,4.1500],[46.7806,4.8539]],
    climbs:[] },
  { n:13, date:'7/17(金)', type:'hilly',  from:'ドール', to:'ベルフォール', km:205.8,
    s:[47.0919,5.4939], e:[47.6369,6.8628],
    via:[[47.0919,5.4939],[47.2400,6.0200],[47.5000,6.5000],[47.6369,6.8628]],
    climbs:['ジュラ丘陵'] },
  { n:14, date:'7/18(土)', type:'mountain', from:'ミュルーズ', to:'マルクシュタイン・フェレラン', km:155.3,
    s:[47.7508,7.3359], e:[47.9000,7.0167],
    via:[[47.7508,7.3359],[47.8200,7.2000],[47.8800,7.1000],[47.9000,7.0167]],
    climbs:['ヴォージュ山地（グラン・バロン方面）'] },
  { n:15, date:'7/19(日)', type:'mountain', from:'シャンパニョール', to:'プラトー・ド・ソレゾン', km:183.9,
    s:[46.7450,5.9058], e:[46.0833,6.4833],
    via:[[46.7450,5.9058],[46.5500,6.0500],[46.3800,6.2000],[46.1500,6.3800],[46.0833,6.4833]],
    climbs:['コル・ド・ラ・コロンビエール（1,613m）','プラトー・ド・ソレゾン（山頂フィニッシュ）🏔'] },
  { n:16, date:'7/21(火)', type:'ITT',    from:'エヴィアン＝レ＝バン', to:'トノン＝レ＝バン', km:26.1,
    s:[46.4003,6.5880], e:[46.3708,6.4789],
    via:[[46.4003,6.5880],[46.3900,6.5400],[46.3708,6.4789]],
    climbs:['レマン湖畔（個人TT）'] },
  { n:17, date:'7/22(水)', type:'flat',   from:'シャンベリー', to:'ヴォワロン', km:174.7,
    s:[45.5646,5.9178], e:[45.3633,5.5908],
    via:[[45.5646,5.9178],[45.5000,5.8000],[45.4200,5.7000],[45.3633,5.5908]],
    climbs:['グルノーブル経由'] },
  { n:18, date:'7/23(木)', type:'mountain', from:'ヴォワロン', to:'オルシエール＝メルレット', km:185.2,
    s:[45.3633,5.5908], e:[44.6833,6.3167],
    via:[[45.3633,5.5908],[45.1900,5.7200],[44.9500,5.9000],[44.7800,6.1500],[44.6833,6.3167]],
    climbs:['コル・デュ・ノワエ','オルシエール＝メルレット（山頂フィニッシュ）🏔'] },
  { n:19, date:'7/24(金)', type:'mountain', from:'ガップ', to:'アルプ・デュエズ', km:127.9,
    s:[44.5594,6.0797], e:[45.0900,6.0700],
    via:[[44.5594,6.0797],[44.7500,6.1500],[44.9500,6.1800],[45.0300,6.0700],[45.0900,6.0700]],
    climbs:['コル・デュ・ガリビエ（2,642m）','アルプ・デュエズ（21ヘアピン）🏔'] },
  { n:20, date:'7/25(土)', type:'mountain', from:'ル・ブール＝ドワザン', to:'アルプ・デュエズ（逆走）', km:170.9,
    s:[45.0550,6.0197], e:[45.0900,6.0700],
    via:[[45.0550,6.0197],[45.0200,6.0800],[45.0333,6.1330],[45.0500,6.1200],[45.0900,6.0700]],
    climbs:['コル・ド・サレンヌ（1,999m）','アルプ・デュエズ（逆走コース）🏔'] },
  { n:21, date:'7/26(日)', type:'flat',   from:'トワリー', to:'パリ（シャンゼリゼ）', km:133.0,
    s:[48.9614,1.8478], e:[48.8698,2.3078],
    via:[[48.9614,1.8478],[48.8714,2.1200],[48.8850,2.2000],[48.8800,2.2800],[48.8698,2.3078]],
    climbs:['モンマルトル（3周回）','シャンゼリゼ（フィニッシュ）'] },
];

var CLIMBS = [
  { name:'コル・デュ・トゥールマレー', lat:42.867, lon:0.143,  elev:2115 },
  { name:'コル・ダスパン',             lat:42.965, lon:0.361,  elev:1489 },
  { name:'コル・ド・トセス',           lat:42.270, lon:1.990,  elev:1800 },
  { name:'コル・ド・ラ・コロンビエール', lat:45.983, lon:6.467,  elev:1613 },
  { name:'コル・デュ・ガリビエ',       lat:45.064, lon:6.408,  elev:2642 },
  { name:'コル・ド・サレンヌ',         lat:45.033, lon:6.133,  elev:1999 },
  { name:'アルプ・デュエズ',           lat:45.090, lon:6.070,  elev:1860 },
  { name:'プラトー・ド・ソレゾン',      lat:46.083, lon:6.483,  elev:1450 },
  { name:'オルシエール＝メルレット',    lat:44.683, lon:6.317,  elev:1825 },
  { name:'ガヴァルニー',               lat:42.732, lon:-0.013, elev:1365 },
  { name:'ル・リオラン',               lat:45.100, lon:2.750,  elev:1160 },
  { name:'マルクシュタイン',           lat:47.900, lon:7.017,  elev:1267 },
];

var TYPE_COLOR = { flat:'#3fb950', hilly:'#ffa657', mountain:'#ff7b72', TTT:'#79c0ff', ITT:'#79c0ff' };
var TYPE_LABEL = { flat:'平坦', hilly:'丘陵', mountain:'山岳', TTT:'チームTT', ITT:'個人TT' };
var LON_MIN = -2.0, LON_MAX = 8.5, LAT_MIN = 41.0, LAT_MAX = 50.5;

var canvas = document.getElementById('c');
var ctx = canvas.getContext('2d');
var mapPanel = document.getElementById('map-panel');
var tooltip  = document.getElementById('map-tooltip');
var ttStage  = document.getElementById('tt-stage');
var ttRoute  = document.getElementById('tt-route');
var ttDetail = document.getElementById('tt-detail');
var ttClimbs = document.getElementById('tt-climbs');

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
  ctx.strokeStyle='#30363d'; ctx.lineWidth=1; ctx.stroke();
  ctx.restore();
}

function draw() {
  ctx.clearRect(0,0,W,H);
  ctx.fillStyle='#0d1117'; ctx.fillRect(0,0,W,H);
  drawCountry(SPAIN,  '#161b22');
  drawCountry(FRANCE, '#1c2128');

  var stagePts = STAGES.map(function(st) {
    var pts = [];
    pts.push(toScreen(st.s[0],st.s[1]));
    (st.via||[]).forEach(function(v){pts.push(toScreen(v[0],v[1]));});
    pts.push(toScreen(st.e[0],st.e[1]));
    return pts;
  });

  STAGES.forEach(function(st, idx) {
    var pts = stagePts[idx];
    var color = TYPE_COLOR[st.type] || '#8b949e';
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
    if(st.type==='TTT'||st.type==='ITT') ctx.setLineDash([7,4]);
    ctx.lineJoin='round'; ctx.lineCap='round';
    ctx.stroke();
    ctx.restore();

    var mid=Math.floor(pts.length/2);
    var mx=(pts[mid].x+(pts[mid>0?mid-1:0].x))/2;
    var my=(pts[mid].y+(pts[mid>0?mid-1:0].y))/2;
    if(zoom>0.85){
      ctx.save();
      ctx.beginPath(); ctx.arc(mx,my,8,0,Math.PI*2);
      ctx.fillStyle=isHover?color:'#21262d'; ctx.fill();
      ctx.strokeStyle=color; ctx.lineWidth=1.5; ctx.stroke();
      ctx.fillStyle=isHover?'#0d1117':color;
      ctx.font='700 8px "Segoe UI",sans-serif';
      ctx.textAlign='center'; ctx.textBaseline='middle';
      ctx.fillText(st.n, mx, my);
      ctx.restore();
    }
  });

  if(zoom>1.0) {
    CLIMBS.forEach(function(cl) {
      var sc=toScreen(cl.lat,cl.lon);
      ctx.save();
      ctx.beginPath(); ctx.arc(sc.x,sc.y,4,0,Math.PI*2);
      ctx.fillStyle='#d2a8ff'; ctx.fill();
      ctx.strokeStyle='#0d1117'; ctx.lineWidth=1; ctx.stroke();
      if(zoom>1.6){
        ctx.font='9px "Segoe UI",sans-serif';
        ctx.fillStyle='#d2a8ff'; ctx.globalAlpha=0.85;
        ctx.fillText(cl.name+'('+cl.elev+'m)', sc.x+6, sc.y+3);
      }
      ctx.restore();
    });
  }

  var seen = {};
  STAGES.forEach(function(st) {
    [[st.s[0],st.s[1],st.from,true],[st.e[0],st.e[1],st.to,st.type==='mountain']].forEach(function(d) {
      var key=d[0].toFixed(2)+','+d[1].toFixed(2);
      if(seen[key]) return; seen[key]=true;
      var sc=toScreen(d[0],d[1]);
      var isAnchor=(d[2]==='バルセロナ'||d[2]==='パリ（シャンゼリゼ）');
      var r=isAnchor?6:3.5;
      var color=isAnchor?'#ff7b72':(d[3]?'#ffa657':'#8b949e');
      if(isAnchor){
        var g=ctx.createRadialGradient(sc.x,sc.y,0,sc.x,sc.y,r*3);
        g.addColorStop(0,'#ff7b7266'); g.addColorStop(1,'transparent');
        ctx.save(); ctx.beginPath(); ctx.arc(sc.x,sc.y,r*3,0,Math.PI*2);
        ctx.fillStyle=g; ctx.fill(); ctx.restore();
      }
      ctx.beginPath(); ctx.arc(sc.x,sc.y,r,0,Math.PI*2);
      ctx.fillStyle=color; ctx.fill();
      if(isAnchor||zoom>1.5){
        ctx.save();
        ctx.font=(isAnchor?'700':'400')+' '+(isAnchor?12:10)+'px "Segoe UI",sans-serif';
        ctx.fillStyle=isAnchor?'#ff7b72':'#8b949e'; ctx.globalAlpha=0.9;
        ctx.fillText(d[2],sc.x+r+4,sc.y+4);
        ctx.restore();
      }
    });
  });

  requestAnimationFrame(draw);
}

function showTooltipAt(st, cx, cy) {
  ttStage.textContent='ステージ '+st.n+'  '+st.date;
  ttRoute.textContent=st.from+'  →  '+st.to;
  ttDetail.textContent=st.km+' km  |  '+TYPE_LABEL[st.type];
  ttClimbs.textContent=st.climbs&&st.climbs.length?'⛰ '+st.climbs.join(' › '):'';
  tooltip.style.display='block';
  var tx=cx+16, ty=cy-10;
  if(tx+270>W) tx=cx-280;
  if(ty+80>H) ty=H-90;
  if(ty<0) ty=8;
  tooltip.style.left=tx+'px'; tooltip.style.top=ty+'px';
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

canvas.addEventListener('mousemove', function(e) {
  if(dragging){
    panX=panStart.x+(e.clientX-dragStart.x);
    panY=panStart.y+(e.clientY-dragStart.y); return;
  }
  var rect=canvas.getBoundingClientRect();
  var mx=e.clientX-rect.left, my=e.clientY-rect.top;
  hoveredStage=findStageAt(mx,my);
  if(hoveredStage){
    canvas.style.cursor='pointer';
    showTooltipAt(hoveredStage, e.clientX-rect.left, e.clientY-rect.top);
  } else {
    canvas.style.cursor='grab';
    tooltip.style.display='none';
  }
});
canvas.addEventListener('mousedown',function(e){
  dragging=true; dragStart={x:e.clientX,y:e.clientY}; panStart={x:panX,y:panY};
  canvas.style.cursor='grabbing'; tooltip.style.display='none';
});
window.addEventListener('mouseup',function(){dragging=false;canvas.style.cursor='grab';});
canvas.addEventListener('wheel',function(e){
  e.preventDefault();
  var f=e.deltaY<0?1.12:0.89;
  var rect=canvas.getBoundingClientRect();
  var mx=e.clientX-rect.left, my=e.clientY-rect.top;
  panX=mx+(panX-mx)*f; panY=my+(panY-my)*f;
  zoom=Math.max(0.4,Math.min(zoom*f,12));
},{passive:false});

// touch support
var touchStartX, touchStartY, touchPinchDist=0, isTap=false;
canvas.addEventListener('touchstart',function(e){
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
  tooltip.style.display='none';
},{passive:false});

canvas.addEventListener('touchmove',function(e){
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

canvas.addEventListener('touchend',function(e){
  e.preventDefault();
  dragging=false;
  if(isTap && e.changedTouches.length===1){
    var t=e.changedTouches[0];
    var rect=canvas.getBoundingClientRect();
    var mx=t.clientX-rect.left, my=t.clientY-rect.top;
    var st=findStageAt(mx,my);
    if(st){
      if(hoveredStage && hoveredStage.n===st.n && tooltip.style.display==='block'){
        tooltip.style.display='none'; hoveredStage=null;
      } else {
        hoveredStage=st; showTooltipAt(st,mx,my);
      }
    } else {
      hoveredStage=null; tooltip.style.display='none';
    }
  }
  isTap=false;
},{passive:false});

window.addEventListener('resize',function(){resize();});

resize();
draw();
</script>
</body>
</html>`;
}
