import { expect, it } from 'vitest';
import { renderContainerFleetCostWidget, renderContainerFleetCostWidgetScript, renderCostWidgets, renderCostWidgetsScript, renderWorkerCostWidget, renderWorkerCostWidgetScript } from './tailscaleWasmCost';

it('exposes independent cost and container widgets as reusable HTML and script components', () => {
  expect(renderWorkerCostWidget()).toContain('id="cost-chart"');
  expect(renderContainerFleetCostWidget()).toContain('id="fleet-rows"');
  expect(renderCostWidgets({ worker: true, containers: false })).toContain('コストトラッカー');
  expect(renderCostWidgets({ worker: true, containers: false })).not.toContain('全コンテナの状態');
  expect(renderCostWidgets({ worker: false, containers: true })).toContain('全コンテナの状態');
  expect(renderWorkerCostWidgetScript()).toContain("jsonRequest('cost')");
  expect(renderContainerFleetCostWidgetScript()).toContain("jsonRequest('fleet')");
  expect(() => new Function(renderWorkerCostWidgetScript())).not.toThrow();
  expect(() => new Function(renderContainerFleetCostWidgetScript())).not.toThrow();
  expect(renderCostWidgetsScript({ worker: false })).not.toContain("jsonRequest('cost')");
});
