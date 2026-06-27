import { describe, it, expect } from 'vitest';
import { getWebGLSpherePage } from './views/webglSphere';

// openfootball/world-cup.json 公式データによる試合→会場マッピング
// venue インデックスは wc2026Stadiums 配列の 0-based インデックス
// 0=Gillette(Boston), 1=MetLife(NJ), 2=Lincoln(Philadelphia), 3=BMO(Toronto),
// 4=HardRock(Miami), 5=MercedesBenz(Atlanta), 6=Arrowhead(KC), 7=NRG(Houston),
// 8=AT&T(Dallas), 9=Azteca(MexicoCity), 10=BBVA(Monterrey), 11=Akron(Guadalajara),
// 12=SoFi(LA), 13=Levis(SantaClara), 14=Lumen(Seattle), 15=BCPlace(Vancouver)
const EXPECTED_VENUES: Array<{ a: string; b: string; date: string; venue: number }> = [
  { a: '🇲🇽', b: '🇿🇦', date: '2026-06-11', venue: 9 },  // Mexico City
  { a: '🇰🇷', b: '🇨🇿', date: '2026-06-12', venue: 11 }, // Guadalajara
  { a: '🇨🇦', b: '🇧🇦', date: '2026-06-12', venue: 3 },  // Toronto
  { a: '🇺🇸', b: '🇵🇾', date: '2026-06-13', venue: 12 }, // LA/Inglewood
  { a: '🇶🇦', b: '🇨🇭', date: '2026-06-13', venue: 13 }, // Santa Clara
  { a: '🇧🇷', b: '🇲🇦', date: '2026-06-13', venue: 1 },  // NY/NJ
  { a: '🇭🇹', b: '🏴󠁧󠁢󠁳󠁣󠁴󠁿', date: '2026-06-14', venue: 0 },  // Boston
  { a: '🇦🇺', b: '🇹🇷', date: '2026-06-14', venue: 15 }, // Vancouver
  { a: '🇩🇪', b: '🇨🇼', date: '2026-06-14', venue: 7 },  // Houston
  { a: '🇳🇱', b: '🇯🇵', date: '2026-06-14', venue: 8 },  // Dallas/Arlington
  { a: '🇨🇮', b: '🇪🇨', date: '2026-06-14', venue: 2 },  // Philadelphia
  { a: '🇸🇪', b: '🇹🇳', date: '2026-06-15', venue: 10 }, // Monterrey
  { a: '🇪🇸', b: '🇨🇻', date: '2026-06-15', venue: 5 },  // Atlanta
  { a: '🇧🇪', b: '🇪🇬', date: '2026-06-15', venue: 14 }, // Seattle
  { a: '🇸🇦', b: '🇺🇾', date: '2026-06-15', venue: 4 },  // Miami
  { a: '🇮🇷', b: '🇳🇿', date: '2026-06-16', venue: 12 }, // LA/Inglewood
  { a: '🇫🇷', b: '🇸🇳', date: '2026-06-16', venue: 1 },  // NY/NJ
  { a: '🇮🇶', b: '🇳🇴', date: '2026-06-16', venue: 0 },  // Boston
  { a: '🇦🇷', b: '🇩🇿', date: '2026-06-17', venue: 6 },  // Kansas City
  { a: '🇦🇹', b: '🇯🇴', date: '2026-06-17', venue: 13 }, // Santa Clara
  { a: '🇵🇹', b: '🇨🇩', date: '2026-06-17', venue: 7 },  // Houston
  { a: '🏴󠁧󠁢󠁥󠁮󠁧󠁿', b: '🇭🇷', date: '2026-06-17', venue: 8 },  // Dallas/Arlington
  { a: '🇬🇭', b: '🇵🇦', date: '2026-06-17', venue: 3 },  // Toronto
  { a: '🇺🇿', b: '🇨🇴', date: '2026-06-18', venue: 9 },  // Mexico City
  { a: '🇨🇿', b: '🇿🇦', date: '2026-06-18', venue: 5 },  // Atlanta
  { a: '🇨🇭', b: '🇧🇦', date: '2026-06-18', venue: 12 }, // LA/Inglewood
  { a: '🇨🇦', b: '🇶🇦', date: '2026-06-18', venue: 15 }, // Vancouver
  { a: '🇲🇽', b: '🇰🇷', date: '2026-06-19', venue: 11 }, // Guadalajara
  { a: '🇺🇸', b: '🇦🇺', date: '2026-06-19', venue: 14 }, // Seattle
  { a: '🏴󠁧󠁢󠁳󠁣󠁴󠁿', b: '🇲🇦', date: '2026-06-19', venue: 0 },  // Boston
  { a: '🇧🇷', b: '🇭🇹', date: '2026-06-20', venue: 2 },  // Philadelphia
  { a: '🇹🇷', b: '🇵🇾', date: '2026-06-20', venue: 12 }, // LA/Inglewood
  { a: '🇳🇱', b: '🇸🇪', date: '2026-06-20', venue: 7 },  // Houston
  { a: '🇩🇪', b: '🇨🇮', date: '2026-06-20', venue: 3 },  // Toronto
  { a: '🇪🇨', b: '🇨🇼', date: '2026-06-21', venue: 6 },  // Kansas City
  { a: '🇹🇳', b: '🇯🇵', date: '2026-06-21', venue: 10 }, // Monterrey
  { a: '🇪🇸', b: '🇸🇦', date: '2026-06-21', venue: 5 },  // Atlanta
  { a: '🇧🇪', b: '🇮🇷', date: '2026-06-21', venue: 12 }, // LA/Inglewood
  { a: '🇺🇾', b: '🇨🇻', date: '2026-06-21', venue: 4 },  // Miami
  { a: '🇳🇿', b: '🇪🇬', date: '2026-06-22', venue: 15 }, // Vancouver
  { a: '🇦🇷', b: '🇦🇹', date: '2026-06-22', venue: 8 },  // Dallas/Arlington
  { a: '🇫🇷', b: '🇮🇶', date: '2026-06-22', venue: 2 },  // Philadelphia
  { a: '🇳🇴', b: '🇸🇳', date: '2026-06-23', venue: 1 },  // NY/NJ
  { a: '🇯🇴', b: '🇩🇿', date: '2026-06-23', venue: 13 }, // Santa Clara
  { a: '🇵🇹', b: '🇺🇿', date: '2026-06-23', venue: 7 },  // Houston
  { a: '🏴󠁧󠁢󠁥󠁮󠁧󠁿', b: '🇬🇭', date: '2026-06-23', venue: 0 },  // Boston
  { a: '🇵🇦', b: '🇭🇷', date: '2026-06-23', venue: 3 },  // Toronto
  { a: '🇨🇴', b: '🇨🇩', date: '2026-06-24', venue: 11 }, // Guadalajara
  { a: '🇨🇭', b: '🇨🇦', date: '2026-06-24', venue: 15 }, // Vancouver
  { a: '🇧🇦', b: '🇶🇦', date: '2026-06-24', venue: 14 }, // Seattle
  { a: '🏴󠁧󠁢󠁳󠁣󠁴󠁿', b: '🇧🇷', date: '2026-06-24', venue: 4 },  // Miami
  { a: '🇲🇦', b: '🇭🇹', date: '2026-06-24', venue: 5 },  // Atlanta
  { a: '🇨🇿', b: '🇲🇽', date: '2026-06-25', venue: 9 },  // Mexico City
  { a: '🇿🇦', b: '🇰🇷', date: '2026-06-25', venue: 10 }, // Monterrey
  { a: '🇨🇼', b: '🇨🇮', date: '2026-06-25', venue: 2 },  // Philadelphia
  { a: '🇪🇨', b: '🇩🇪', date: '2026-06-25', venue: 1 },  // NY/NJ
  { a: '🇯🇵', b: '🇸🇪', date: '2026-06-25', venue: 8 },  // Dallas/Arlington
  { a: '🇹🇳', b: '🇳🇱', date: '2026-06-25', venue: 6 },  // Kansas City
  { a: '🇹🇷', b: '🇺🇸', date: '2026-06-26', venue: 12 }, // LA/Inglewood
  { a: '🇵🇾', b: '🇦🇺', date: '2026-06-26', venue: 13 }, // Santa Clara
  { a: '🇳🇴', b: '🇫🇷', date: '2026-06-26', venue: 0 },  // Boston
  { a: '🇸🇳', b: '🇮🇶', date: '2026-06-26', venue: 3 },  // Toronto
  { a: '🇨🇻', b: '🇸🇦', date: '2026-06-27', venue: 7 },  // Houston
  { a: '🇺🇾', b: '🇪🇸', date: '2026-06-27', venue: 11 }, // Guadalajara
  { a: '🇪🇬', b: '🇮🇷', date: '2026-06-27', venue: 14 }, // Seattle
  { a: '🇳🇿', b: '🇧🇪', date: '2026-06-27', venue: 15 }, // Vancouver
  { a: '🇵🇦', b: '🏴󠁧󠁢󠁥󠁮󠁧󠁿', date: '2026-06-27', venue: 1 },  // NY/NJ
  { a: '🇭🇷', b: '🇬🇭', date: '2026-06-27', venue: 2 },  // Philadelphia
  { a: '🇨🇴', b: '🇵🇹', date: '2026-06-27', venue: 4 },  // Miami
  { a: '🇨🇩', b: '🇺🇿', date: '2026-06-27', venue: 5 },  // Atlanta
  { a: '🇩🇿', b: '🇦🇹', date: '2026-06-28', venue: 6 },  // Kansas City
  { a: '🇯🇴', b: '🇦🇷', date: '2026-06-28', venue: 8 },  // Dallas/Arlington
];

