import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { render, screen, waitFor, fireEvent, within, cleanup } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { CustomersView } from './CustomersView';
import * as customersApi from '../api/customers';
import type { Customer } from '../types/customer';

const MOCK_CUSTOMERS: Customer[] = [
  {
    id: 501,
    name: 'Inversiones Pacifico SpA',
    rut: '77.890.123-4',
    email: 'contacto@pacifico.cl',
    phone: '+56 9 9123 4567',
    address: 'Av. Vitacura 2939, Piso 8',
    city: 'Santiago',
    state: 'Región Metropolitana',
    country: 'Chile',
    orders: [{ id: 101 }, { id: 102 }],
    loyaltyCustomers: [{ id: 1 }, { id: 2 }, { id: 3 }],
  },
  {
    id: 502,
    name: 'Distribuidora del Valle',
    rut: null,
    email: 'ventas@valle.cl',
    phone: '+56 9 8234 5678',
    address: 'Camino Internacional 450',
    city: 'Viña del Mar',
    state: 'Valparaíso',
    country: 'Chile',
    orders: [{ id: 103 }],
    loyaltyCustomers: [],
  },
  {
    id: 503,
    name: 'Global Bistro Concepts',
    rut: '96.543.210-K',
    email: 'finance@globalbistro.com',
    phone: '+1 305 555 0199',
    address: '777 Brickell Ave',
    city: 'Miami',
    state: 'Florida',
    country: 'United States',
    orders: [{ id: 104 }, { id: 105 }, { id: 106 }, { id: 107 }],
    loyaltyCustomers: [{ id: 4 }],
  },
];

