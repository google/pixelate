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

import { TruthyTypesOf } from 'rxjs';
import { EditableImageData, getImageData } from './image';
import { decodeBase64, loadImageFile } from './io';

export enum Mode {
  NEW = 'n',
  PREPROCESS = 'p',
  DRAW = 'd',
  ASSEMBLE = 'a',
}

export interface CanvasEditorState {
  activeColor: HexColor;
  activeTool: Tool;
}

export interface InstructionsState {
  crossedOutColors: Set<HexColor>;
  crossedOutRows: Set<number>;
  crossedOutColumns: Set<number>;
}

export type PersistableState =
  | {
      mode: Mode.NEW;
    }
  | EditState;

export interface EditState {
  mode: Mode.PREPROCESS | Mode.DRAW | Mode.ASSEMBLE;
  imageData: EditableImageData;
  canvasEditorState: CanvasEditorState;
  instructionsState: InstructionsState;
}

export function getDefaultDrawState(): Omit<EditState, 'imageData'> {
  return {
    mode: Mode.DRAW,
    canvasEditorState: {
      activeColor: '#000000',
      activeTool: Tool.DRAW,
    },
    instructionsState: {
      crossedOutColors: new Set(),
      crossedOutColumns: new Set(),
      crossedOutRows: new Set(),
    },
  };
}

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
  value: string | null | undefined,
  enumType: StringEnum<T>
): value is T {
  if (value === null || value === undefined) {
    return false;
  }

  return Object.values(enumType).includes(value);
}

export interface StateSerializer {
  save(state: EditState): Promise<void>;
  read(): Promise<DeepPartial<EditState> | null>;
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

export function isLightColor(rgb: [number, number, number]) {
  return Math.max(...rgb) > 220;
}

export function isHexColor(hex: HexColor | string): hex is HexColor {
  try {
    hexToRgb(hex as HexColor);
    return true;
  } catch (e) {
    return false;
  }
}

const QUERY_KEYS = {
  activeColor: 'c',
  crossedOutColors: 'bg',
  crossedOutColumns: 'cols',
  crossedOutRows: 'rows',
  image: 'b',
  mode: 'm',
} as const;

function parseNumberArray(str: string): number[] {
  return str
    .split(',')
    .map((s) => Number(s))
    .filter((n) => !isNaN(n));
}

export async function deserializeState(
  str: string
): Promise<DeepPartial<EditState>> {
  const params = new URLSearchParams(str);

  const image = params.get(QUERY_KEYS['image']);
  const mode = params.get(QUERY_KEYS['mode']);
  if (
    !image ||
    !image.startsWith('data:image/png;base64,') ||
    !isEnum(mode, Mode) ||
    (mode !== Mode.PREPROCESS && mode !== Mode.ASSEMBLE && mode !== Mode.DRAW)
  ) {
    return {};
  }

  const file = await decodeBase64(image);
  const img = await loadImageFile(file);
  const imageData = new EditableImageData(getImageData(img));

  const state = {
    imageData,
    mode,
    canvasEditorState: {} as Partial<CanvasEditorState>,
    instructionsState: {} as Partial<InstructionsState>,
  };

  const activeColor = params.get(QUERY_KEYS['activeColor']);
  if (activeColor && isHexColor(activeColor)) {
    state.canvasEditorState.activeColor = activeColor;
  }

  const crossedOutColors = params
    .get(QUERY_KEYS['crossedOutColors'])
    ?.split(',')
    .filter(isHexColor);
  if (crossedOutColors?.length) {
    state.instructionsState.crossedOutColors = new Set(crossedOutColors);
  }

  const crossedOutColumns = parseNumberArray(
    params.get(QUERY_KEYS['crossedOutColumns']) ?? ''
  );
  if (crossedOutColumns.length) {
    // Deserialize 1-based indices to 0-based indices.
    state.instructionsState.crossedOutColumns = new Set(
      crossedOutColumns.map((n) => n - 1)
    );
  }

  const crossedOutRows = parseNumberArray(
    params.get(QUERY_KEYS['crossedOutRows']) ?? ''
  );
  if (crossedOutRows.length) {
    // Deserialize 1-based indices to 0-based indices.
    state.instructionsState.crossedOutRows = new Set(
      crossedOutRows.map((n) => n - 1)
    );
  }

  return state;
}

export function serializeState(state: EditState): string {
  return new URLSearchParams({
    [QUERY_KEYS['activeColor']]: state.canvasEditorState.activeColor,
    [QUERY_KEYS['image']]: state.imageData.toDataURL(),
    [QUERY_KEYS['crossedOutColors']]: Array.from(
      state.instructionsState.crossedOutColors
    ).join(','),
    // Serialize 0-based indices to 1-based indices.
    [QUERY_KEYS['crossedOutColumns']]: Array.from(
      state.instructionsState.crossedOutColumns
    )
      .map((n) => n + 1)
      .join(','),
    [QUERY_KEYS['crossedOutRows']]: Array.from(
      state.instructionsState.crossedOutRows
    )
      .map((n) => n + 1)
      .join(','),
    [QUERY_KEYS['mode']]: state.mode,
  }).toString();
}

export function requireNonNull<T>(
  value: T | null | undefined,
  msg?: string
): NonNullable<typeof value> {
  if (value === null || value === undefined) {
    throw new Error(msg ?? 'Expected value to be neither null nor undefined.');
  }
  return value as NonNullable<T>;
}

export function requireTruthy<T>(
  value: T | null | undefined,
  msg?: string
): TruthyTypesOf<typeof value> {
  if (!value) {
    throw new Error(msg ?? `Expected value to be truthy, got ${value}`);
  }
  return value as TruthyTypesOf<T>;
}

export function assert<T>(
  value: T | null | undefined,
  msg?: string
): asserts value is TruthyTypesOf<T> {
  if (!value) {
    throw new Error(msg ?? `Expected value to be truthy, got ${value}`);
  }
}

export function assertTrue(
  value: boolean | null | undefined,
  msg?: string
): asserts value is true {
  if (!value) {
    throw new Error(msg ?? `Expected value to be truthy, got ${value}`);
  }
}

export type DeepPartial<T> = T extends object
  ? {
      [P in keyof T]?: DeepPartial<T[P]>;
    }
  : T;
