export interface ContainerPlan {
  baseMiB: number | null;
  baseSeconds: number | null;
  limitMiB: number | null;
  limitSeconds: number | null;
  selected: string[];
  packages: { id: string; sizeMiB: number | null; seconds: number | null; dependencies: string[] }[];
}

// This source is embedded in the browser planner. Do not derive it with
// calculateContainerPlan.toString(): the Worker bundler can inject its private
// __name helper into the function body, which does not exist in browser pages.
export const containerPlanBrowserSource = String.raw`function calculate(plan) {
  function number(value) {
    if (value !== null && (typeof value !== 'number' || !Number.isFinite(value) || value < 0)) throw new Error('容量・時間には0以上の有限数を入力してください');
  }
  [plan.baseMiB, plan.baseSeconds, plan.limitMiB, plan.limitSeconds].forEach(number);
  const packages = new Map();
  for (const item of plan.packages) {
    if (!item.id || packages.has(item.id)) throw new Error('項目IDは空欄・重複にできません');
    number(item.sizeMiB); number(item.seconds);
    packages.set(item.id, item);
  }
  const included = new Set();
  const visiting = new Set();
  function visit(id) {
    if (visiting.has(id)) throw new Error('依存関係が循環しています: ' + id);
    if (included.has(id)) return;
    const item = packages.get(id);
    if (!item) throw new Error('依存項目がありません: ' + id);
    visiting.add(id);
    item.dependencies.forEach(visit);
    visiting.delete(id); included.add(id);
  }
  plan.selected.forEach(visit);
  let imageMiB = plan.baseMiB;
  let buildSeconds = plan.baseSeconds;
  const unknown = [];
  for (const id of included) {
    const item = packages.get(id);
    if (item.sizeMiB === null) unknown.push(id + ': 容量');
    if (item.seconds === null) unknown.push(id + ': 時間');
    imageMiB = imageMiB === null || item.sizeMiB === null ? null : imageMiB + item.sizeMiB;
    buildSeconds = buildSeconds === null || item.seconds === null ? null : buildSeconds + item.seconds;
  }
  function status(total, limit) {
    return total === null || limit === null ? 'unknown' : total > limit ? 'over' : 'within';
  }
  if ((imageMiB !== null && !Number.isFinite(imageMiB)) || (buildSeconds !== null && !Number.isFinite(buildSeconds))) throw new Error('合計が大きすぎます');
  return { imageMiB, buildSeconds, included: [...included], unknown,
    sizeStatus: status(imageMiB, plan.limitMiB), timeStatus: status(buildSeconds, plan.limitSeconds),
    remainingMiB: imageMiB === null || plan.limitMiB === null ? null : plan.limitMiB - imageMiB,
    remainingSeconds: buildSeconds === null || plan.limitSeconds === null ? null : plan.limitSeconds - buildSeconds };
}`;

/** Values are incremental, uncompressed final-image MiB and sequential cold-build seconds. */
export function calculateContainerPlan(plan: ContainerPlan) {
  function number(value: number | null) {
    if (value !== null && (typeof value !== 'number' || !Number.isFinite(value) || value < 0)) throw new Error('容量・時間には0以上の有限数を入力してください');
  }
  [plan.baseMiB, plan.baseSeconds, plan.limitMiB, plan.limitSeconds].forEach(number);
  const packages = new Map<string, ContainerPlan['packages'][number]>();
  for (const item of plan.packages) {
    if (!item.id || packages.has(item.id)) throw new Error('項目IDは空欄・重複にできません');
    number(item.sizeMiB); number(item.seconds);
    packages.set(item.id, item);
  }
  const included = new Set<string>();
  const visiting = new Set<string>();
  function visit(id: string) {
    if (visiting.has(id)) throw new Error('依存関係が循環しています: ' + id);
    if (included.has(id)) return;
    const item = packages.get(id);
    if (!item) throw new Error('依存項目がありません: ' + id);
    visiting.add(id);
    item.dependencies.forEach(visit);
    visiting.delete(id); included.add(id);
  }
  plan.selected.forEach(visit);
  let imageMiB = plan.baseMiB;
  let buildSeconds = plan.baseSeconds;
  const unknown: string[] = [];
  for (const id of included) {
    const item = packages.get(id)!;
    if (item.sizeMiB === null) unknown.push(id + ': 容量');
    if (item.seconds === null) unknown.push(id + ': 時間');
    imageMiB = imageMiB === null || item.sizeMiB === null ? null : imageMiB + item.sizeMiB;
    buildSeconds = buildSeconds === null || item.seconds === null ? null : buildSeconds + item.seconds;
  }
  function status(total: number | null, limit: number | null) {
    return total === null || limit === null ? 'unknown' : total > limit ? 'over' : 'within';
  }
  if ((imageMiB !== null && !Number.isFinite(imageMiB)) || (buildSeconds !== null && !Number.isFinite(buildSeconds))) throw new Error('合計が大きすぎます');
  return { imageMiB, buildSeconds, included: [...included], unknown,
    sizeStatus: status(imageMiB, plan.limitMiB), timeStatus: status(buildSeconds, plan.limitSeconds),
    remainingMiB: imageMiB === null || plan.limitMiB === null ? null : plan.limitMiB - imageMiB,
    remainingSeconds: buildSeconds === null || plan.limitSeconds === null ? null : plan.limitSeconds - buildSeconds };
}
