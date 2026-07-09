import { render, screen } from '@testing-library/react';
import { SectionRail } from '~/components/editor-shared/SectionRail';

const sections = [
  { id: 's1', title: 'Roof', items: [{ id: 'i1' }, { id: 'i2' }] },
  { id: 's2', title: 'Electrical', items: [{ id: 'i3' }] },
];

test('fill mode renders progress donut and Inspection Details overview', () => {
  render(
    <SectionRail
      mode="fill"
      sections={sections}
      activeSection="s1"
      onSelect={() => {}}
      results={{}}
      sectionProgress={() => ({ total: 2, rated: 1, percent: 50, hasDefect: false })}
      onSelectOverview={() => {}}
    />
  );
  expect(screen.getByTestId('inspection-details-entry')).toBeTruthy();
  expect(screen.getByText('Roof')).toBeTruthy();
});

test('author mode hides the Inspection Details overview and shows item counts', () => {
  render(
    <SectionRail
      mode="author"
      sections={sections}
      activeSection="s1"
      onSelect={() => {}}
      onAddSection={() => {}}
      onMoveSection={() => {}}
    />
  );
  expect(screen.queryByTestId('inspection-details-entry')).toBeNull();
  expect(screen.getByTestId('add-section-btn')).toBeTruthy();
  expect(screen.getByText('2')).toBeTruthy(); // Roof item count
});
