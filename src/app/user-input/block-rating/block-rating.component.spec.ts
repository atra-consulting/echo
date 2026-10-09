import { ComponentFixture, TestBed } from '@angular/core/testing';

import { BlockRatingComponent } from './block-rating.component';

describe('BlockRatingComponent', () => {
  let component: BlockRatingComponent;
  let fixture: ComponentFixture<BlockRatingComponent>;

  beforeEach(async () => {
    await TestBed.configureTestingModule({
      imports: [BlockRatingComponent]
    })
    .compileComponents();

    fixture = TestBed.createComponent(BlockRatingComponent);
    component = fixture.componentInstance;
    fixture.detectChanges();
  });

  it('should create', () => {
    expect(component).toBeTruthy();
  });
});
