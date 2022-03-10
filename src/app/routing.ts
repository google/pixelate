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
  DRAW,
  ASSEMBLE,
}

const QUERY_PARAM_KEY = 'b';
const MODE_PARAM_KEY = 'm';
const MODE_VALUES = new Map([
  [Mode.ASSEMBLE, 'a'],
  [Mode.DRAW, 'd'],
]);

export function getAndClearBase64FromURL(): string | undefined {
  const searchString = document.location.hash.slice(1);
  const params = new URLSearchParams(searchString);
  const base64Data = params.get(QUERY_PARAM_KEY);

  if (base64Data && base64Data.startsWith('data:image/png;base64,')) {
    params.delete(QUERY_PARAM_KEY);
    document.location.hash = `#${params}`;
    return base64Data;
  } else {
    return undefined;
  }
}

export function getModeFromURL(searchString?: string): Mode | undefined {
  if (searchString === undefined) {
    searchString = document.location.hash.slice(1);
  }

  const key = new URLSearchParams(searchString).get(MODE_PARAM_KEY);

  for (const [mode, modeKey] of MODE_VALUES.entries()) {
    if (modeKey === key) {
      return mode;
    }
  }

  return undefined;
}

export function createBase64DataURL(
  data: string,
  mode: Mode,
  baseURL?: string
) {
  const params = new URLSearchParams({
    [MODE_PARAM_KEY]: MODE_VALUES.get(mode) ?? '',
    [QUERY_PARAM_KEY]: data,
  });
  const url = new URL(baseURL ?? window.location.toString());
  url.hash = `#${params}`;
  return url.toString();
}
