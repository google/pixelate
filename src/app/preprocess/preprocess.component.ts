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

enum Edge {
  TOP = 'top',
  RIGHT = 'right',
  BOTTOM = 'bottom',
  LEFT = 'left',
}

@Component({
  selector: 'app-preprocess',
  templateUrl: './preprocess.component.html',
  styleUrls: ['./preprocess.component.scss'],
})
export class PreprocessComponent
  implements OnInit, AfterViewInit, OnChanges, OnDestroy
{
  readonly Edge = Edge;

  @ViewChild('canvas') canvas!: ElementRef<HTMLCanvasElement>;

  private ctx!: CanvasRenderingContext2D;

  readonly minTargetScale = 8;

  targetColors = 20;

  targetScale = this.minTargetScale;

  @Input() imageData!: EditableImageData;

  /** Emits the final image OnDestroy to prevent two-way data binding loops. */
  @Output()
  readonly imageDataOnDestroy = new EventEmitter<EditableImageData>();

  get maxTargetScale() {
    return Math.min(80, this.imageData?.width ?? 80);
  }

  get maxTargetColors() {
    return Math.min(20, this.imageData?.count().size ?? 20);
  }

  get scaledHeight() {
    return Math.round(
      (this.imageData.height / this.imageData.width) * this.scaledWidth
    );
  }

  get scaledWidth() {
    return this.targetScale;
  }

  get croppedWidth() {
    return this.scaledWidth - this.crops.left - this.crops.right;
  }

  get croppedHeight() {
    return this.scaledHeight - this.crops.top - this.crops.bottom;
  }

  get realWidth() {
    return this.croppedWidth * 7.6;
  }

  get realHeight() {
    return this.croppedHeight * 7.6;
  }

  crops = {
    [Edge.LEFT]: 0,
    [Edge.RIGHT]: 0,
    [Edge.TOP]: 0,
    [Edge.BOTTOM]: 0,
  };

  ngOnInit(): void {
    requireNonNull(this.imageData);

    let targetScale = this.imageData.width;

    if (targetScale === 0) {
      throw new Error('targetScale is 0');
    }

    while (targetScale > this.maxTargetScale) {
      targetScale /= 2;
    }
    while (targetScale < this.minTargetScale) {
      targetScale *= 2;
    }
    this.targetScale = Math.round(targetScale);
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
          (window.innerWidth - 200) / this.croppedWidth,
          (window.innerHeight - 200) / this.croppedHeight,
          25
        )
      )
    );
    this.canvas.nativeElement.style.width = `${this.croppedWidth * zoom}px`;
    this.canvas.nativeElement.style.height = `${this.croppedHeight * zoom}px`;

    this.ctx.canvas.width = this.croppedWidth;
    this.ctx.canvas.height = this.croppedHeight;
    this.ctx.fillStyle = '#ffffff';
    this.ctx.fillRect(0, 0, this.croppedWidth, this.croppedHeight);

    // TODO: To reduce GC and improve performance, reuse one ImageData and change
    // the its size.
    const scaledImageData = new EditableImageData(
      new ImageData(this.scaledWidth, this.scaledHeight)
    );

    downscale(this.imageData, scaledImageData, this.targetColors);

    this.ctx.putImageData(
      scaledImageData.imageData,
      -this.crops[Edge.LEFT],
      -this.crops[Edge.TOP],
      0,
      0,
      this.scaledWidth,
      this.scaledHeight
    );
  }

  expand(edge: Edge) {
    if (this.canExpand(edge)) {
      this.crops[edge]--;
      this.ngOnChanges();
    }
  }

  shrink(edge: Edge) {
    if (this.canShrink(edge)) {
      this.crops[edge]++;
      this.ngOnChanges();
    }
  }

  canExpand(edge: Edge) {
    return this.crops[edge] > 0;
  }

  canShrink(edge: Edge) {
    if (edge === Edge.TOP || edge === Edge.BOTTOM) {
      return (
        this.crops[Edge.TOP] + this.crops[Edge.BOTTOM] < this.scaledHeight - 1
      );
    } else {
      return (
        this.crops[Edge.LEFT] + this.crops[Edge.RIGHT] < this.scaledWidth - 1
      );
    }
  }

  resizeTo(scaledWidth: number) {
    this.targetScale = scaledWidth;
    this.crops = {
      [Edge.LEFT]: 0,
      [Edge.RIGHT]: 0,
      [Edge.TOP]: 0,
      [Edge.BOTTOM]: 0,
    };
    this.ngOnChanges();
  }

  ngOnDestroy(): void {
    this.imageDataOnDestroy.next(
      new EditableImageData(
        this.ctx.getImageData(0, 0, this.croppedWidth, this.croppedHeight)
      )
    );
  }
}
