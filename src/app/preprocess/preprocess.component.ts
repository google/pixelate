/*
 Copyright 2022 Google LLC

 Licensed under the Apache License, Version 2.0 (the "License");
 you may not use this file except in compliance with the License.
 You may obtain a copy of the License at

      https://www.apache.org/licenses/LICENSE-2.0

 Unless required by applicable law or agreed to in writing, software
 distributed under the License is distributed on an "AS IS" BASIS,
 WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied.
 See the License for the specific language governing permissions and
 limitations under the License.
 */

import {
  AfterViewInit,
  Component,
  ElementRef,
  EventEmitter,
  Input,
  OnChanges,
  OnDestroy,
  OnInit,
  Output,
  ViewChild,
} from '@angular/core';
import { downscale, EditableImageData, getContext2D } from '../image';
import { requireNonNull } from '../state';

@Component({
  selector: 'app-preprocess',
  templateUrl: './preprocess.component.html',
  styleUrls: ['./preprocess.component.scss'],
})
export class PreprocessComponent
  implements OnInit, AfterViewInit, OnChanges, OnDestroy
{
  @ViewChild('canvas') canvas!: ElementRef<HTMLCanvasElement>;

  private ctx!: CanvasRenderingContext2D;

  readonly minTargetWidth = 8;

  targetColors = 20;

  targetWidth = this.minTargetWidth;

  @Input() imageData!: EditableImageData;

  /** Emits the final image OnDestroy to prevent two-way data binding loops. */
  @Output()
  readonly imageDataOnDestroy = new EventEmitter<EditableImageData>();

  get maxTargetWidth() {
    return Math.min(80, this.imageData?.width ?? 80);
  }

  get maxTargetColors() {
    return Math.min(20, this.imageData?.count().size ?? 20);
  }

  get targetHeight() {
    return Math.round(
      (this.imageData.height / this.imageData.width) * this.targetWidth
    );
  }

  get realWidth() {
    return this.targetWidth * 7.6;
  }

  get realHeight() {
    return this.targetHeight * 7.6;
  }

  ngOnInit(): void {
    requireNonNull(this.imageData);

    let targetWidth = this.imageData.width;

    if (targetWidth === 0) {
      throw new Error('targetWidth is 0');
    }

    while (targetWidth > this.maxTargetWidth) {
      targetWidth /= 2;
    }
    while (targetWidth < this.minTargetWidth) {
      targetWidth *= 2;
    }
    this.targetWidth = Math.round(targetWidth);
  }

  ngAfterViewInit(): void {
    this.ctx = getContext2D(this.canvas.nativeElement);
    this.ngOnChanges();
  }

  ngOnChanges(): void {
    if (!this.ctx || !this.imageData) {
      return;
    }

    const zoom = Math.trunc(
      Math.max(
        1,
        Math.min(
          (window.innerWidth / this.imageData.width) * 0.9,
          (window.innerHeight / this.imageData.height) * 0.9,
          25
        )
      )
    );
    this.canvas.nativeElement.style.width = `${this.imageData.width * zoom}px`;
    this.canvas.nativeElement.style.height = `${
      this.imageData.height * zoom
    }px`;

    const targetHeight = this.targetHeight;
    this.ctx.canvas.width = this.targetWidth;
    this.ctx.canvas.height = targetHeight;
    this.ctx.fillStyle = '#ffffff';
    this.ctx.fillRect(0, 0, this.targetWidth, targetHeight);

    // TODO: To reduce GC and improve performance, reuse one ImageData and change
    // the its size.
    const scaledImageData = new EditableImageData(
      this.ctx.getImageData(0, 0, this.targetWidth, targetHeight)
    );
    downscale(this.imageData, scaledImageData, this.targetColors);
    this.ctx.putImageData(scaledImageData.imageData, 0, 0);
  }

  ngOnDestroy(): void {
    this.imageDataOnDestroy.next(
      new EditableImageData(
        this.ctx.getImageData(0, 0, this.targetWidth, this.targetHeight)
      )
    );
  }
}
