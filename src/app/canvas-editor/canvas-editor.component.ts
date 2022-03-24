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

import { KeyValue } from '@angular/common';
import {
  AfterViewInit,
  Component,
  ElementRef,
  EventEmitter,
  Input,
  OnInit,
  Output,
  TrackByFunction,
  ViewChild,
} from '@angular/core';
import {
  CanvasEditorState,
  HexColor,
  hexToRgb,
  isLightColor,
  requireNonNull,
  Tool,
} from '../state';
import { EditableCanvas, EditableImageData, Operation } from '../image';

const MAX_SCALE = 25;

/** Canvas with image editing functions. */
@Component({
  selector: 'app-canvas-editor',
  templateUrl: './canvas-editor.component.html',
  styleUrls: ['./canvas-editor.component.scss'],
})
export class CanvasEditorComponent implements OnInit, AfterViewInit {
  readonly Tool = Tool;

  @ViewChild('canvas') canvas!: ElementRef<HTMLCanvasElement>;

  private editableCanvas!: EditableCanvas;

  @Input() state: CanvasEditorState = {
    activeTool: Tool.DRAW,
    activeColor: '#000000',
  };

  @Output() readonly stateChange = new EventEmitter<CanvasEditorState>();

  @Input() imageData!: EditableImageData;

  colorCounts: ReadonlyMap<HexColor, number> = new Map();

  get activeColorLight() {
    return isLightColor(hexToRgb(this.state.activeColor));
  }

  ngOnInit(): void {
    requireNonNull(this.imageData);
    this.colorCounts = this.imageData.count();
  }

  ngAfterViewInit(): void {
    this.editableCanvas = new EditableCanvas(
      this.canvas.nativeElement,
      this.imageData
    );
    this.zoomToFit();
  }

  set zoom(zoom: number) {
    this.canvas.nativeElement.style.width = `${
      this.editableCanvas.width * zoom
    }px`;
    this.canvas.nativeElement.style.height = `${
      this.editableCanvas.height * zoom
    }px`;
  }

  get zoom() {
    return this.canvas.nativeElement.offsetWidth / this.editableCanvas.width;
  }

  zoomToFit() {
    this.zoom = Math.trunc(
      Math.max(
        1,
        Math.min(
          (window.innerWidth / this.editableCanvas.width) * 0.9,
          (window.innerHeight / this.editableCanvas.height) * 0.9,
          MAX_SCALE
        )
      )
    );
  }

  zoomIn() {
    this.zoom = Math.min(MAX_SCALE, this.zoom + 1);
  }

  zoomOut() {
    this.zoom = Math.max(1, this.zoom - 1);
  }

  readonly bufferedOperations: Operation[] = [];
  animationFrameId = 0;

  onMouseDown(event: MouseEvent) {
    if (!(event.buttons & 1)) {
      return;
    }

    event.preventDefault();

    // Math.min() prevents edge case of editing pixel that is slightly outside of canvas.
    const x = Math.min(
      this.editableCanvas.width - 1,
      Math.trunc(event.offsetX / this.zoom)
    );
    const y = Math.min(
      this.editableCanvas.height - 1,
      Math.trunc(event.offsetY / this.zoom)
    );
    const previous =
      this.bufferedOperations[this.bufferedOperations.length - 1];

    if (
      previous &&
      previous.tool === this.state.activeTool &&
      previous.color === this.state.activeColor &&
      previous.x === x &&
      previous.y === y
    ) {
      return;
    }

    this.bufferedOperations.push({
      tool: this.state.activeTool,
      color: this.state.activeColor,
      x,
      y,
    });

    if (this.bufferedOperations.length > 1) {
      return;
    }

    this.animationFrameId = requestAnimationFrame(() => {
      this.editableCanvas.applyMany(this.bufferedOperations);
      this.animationFrameId = 0;
      this.bufferedOperations.length = 0;
      this.colorCounts = this.editableCanvas.count();
    });
  }

  onMouseMove(event: MouseEvent) {
    this.onMouseDown(event);
  }

  readonly trackByKey: TrackByFunction<KeyValue<HexColor, number>> = (
    index,
    { key }
  ) => key;
}
