import { fireEvent, render, screen } from '@testing-library/react-native';
import { useState } from 'react';

import { Segmented } from './segmented';

type Filter = 'all' | 'in' | 'out';

function Filters({ onChange }: { onChange: (f: Filter) => void }) {
  const [value, setValue] = useState<Filter>('all');
  return (
    <Segmented
      accessibilityLabel="Show transactions"
      value={value}
      onChange={(next) => {
        onChange(next);
        setValue(next);
      }}
      options={[
        { id: 'all', label: 'All' },
        { id: 'in', label: 'In', icon: 'arrow-bottom-left' },
        { id: 'out', label: 'Out', icon: 'arrow-top-right' },
      ]}
    />
  );
}

test('pressing "In" slides the pill one segment across and reports the choice', async () => {
  const onChange = jest.fn();
  await render(<Filters onChange={onChange} />);
  const pill = screen.getByTestId('segmented-pill');
  expect(pill).toHaveStyle({ transform: [{ translateX: '0%' }] });

  await fireEvent.press(screen.getByRole('radio', { name: 'In' }));

  expect(pill).toHaveStyle({ transform: [{ translateX: '100%' }] });
  expect(onChange).toHaveBeenCalledWith('in');
  expect(screen.getByRole('radio', { name: 'In' })).toBeChecked();
});

test('pressing the selected segment changes nothing', async () => {
  const onChange = jest.fn();
  await render(<Filters onChange={onChange} />);

  await fireEvent.press(screen.getByRole('radio', { name: 'All' }));

  expect(onChange).not.toHaveBeenCalled();
  expect(screen.getByRole('radio', { name: 'All' })).toBeChecked();
});
