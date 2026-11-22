import { describe, expect, it } from 'vitest';
import {
  buildFiscalData,
  grandTotalBalance,
  isTaxExempt,
  resolveTaxExemption,
  sameFiscalData,
  splitFiscalData,
  validateFiscalDataPayload,
  validateFiscalForm,
} from './receipt-fiscal';

const state = (patch: Partial<ReturnType<typeof splitFiscalData>> = {}) => ({
  taxId: '',
  exemptionCode: '',
  taxExempt: false,
  extra: '',
  ...patch,
});

describe('receipt-fiscal — exemption rule (same as the back-end, Historia 10)', () => {
  it('is not exempt without a JSON object', () => {
    expect(resolveTaxExemption(null).exempt).toBe(false);
    expect(resolveTaxExemption('').exempt).toBe(false);
    expect(resolveTaxExemption('not json').exempt).toBe(false);
    expect(resolveTaxExemption('[1]').exempt).toBe(false);
  });

  it('lets an explicit tax_exempt boolean decide', () => {
    expect(resolveTaxExemption('{"tax_exempt":true,"exemption_code":"EX-1"}')).toEqual({
      exempt: true,
      exemptionCode: 'EX-1',
      taxId: null,
    });
    // false suspende la exención aunque el certificado siga registrado.
    expect(resolveTaxExemption('{"tax_exempt":false,"exemption_code":"EX-1"}').exempt).toBe(false);
  });

  it('is exempt when there is an exemption_code and no tax_exempt flag', () => {
    expect(resolveTaxExemption('{"tax_id":" 123 ","exemption_code":" EX-9 "}')).toEqual({
      exempt: true,
      exemptionCode: 'EX-9',
      taxId: '123',
    });
    expect(resolveTaxExemption('{"exemption_code":"   "}').exempt).toBe(false);
    expect(isTaxExempt({ fiscal_data: '{"exemption_code":"EX-9"}' })).toBe(true);
    expect(isTaxExempt({ fiscal_data: '{"tax_id":"1"}' })).toBe(false);
  });
});

describe('receipt-fiscal — payload validation (same messages as the 400 of the back-end)', () => {
  it('accepts empty text and valid payloads', () => {
    expect(validateFiscalDataPayload('')).toBeNull();
    expect(validateFiscalDataPayload('{"tax_id":"1","exemption_code":"EX","tax_exempt":true}')).toBeNull();
    expect(validateFiscalDataPayload('{"fiscal_number":"F1"}')).toBeNull();
  });

  it('rejects what the back-end rejects', () => {
    expect(validateFiscalDataPayload('{bad')).toBe('fiscalData must be valid JSON');
    expect(validateFiscalDataPayload('[1]')).toBe('fiscalData must be a valid JSON object');
    expect(validateFiscalDataPayload('{"tax_id":""}')).toBe(
      'fiscalData.tax_id must be a non-empty string of at most 64 characters',
    );
    expect(validateFiscalDataPayload(`{"exemption_code":"${'X'.repeat(65)}"}`)).toBe(
      'fiscalData.exemption_code must be a non-empty string of at most 64 characters',
    );
    expect(validateFiscalDataPayload('{"tax_id":12}')).toMatch(/tax_id must be a non-empty string/);
    expect(validateFiscalDataPayload('{"tax_exempt":"yes"}')).toBe('fiscalData.tax_exempt must be a boolean');
    expect(validateFiscalDataPayload('{"tax_exempt":true}')).toBe(
      'fiscalData.exemption_code is required when tax_exempt is true',
    );
  });
});

