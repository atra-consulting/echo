import { Component, ChangeDetectionStrategy, inject, input, output } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { MatButtonModule } from '@angular/material/button';
import { MatIconModule } from '@angular/material/icon';
import { MatTooltipModule } from '@angular/material/tooltip';
import { DataStorageService } from '../data-storage.service';

@Component({
    selector: 'app-reference-output',
    imports: [FormsModule, MatButtonModule, MatIconModule, MatTooltipModule],
    templateUrl: './reference-output.component.html',
    styleUrl: './reference-output.component.scss',
    changeDetection: ChangeDetectionStrategy.OnPush,
})
export class ReferenceOutputComponent {
    public flowTextHtml = input<string>('');
    public placeholderClick = output<string>();
    public dataStorageService = inject(DataStorageService);
    public isEditing = false;

    public toggleEdit(): void {
        this.isEditing = !this.isEditing;
    }

    public async copyToClipboard(): Promise<void> {
        await navigator.clipboard.writeText(this.dataStorageService.flowText);
    }

    public onPaperClick(event: Event): void {
        const target = event.target as HTMLElement;
        if (target.classList.contains('placeholder')) {
            const fieldClass = Array.from(target.classList)
                .find(c => c.startsWith('placeholder--'));
            const field = fieldClass?.substring('placeholder--'.length);
            if (field) {
                this.placeholderClick.emit(field);
            }
        }
    }
}
