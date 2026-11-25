import { formatPhoneNumber } from './phone-number';

/**
 * The preferred way to write a phone number, `(206) 555-1234`, from any of the formats the
 * `PHONE_NUMBER_FORMAT` rule accepts.  The phone list applies it on blur, to valid numbers only.
 */
describe('formatPhoneNumber', () => {
  it('writes every accepted format as (206) 555-1234', () => {
    for (const number of [
      '2065551234',
      '206-555-1234',
      '206.555.1234',
      '206 555 1234',
      '(206) 555-1234',
      '(206)555-1234',
      '12065551234',
      '+12065551234',
      '1-206-555-1234',
      '+1 (206) 555-1234',
    ]) {
      expect(formatPhoneNumber(number), number).toBe('(206) 555-1234');
    }
  });

  it('gives up on anything that is not ten digits, with or without a 1 in front', () => {
    for (const number of ['555-1234', '206-555-12345', '22065551234', '', null, undefined]) {
      expect(formatPhoneNumber(number), String(number)).toBeUndefined();
    }
  });
});
