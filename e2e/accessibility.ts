import AxeBuilder from '@axe-core/playwright';
import { expect, type Locator, type Page } from '@playwright/test';

export async function expectNoSeriousAccessibilityViolations(page: Page) {
  // Scan the stable interface rather than transient fade-in frames whose parent
  // opacity can temporarily lower otherwise-compliant text contrast.
  await page.waitForTimeout(1_500);

  const result = await new AxeBuilder({ page })
    .withTags(['wcag2a', 'wcag2aa', 'wcag21a', 'wcag21aa'])
    .analyze();

  const violations = result.violations
    .filter(violation => violation.impact === 'critical' || violation.impact === 'serious')
    .map(violation => ({
      id: violation.id,
      impact: violation.impact,
      help: violation.help,
      nodes: violation.nodes.map(node => ({
        target: node.target.join(' '),
        html: node.html,
        failureSummary: node.failureSummary,
      })),
    }));

  expect(violations, 'Serious WCAG A/AA accessibility violations').toEqual([]);
}

export async function tabTo(page: Page, target: Locator, maximumTabs = 30) {
  for (let index = 0; index < maximumTabs; index += 1) {
    await page.keyboard.press('Tab');
    if (await target.evaluate(element => element === document.activeElement)) return;
  }
  throw new Error(`Keyboard focus did not reach the requested control within ${maximumTabs} Tab presses.`);
}