describe('receipt-fiscal — form state', () => {
  it('splits fiscal_data into the structured fields and the remaining JSON', () => {
    expect(splitFiscalData('{"tax_id":"J-1","exemption_code":"EX-1","fiscal_number":"F1"}')).toEqual({
      taxId: 'J-1',
      exemptionCode: 'EX-1',
      taxExempt: true,
      extra: JSON.stringify({ fiscal_number: 'F1' }, null, 2),
    });
    expect(splitFiscalData(null)).toEqual(state());
    expect(splitFiscalData('legacy text')).toEqual(state({ extra: 'legacy text' }));
  });

  it('validates each field with the back-end limits', () => {
    expect(validateFiscalForm(state({ taxId: 'J-1' }))).toEqual({});
    expect(validateFiscalForm(state({ taxId: 'X'.repeat(65) })).taxId).toMatch(/64 characters/);
    expect(validateFiscalForm(state({ exemptionCode: 'X'.repeat(65) })).exemptionCode).toMatch(/64 characters/);
    expect(validateFiscalForm(state({ taxExempt: true })).exemptionCode).toMatch(/exemption code is required/i);
    expect(validateFiscalForm(state({ taxExempt: true, exemptionCode: 'EX' }))).toEqual({});
    expect(validateFiscalForm(state({ extra: '{bad' })).extra).toMatch(/valid JSON/);
    expect(validateFiscalForm(state({ extra: '[1]' })).extra).toMatch(/JSON object/);
    expect(validateFiscalForm(state({ extra: '{"tax_id":"1"}' })).extra).toMatch(/own field/);
  });

  it('builds a compact payload with only the needed keys', () => {
    expect(buildFiscalData(state())).toBe('');
    expect(buildFiscalData(state({ taxId: ' J-1 ', extra: '{"fiscal_number":"F1"}' }))).toBe(
      '{"tax_id":"J-1","fiscal_number":"F1"}',
    );
    // Exención implícita por el código: no hace falta escribir tax_exempt.
    expect(buildFiscalData(state({ exemptionCode: 'EX-1', taxExempt: true }))).toBe('{"exemption_code":"EX-1"}');
    // Desmarcar con un código registrado suspende la exención con tax_exempt: false.
    expect(buildFiscalData(state({ exemptionCode: 'EX-1', taxExempt: false }))).toBe(
      '{"exemption_code":"EX-1","tax_exempt":false}',
    );
    // Si el original ya traía la bandera, se conserva explícita.
    expect(
      buildFiscalData(state({ exemptionCode: 'EX-1', taxExempt: true }), '{"exemption_code":"EX-1","tax_exempt":true}'),
    ).toBe('{"exemption_code":"EX-1","tax_exempt":true}');
  });

  it('round-trips without spurious changes', () => {
    const raw = '{"fiscal_number":"F1","tax_id":"J-1","exemption_code":"EX-1"}';
    expect(sameFiscalData(buildFiscalData(splitFiscalData(raw), raw), raw)).toBe(true);
    expect(sameFiscalData('{"a":1,"b":2}', '{ "b": 2, "a": 1 }')).toBe(true);
    expect(sameFiscalData('{"a":1}', '{"a":2}')).toBe(false);
    expect(sameFiscalData('', null)).toBe(true);
    expect(sameFiscalData('{"a":1}', '')).toBe(false);
  });
});

describe('receipt-fiscal — grand total balance', () => {
  it('checks grand_total = subtotal + total_tax − total_discount to the cent', () => {
    expect(grandTotalBalance({ subtotal: 100, total_tax: 19, total_discount: 5.5, grand_total: 113.5 })).toEqual({
      expected: 113.5,
      actual: 113.5,
      differenceCents: 0,
      balanced: true,
    });
    // 0.1 + 0.2 no rompe el cuadre: se compara en centavos enteros.
    expect(grandTotalBalance({ subtotal: 0.1, total_tax: 0.2, total_discount: 0, grand_total: 0.3 }).balanced).toBe(
      true,
    );
    const off = grandTotalBalance({ subtotal: 10, total_tax: 1.9, total_discount: 0, grand_total: 11.91 });
    expect(off.balanced).toBe(false);
    expect(off.differenceCents).toBe(1);
  });
});
