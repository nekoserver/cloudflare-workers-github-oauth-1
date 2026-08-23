import { describe, expect, it } from 'vitest';
import { ROUTE_CITIES } from './data/routeCities';

const EXPECTED_ADDITIONS = [
  'Palermo',
  'Bari',
  'Catania',
  'Verona',
  'Padua',
  'Trieste',
  'Brescia',
  'Parma',
  'Modena',
  'Perugia',
];

describe('heritage-journey イタリア都市データ追加', () => {
  const italianCities = ROUTE_CITIES.filter((city) => city.country === 'イタリア');

  it('既存8都市に新しい10都市を加えた18都市を利用できる', () => {
    expect(italianCities).toHaveLength(18);
    expect(italianCities.map((city) => city.name)).toEqual(expect.arrayContaining(EXPECTED_ADDITIONS));
  });

  it('追加都市は一意な識別名・表示名・座標を持つ', () => {
    const additions = italianCities.filter((city) => EXPECTED_ADDITIONS.includes(city.name));
    expect(new Set(additions.map((city) => city.name))).toHaveLength(10);
    expect(new Set(additions.map((city) => city.label))).toHaveLength(10);
    expect(new Set(additions.map((city) => `${city.lat},${city.lon}`))).toHaveLength(10);
    expect(additions.every((city) => city.flag === '🇮🇹')).toBe(true);
  });
});
