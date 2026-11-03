/**
 * Copyright since 2025 Mifos Initiative
 *
 * This Source Code Form is subject to the terms of the Mozilla Public
 * License, v. 2.0. If a copy of the MPL was not distributed with this
 * file, You can obtain one at http://mozilla.org/MPL/2.0/.
 */

import { TestBed } from '@angular/core/testing';
import {
  HttpClient,
  HttpContext,
  provideHttpClient,
  withInterceptorsFromDi,
  HTTP_INTERCEPTORS
} from '@angular/common/http';
import { HttpTestingController, provideHttpClientTesting } from '@angular/common/http/testing';
import { TranslateModule } from '@ngx-translate/core';
import { describe, it, expect, jest, beforeEach, afterEach } from '@jest/globals';

import { ErrorHandlerInterceptor, SKIP_GLOBAL_ERROR_HANDLER } from './error-handler.interceptor';
import { AlertService } from '../alert/alert.service';

describe('ErrorHandlerInterceptor', () => {
  let http: HttpClient;
  let httpMock: HttpTestingController;
  let alertService: { alert: jest.Mock };

  beforeEach(() => {
    alertService = { alert: jest.fn() };
    TestBed.configureTestingModule({
      imports: [TranslateModule.forRoot()],
      providers: [
        { provide: AlertService, useValue: alertService },
        { provide: HTTP_INTERCEPTORS, useClass: ErrorHandlerInterceptor, multi: true },
        provideHttpClient(withInterceptorsFromDi()),
        provideHttpClientTesting()
      ]
    });
    http = TestBed.inject(HttpClient);
    httpMock = TestBed.inject(HttpTestingController);
  });

  afterEach(() => {
    httpMock.verify();
  });

  it('shows a global alert for a failed request by default', () => {
    http.get('/missing').subscribe({ error: () => undefined });

    httpMock.expectOne('/missing').flush({}, { status: 404, statusText: 'Not Found' });

    expect(alertService.alert).toHaveBeenCalled();
  });

  it('skips the global alert when SKIP_GLOBAL_ERROR_HANDLER is set, still passing the error on', () => {
    const errorHandler = jest.fn();
    http
      .get('/missing', { context: new HttpContext().set(SKIP_GLOBAL_ERROR_HANDLER, true) })
      .subscribe({ error: errorHandler });

    httpMock.expectOne('/missing').flush({}, { status: 404, statusText: 'Not Found' });

    expect(alertService.alert).not.toHaveBeenCalled();
    expect(errorHandler).toHaveBeenCalled();
  });
});
