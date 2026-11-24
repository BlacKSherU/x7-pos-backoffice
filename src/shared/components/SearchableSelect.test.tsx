import { useState } from 'react';
import { cleanup, render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { SearchableSelect, type SearchableSelectOption } from './SearchableSelect';

afterEach(cleanup);

const OPTIONS: SearchableSelectOption[] = [
  { value: 'CHE', label: 'CHE — WIR Euro' },
  { value: 'CLP', label: 'CLP — Chilean Peso' },
  { value: 'EUR', label: 'EUR — Euro' },
  { value: 'USD', label: 'USD — US Dollar', description: 'Default', disabled: true },
];

function Harness(props: { onSearch?: (q: string) => void; options?: SearchableSelectOption[]; error?: string }) {
  const [value, setValue] = useState('CLP');
  return (
    <SearchableSelect
      id="currency"
      label="Currency *"
      value={value}
      options={props.options ?? OPTIONS}
      onChange={setValue}
      onSearch={props.onSearch}
      error={props.error}
      emptyMessage="Nothing here."
    />
  );
}

describe('SearchableSelect', () => {
  it('shows the selected option and opens a searchable listbox', async () => {
    render(<Harness />);
    const button = screen.getByLabelText('Currency *');
    expect(button).toHaveTextContent('CLP — Chilean Peso');

    await userEvent.click(button);
    expect(screen.getByRole('combobox', { name: 'Search currency' })).toHaveFocus();
    expect(screen.getAllByRole('option')).toHaveLength(4);
    expect(screen.getByRole('option', { name: /CLP/ })).toHaveAttribute('aria-selected', 'true');
  });

  it('ranks local matches: the option whose name starts with the query comes first', async () => {
    render(<Harness />);
    await userEvent.click(screen.getByLabelText('Currency *'));
    await userEvent.type(screen.getByRole('combobox', { name: 'Search currency' }), 'euro');

    expect(screen.getAllByRole('option').map((o) => o.textContent)).toEqual(['EUR — Euro', 'CHE — WIR Euro']);
    await userEvent.keyboard('{Enter}');
    expect(screen.getByLabelText('Currency *')).toHaveTextContent('EUR — Euro');
    expect(screen.queryByRole('listbox')).not.toBeInTheDocument();
  });

  it('navigates with the arrows, skips disabled options and closes with Escape', async () => {
    render(<Harness />);
    await userEvent.click(screen.getByLabelText('Currency *'));
    // abre en CLP (índice 1); ↓ va a EUR; ↓ salta USD (deshabilitada) y vuelve a CHE
    await userEvent.keyboard('{ArrowDown}{ArrowDown}{Enter}');
    expect(screen.getByLabelText('Currency *')).toHaveTextContent('CHE — WIR Euro');

    await userEvent.click(screen.getByLabelText('Currency *'));
    await userEvent.click(screen.getByRole('option', { name: /USD/ }));
    expect(screen.getByRole('listbox')).toBeInTheDocument();
    await userEvent.keyboard('{Escape}');
    expect(screen.queryByRole('listbox')).not.toBeInTheDocument();
    expect(screen.getByLabelText('Currency *')).toHaveTextContent('CHE — WIR Euro');
  });

  it('delegates the search when onSearch is given and shows the empty message', async () => {
    const onSearch = vi.fn();
    render(<Harness onSearch={onSearch} options={[]} />);
    await userEvent.click(screen.getByLabelText('Currency *'));
    await userEvent.type(screen.getByRole('combobox', { name: 'Search currency' }), 'ab');

    expect(onSearch).toHaveBeenLastCalledWith('ab');
    expect(screen.getByText('Nothing here.')).toBeInTheDocument();
  });

  it('shows the validation error', () => {
    render(<Harness error="Select a currency." />);
    expect(screen.getByRole('alert')).toHaveTextContent('Select a currency.');
    expect(screen.getByLabelText('Currency *')).toHaveAttribute('aria-invalid', 'true');
  });
});
