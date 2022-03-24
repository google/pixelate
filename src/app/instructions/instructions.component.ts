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
import { EditableImageData } from '../image';
import { HexColor, hexToRgb, InstructionsState, isLightColor } from '../state';

/** Instructions on how to assemble the pixel art mural. */
@Component({
  selector: 'app-instructions',
  templateUrl: './instructions.component.html',
  styleUrls: ['./instructions.component.scss'],
})
export class InstructionsComponent {
  #pixels: ReadonlyArray<ReadonlyArray<HexColor>> = [];

  @Input()
  set imageData(imageData: EditableImageData) {
    this.#pixels = imageData.pixels();
    this.indices.clear();
    const counts = new Map<HexColor, number>();

    for (const row of this.#pixels) {
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

    this.textClasses = new Map(
      Array.from(counts.keys()).map((color) => [
        color,
        isLightColor(hexToRgb(color)) ? 'dark-text' : 'light-text',
      ])
    );
  }

  get pixels() {
    return this.#pixels;
  }

  textClasses = new Map<HexColor, string>();

  indices = new Map<HexColor, string>();

  colors: { color: HexColor; index: string; count: number }[] = [];

  @Input() state!: InstructionsState;

  @Output() stateChange = new EventEmitter<InstructionsState>();

  get totalWidth() {
    return (this.pixels[0]?.length ?? 0) * 7.6;
  }

  get totalHeight() {
    return this.pixels.length * 7.6;
  }

  get totalCount() {
    return Array.from(this.colors.values()).reduce(
      (sum, entry) =>
        sum + (this.state.crossedOutColors.has(entry.color) ? 0 : entry.count),
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

  toggleCrossedColor(color: HexColor) {
    toggle(color, this.state.crossedOutColors);
    this.stateChange.next(this.state);
  }

  toggleCrossedRow(row: number) {
    toggle(row, this.state.crossedOutRows);
    this.stateChange.next(this.state);
  }

  toggleCrossedColumn(column: number) {
    toggle(column, this.state.crossedOutColumns);
    this.stateChange.next(this.state);
  }
}

function toggle<T>(value: T, set: Set<T>) {
  if (set.has(value)) {
    set.delete(value);
  } else {
    set.add(value);
  }
}
