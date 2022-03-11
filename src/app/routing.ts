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

import { Injectable } from '@angular/core';
import {
  deserializeState,
  PersistableState,
  serializeState,
  StateSerializer,
} from './state';

@Injectable()
export class UrlStateSerializer implements StateSerializer {
  async clear(): Promise<void> {
    document.location.hash = '';
  }

  makeURL(state: PersistableState) {
    const url = new URL(window.location.toString());
    url.hash = `#${serializeState(state)}`;
    return url.toString();
  }

  async save(state: PersistableState): Promise<void> {
    document.location.hash = `#${serializeState(state)}`;
  }

  async read(): Promise<Partial<PersistableState> | null> {
    const params = document.location.hash.slice(1);
    console.log('URL', params ? deserializeState(params) : null);
    return params ? deserializeState(params) : null;
  }
}
