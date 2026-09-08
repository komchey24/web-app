/**
 * Copyright since 2025 Mifos Initiative
 *
 * This Source Code Form is subject to the terms of the Mozilla Public
 * License, v. 2.0. If a copy of the MPL was not distributed with this
 * file, You can obtain one at http://mozilla.org/MPL/2.0/.
 */

/** Angular Imports */
import { ChangeDetectionStrategy, Component, inject, DestroyRef } from '@angular/core';
import { takeUntilDestroyed } from '@angular/core/rxjs-interop';
import { ActivatedRoute, Router, RouterLink } from '@angular/router';
import { MatDialog } from '@angular/material/dialog';
import { MatButtonToggleGroup, MatButtonToggle } from '@angular/material/button-toggle';
import { DomSanitizer, SafeHtml } from '@angular/platform-browser';

/** Custom Services */
import { TemplatesService } from '../templates.service';

/** Custom Components */
import { DeleteDialogComponent } from 'app/shared/delete-dialog/delete-dialog.component';
import { FaIconComponent } from '@fortawesome/angular-fontawesome';
import { STANDALONE_SHARED_IMPORTS } from 'app/standalone-shared.module';

/** Custom Imports */
import { isAdvancedTemplateText, wrapTemplateTextForPreview } from '../template-text.utils';

/**
 * View Template Component.
 */
@Component({
  selector: 'mifosx-view-template',
  templateUrl: './view-template.component.html',
  styleUrls: ['./view-template.component.scss'],
  imports: [
    ...STANDALONE_SHARED_IMPORTS,
    FaIconComponent,
    MatButtonToggleGroup,
    MatButtonToggle
  ],
  changeDetection: ChangeDetectionStrategy.OnPush
})
export class ViewTemplateComponent {
  private route = inject(ActivatedRoute);
  private templatesService = inject(TemplatesService);
  private router = inject(Router);
  private dialog = inject(MatDialog);
  private destroyRef = inject(DestroyRef);
  private sanitizer = inject(DomSanitizer);

  /** Template Data */
  templateData: any;
  /** How the template text is displayed: rendered in an isolated frame, or as source. */
  textView: 'preview' | 'source' = 'preview';
  /** Template text rendered into a self contained document for the preview frame. */
  previewDocument: SafeHtml = '';
  /** True when the text is a full HTML document or carries styles, scripts or Mustache sections. */
  isAdvancedTemplate = false;

  /**
   * Retrieves the template data from `resolve`.
   * @param {TemplateService} templateService Accounting Service.
   * @param {ActivatedRoute} route Activated Route.
   * @param {Router} router Router for navigation.
   * @param {MatDialog} dialog Dialog reference.
   */
  constructor() {
    this.route.data.pipe(takeUntilDestroyed(this.destroyRef)).subscribe((data: { template: any }) => {
      this.templateData = data.template;
      const text: string = this.templateData?.text || '';
      this.isAdvancedTemplate = isAdvancedTemplateText(text);
      // The frame is fully sandboxed, so the document it is handed can never touch the app.
      this.previewDocument = this.sanitizer.bypassSecurityTrustHtml(wrapTemplateTextForPreview(text));
    });
  }

  /**
   * Deletes the template and redirects to templates.
   */
  delete() {
    const deleteTemplateDialogRef = this.dialog.open(DeleteDialogComponent, {
      data: { deleteContext: `template ${this.templateData.id}` }
    });
    deleteTemplateDialogRef.afterClosed().subscribe((response: any) => {
      if (response?.delete) {
        this.templatesService.deleteTemplate(this.templateData.id).subscribe(() => {
          this.router.navigate(['/templates']);
        });
      }
    });
  }
}
