import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { AppModal } from './AppModal';

describe('AppModal', () => {
  afterEach(() => {
    document.body.innerHTML = '';
  });

  it('renders modal shell in a portal with title and children', () => {
    render(
      <AppModal title="Edit Merchant Branch" onClose={() => undefined}>
        <p>Modal body content</p>
      </AppModal>,
    );

    expect(screen.getByRole('dialog')).toBeInTheDocument();
    expect(screen.getByText('Edit Merchant Branch')).toBeInTheDocument();
    expect(screen.getByText('Modal body content')).toBeInTheDocument();
  });

  it('calls onClose when close button is clicked', async () => {
    const user = userEvent.setup();
    const onClose = vi.fn();

    render(
      <AppModal title="Deactivate Branch" onClose={onClose}>
        <p>Confirm action</p>
      </AppModal>,
    );

    await user.click(screen.getByRole('button', { name: /close dialog/i }));
    expect(onClose).toHaveBeenCalledTimes(1);
  });
});
