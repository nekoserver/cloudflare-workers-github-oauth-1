/**
 * MLB30球団の地区分け(チームIDはMLB Stats APIのteam.id)。
 * /mlb ページ(src/views/mlbSphere.ts、クライアントJS内のDIVISIONS)と
 * 同じ内容。mlbSphere.tsはHTML文字列に埋め込んだブラウザ側JSのため
 * このファイルを直接importできず、値を重複して保持している。
 * 球団の異動・地区再編があれば両方を同時に更新すること。
 */
export type MlbDivision = { name: string; teams: number[] };

export const MLB_DIVISIONS: MlbDivision[] = [
  { name: 'AL East', teams: [110, 111, 147, 139, 141] },
  { name: 'AL Central', teams: [145, 114, 116, 118, 142] },
  { name: 'AL West', teams: [117, 108, 133, 136, 140] },
  { name: 'NL East', teams: [144, 146, 121, 143, 120] },
  { name: 'NL Central', teams: [112, 113, 158, 134, 138] },
  { name: 'NL West', teams: [109, 115, 119, 135, 137] },
];
