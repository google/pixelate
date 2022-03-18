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

import { KeyValue } from '@angular/common';
import {
  AfterViewInit,
  Component,
  ElementRef,
  Input,
  Output,
  TrackByFunction,
  ViewChild,
} from '@angular/core';
import { ReplaySubject } from 'rxjs';
import { HexColor, hexToRgb, isLightColor, Tool } from '../state';
import { EditableContext2D } from './context';

const MAX_SCALE = 25;

/** Canvas with image editing functions. */
@Component({
  selector: 'app-canvas-editor',
  templateUrl: './canvas-editor.component.html',
  styleUrls: ['./canvas-editor.component.scss'],
})
export class CanvasEditorComponent implements AfterViewInit {
  readonly Tool = Tool;

  @ViewChild('canvas') canvas!: ElementRef<HTMLCanvasElement>;

  private ctx!: EditableContext2D;

  @Input() activeTool: Tool = Tool.DRAW;

  @Input() activeColor: HexColor = '#000000';

  get activeColorLight() {
    return isLightColor(hexToRgb(this.activeColor));
  }

  @Output() readonly colorCounts = new ReplaySubject<
    ReadonlyMap<HexColor, number>
  >(1);

  @Output() readonly pixels = new ReplaySubject<
    ReadonlyArray<ReadonlyArray<HexColor>>
  >(1);

  hasImage = false;

  ngAfterViewInit(): void {
    const ctx = this.canvas.nativeElement.getContext('2d');

    if (!ctx) {
      throw new Error('CanvasRenderingContext2D is null');
    }

    ctx.imageSmoothingEnabled = false;

    this.ctx = new EditableContext2D(ctx);
  }

  clear() {
    this.hasImage = false;
  }

  loadImage(img: HTMLImageElement) {
    if (!this.ctx) {
      return;
    }

    this.ctx.resetToImage(img);
    this.zoomToFit();
    this.activeColor = this.ctx.pick(0, 0);
    this.colorCounts.next(this.ctx.count());
    this.pixels.next(this.ctx.pixels());
    this.hasImage = true;
  }

  async loadImageFile(imageFile: File) {
    const img = await loadImageFile(imageFile);
    this.loadImage(img);
  }

  set zoom(zoom: number) {
    this.canvas.nativeElement.style.width = `${this.ctx.width * zoom}px`;
    this.canvas.nativeElement.style.height = `${this.ctx.height * zoom}px`;
  }

  get zoom() {
    return this.canvas.nativeElement.offsetWidth / this.ctx.width;
  }

  zoomToFit() {
    this.zoom = Math.trunc(
      Math.max(
        1,
        Math.min(
          (window.innerWidth / this.ctx.width) * 0.9,
          (window.innerHeight / this.ctx.height) * 0.9,
          MAX_SCALE
        )
      )
    );
  }

  zoomIn() {
    this.zoom = Math.min(MAX_SCALE, this.zoom + 1);
  }

  zoomOut() {
    this.zoom = Math.max(1, this.zoom - 1);
  }

  readonly bufferedCoords: [Tool, HexColor, number, number][] = [];
  animationFrameId = 0;

  onMouseDown(event: MouseEvent) {
    if (!(event.buttons & 1)) {
      return;
    }

    event.preventDefault();

    // Math.min() prevents edge case of editing pixel that is slightly outside of canvas.
    const x = Math.min(
      this.ctx.width - 1,
      Math.trunc(event.offsetX / this.zoom)
    );
    const y = Math.min(
      this.ctx.height - 1,
      Math.trunc(event.offsetY / this.zoom)
    );
    const previous = this.bufferedCoords[this.bufferedCoords.length - 1];

    if (
      previous &&
      previous[0] === this.activeTool &&
      previous[1] === this.activeColor &&
      previous[2] === x &&
      previous[3] === y
    ) {
      return;
    }

    this.bufferedCoords.push([this.activeTool, this.activeColor, x, y]);

    if (this.bufferedCoords.length > 1) {
      return;
    }

    this.animationFrameId = requestAnimationFrame(() => {
      this.ctx.applyMany(this.bufferedCoords);
      this.animationFrameId = 0;
      this.bufferedCoords.length = 0;
      this.colorCounts.next(this.ctx.count());
      this.pixels.next(this.ctx.pixels());
    });
  }

  onMouseMove(event: MouseEvent) {
    this.onMouseDown(event);
  }

  getBlob(): Promise<Blob> {
    return new Promise((resolve, reject) => {
      this.canvas.nativeElement.toBlob((blob) => {
        if (blob) {
          resolve(blob);
        } else {
          reject(new Error('Empty blob'));
        }
      }, 'image/png');
    });
  }

  async getFile(): Promise<File> {
    const blob = await this.getBlob();
    return new File([blob], 'pixelate.png');
  }

  getDataURL() {
    return this.canvas.nativeElement.toDataURL('image/png');
  }

  readonly trackByKey: TrackByFunction<KeyValue<HexColor, number>> = (
    index,
    { key }
  ) => key;
}

async function loadImageFile(imageFile: File): Promise<HTMLImageElement> {
  return new Promise((resolve, reject) => {
    const img = new Image();
    img.onerror = (e) => {
      reject(e);
    };
    img.onload = () => {
      resolve(img);
    };
    img.src = URL.createObjectURL(imageFile);
  });
}