describe('CustomersView Workspace Data Grid', () => {
  beforeEach(() => {
    vi.restoreAllMocks();
  });

  afterEach(() => {
    cleanup();
  });

  describe('1. Dynamic Dataset Hydration & Tenant Scoping', () => {
    it('fetches active customer records on mount using active companyId context', async () => {
      const fetchSpy = vi.spyOn(customersApi, 'fetchCustomers').mockResolvedValue(MOCK_CUSTOMERS);

      render(<CustomersView companyId={42} />);

      await waitFor(() => {
        expect(fetchSpy).toHaveBeenCalledWith(42);
      });

      expect(await screen.findByText('Inversiones Pacifico SpA')).toBeInTheDocument();
      expect(screen.getByText('Distribuidora del Valle')).toBeInTheDocument();
      expect(screen.getByText('Global Bistro Concepts')).toBeInTheDocument();
    });

    it('displays loading indicator while dataset is hydrating', () => {
      vi.spyOn(customersApi, 'fetchCustomers').mockImplementation(
        () => new Promise(() => {}),
      );

      render(<CustomersView companyId={42} />);
      expect(
        screen.getByText(/Hydrating active enterprise customer profiles/i),
      ).toBeInTheDocument();
    });

    it('renders error state and offers retry button if network fetch fails', async () => {
      const fetchSpy = vi
        .spyOn(customersApi, 'fetchCustomers')
        .mockRejectedValue(new Error('Network connection timeout'));

      render(<CustomersView companyId={42} />);

      expect(
        await screen.findByText(/Failed to load enterprise customer records/i),
      ).toBeInTheDocument();

      const retryBtn = screen.getByRole('button', { name: /Retry Connection/i });
      expect(retryBtn).toBeInTheDocument();

      fetchSpy.mockResolvedValueOnce(MOCK_CUSTOMERS);
      fireEvent.click(retryBtn);

      expect(await screen.findByText('Inversiones Pacifico SpA')).toBeInTheDocument();
    });

    it('empty state handling: when payload returns 0 configurations, table canvas disappears completely and renders custom illustration and label', async () => {
      vi.spyOn(customersApi, 'fetchCustomers').mockResolvedValue([]);

      render(<CustomersView companyId={42} />);

      const emptyState = await screen.findByTestId('customers-empty-state');
      expect(emptyState).toBeInTheDocument();

      // Label verification
      expect(
        screen.getByText(
          "No customers configured yet for this company profile. Click 'Add Customer' to establish your business partners network.",
        ),
      ).toBeInTheDocument();

      // Verify that the table grid disappears completely
      expect(screen.queryByRole('table')).not.toBeInTheDocument();
      expect(screen.queryByText(/CUSTOMER DIRECTORY DATA GRID/i)).not.toBeInTheDocument();
    });
  });

  describe('2. Core Grid Layout Data-Binding (Column Mappings)', () => {
    beforeEach(() => {
      vi.spyOn(customersApi, 'fetchCustomers').mockResolvedValue(MOCK_CUSTOMERS);
    });

    it('renders Customer Identity: displays name and unique ID badge (#CUST-{id})', async () => {
      render(<CustomersView companyId={42} />);

      await screen.findByText('Inversiones Pacifico SpA');
      expect(screen.getByText('#CUST-501')).toBeInTheDocument();
      expect(screen.getByText('#CUST-502')).toBeInTheDocument();
      expect(screen.getByText('#CUST-503')).toBeInTheDocument();
    });

    it('renders Contact Channels: displays email and phone records', async () => {
      render(<CustomersView companyId={42} />);

      await screen.findByText('Inversiones Pacifico SpA');
      expect(screen.getByText('contacto@pacifico.cl')).toBeInTheDocument();
      expect(screen.getByText('+56 9 9123 4567')).toBeInTheDocument();
      expect(screen.getByText('ventas@valle.cl')).toBeInTheDocument();
      expect(screen.getByText('+56 9 8234 5678')).toBeInTheDocument();
    });

    it('renders Tax Identification Number: displays rut or gray placeholder "No RUT assigned"', async () => {
      render(<CustomersView companyId={42} />);

      await screen.findByText('Inversiones Pacifico SpA');
      // Assigned RUTs
      expect(screen.getByText('77.890.123-4')).toBeInTheDocument();
      expect(screen.getByText('96.543.210-K')).toBeInTheDocument();

      // Unassigned RUT (customer 502 has rut: null)
      expect(screen.getByText('No RUT assigned')).toBeInTheDocument();
    });

    it('renders Geographic Location: accurately renders address, city, state, country', async () => {
      render(<CustomersView companyId={42} />);

      await screen.findByText('Inversiones Pacifico SpA');

      // Street addresses
      expect(screen.getByText('Av. Vitacura 2939, Piso 8')).toBeInTheDocument();
      expect(screen.getByText('Camino Internacional 450')).toBeInTheDocument();
      expect(screen.getByText('777 Brickell Ave')).toBeInTheDocument();

      // Regional strings (city, state, country)
      expect(screen.getByText(/Santiago, Región Metropolitana, Chile/)).toBeInTheDocument();
      expect(screen.getByText(/Viña del Mar, Valparaíso, Chile/)).toBeInTheDocument();
      expect(screen.getByText(/Miami, Florida, United States/)).toBeInTheDocument();
    });

    it('renders Linked Activity Badges: displays count length of connected orders and loyalty records', async () => {
      render(<CustomersView companyId={42} />);

      await screen.findByText('Inversiones Pacifico SpA');

      // Row 1 (501): 2 orders, 3 loyalty
      const row1 = screen.getByText('Inversiones Pacifico SpA').closest('tr')!;
      expect(within(row1).getByText('2 Orders')).toBeInTheDocument();
      expect(within(row1).getByText('3 Loyalty')).toBeInTheDocument();

      // Row 2 (502): 1 order, 0 loyalty
      const row2 = screen.getByText('Distribuidora del Valle').closest('tr')!;
      expect(within(row2).getByText('1 Orders')).toBeInTheDocument();
      expect(within(row2).getByText('0 Loyalty')).toBeInTheDocument();

      // Row 3 (503): 4 orders, 1 loyalty
      const row3 = screen.getByText('Global Bistro Concepts').closest('tr')!;
      expect(within(row3).getByText('4 Orders')).toBeInTheDocument();
      expect(within(row3).getByText('1 Loyalty')).toBeInTheDocument();
    });
  });

  describe('3. Advanced Real-Time Searching & Filtration', () => {
    beforeEach(() => {
      vi.spyOn(customersApi, 'fetchCustomers').mockResolvedValue(MOCK_CUSTOMERS);
    });

    it('alphanumeric search bar filters grid rows in real-time against customer name', async () => {
      const user = userEvent.setup();
      render(<CustomersView companyId={42} />);

      await screen.findByText('Inversiones Pacifico SpA');

      const searchInput = screen.getByTestId('customer-search-input');
      await user.type(searchInput, 'Valle');

      await waitFor(
        () => {
          expect(screen.getByText('Distribuidora del Valle')).toBeInTheDocument();
          expect(screen.queryByText('Inversiones Pacifico SpA')).not.toBeInTheDocument();
          expect(screen.queryByText('Global Bistro Concepts')).not.toBeInTheDocument();
        },
        { timeout: 3000 },
      );
    });

    it('alphanumeric search bar filters grid rows in real-time against email vector', async () => {
      const user = userEvent.setup();
      render(<CustomersView companyId={42} />);

      await screen.findByText('Inversiones Pacifico SpA');

      const searchInput = screen.getByTestId('customer-search-input');
      await user.type(searchInput, 'finance@globalbistro');

      await waitFor(() => {
        expect(screen.getByText('Global Bistro Concepts')).toBeInTheDocument();
        expect(screen.queryByText('Inversiones Pacifico SpA')).not.toBeInTheDocument();
        expect(screen.queryByText('Distribuidora del Valle')).not.toBeInTheDocument();
      });
    });

    it('alphanumeric search bar filters grid rows in real-time against tax code (RUT)', async () => {
      const user = userEvent.setup();
      render(<CustomersView companyId={42} />);

      await screen.findByText('Inversiones Pacifico SpA');

      const searchInput = screen.getByTestId('customer-search-input');
      await user.type(searchInput, '77.890');

      await waitFor(() => {
        expect(screen.getByText('Inversiones Pacifico SpA')).toBeInTheDocument();
        expect(screen.queryByText('Distribuidora del Valle')).not.toBeInTheDocument();
        expect(screen.queryByText('Global Bistro Concepts')).not.toBeInTheDocument();
      });
    });

    it('isolates customer records by city dropdown filter', async () => {
      render(<CustomersView companyId={42} />);

      await screen.findByText('Inversiones Pacifico SpA');

      const citySelect = screen.getByTestId('filter-city-select');
      fireEvent.change(citySelect, { target: { value: 'Miami' } });

      await waitFor(() => {
        expect(screen.getByText('Global Bistro Concepts')).toBeInTheDocument();
        expect(screen.queryByText('Inversiones Pacifico SpA')).not.toBeInTheDocument();
        expect(screen.queryByText('Distribuidora del Valle')).not.toBeInTheDocument();
      });
    });

    it('isolates customer records by state dropdown filter', async () => {
      render(<CustomersView companyId={42} />);

      await screen.findByText('Inversiones Pacifico SpA');

      const stateSelect = screen.getByTestId('filter-state-select');
      fireEvent.change(stateSelect, { target: { value: 'Valparaíso' } });

      await waitFor(() => {
        expect(screen.getByText('Distribuidora del Valle')).toBeInTheDocument();
        expect(screen.queryByText('Inversiones Pacifico SpA')).not.toBeInTheDocument();
        expect(screen.queryByText('Global Bistro Concepts')).not.toBeInTheDocument();
      });
    });

    it('isolates customer records by country dropdown filter', async () => {
      render(<CustomersView companyId={42} />);

      await screen.findByText('Inversiones Pacifico SpA');

      const countrySelect = screen.getByTestId('filter-country-select');
      fireEvent.change(countrySelect, { target: { value: 'Chile' } });

      await waitFor(() => {
        expect(screen.getByText('Inversiones Pacifico SpA')).toBeInTheDocument();
        expect(screen.getByText('Distribuidora del Valle')).toBeInTheDocument();
        expect(screen.queryByText('Global Bistro Concepts')).not.toBeInTheDocument();
      });
    });

    it('renders filtered-empty state and restores full grid when Clear Filters is clicked', async () => {
      const user = userEvent.setup();
      render(<CustomersView companyId={42} />);

      await screen.findByText('Inversiones Pacifico SpA');

      const searchInput = screen.getByTestId('customer-search-input');
      await user.type(searchInput, 'nonexistent-query-12345');

      await waitFor(() => {
        expect(screen.getByTestId('customers-filtered-empty-state')).toBeInTheDocument();
        expect(screen.getByText(/No matching customers found/i)).toBeInTheDocument();
      });

      const emptyCard = screen.getByTestId('customers-filtered-empty-state');
      const clearBtn = within(emptyCard).getByRole('button', { name: /Clear Filters/i });
      await user.click(clearBtn);

      await waitFor(() => {
        expect(screen.getByText('Inversiones Pacifico SpA')).toBeInTheDocument();
        expect(screen.getByText('Distribuidora del Valle')).toBeInTheDocument();
        expect(screen.getByText('Global Bistro Concepts')).toBeInTheDocument();
      });
    });
  });

  describe('4. Operational CRUD Form Drawer Workflow', () => {
    beforeEach(() => {
      vi.spyOn(customersApi, 'fetchCustomers').mockResolvedValue(MOCK_CUSTOMERS);
    });

    it('opens add customer drawer and enforces mandatory fields (name, rut, email, address, city, state, country) while phone is optional', async () => {
      const user = userEvent.setup();
      render(<CustomersView companyId={42} merchantId={7} />);

      await screen.findByText('Inversiones Pacifico SpA');

      const addBtn = screen.getByRole('button', { name: /ADD CUSTOMER/i });
      await user.click(addBtn);

      expect(await screen.findByText('Add New Customer')).toBeInTheDocument();

      const saveBtn = screen.getByRole('button', { name: /Save Customer/i });
      await user.click(saveBtn);

      // Verify all mandatory validations
      expect(await screen.findByText('Customer name is required.')).toBeInTheDocument();
      expect(screen.getByText('Tax identification (RUT) is required.')).toBeInTheDocument();
      expect(screen.getByText('Contact email is required.')).toBeInTheDocument();
      expect(screen.getByText('Street address is required.')).toBeInTheDocument();
      expect(screen.getByText('City is required.')).toBeInTheDocument();
      expect(screen.getByText('State / Region is required.')).toBeInTheDocument();
      expect(screen.getByText('Country is required.')).toBeInTheDocument();
    });

    it('creates a customer and automatically injects companyId, merchantId, and timestamps into the payload', async () => {
      const user = userEvent.setup();
      const createSpy = vi.spyOn(customersApi, 'createCustomer').mockResolvedValue({
        id: 999,
        name: 'Nuevo Cliente SpA',
        rut: '76.999.888-1',
        email: 'admin@nuevocliente.cl',
        phone: null,
        address: 'Calle Nueva 123',
        city: 'Concepción',
        state: 'Biobío',
        country: 'Chile',
        companyId: 42,
        merchantId: 7,
      });

      render(<CustomersView companyId={42} merchantId={7} />);
      await screen.findByText('Inversiones Pacifico SpA');

      await user.click(screen.getByRole('button', { name: /ADD CUSTOMER/i }));
      expect(await screen.findByText('Add New Customer')).toBeInTheDocument();

      // Fill in mandatory fields (leaving phone blank to verify it is optional)
      fireEvent.change(screen.getByPlaceholderText(/e\.g\. Acme Hospitality Group/i), {
        target: { value: 'Nuevo Cliente SpA' },
      });
      fireEvent.change(screen.getByPlaceholderText(/e\.g\. 76\.123\.456-7/i), {
        target: { value: '76.999.888-1' },
      });
      fireEvent.change(screen.getByPlaceholderText(/contact@example\.com/i), {
        target: { value: 'admin@nuevocliente.cl' },
      });
      fireEvent.change(screen.getByPlaceholderText(/e\.g\. Av\. Providencia 1234/i), {
        target: { value: 'Calle Nueva 123' },
      });
      fireEvent.change(screen.getByPlaceholderText(/Santiago/i), {
        target: { value: 'Concepción' },
      });
      fireEvent.change(screen.getByPlaceholderText(/Región Metropolitana/i), {
        target: { value: 'Biobío' },
      });
      fireEvent.change(screen.getByPlaceholderText(/Chile/i), {
        target: { value: 'Chile' },
      });

      await user.click(screen.getByRole('button', { name: /Save Customer/i }));

      await waitFor(() => {
        expect(createSpy).toHaveBeenCalledWith(
          expect.objectContaining({
            name: 'Nuevo Cliente SpA',
            rut: '76.999.888-1',
            email: 'admin@nuevocliente.cl',
            address: 'Calle Nueva 123',
            city: 'Concepción',
            state: 'Biobío',
            country: 'Chile',
            companyId: 42,
            merchantId: 7,
            created_at: expect.any(String),
            updated_at: expect.any(String),
          }),
        );
      });

      // Verify the new customer appears in the data grid reactively
      expect(await screen.findByText('Nuevo Cliente SpA')).toBeInTheDocument();
      expect(screen.getByText('#CUST-999')).toBeInTheDocument();
    });

    it('pre-populates form drawer fields on edit and dispatches PATCH updateCustomer', async () => {
      const user = userEvent.setup();
      const updateSpy = vi.spyOn(customersApi, 'updateCustomer').mockResolvedValue({
        id: 501,
        name: 'Inversiones Pacifico Modificado',
        rut: '77.890.123-4',
        email: 'contacto@pacifico.cl',
      });

      render(<CustomersView companyId={42} merchantId={7} />);
      await screen.findByText('Inversiones Pacifico SpA');

      const editBtn = screen.getByRole('button', { name: /Edit Inversiones Pacifico SpA/i });
      await user.click(editBtn);

      expect(await screen.findByText('Edit Customer Profile')).toBeInTheDocument();

      const nameInput = screen.getByDisplayValue('Inversiones Pacifico SpA');
      await user.clear(nameInput);
      await user.type(nameInput, 'Inversiones Pacifico Modificado');

      await user.click(screen.getByRole('button', { name: /Update Profile/i }));

      await waitFor(() => {
        expect(updateSpy).toHaveBeenCalledWith(
          501,
          expect.objectContaining({
            name: 'Inversiones Pacifico Modificado',
            rut: '77.890.123-4',
            companyId: 42,
            merchantId: 7,
            updated_at: expect.any(String),
          }),
        );
      });

      expect(await screen.findByText('Inversiones Pacifico Modificado')).toBeInTheDocument();
    });
  });

  describe('5. Detailed Inspection Drawer & Nested Relational Views', () => {
    beforeEach(() => {
      vi.spyOn(customersApi, 'fetchCustomers').mockResolvedValue(MOCK_CUSTOMERS);
    });

    it('opens side inspection drawer on row click and renders full system metadata, address vectors, and relational arrays', async () => {
      render(<CustomersView companyId={42} merchantId={7} />);
      await screen.findByText('Inversiones Pacifico SpA');

      fireEvent.click(screen.getByText('Inversiones Pacifico SpA'));

      const drawer = await screen.findByRole('dialog', { name: /Customer Profile Details/i });
      expect(drawer).toBeInTheDocument();

      // System Metadata & Tenant Scoping within the drawer
      expect(within(drawer).getByText(/Tenant #42/i)).toBeInTheDocument();
      expect(within(drawer).getByText(/Merchant #7/i)).toBeInTheDocument();
      expect(within(drawer).getByText('RUT: 77.890.123-4')).toBeInTheDocument();

      // Geographic Address Vectors
      expect(within(drawer).getByText('Av. Vitacura 2939, Piso 8')).toBeInTheDocument();
      expect(within(drawer).getByText(/Santiago, Región Metropolitana, Chile/i)).toBeInTheDocument();

      // Relational Views: Orders & Loyalty summaries
      expect(within(drawer).getByText('Connected Orders (OneToMany)')).toBeInTheDocument();
      expect(within(drawer).getByText('Connected Loyalty Profiles (OneToMany)')).toBeInTheDocument();
      expect(within(drawer).getByText('Order #101')).toBeInTheDocument();
      expect(within(drawer).getByText('Order #102')).toBeInTheDocument();
      expect(within(drawer).getByText('Card #1')).toBeInTheDocument();
    });
  });

  describe('6. Soft-Delete Pipeline & Confirmation Guard', () => {
    beforeEach(() => {
      vi.spyOn(customersApi, 'fetchCustomers').mockResolvedValue(MOCK_CUSTOMERS);
    });

    it('prompts delete confirmation modal warning and cancels without mutating state', async () => {
      const user = userEvent.setup();
      const deleteSpy = vi.spyOn(customersApi, 'deleteCustomer');

      render(<CustomersView companyId={42} />);
      await screen.findByText('Inversiones Pacifico SpA');

      const deleteBtn = screen.getByRole('button', { name: /Delete Inversiones Pacifico SpA/i });
      await user.click(deleteBtn);

      expect(await screen.findByText('Delete Customer Profile')).toBeInTheDocument();
      expect(screen.getByText(/Are you sure you want to delete Inversiones Pacifico SpA\?/i)).toBeInTheDocument();
      expect(screen.getByText(/will be soft-deleted and removed from active lookups/i)).toBeInTheDocument();

      // Cancel button
      const cancelBtn = screen.getByRole('button', { name: /Cancel/i });
      await user.click(cancelBtn);

      expect(deleteSpy).not.toHaveBeenCalled();
      expect(screen.getByText('Inversiones Pacifico SpA')).toBeInTheDocument();
    });

    it('confirms soft-delete, dispatches deletion request, and immediately removes customer from active grid without reload', async () => {
      const user = userEvent.setup();
      const deleteSpy = vi.spyOn(customersApi, 'deleteCustomer').mockResolvedValue({ success: true });

      render(<CustomersView companyId={42} />);
      await screen.findByText('Inversiones Pacifico SpA');

      const deleteBtn = screen.getByRole('button', { name: /Delete Inversiones Pacifico SpA/i });
      await user.click(deleteBtn);

      const confirmBtn = screen.getByRole('button', { name: /Confirm Delete/i });
      await user.click(confirmBtn);

      await waitFor(() => {
        expect(deleteSpy).toHaveBeenCalledWith(501);
      });

      // Instantly removed from grid without full page reload
      await waitFor(() => {
        expect(screen.queryByText('Inversiones Pacifico SpA')).not.toBeInTheDocument();
      });

      // Other customers remain intact
      expect(screen.getByText('Distribuidora del Valle')).toBeInTheDocument();
      expect(screen.getByText('Global Bistro Concepts')).toBeInTheDocument();
    });
  });
});
