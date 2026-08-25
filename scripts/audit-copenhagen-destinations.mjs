import { readFileSync } from 'node:fs';

// CPH の「Destinations」掲載都市を IATA 到着空港コードへ正規化したスナップショット。
// 都市圏に複数空港がある場合も、CPH からの直行便が到着する空港を個別に数える。
export const COPENHAGEN_DESTINATION_CODES = `
AAL AAR BLL RNN FAE GOH KSF SFJ AGH ARN GOT KRN LLA MMX OSD AES BGO BOO EVE
KRS OSL SVG TOS TRD HEL KTT RVN KEF ABZ BHX EDI LGW LHR MAN DUB AMS BRU LUX
CDG ORY BOD LYS MRS MPL NCE NTE BIA BER CGN DUS FRA HAM MUC NUE STR GVA ZRH
BSL VIE INN SZG WAW GDN KRK WRO POZ SZZ TLL RIX VNO KUN PLQ PRG BUD OTP CLJ
IAS SOF VAR BOJ BEG ZAG SPU DBV PUY SJJ PRN SKP TGD TIA ALC AGP BCN BIO MAD
PMI TFS LPA ACE FUE IBZ MAH SCQ LIS OPO FAO FNC BGY BLQ FCO MXP LIN NAP PSA
VCE FLR CAG CTA PMO BRI OLB TRN VRN ATH SKG CHQ HER RHO KGS CFU ZTH JTR PVK
LCA PFO MLA IST SAW AYT ADB BJV DLM GZP TBS KUT EVN TLV BEY AMM DOH DXB CAI
HRG SSH AGA RAK TUN DJE SID DEL BKK SIN HND ICN PVG JFK EWR BOS IAD ORD LAX
SFO ATL MIA YYZ
`.trim().split(/\s+/);

// 上の一覧は地域順。MLA までを（キプロスを含む）ヨーロッパ便として扱う。
// トルコ、コーカサス以東はこの追加対象に含めない。
export const COPENHAGEN_EUROPE_DESTINATION_CODES = COPENHAGEN_DESTINATION_CODES.slice(
  0,
  COPENHAGEN_DESTINATION_CODES.indexOf('MLA') + 1,
);

export function auditCopenhagenDestinations(airportSource) {
  const registeredCodes = new Set(
    [...airportSource.matchAll(/\bcode:\s*["']([^"']+)["']/g)].map((match) => match[1]),
  );
  const registered = COPENHAGEN_DESTINATION_CODES.filter((code) => registeredCodes.has(code));
  const missing = COPENHAGEN_DESTINATION_CODES.filter((code) => !registeredCodes.has(code));
  return { total: COPENHAGEN_DESTINATION_CODES.length, registered, missing };
}

if (process.argv[1] && import.meta.url === new URL(`file://${process.argv[1]}`).href) {
  const source = readFileSync(new URL('../src/data/airports.ts', import.meta.url), 'utf8');
  const result = auditCopenhagenDestinations(source);
  console.log(`CPH destinations: ${result.total}`);
  console.log(`Registered in heritage-journey: ${result.registered.length}`);
  console.log(`Registered codes: ${result.registered.join(' ')}`);
  console.log(`Missing codes: ${result.missing.join(' ')}`);
}
