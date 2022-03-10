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

@Injectable()
export class DragDropService {
  registerDropHandler(callback: (file: File) => void) {
    document.addEventListener('dragover', (event) => {
      event.preventDefault();
    });
    document.addEventListener('drop', (event) => {
      event.preventDefault();

      if (!event.dataTransfer) {
        return;
      }
      const file = getImageFromDataTransfer(event.dataTransfer);

      if (!file) {
        return;
      }

      callback(file);
    });
  }
}

@Injectable()
export class ClipboardService {
  registerPasteHandler(callback: (file: File) => void) {
    window.addEventListener('paste', (event) => {
      const dataTransfer = (event as ClipboardEvent)?.clipboardData;
      if (!dataTransfer) {
        return;
      }
      const file = getImageFromDataTransfer(dataTransfer);
      if (!file) {
        return;
      }
      event.preventDefault();
      callback(file);
    });
  }
}

const STORAGE_KEY = 'image';

@Injectable()
export class StorageService {
  read(): string | undefined {
    return window.localStorage.getItem(STORAGE_KEY) ?? undefined;
  }

  write(imageData: string) {
    window.localStorage.setItem(STORAGE_KEY, imageData);
  }
}

function getImageFromDataTransfer(dataTransfer: DataTransfer): File | null {
  for (let i = 0; i < dataTransfer.items.length; i++) {
    const item = dataTransfer.items[i];
    if (item.type.startsWith('image')) {
      return item.getAsFile();
    }
  }
  return null;
}

export function showFileDialog(callback: (file: File) => void) {
  const input = document.createElement('input');
  input.type = 'file';
  input.accept = 'image/*';
  input.addEventListener('change', () => {
    for (let i = 0; i < (input.files?.length ?? 0); i++) {
      const file = input.files?.item(i);
      if (file?.type.startsWith('image/')) {
        callback(file);
        return;
      }
    }
  });
  input.click();
}

export async function decodeBase64(base64Data: string): Promise<File> {
  const blob = await fetch(base64Data).then((res) => res.blob());
  return new File([blob], 'file.png', { type: 'image/png' });
}
