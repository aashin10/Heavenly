import { HttpErrorResponse } from '@angular/common/http';
import {
  problemDetail,
  problemFieldErrors,
  problemMessages,
  problemStatus,
} from './problem-details';

function httpError(status: number, body: unknown): HttpErrorResponse {
  return new HttpErrorResponse({ status, error: body });
}

describe('problem-details', () => {
  it('reads the server’s own words off a 409', () => {
    const error = httpError(409, {
      title: 'Conflict.',
      status: 409,
      detail: 'You have already bid on tender TND-2026-00087.',
    });

    expect(problemStatus(error)).toBe(409);
    expect(problemDetail(error, 'fallback')).toBe(
      'You have already bid on tender TND-2026-00087.'
    );
  });

  it('camelCases validation keys so they match form control names', () => {
    // FluentValidation names properties as declared: PascalCase on the wire,
    // camelCase in the Angular form. Without this the error binds to nothing.
    const error = httpError(400, {
      title: 'One or more validation errors occurred.',
      status: 400,
      errors: {
        TotalPrice: ['A bid must have a price.'],
        TechnicalApproach: ['A technical approach is required.'],
      },
    });

    expect(problemFieldErrors(error)).toEqual({
      totalPrice: ['A bid must have a price.'],
      technicalApproach: ['A technical approach is required.'],
    });
  });

  it('collapses an indexed path onto its top-level control', () => {
    // RuleForEach produces "PriceBreakdown[0].Description". No control has
    // that name; the array itself does.
    const error = httpError(400, {
      status: 400,
      errors: {
        'PriceBreakdown[0].Description': ['must not be empty'],
        'PriceBreakdown[1].Amount': ['must be >= 0'],
      },
    });

    expect(problemFieldErrors(error)).toEqual({
      priceBreakdown: ['must not be empty', 'must be >= 0'],
    });
  });

  it('lists every validation message for a summary panel', () => {
    const error = httpError(400, {
      status: 400,
      errors: { TotalPrice: ['A bid must have a price.'], Deviations: ['too long'] },
    });

    expect(problemMessages(error)).toEqual(['A bid must have a price.', 'too long']);
  });

  it('falls back when the body is not problem details at all', () => {
    // A dropped connection has status 0 and a ProgressEvent for a body. The
    // fallback must win rather than "[object ProgressEvent]" reaching a toast.
    const offline = new HttpErrorResponse({ status: 0, error: new ProgressEvent('error') });

    expect(problemStatus(offline)).toBe(0);
    expect(problemDetail(offline, 'Could not reach the server.')).toBe(
      'Could not reach the server.'
    );
    expect(problemFieldErrors(offline)).toEqual({});
    expect(problemMessages(offline)).toEqual([]);
  });
});
