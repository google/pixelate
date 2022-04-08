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

import { HexColor, hexToRgb, requireNonNull, rgbToHex, Tool } from './state';

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

export interface Operation {
  tool: Tool;
  color: HexColor;
  x: number;
  y: number;
}

/** Wrapper for CanvasRenderingContext2D with convenience editing functions.  */
export class EditableCanvas {
  constructor(
    readonly canvas: HTMLCanvasElement,
    readonly imageData: EditableImageData
  ) {
    this.canvas.width = imageData.width;
    this.canvas.height = imageData.height;
    this.ctx = getContext2D(this.canvas);
    this.ctx.fillStyle = '#ffffff';
    this.ctx.fillRect(0, 0, imageData.width, imageData.height);
    this.redraw();
  }

  private ctx: CanvasRenderingContext2D;

  get width() {
    return this.imageData.width;
  }

  get height() {
    return this.imageData.height;
  }

  count() {
    return this.imageData.count();
  }

  pixels() {
    return this.imageData.pixels();
  }

  applyMany(operations: Operation[]) {
    const dirty = operations.reduce(
      (dirtyArea, operation) =>
        mergeDirtyAreas(dirtyArea, this.apply(this.imageData, operation)),
      null as DirtyArea | null
    );

    if (dirty) {
      this.redraw(dirty);
    }
  }

  redraw(dirtyArea?: DirtyArea) {
    dirtyArea ??= {
      left: 0,
      top: 0,
      right: this.width - 1,
      bottom: this.height - 1,
    };

    this.ctx.putImageData(
      this.imageData.imageData,
      0,
      0,
      dirtyArea.left,
      dirtyArea.top,
      dirtyArea.right - dirtyArea.left + 1,
      dirtyArea.bottom - dirtyArea.top + 1
    );
  }

  private apply(
    imageData: EditableImageData,
    { tool, color, x, y }: Operation
  ): DirtyArea | null {
    if (tool === Tool.DRAW) {
      return imageData.draw(x, y, color);
    } else if (tool === Tool.FILL) {
      return imageData.fill(x, y, color);
    } else if (tool === Tool.MAGIC_WAND) {
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
export class EditableImageData {
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

  get width() {
    return this.imageData.width;
  }

  get height() {
    return this.imageData.height;
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

    // Set to full opacity to allow drawing over transparent pixels.
    this.imageData.data[i + 3] = 255;

    this.#pixels[y][x] = fillColor;

    const previousCount = (this.#counter.get(previous) ?? 0) - 1;
    if (previousCount <= 0) {
      this.#counter.delete(previous);
    } else {
      this.#counter.set(previous, previousCount);
    }
    this.#counter.set(fillColor, (this.#counter.get(fillColor) ?? 0) + 1);

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

  toDataURL() {
    const canvas = createCanvas(this);
    const ctx = getContext2D(canvas);
    ctx.putImageData(this.imageData, 0, 0);
    return canvas.toDataURL('image/png');
  }

  toPngBlob(): Promise<Blob> {
    const canvas = createCanvas(this);
    const ctx = getContext2D(canvas);
    ctx.putImageData(this.imageData, 0, 0);

    return new Promise((resolve, reject) => {
      canvas.toBlob((blob) => {
        if (blob) {
          resolve(blob);
        } else {
          reject(new Error('Empty blob'));
        }
      }, 'image/png');
    });
  }

  toImg(): HTMLImageElement {
    const img = new Image();
    img.src = this.toDataURL();
    // Caution: assertTrue(img.complete) might be false!
    return img;
  }
}

function createCanvas({
  width,
  height,
}: {
  width: number;
  height: number;
}): HTMLCanvasElement {
  const canvas = document.createElement('canvas');
  canvas.width = width;
  canvas.height = height;
  return canvas;
}

export function getContext2D(canvas: HTMLCanvasElement) {
  const ctx = requireNonNull(canvas.getContext('2d', { alpha: false }));
  ctx.imageSmoothingEnabled = false;
  return ctx;
}

export function getImageData(img: HTMLImageElement): ImageData {
  if (!img.complete) {
    throw new Error('Cannot create EditableImageData from non-loaded img.');
  }
  if (!img.naturalHeight || !img.naturalWidth) {
    throw new Error('Cannot create EditableImageData from empty image.');
  }
  const canvas = createCanvas({
    width: img.naturalWidth,
    height: img.naturalHeight,
  });
  const ctx = getContext2D(canvas);

  // Fill with white before painting image to effectively remove opacity.
  // Opacity is incompatile with the browser's native color picker, which
  // would then pick the background color behind.
  ctx.fillStyle = '#ffffff';
  ctx.fillRect(0, 0, img.naturalWidth, img.naturalHeight);

  ctx.drawImage(img, 0, 0);
  return ctx.getImageData(0, 0, img.naturalWidth, img.naturalHeight);
}
