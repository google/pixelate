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

import { Component, Input, ViewChild } from '@angular/core';
import { ComponentFixture, TestBed } from '@angular/core/testing';
import { AppModule } from '../app.module';
import { EditableImageData, getImageData } from '../image';
import { load1x1Img } from '../test_util';

import { PreprocessComponent } from './preprocess.component';

@Component({
  template: `<app-preprocess [imageData]="imageData"></app-preprocess>`,
})
class TestHostComponent {
  @Input()
  imageData?: EditableImageData;

  @ViewChild(PreprocessComponent)
  component!: PreprocessComponent;
}

describe('PreprocessComponent', () => {
  let hostComponent: TestHostComponent;
  let fixture: ComponentFixture<TestHostComponent>;

  beforeEach(async () => {
    await TestBed.configureTestingModule({
      imports: [AppModule],
      declarations: [PreprocessComponent, TestHostComponent],
    }).compileComponents();
  });

  beforeEach(() => {
    fixture = TestBed.createComponent(TestHostComponent);
    hostComponent = fixture.componentInstance;
  });

  it('should create', async () => {
    hostComponent.imageData = new EditableImageData(
      getImageData(await load1x1Img())
    );
    fixture.detectChanges(); // Runs OnInit.

    expect(hostComponent.component).toBeTruthy();
  });
});
