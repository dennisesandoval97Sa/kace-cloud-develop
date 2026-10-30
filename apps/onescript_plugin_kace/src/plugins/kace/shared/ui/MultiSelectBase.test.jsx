import { fireEvent, render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { describe, expect, it, vi } from 'vitest';
import MultiSelectBase from './MultiSelectBase.jsx';

describe('MultiSelectBase', () => {
  it('with disableClientFilter search text does not hide options', async () => {
    const user = userEvent.setup();
    render(
      <MultiSelectBase
        name="f"
        options={[{ label: 'Alpha', value: '1' }]}
        selected={[]}
        onChange={() => {}}
        placeholder="Pick"
        disableClientFilter
      />
    );
    await user.click(screen.getByText('Pick'));
    const input = screen.getByPlaceholderText('Buscar...');
    await user.type(input, 'zzz');
    expect(screen.getByText('Alpha')).toBeInTheDocument();
  });

  it('uses controlled searchTerm when props provided', async () => {
    const user = userEvent.setup();
    const onSearch = vi.fn();
    render(
      <MultiSelectBase
        name="f"
        options={[{ label: 'Alpha', value: '1' }]}
        selected={[]}
        onChange={() => {}}
        placeholder="Pick"
        searchTerm="hi"
        onSearchTermChange={onSearch}
      />
    );
    await user.click(screen.getByText('Pick'));
    expect(screen.getByPlaceholderText('Buscar...')).toHaveValue('hi');
    await user.type(screen.getByPlaceholderText('Buscar...'), 'x');
    expect(onSearch).toHaveBeenCalled();
  });

  it('keeps search and actions fixed above the scrolling options list', async () => {
    const user = userEvent.setup();
    render(
      <MultiSelectBase
        name="f"
        options={[{ label: 'Alpha', value: '1' }]}
        selected={[]}
        onChange={() => {}}
        placeholder="Pick"
      />
    );
    await user.click(screen.getByText('Pick'));
    const scrollPanel = screen.getByTestId('kace-multiselect-scroll-menu');
    const input = screen.getByPlaceholderText('Buscar...');
    expect(scrollPanel.contains(input)).toBe(false);
    expect(input.closest('.kace-multiselect-menu-sticky')).not.toBeNull();
  });

  it('calls onMenuScroll when menu scroll fires', async () => {
    const user = userEvent.setup();
    const onMenuScroll = vi.fn();
    render(
      <MultiSelectBase
        name="f"
        options={[{ label: 'A', value: '1' }]}
        selected={[]}
        onChange={() => {}}
        placeholder="Pick"
        onMenuScroll={onMenuScroll}
      />
    );
    await user.click(screen.getByText('Pick'));
    const menu = screen.getByTestId('kace-multiselect-scroll-menu');
    fireEvent.scroll(menu);
    expect(onMenuScroll).toHaveBeenCalled();
  });
});
