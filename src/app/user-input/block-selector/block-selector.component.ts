
import { Component, input, OnInit, ChangeDetectionStrategy, inject } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { MatFormFieldModule } from '@angular/material/form-field';
import { MatSelectModule } from '@angular/material/select';
import { DataStorageService } from 'src/app/data-storage.service';

@Component({
    selector: 'app-block-selector',
    imports: [
    FormsModule,
    MatFormFieldModule,
    MatSelectModule
],
    templateUrl: './block-selector.component.html',
    styleUrl: './block-selector.component.scss',
    changeDetection: ChangeDetectionStrategy.OnPush
})
export class BlockSelectorComponent implements OnInit {
  public options = input<string[]>([]);
  public topicKey = input<string>('');
  public subtopicKey = input<string>('');
  public disabled = input<boolean>(false);
  public selectedOption = input<{
    text: string;
    rating: string;
    options?: any;
    description?: string;
  }>({ text: '', rating: '' });

  public selectedTextBlock: string = '';
  public showDisabledHint: boolean = false;

  public dataStorageService = inject(DataStorageService);

  public ngOnInit(): void {
    if (this.selectedOption().text !== '') {
      this.selectedTextBlock = this.selectedOption().text;
    } else {
      const selectedBlock = this.dataStorageService.getSelectedBlock(
        this.topicKey(),
        this.subtopicKey()
      );
      if (selectedBlock) {
        this.selectedTextBlock = selectedBlock.text;
      }
    }
  }

  public onSelect(selectedTextBlock: string): void {
    this.dataStorageService.setSelectedBlock(
      this.topicKey(),
      this.subtopicKey(),
      selectedTextBlock,
      this.selectedOption().rating
    );
  }
}
