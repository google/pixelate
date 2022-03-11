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

import { Component, EventEmitter, Input, Output } from '@angular/core';
import { HexColor } from '../state';

/** Instructions on how to assemble the pixel art mural. */
@Component({
  selector: 'app-instructions',
  templateUrl: './instructions.component.html',
  styleUrls: ['./instructions.component.scss'],
})
export class InstructionsComponent {
  #pixels: ReadonlyArray<ReadonlyArray<HexColor>> = [];

  @Input()
  set pixels(pixels: ReadonlyArray<ReadonlyArray<HexColor>>) {
    this.#pixels = pixels;
    this.indices = new Map();
    const counts = new Map<HexColor, number>();

    for (const row of pixels) {
      for (const color of row) {
        let index = this.indices.get(color);
        if (index === undefined) {
          index = String.fromCharCode('a'.charCodeAt(0) + this.indices.size);
          this.indices.set(color, index);
        }

        const count = counts.get(color) ?? 0;
        counts.set(color, count + 1);
      }
    }

    this.colors = Array.from(counts.entries()).map(([color, count]) => ({
      color,
      index: this.indices.get(color) ?? '',
      count,
    }));
  }

  get pixels() {
    return this.#pixels;
  }

  @Output()
  readonly toggleBackgroundColor = new EventEmitter<HexColor>();

  @Output()
  readonly toggleRow = new EventEmitter<number>();

  @Output()
  readonly toggleColumn = new EventEmitter<number>();

  indices = new Map<HexColor, string>();

  colors: { color: HexColor; index: string; count: number }[] = [];

  @Input()
  crossedOutColors = new Set<HexColor>();

  @Input()
  crossedOutRows = new Set<number>();

  @Input()
  crossedOutColumns = new Set<number>();

  get totalWidth() {
    return (this.pixels[0]?.length ?? 0) * 7.6;
  }

  get totalHeight() {
    return this.pixels.length * 7.6;
  }

  get totalCount() {
    return Array.from(this.colors.values()).reduce(
      (sum, entry) =>
        sum + (this.crossedOutColors.has(entry.color) ? 0 : entry.count),
      0
    );
  }

  get lowerTime() {
    return Math.trunc(this.totalCount / 4);
  }

  get upperTime() {
    return Math.trunc(this.totalCount / 2);
  }

  getIndex(color: HexColor) {
    let index = this.indices.get(color);
    if (index === undefined) {
      index = String.fromCharCode('a'.charCodeAt(0) + this.indices.size);
      this.indices.set(color, index);
    }
    return index;
  }

  get width() {
    return this.pixels[0]?.length ?? 0;
  }

  get height() {
    return this.pixels.length;
  }

  isHalf(index: number, total: number) {
    return Math.trunc(total / 2) === index;
  }
}
