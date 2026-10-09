import { Component, ChangeDetectionStrategy, inject } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { MatFormFieldModule } from '@angular/material/form-field';
import { MatInputModule } from '@angular/material/input';
import { MatSelectModule } from '@angular/material/select';
import { DataStorageService } from 'src/app/data-storage.service';
import { CdkTextareaAutosize } from '@angular/cdk/text-field';

@Component({
    selector: 'app-position',
    imports: [FormsModule, MatFormFieldModule, MatInputModule, MatSelectModule, CdkTextareaAutosize],
    templateUrl: './position.component.html',
    styleUrl: './position.component.scss',
    changeDetection: ChangeDetectionStrategy.OnPush
})
export class PositionComponent {

  public dataStorageService = inject(DataStorageService);


}
