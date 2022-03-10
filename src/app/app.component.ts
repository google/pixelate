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

import { AfterViewInit, Component, ViewChild } from '@angular/core';
import { CanvasEditorComponent } from './canvas-editor/canvas-editor.component';
import { HexColor } from './canvas-editor/context';
import {
  ClipboardService,
  decodeBase64,
  DragDropService,
  showFileDialog,
  StorageService,
} from './io';
import {
  createBase64DataURL,
  getAndClearBase64FromURL,
  getModeFromURL,
  Mode,
} from './routing';

@Component({
  selector: 'app-root',
  templateUrl: './app.component.html',
  styleUrls: ['./app.component.scss'],
})
export class AppComponent implements AfterViewInit {
  readonly Mode = Mode;

  mode = Mode.DRAW;

  @ViewChild(CanvasEditorComponent) canvas!: CanvasEditorComponent;

  isBackgroundColor: { [key in HexColor]: boolean } = {};

  constructor(
    private readonly dragDropService: DragDropService,
    private readonly clipboardService: ClipboardService,
    private readonly storageService: StorageService
  ) {}

  async ngAfterViewInit() {
    this.dragDropService.registerDropHandler((file) => {
      this.canvas.loadImageFile(file);
    });
    this.clipboardService.registerPasteHandler((file) => {
      this.canvas.loadImageFile(file);
    });

    this.mode = getModeFromURL() ?? Mode.DRAW;

    const base64Data = getAndClearBase64FromURL() ?? this.storageService.read();
    if (base64Data) {
      const file = await decodeBase64(base64Data);
      this.canvas.loadImageFile(file);
    }

    window.addEventListener('beforeunload', () => {
      if (this.canvas.hasImage) {
        this.storageService.write(this.canvas.getDataURL());
      }
    });
  }

  uploadFile() {
    showFileDialog((file) => {
      this.canvas.loadImageFile(file);
    });
  }

  async downloadPng() {
    const file = await this.canvas.getFile();
    const date = new Date().toISOString().slice(0, 10);

    const a = document.createElement('a');
    a.href = URL.createObjectURL(file);
    a.download = `pixelate-${date}.png`;
    a.click();
  }

  async copyImage() {
    const blob = await this.canvas.getBlob();
    const item = new ClipboardItem({ 'image/png': blob });
    return navigator.clipboard.write([item]);
  }

  async copyUrl() {
    const data = this.canvas.canvas.nativeElement.toDataURL('png');
    const url = createBase64DataURL(data, this.mode);
    return navigator.clipboard.writeText(url);
  }

  printAssembly() {
    const original = this.mode;
    this.mode = Mode.ASSEMBLE;
    setTimeout(() => {
      window.print();
      this.mode = original;
    }, 1);
  }

  toggleBackgroundColor(color: HexColor) {
    this.isBackgroundColor[color] = !this.isBackgroundColor[color];
  }
}
