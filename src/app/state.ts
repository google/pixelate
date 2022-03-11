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

export enum Mode {
  DRAW = 'd',
  ASSEMBLE = 'a',
}

export interface PersistableState {
  image: string;
  mode: Mode;
  crossedColors: HexColor[];
  crossedRows: number[];
  crossedColumns: number[];
  activeColor: HexColor;
}

export const DEFAULT_STATE: Readonly<PersistableState> = {
  activeColor: '#000000',
  crossedColors: [],
  crossedColumns: [],
  crossedRows: [],
  image: '',
  mode: Mode.DRAW,
};

export type HexColor = `#${string}`;

export enum Tool {
  DRAW,
  FILL,
  MAGIC_WAND,
}

interface StringEnum<T> {
  [id: string]: T | string;
}

export function isEnum<T extends string>(
  value: string,
  enumType: StringEnum<T>
): value is T {
  return Object.values(enumType).includes(value);
}

export interface StateSerializer {
  save(state: PersistableState): Promise<void>;
  read(): Promise<Partial<PersistableState> | null>;
  clear(): Promise<void>;
}

function toHex(a: number) {
  return a.toString(16).padStart(2, '0');
}

export function rgbToHex(r: number, g: number, b: number): HexColor {
  if (r > 255 || g > 255 || b > 255) {
    throw new Error(`Invalid color component ${r}, ${g}, ${b}`);
  }
  return `#${toHex(r) + toHex(g) + toHex(b)}`;
}

const HEX_REGEX = /^#?([a-f\d]{2})([a-f\d]{2})([a-f\d]{2})$/i;

export function hexToRgb(hex: HexColor): [number, number, number] {
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

export function isHexColor(hex: HexColor | string): hex is HexColor {
  try {
    hexToRgb(hex as HexColor);
    return true;
  } catch (e) {
    return false;
  }
}

const QUERY_KEYS: { [key in keyof PersistableState]: string } = {
  activeColor: 'c',
  crossedColors: 'bg',
  crossedColumns: 'cols',
  crossedRows: 'rows',
  image: 'b',
  mode: 'm',
};

export function deserializeState(str: string): Partial<PersistableState> {
  const params = new URLSearchParams(str);
  const state: Partial<PersistableState> = {};

  const image = params.get(QUERY_KEYS['image']);
  if (image && image.startsWith('data:image/png;base64,')) {
    state.image = image;
  }

  const activeColor = params.get(QUERY_KEYS['activeColor']);
  if (activeColor && isHexColor(activeColor)) {
    state.activeColor = activeColor;
  }

  const crossedColors = params
    .get(QUERY_KEYS['crossedColors'])
    ?.split(',')
    .filter(isHexColor);
  if (crossedColors?.length) {
    state.crossedColors = crossedColors;
  }

  const mode = params.get(QUERY_KEYS['mode']);
  if (mode && isEnum(mode, Mode)) {
    state.mode = mode;
  }

  document.location.hash = '';
  return state;
}

export function serializeState(state: PersistableState): string {
  return new URLSearchParams({
    [QUERY_KEYS['activeColor']]: state.activeColor,
    [QUERY_KEYS['image']]: state.image,
    [QUERY_KEYS['crossedColors']]: state.crossedColors.join(','),
    [QUERY_KEYS['crossedColumns']]: state.crossedColumns.join(','),
    [QUERY_KEYS['crossedRows']]: state.crossedRows.join(','),
    [QUERY_KEYS['mode']]: state.mode,
  }).toString();
}
