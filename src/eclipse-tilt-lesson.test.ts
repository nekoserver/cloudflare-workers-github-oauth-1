import { describe, expect, it } from 'vitest';
import { getEclipseTiltLessonPage } from './views/eclipseTiltLesson';

describe('getEclipseTiltLessonPage', () => {
  it('renders the 5 degree lunar orbit eclipse lesson materials', () => {
    const html = getEclipseTiltLessonPage('<teacher>');

    expect(html).toContain('日食が毎月起きない理由');
    expect(html).toContain('約5°傾いています');
    expect(html).toContain('交点付近の新月');
    expect(html).toContain('User: &lt;teacher&gt;');
    expect(html).toContain('data-mode="hit"');
  });
});
