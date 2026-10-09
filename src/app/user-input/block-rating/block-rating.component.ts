
import { Component, input, OnInit, ChangeDetectionStrategy, inject } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { MatHint } from '@angular/material/form-field';
import { MatRadioModule } from '@angular/material/radio';
import { DataStorageService } from 'src/app/data-storage.service';
import { BlockSelectorComponent } from '../block-selector/block-selector.component';

@Component({
    selector: 'app-block-rating',
    imports: [
    MatRadioModule,
    BlockSelectorComponent,
    FormsModule,
    MatHint
],
    templateUrl: './block-rating.component.html',
    styleUrl: './block-rating.component.scss',
    changeDetection: ChangeDetectionStrategy.OnPush
})
export class BlockRatingComponent implements OnInit {
  public options = input<any[]>([]);
  public topicKey = input<string>('');
  public subtopicKey = input<string>('');

  public selectedOption: {
    text: string;
    rating: string;
    options?: any;
    description?: string;
  } = { text: '', rating: '' };

  public dataStorageService = inject(DataStorageService);

  ngOnInit(): void {
    const selectedBlock = this.dataStorageService.getSelectedBlock(
      this.topicKey(),
      this.subtopicKey()
    );
    if (selectedBlock) {
      this.selectedOption.rating = selectedBlock.rating;
      this.selectedOption.text = selectedBlock.text;
    }
    this.selectedOption.options =
      this.options().find((option) => option.title === this.selectedOption.rating)
        ?.options || [];
  }

  radioChange(event: any): void {
    const selectedOption = this.options().find(
      (option) => option.title === event.value
    );
    if (selectedOption) {
      this.selectedOption.rating = selectedOption.title;
      this.selectedOption.options = selectedOption.options;
      const selectedBlock = this.dataStorageService.getSelectedBlock(
        this.topicKey(),
        this.subtopicKey()
      );
      this.selectedOption.text = selectedBlock?.text || '';
      this.dataStorageService.setSelectedBlock(
        this.topicKey(),
        this.subtopicKey(),
        this.selectedOption.text,
        this.selectedOption.rating
      );
    }
  }
}
