import {
  AfterViewInit,
  Component,
  ElementRef,
  EventEmitter,
  Input,
  OnDestroy,
  OnInit,
  Output,
  ViewChild,
} from '@angular/core';
import { EditableImageData, getContext2D } from '../image';
import { requireNonNull, requireTruthy } from '../state';

@Component({
  selector: 'app-preprocess',
  templateUrl: './preprocess.component.html',
  styleUrls: ['./preprocess.component.scss'],
})
export class PreprocessComponent implements OnInit, AfterViewInit, OnDestroy {
  @ViewChild('canvas') canvas!: ElementRef<HTMLCanvasElement>;

  private ctx!: CanvasRenderingContext2D;

  maxTargetWidth = 80;

  readonly minTargetWidth = 8;

  #targetWidth = this.minTargetWidth;

  #img!: HTMLImageElement;

  @Input() set img(img: HTMLImageElement) {
    this.#img = img;
    this.update();
  }

  /** Emits the final image OnDestroy to prevent two-way data binding loops. */
  @Output()
  readonly imageDataOnDestroy = new EventEmitter<EditableImageData>();

  set targetWidth(targetWidth: number) {
    this.#targetWidth = targetWidth;
    this.update();
  }

  get targetWidth() {
    return this.#targetWidth;
  }

  get targetHeight() {
    return Math.round(
      (this.#img.naturalHeight / this.#img.naturalWidth) * this.targetWidth
    );
  }

  get realWidth() {
    return this.targetWidth * 7.6;
  }

  get realHeight() {
    return this.targetHeight * 7.6;
  }

  ngOnInit(): void {
    requireNonNull(this.#img);
    requireTruthy(this.#img.complete);

    let targetWidth = this.#img.naturalWidth;
    this.maxTargetWidth = Math.min(80, this.#img.naturalWidth);

    if (targetWidth === 0) {
      throw new Error('targetWidth is 0');
    }

    while (targetWidth > this.maxTargetWidth) {
      targetWidth /= 2;
    }
    while (targetWidth < this.minTargetWidth) {
      targetWidth *= 2;
    }
    this.#targetWidth = Math.round(targetWidth);
  }

  ngAfterViewInit(): void {
    this.ctx = getContext2D(this.canvas.nativeElement);
    this.update();
  }

  update() {
    if (!this.ctx) {
      return;
    }

    const zoom = Math.trunc(
      Math.max(
        1,
        Math.min(
          (window.innerWidth / this.#img.naturalWidth) * 0.9,
          (window.innerHeight / this.#img.naturalHeight) * 0.9,
          25
        )
      )
    );
    this.canvas.nativeElement.style.width = `${
      this.#img.naturalWidth * zoom
    }px`;
    this.canvas.nativeElement.style.height = `${
      this.#img.naturalHeight * zoom
    }px`;

    const targetHeight = this.targetHeight;
    this.ctx.canvas.width = this.targetWidth;
    this.ctx.canvas.height = targetHeight;
    this.ctx.fillStyle = '#ffffff';
    this.ctx.fillRect(0, 0, this.targetWidth, targetHeight);
    this.ctx.drawImage(this.#img, 0, 0, this.targetWidth, targetHeight);
  }

  ngOnDestroy(): void {
    this.imageDataOnDestroy.next(
      new EditableImageData(
        this.ctx.getImageData(0, 0, this.targetWidth, this.targetHeight)
      )
    );
  }
}
