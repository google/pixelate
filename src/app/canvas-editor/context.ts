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

export type HexColor = `#${string}`;

/** Wrapper for CanvasRenderingContext2D with convenience editing functions.  */
export class EditableContext2D {
  constructor(readonly ctx: CanvasRenderingContext2D) {}

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
  }

  count() {
    const imageData = new EditableImageData(
      this.ctx.getImageData(0, 0, this.ctx.canvas.width, this.ctx.canvas.height)
    );
    return imageData.count();
  }

  pixels() {
    const imageData = new EditableImageData(
      this.ctx.getImageData(0, 0, this.ctx.canvas.width, this.ctx.canvas.height)
    );
    return imageData.pixels();
  }

  edit(cb: (imageData: EditableImageData) => void) {
    const imageData = this.ctx.getImageData(
      0,
      0,
      this.ctx.canvas.width,
      this.ctx.canvas.height
    );
    cb(new EditableImageData(imageData));
    this.ctx.putImageData(imageData, 0, 0);
  }

  fill(x: number, y: number, fillColor: HexColor) {
    this.edit((imageData) => {
      imageData.fill(x, y, fillColor);
    });
  }

  draw(x: number, y: number, fillColor: HexColor) {
    this.edit((imageData) => {
      imageData.draw(x, y, fillColor);
    });
  }

  pick(x: number, y: number): HexColor {
    const imageData = new EditableImageData(
      this.ctx.getImageData(0, 0, this.ctx.canvas.width, this.ctx.canvas.height)
    );
    return imageData.pick(x, y);
  }
}

function toHex(a: number) {
  return a.toString(16).padStart(2, '0');
}

function rgbToHex(r: number, g: number, b: number): HexColor {
  if (r > 255 || g > 255 || b > 255) {
    throw new Error(`Invalid color component ${r}, ${g}, ${b}`);
  }

  return `#${toHex(r) + toHex(g) + toHex(b)}`;
}

const HEX_REGEX = /^#?([a-f\d]{2})([a-f\d]{2})([a-f\d]{2})$/i;

function hexToRgb(hex: HexColor): [number, number, number] {
  const result = HEX_REGEX.exec(hex);
  if (!result) {
    throw new Error(`Invalid color ${hex}`);
  }
  return [
    parseInt(result[1], 16),
    parseInt(result[2], 16),
    parseInt(result[3], 16),
  ];
}

/** Wrapper for ImageData with convenience editing functions. */
class EditableImageData {
  constructor(private readonly imageData: ImageData) {}

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

  draw(x: number, y: number, fillColor: HexColor) {
    const rgb = hexToRgb(fillColor);
    const i = this.toIndex(x, y);
    this.imageData.data[i + 0] = rgb[0];
    this.imageData.data[i + 1] = rgb[1];
    this.imageData.data[i + 2] = rgb[2];
  }

  fill(x: number, y: number, fillColor: HexColor) {
    let cur: [number, number] | undefined;
    const queue: [number, number][] = [[x, y]];
    const startColor = this.pick(x, y);

    while ((cur = queue.pop())) {
      const [cx, cy] = cur;
      const currentColor = this.pick(cx, cy);

      if (currentColor !== startColor || currentColor === fillColor) {
        continue;
      }

      this.draw(cx, cy, fillColor);

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
  }

  pixels(): HexColor[][] {
    const results: HexColor[][] = [];
    for (let y = 0; y < this.imageData.height; y++) {
      const row: HexColor[] = [];
      for (let x = 0; x < this.imageData.width; x++) {
        row.push(this.pick(x, y));
      }
      results.push(row);
    }
    return results;
  }

  count(): Map<HexColor, number> {
    const counter = new Map();
    for (let x = 0; x < this.imageData.width; x++) {
      for (let y = 0; y < this.imageData.height; y++) {
        const color = this.pick(x, y);
        const count = counter.get(color) ?? 0;
        counter.set(color, count + 1);
      }
    }
    return counter;
  }
}
