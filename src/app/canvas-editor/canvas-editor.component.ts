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
  Output,
  ViewChild,
} from '@angular/core';
import { EditableContext2D, HexColor } from './context';

const MAX_SCALE = 25;

export enum Tool {
  DRAW,
  FILL,
  PICK,
}

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

  @Output() readonly colorCounts = new EventEmitter<Map<HexColor, number>>();

  @Output() readonly pixels = new EventEmitter<HexColor[][]>();

  hasImage = false;

  ngAfterViewInit(): void {
    const ctx = this.canvas.nativeElement.getContext('2d');

    if (!ctx) {
      throw new Error('CanvasRenderingContext2D is null');
    }

    ctx.imageSmoothingEnabled = false;

    this.ctx = new EditableContext2D(ctx);
  }

  async loadImageFile(imageFile: File) {
    if (!this.ctx) {
      return;
    }

    const img = await loadImageFile(imageFile);
    this.ctx.resetToImage(img);
    this.zoomToFit();
    this.activeColor = this.ctx.pick(0, 0);
    this.colorCounts.next(this.ctx.count());
    this.pixels.next(this.ctx.pixels());
    this.hasImage = true;
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
          window.innerWidth / this.ctx.width,
          window.innerHeight / this.ctx.height,
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

  onMouseDown(event: MouseEvent) {
    if (!(event.buttons & 1)) {
      return;
    }

    const x = Math.trunc(event.offsetX / this.zoom);
    const y = Math.trunc(event.offsetY / this.zoom);

    if (this.activeTool === Tool.DRAW) {
      this.ctx?.draw(x, y, this.activeColor);
    } else if (this.activeTool === Tool.FILL) {
      this.ctx?.fill(x, y, this.activeColor);
    } else if (this.activeTool === Tool.PICK) {
      this.activeColor = this.ctx.pick(x, y);
    } else {
      return;
    }

    this.colorCounts.next(this.ctx.count());
    this.pixels.next(this.ctx.pixels());
    event.preventDefault();
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
