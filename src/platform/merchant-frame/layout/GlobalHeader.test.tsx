import { cleanup, render, screen } from '@testing-library/react';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { GlobalHeader } from '@/platform/merchant-frame/layout/GlobalHeader';
import { calledRoutes, fakeBackend } from '@/test/fetch';

function renderHeader(activeTab = 'dashboard') {
  return render(
    <GlobalHeader
      activeTab={activeTab}
      activeCategory="home"
      refreshTrigger={0}
      navCategories={[]}
      notifications={[]}
      showNotifications={false}
      setShowNotifications={vi.fn()}
      isSidebarCollapsed={false}
      onToggleSidebar={vi.fn()}
      onLogoClick={vi.fn()}
    />,
  );
}

afterEach(() => {
  cleanup();
  vi.unstubAllGlobals();
});

describe('GlobalHeader profile', () => {
  it('loads the signed-in user from /auth/profile', async () => {
    const fetchMock = fakeBackend({
      '/auth/profile': { id: 1, username: 'ana_admin', email: 'ana@x7.test', role: 'merchant_admin' },
    });
    vi.stubGlobal('fetch', fetchMock);

    renderHeader();

    expect(await screen.findByText('ana_admin')).toBeInTheDocument();
    expect(screen.getByText('merchant_admin')).toBeInTheDocument();
    expect(calledRoutes(fetchMock)).toEqual(['GET /auth/profile']);
  });

  // Antes el cuerpo del 404 se guardaba como perfil y getInitials(undefined) rompía el header.
  it('keeps rendering the header when the profile request fails', async () => {
    const fetchMock = fakeBackend({});
    vi.stubGlobal('fetch', fetchMock);

    renderHeader();

    await vi.waitFor(() => expect(fetchMock).toHaveBeenCalled());
    expect(screen.getByRole('banner')).toBeInTheDocument();
    expect(screen.queryByAltText('Profile Portrait')).not.toBeInTheDocument();
  });
});

describe('GlobalHeader Platform SaaS context tabs', () => {
  it.each([
    ['saas-companies-directory', 'Companies Directory'],
    ['saas-merchant-users', 'Merchant User Directory'],
    ['saas-merchant-terminals', 'Merchant Terminals'],
    ['saas-company-profile', 'Company Profile'],
  ])('labels %s under Platform SaaS instead of SYSTEM', async (tab, title) => {
    vi.stubGlobal('fetch', fakeBackend({}));

    renderHeader(tab);

    const banner = screen.getByRole('banner');
    expect(banner).toHaveTextContent('Platform SaaS');
    expect(banner).toHaveTextContent(title);
    expect(banner).not.toHaveTextContent(/SYSTEM/);
    expect(banner).not.toHaveTextContent(/Saas /);
  });
});
