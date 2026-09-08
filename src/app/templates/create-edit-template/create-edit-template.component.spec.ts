/**
 * Copyright since 2025 Mifos Initiative
 *
 * This Source Code Form is subject to the terms of the Mozilla Public
 * License, v. 2.0. If a copy of the MPL was not distributed with this
 * file, You can obtain one at http://mozilla.org/MPL/2.0/.
 */

import { ChangeDetectorRef } from '@angular/core';
import { TestBed } from '@angular/core/testing';
import { FormBuilder } from '@angular/forms';
import { ActivatedRoute, Router } from '@angular/router';
import { MatDialog } from '@angular/material/dialog';
import { TranslateService } from '@ngx-translate/core';
import { of } from 'rxjs';

import { ThemingService } from 'app/shared/theme-toggle/theming.service';
import { TemplatesService } from '../templates.service';
import { CreateEditComponent } from './create-edit-template.component';

describe('CreateEditComponent', () => {
  const templateData = {
    entities: [
      { id: 0, name: 'client' },
      { id: 1, name: 'loan' }
    ],
    types: [
      { id: 0, name: 'Document' },
      { id: 2, name: 'SMS' }
    ],
    template: {
      id: 76,
      entity: 'client',
      type: 'SMS',
      name: 'SELF_SERVICE_LOGIN_SUCCESS_EMAIL_SUBJECT',
      text: '<p>Original</p>',
      mappers: [] as any[]
    }
  };

  let router: { navigate: jest.Mock };
  let templatesService: { createTemplate: jest.Mock; updateTemplate: jest.Mock };
  let dialog: { open: jest.Mock };
  /** What the next confirmation dialog resolves to. */
  let confirmResponse: { confirm?: boolean } | undefined;

  function createComponent(mode: 'create' | 'edit', data = templateData): CreateEditComponent {
    TestBed.resetTestingModule();
    router = { navigate: jest.fn() };
    confirmResponse = { confirm: true };
    dialog = { open: jest.fn().mockImplementation(() => ({ afterClosed: () => of(confirmResponse) })) };
    templatesService = {
      createTemplate: jest.fn().mockReturnValue(of({ resourceId: 77 })),
      updateTemplate: jest.fn().mockReturnValue(of({ resourceId: data.template?.id }))
    };

    TestBed.configureTestingModule({
      providers: [
        FormBuilder,
        { provide: ActivatedRoute, useValue: { data: of({ templateData: data, mode }) } },
        { provide: Router, useValue: router },
        { provide: TemplatesService, useValue: templatesService },
        { provide: ThemingService, useValue: { theme: of('light-theme') } },
        { provide: MatDialog, useValue: dialog },
        { provide: TranslateService, useValue: { instant: (key: string) => key } },
        // The component is constructed outside a view here, so its OnPush hook has to be stubbed.
        { provide: ChangeDetectorRef, useValue: { markForCheck: jest.fn() } }
      ]
    });

    let component: CreateEditComponent;
    TestBed.runInInjectionContext(() => {
      component = new CreateEditComponent();
    });
    component.ngOnInit();
    return component;
  }

  it('includes the template id in the update payload on edit submit', () => {
    const component = createComponent('edit');
    jest.spyOn(component, 'getEditorContent').mockReturnValue('<p>Updated</p>');

    component.submit();

    expect(templatesService.updateTemplate).toHaveBeenCalledWith(
      {
        id: templateData.template.id,
        entity: 0,
        type: 2,
        name: 'SELF_SERVICE_LOGIN_SUCCESS_EMAIL_SUBJECT',
        text: '<p>Updated</p>',
        mappers: []
      },
      templateData.template.id
    );
    expect(templatesService.createTemplate).not.toHaveBeenCalled();
  });

  it('opens a full HTML document in the source editor', () => {
    const htmlTemplate = {
      ...templateData,
      template: { ...templateData.template, text: '<!DOCTYPE html>\n<html><body>{{#rows}}x{{/rows}}</body></html>' }
    };
    const component = createComponent('edit', htmlTemplate);

    expect(component.editorMode).toBe('code');
    expect(component.textNeedsSourceEditor).toBe(true);
  });

  it('opens a rich text fragment in the rich text editor', () => {
    const component = createComponent('edit');

    expect(component.editorMode).toBe('rich');
    expect(component.textNeedsSourceEditor).toBe(false);
  });

  it('submits the source text verbatim in code mode, bypassing the rich text editor', () => {
    const text =
      '<!DOCTYPE html>\n<html><head><style>p{color:red}</style></head><body>{{#rows}}x{{/rows}}</body></html>';
    const component = createComponent('edit', {
      ...templateData,
      template: { ...templateData.template, text }
    });

    component.submit();

    expect(templatesService.updateTemplate.mock.calls[0][0].text).toBe(text);
  });

  it('asks before an entity change discards the template text', () => {
    const component = createComponent('edit');
    confirmResponse = { confirm: true };

    component.templateForm.get('entity').setValue(1);

    expect(dialog.open).toHaveBeenCalled();
    expect(component.templateForm.get('text').value).toBe('');
    expect(component.templateForm.get('entity').value).toBe(1);
  });

  it('keeps the text and the entity when the change is cancelled', () => {
    const component = createComponent('edit');
    confirmResponse = undefined;

    component.templateForm.get('entity').setValue(1);

    expect(dialog.open).toHaveBeenCalled();
    expect(component.templateForm.get('text').value).toBe(templateData.template.text);
    expect(component.templateForm.get('entity').value).toBe(0);
  });

  it('does not ask when there is no text to lose', () => {
    const component = createComponent('edit', {
      ...templateData,
      template: { ...templateData.template, text: '   ' }
    });

    component.templateForm.get('entity').setValue(1);

    expect(dialog.open).not.toHaveBeenCalled();
    expect(component.templateForm.get('entity').value).toBe(1);
  });

  it('does not ask on the initial entity default in create mode', () => {
    createComponent('create');

    expect(dialog.open).not.toHaveBeenCalled();
  });

  it('builds the form for a template stored without an entity or type', () => {
    const unassigned = {
      ...templateData,
      template: { ...templateData.template, entity: undefined as string, type: undefined as string }
    };

    const component = createComponent('edit', unassigned);

    expect(component.templateForm.get('entity').value).toBeNull();
    expect(component.templateForm.get('type').value).toBeNull();
    // Submit stays blocked until the missing entity and type are picked.
    expect(component.templateForm.valid).toBe(false);
  });

  it('does not offer to clear the text when an entity is assigned for the first time', () => {
    const component = createComponent('edit', {
      ...templateData,
      template: { ...templateData.template, entity: undefined as string, type: undefined as string }
    });

    component.templateForm.get('entity').setValue(1);

    expect(dialog.open).not.toHaveBeenCalled();
    expect(component.templateForm.get('text').value).toBe(templateData.template.text);
    expect(component.templateForm.get('entity').value).toBe(1);
  });

  it('does not add an id to the create payload', () => {
    const component = createComponent('create');
    component.templateForm.patchValue({
      entity: 1,
      type: 2,
      name: 'New Template',
      text: '<p>Draft</p>'
    });
    jest.spyOn(component, 'getEditorContent').mockReturnValue('<p>Created</p>');

    component.submit();

    const [payload] = templatesService.createTemplate.mock.calls[0];
    expect(payload).not.toHaveProperty('id');
    expect(payload).toMatchObject({
      entity: 1,
      type: 2,
      name: 'New Template',
      text: '<p>Created</p>'
    });
    expect(templatesService.updateTemplate).not.toHaveBeenCalled();
  });
});