function extractMatches(html: string): Array<{ a: string; b: string; date: string; venue: number }> {
  const start = html.indexOf('var MATCHES = [');
  const end = html.indexOf('];', start) + 2;
  const block = html.slice(start, end);
  const results: Array<{ a: string; b: string; date: string; venue: number }> = [];
  const re = /\{a:"([^"]+)",b:"([^"]+)",date:"([^"]+)",time:"[^"]+",venue:(\d+)\}/g;
  let m: RegExpExecArray | null;
  while ((m = re.exec(block)) !== null) {
    results.push({ a: m[1], b: m[2], date: m[3], venue: parseInt(m[4], 10) });
  }
  return results;
}

describe('FIFA 2026 WC グループステージ 試合→会場マッピング', () => {
  const html = getWebGLSpherePage('testuser');
  const matches = extractMatches(html);

  it('グループステージ72試合＋R32の7試合が存在する', () => {
    expect(matches.length).toBeGreaterThanOrEqual(72);
  });

  it('wc2026Stadiums[5] は Mercedes-Benz Stadium (Atlanta) である（Charlotte ではない）', () => {
    expect(html).toContain('Mercedes-Benz Stadium');
    expect(html).not.toContain('Bank of America Stadium');
  });

  EXPECTED_VENUES.forEach(({ a, b, date, venue }, idx) => {
    it(`[${idx}] ${date} ${a} vs ${b} → venue:${venue}`, () => {
      const match = matches[idx];
      expect(match).toBeDefined();
      expect(match.a).toBe(a);
      expect(match.b).toBe(b);
      expect(match.date).toBe(date);
      expect(match.venue).toBe(venue);
    });
  });
});
