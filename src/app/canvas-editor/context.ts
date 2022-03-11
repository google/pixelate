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

import { HexColor, hexToRgb, rgbToHex, Tool } from '../state';

interface DirtyArea {
  left: number;
  top: number;
  right: number;
  bottom: number;
}

function mergeDirtyAreas(
  a: DirtyArea | null,
  b: DirtyArea | null
): DirtyArea | null {
  if (!a) {
    return b;
  } else if (!b) {
    return a;
  } else {
    return {
      left: Math.min(a.left, b.left),
      right: Math.max(a.right, b.right),
      top: Math.min(a.top, b.top),
      bottom: Math.max(a.bottom, b.bottom),
    };
  }
}

/** Wrapper for CanvasRenderingContext2D with convenience editing functions.  */
export class EditableContext2D {
  constructor(readonly ctx: CanvasRenderingContext2D) {
    this.imageData = new EditableImageData(
      ctx.getImageData(0, 0, this.width, this.height)
    );
  }

  private imageData: EditableImageData;

  get width() {
    return this.ctx.canvas.width;
  }

  get height() {
    return this.ctx.canvas.height;
  }

  resetToImage(img: HTMLImageElement) {
    const { naturalHeight, naturalWidth } = img;
    this.ctx.canvas.width = naturalWidth;
    this.ctx.canvas.height = naturalHeight;
    this.ctx.fillStyle = '#ffffff';
    this.ctx.fillRect(0, 0, naturalWidth, naturalHeight);
    this.ctx.drawImage(img, 0, 0);
    this.imageData = new EditableImageData(
      this.ctx.getImageData(0, 0, naturalWidth, naturalHeight)
    );
  }

  count() {
    return this.imageData.count();
  }

  pixels() {
    return this.imageData.pixels();
  }

  applyMany(operations: [Tool, HexColor, number, number][]) {
    const dirty = operations.reduce(
      (dirtyArea, [tool, color, x, y]) =>
        mergeDirtyAreas(
          dirtyArea,
          this.apply(this.imageData, tool, color, x, y)
        ),
      null as DirtyArea | null
    );

    if (dirty) {
      this.ctx.putImageData(
        this.imageData.imageData,
        0,
        0,
        dirty.left,
        dirty.top,
        dirty.right - dirty.left + 1,
        dirty.bottom - dirty.top + 1
      );
    }
  }

  private apply(
    imageData: EditableImageData,
    tool: Tool,
    color: HexColor,
    x: number,
    y: number
  ): DirtyArea | null {
    if (tool === Tool.DRAW) {
      return imageData.draw(x, y, color);
    } else if (tool === Tool.FILL) {
      return imageData.fill(x, y, color);
    } else if (tool == Tool.MAGIC_WAND) {
      return imageData.fill_all(x, y, color);
    } else {
      throw new Error(`Unknown tool ${tool}`);
    }
  }

  pick(x: number, y: number): HexColor {
    return this.imageData.pick(x, y);
  }
}

/** Wrapper for ImageData with convenience editing functions. */
class EditableImageData {
  #pixels: HexColor[][];
  #counter: Map<HexColor, number>;

  constructor(readonly imageData: ImageData) {
    this.#pixels = [];
    this.#counter = new Map();

    for (let y = 0; y < this.imageData.height; y++) {
      const row: HexColor[] = [];
      for (let x = 0; x < this.imageData.width; x++) {
        const color = this.pick(x, y);
        row.push(color);
        const count = this.#counter.get(color) ?? 0;
        this.#counter.set(color, count + 1);
      }
      this.#pixels.push(row);
    }
  }

  private toIndex(x: number, y: number) {
    return (y * this.imageData.width + x) * 4;
  }

  pick(x: number, y: number): HexColor {
    const i = this.toIndex(x, y);
    return rgbToHex(
      this.imageData.data[i + 0],
      this.imageData.data[i + 1],
      this.imageData.data[i + 2]
    );
  }

  draw(x: number, y: number, fillColor: HexColor): DirtyArea | null {
    const previous = this.#pixels[y][x];

    if (previous === fillColor) {
      return null;
    }

    const rgb = hexToRgb(fillColor);
    const i = this.toIndex(x, y);

    this.imageData.data[i + 0] = rgb[0];
    this.imageData.data[i + 1] = rgb[1];
    this.imageData.data[i + 2] = rgb[2];
    this.#pixels[y][x] = fillColor;

    const previousCount = (this.#counter.get(previous) ?? 0) - 1;
    if (previousCount <= 0) {
      this.#counter.delete(previous);
    } else {
      this.#counter.set(previous, previousCount);
    }

    return { left: x, top: y, right: x, bottom: y };
  }

  fill(x: number, y: number, fillColor: HexColor): DirtyArea | null {
    let cur: [number, number] | undefined;
    const queue: [number, number][] = [[x, y]];
    const startColor = this.pick(x, y);
    const dirtyArea: DirtyArea = { left: x, top: y, right: x, bottom: y };

    if (this.pick(x, y) === fillColor) {
      return null;
    }

    while ((cur = queue.pop())) {
      const [cx, cy] = cur;
      const currentColor = this.pick(cx, cy);

      if (currentColor !== startColor || currentColor === fillColor) {
        continue;
      }

      this.draw(cx, cy, fillColor);
      dirtyArea.left = Math.min(dirtyArea.left, cx);
      dirtyArea.right = Math.max(dirtyArea.right, cx);
      dirtyArea.top = Math.min(dirtyArea.top, cy);
      dirtyArea.bottom = Math.max(dirtyArea.bottom, cy);

      if (cx > 0) {
        queue.push([cx - 1, cy]);
      }
      if (cx < this.imageData.width - 1) {
        queue.push([cx + 1, cy]);
      }
      if (cy > 0) {
        queue.push([cx, cy - 1]);
      }
      if (cy < this.imageData.height - 1) {
        queue.push([cx, cy + 1]);
      }
    }

    return dirtyArea;
  }

  fill_all(x: number, y: number, fillColor: HexColor): DirtyArea | null {
    const startColor = this.pick(x, y);
    const dirtyArea: DirtyArea = { left: x, top: y, right: x, bottom: y };
    for (let x = 0; x < this.imageData.width; x++) {
      for (let y = 0; y < this.imageData.height; y++) {
        const color = this.pick(x, y);
        if (color === startColor) {
          this.draw(x, y, fillColor);
          dirtyArea.left = Math.min(dirtyArea.left, x);
          dirtyArea.right = Math.max(dirtyArea.right, x);
          dirtyArea.top = Math.min(dirtyArea.top, y);
          dirtyArea.bottom = Math.max(dirtyArea.bottom, y);
        }
      }
    }
    return dirtyArea;
  }

  pixels(): ReadonlyArray<ReadonlyArray<HexColor>> {
    return this.#pixels;
  }

  count(): ReadonlyMap<HexColor, number> {
    return this.#counter;
  }
}
