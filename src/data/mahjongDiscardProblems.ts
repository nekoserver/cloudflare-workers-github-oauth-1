export type MahjongDiscardProblem = {
  id: string;
  title: string;
  hand: string;
  note: string;
  expectedDiscard: string;
};

export const MAHJONG_DISCARD_PROBLEMS: MahjongDiscardProblem[] = [
  {
    id: 'iso-7s',
    title: '完全な萬子＋筒子ターツ＋孤立索子',
    hand: '123m 456m 789m 11p 34p 7s',
    note: '7s だけが浮いている。切ってテンパイ。',
    expectedDiscard: '7s',
  },
  {
    id: 'honor-trash',
    title: '形の良い索子＋余計な字牌',
    hand: '234s 567s 888s 123p 5p 2z',
    note: '南（2z）が孤立。索子・筒子の良形を崩さない。',
    expectedDiscard: '南',
  },
  {
    id: 'ryanmen-vs-kanchan',
    title: '両面と嵌張の比較',
    hand: '234m 567m 888m 45p 6p 9s 9s',
    note: '9s の対子を切って両面を活かす。',
    expectedDiscard: '9s',
  },
  {
    id: 'iishanten-fix',
    title: '1向聴からテンパイへ',
    hand: '113m 456m 789m 234p 5p 7s',
    note: '7s を切るとテンパイ（3p待ち＋他）。',
    expectedDiscard: '7s',
  },
];
