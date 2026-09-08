/**
 * Copyright since 2025 Mifos Initiative
 *
 * This Source Code Form is subject to the terms of the Mozilla Public
 * License, v. 2.0. If a copy of the MPL was not distributed with this
 * file, You can obtain one at http://mozilla.org/MPL/2.0/.
 */

import { ComponentFixture, TestBed } from '@angular/core/testing';
import { ActivatedRoute, Router } from '@angular/router';
import { MatDialog } from '@angular/material/dialog';
import { TranslateModule } from '@ngx-translate/core';
import { FaIconLibrary } from '@fortawesome/angular-fontawesome';
import { faEdit, faTrash } from '@fortawesome/free-solid-svg-icons';
import { of } from 'rxjs';

import { AuthenticationService } from 'app/core/authentication/authentication.service';
import { TemplatesService } from '../templates.service';
import { ViewTemplateComponent } from './view-template.component';

describe('ViewTemplateComponent', () => {
  const htmlDocument =
    '<!DOCTYPE html>\n<html lang="km"><head><style>body{margin:0}</style></head>' +
    '<body>{{#hasRows}}<table></table>{{/hasRows}}<script>var a = 1;</script></body></html>';

  function createFixture(text: string): ComponentFixture<ViewTemplateComponent> {
    TestBed.resetTestingModule();
    TestBed.configureTestingModule({
      imports: [
        ViewTemplateComponent,
        TranslateModule.forRoot()
      ],
      providers: [
        {
          provide: ActivatedRoute,
          useValue: { data: of({ template: { id: 2, name: 'Report', entity: 'loan', type: 'Document', text } }) }
        },
        { provide: Router, useValue: { navigate: jest.fn() } },
        { provide: TemplatesService, useValue: { deleteTemplate: jest.fn().mockReturnValue(of({})) } },
        { provide: MatDialog, useValue: { open: jest.fn() } },
        {
          provide: AuthenticationService,
          useValue: { getCredentials: () => ({ permissions: ['ALL_FUNCTIONS'] }) }
        }
      ]
    });

    TestBed.inject(FaIconLibrary).addIcons(faEdit, faTrash);

    const fixture = TestBed.createComponent(ViewTemplateComponent);
    fixture.detectChanges();
    return fixture;
  }

  it('renders a full HTML document into a sandboxed frame instead of the page', () => {
    const fixture = createFixture(htmlDocument);
    const iframe: HTMLIFrameElement = fixture.nativeElement.querySelector('iframe.template-preview');

    expect(fixture.componentInstance.isAdvancedTemplate).toBe(true);
    expect(iframe).toBeTruthy();
    // Fully sandboxed: the template's own scripts and styles can never reach the app.
    expect(iframe.getAttribute('sandbox')).toBe('');
    expect(iframe.getAttribute('srcdoc')).toContain('{{#hasRows}}');
    // The document must not be spliced into the app's own DOM.
    expect(fixture.nativeElement.querySelector('table')).toBeNull();
  });

  it('shows the unmodified source when the source view is selected', () => {
    const fixture = createFixture(htmlDocument);
    // Click the toggle the way a user does, so the OnPush view actually updates.
    const toggles: HTMLElement[] = Array.from(fixture.nativeElement.querySelectorAll('mat-button-toggle button'));
    toggles[1].click();
    fixture.detectChanges();

    expect(fixture.componentInstance.textView).toBe('source');

    const source: HTMLElement = fixture.nativeElement.querySelector('pre.template-source');
    expect(source.textContent).toBe(htmlDocument);
    expect(fixture.nativeElement.querySelector('iframe.template-preview')).toBeNull();
  });

  it('wraps a plain fragment for the preview frame', () => {
    const fixture = createFixture('<p>Dear {{client.displayName}},</p>');

    expect(fixture.componentInstance.isAdvancedTemplate).toBe(false);
    const iframe: HTMLIFrameElement = fixture.nativeElement.querySelector('iframe.template-preview');
    expect(iframe.getAttribute('srcdoc')).toContain('<p>Dear {{client.displayName}},</p>');
  });
});
