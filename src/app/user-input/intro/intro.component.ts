import { Component, OnInit, ChangeDetectionStrategy, inject } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { MatDatepickerInputEvent, MatDatepickerModule } from '@angular/material/datepicker';
import { MatFormFieldModule } from '@angular/material/form-field';
import { MatInputModule } from '@angular/material/input';
import { MatSelectModule } from '@angular/material/select';
import { DataStorageService } from 'src/app/data-storage.service';

@Component({
    selector: 'app-intro',
    imports: [
        FormsModule,
        MatDatepickerModule,
        MatFormFieldModule,
        MatInputModule,
        MatSelectModule,
    ],
    templateUrl: './intro.component.html',
    styleUrl: './intro.component.scss',
    changeDetection: ChangeDetectionStrategy.OnPush
})
export class IntroComponent implements OnInit {

  public dataStorageService = inject(DataStorageService);

  ngOnInit(): void {
    this.dataStorageService.birthdate = this.convertStringToDate(this.dataStorageService.formData.birthdate);
    this.dataStorageService.hiredate = this.convertStringToDate(this.dataStorageService.formData.hiredate);
    this.dataStorageService.enddate = this.convertStringToDate(this.dataStorageService.formData.enddate);
  }

  private convertStringToDate(dateString: string): Date | null {
    if (!dateString) {
      return null;
    }
    const [day, month, year] = dateString.split('.').map(part => parseInt(part, 10));
    return new Date(year, month - 1, day);
  }

  public saveData(key: string, value: string): void {
    this.dataStorageService.setFormData(key, value);
    if (key === 'salutation') {
      this.dataStorageService.getData('').subscribe((response) => {
        this.dataStorageService.inputData = response;
      });
    }
  }

  public onDateChange(key: string, event: MatDatepickerInputEvent<Date>): void {
    const date = event.value;
    if (date) {
      this.saveData(key, new Date(date).toLocaleDateString());
    }
  }

}
