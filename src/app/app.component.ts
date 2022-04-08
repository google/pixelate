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

import { AfterViewInit, Component } from '@angular/core';
import { EditableImageData, getImageData } from './image';
import {
  ClipboardService,
  downloadFile,
  DragDropService,
  loadImageFile,
  showFileDialog,
  StorageService,
} from './io';
import { UrlStateSerializer } from './routing';
import {
  EditState,
  getDefaultDrawState,
  Mode,
  PersistableState,
} from './state';

@Component({
  selector: 'app-root',
  templateUrl: './app.component.html',
  styleUrls: ['./app.component.scss'],
})
export class AppComponent implements AfterViewInit {
  readonly Mode = Mode;

  state: PersistableState = { mode: Mode.NEW };

  constructor(
    private readonly dragDropService: DragDropService,
    private readonly clipboardService: ClipboardService,
    private readonly storageService: StorageService,
    private readonly urlStateSerializer: UrlStateSerializer
  ) {}

  async openImageFile(file: File) {
    // TODO: Loading a new image into an existing PreprocessComponent currently does not change the
    // image. Once this is fixed, remove the workaround that sets state to NEW first to force
    // unloading and re-instantiating PreprocessComponent.
    this.state = { mode: Mode.NEW };

    // TODO: As performance improvement, downscale large images to the maximum size of
    // PreprocessComponent. The image is frequently rescaled, precomputing a workable size greatly
    // speeds up the UI for large input images.
    const img = await loadImageFile(file);
    const imageData = new EditableImageData(getImageData(img));
    this.state = { ...getDefaultDrawState(), mode: Mode.PREPROCESS, imageData };
  }

  async ngAfterViewInit() {
    this.dragDropService.registerDropHandler((file) => {
      this.openImageFile(file);
    });
    this.clipboardService.registerPasteHandler((file) => {
      this.openImageFile(file);
    });

    try {
      const loadedState =
        (await this.urlStateSerializer.read()) ??
        (await this.storageService.read());

      if (loadedState?.imageData) {
        const defaultState = getDefaultDrawState();
        this.state = {
          ...defaultState,
          ...loadedState,
          canvasEditorState: {
            ...defaultState.canvasEditorState,
            ...loadedState.canvasEditorState,
          },
          instructionsState: {
            ...defaultState.instructionsState,
            ...loadedState.instructionsState,
          },
        } as EditState;
      }
    } finally {
      this.urlStateSerializer.clear();
    }

    if (this.isMobile && this.state.mode === Mode.DRAW) {
      // Draw experience is tough on mobile phones. Show Assembly view as default for now.
      this.state.mode = Mode.ASSEMBLE;
    }

    window.addEventListener('beforeunload', () => {
      const state = this.state;
      if (hasImageData(state)) {
        this.storageService.save(state);
      } else {
        this.storageService.clear();
      }
    });
  }

  get isMobile() {
    return (
      getComputedStyle(document.documentElement)
        .getPropertyValue('--mobile')
        .trim() === '1'
    );
  }

  get hasImage() {
    return hasImageData(this.state);
  }

  newFile() {
    this.state = { mode: Mode.NEW };
    this.storageService.clear();
  }

  openDrawMode(image: HTMLImageElement | EditableImageData) {
    const imageData =
      image instanceof EditableImageData
        ? image
        : new EditableImageData(getImageData(image));

    this.state = {
      ...getDefaultDrawState(),
      imageData,
    };
  }

  uploadFile() {
    showFileDialog((file) => this.openImageFile(file));
  }

  async downloadPng() {
    if (!hasImageData(this.state)) {
      throw new Error('copyImage requires imageData.');
    }
    const blob = await this.state.imageData.toPngBlob();
    const date = new Date().toISOString().slice(0, 10);
    const file = new File([blob], `pixelate-${date}.png`);
    downloadFile(file);
  }

  async copyImage() {
    if (!hasImageData(this.state)) {
      throw new Error('copyImage requires imageData.');
    }
    const blob = await this.state.imageData.toPngBlob();
    const item = new ClipboardItem({ 'image/png': blob });
    await navigator.clipboard.write([item]);
  }

  async copyUrl() {
    if (!hasImageData(this.state)) {
      throw new Error('copyUrl requires persistableState');
    }
    const url = this.urlStateSerializer.makeURL(this.state);
    return navigator.clipboard.writeText(url);
  }
}

function hasImageData(state: PersistableState): state is EditState {
  return (
    state.mode === Mode.DRAW ||
    state.mode === Mode.ASSEMBLE ||
    state.mode === Mode.PREPROCESS
  );
}
