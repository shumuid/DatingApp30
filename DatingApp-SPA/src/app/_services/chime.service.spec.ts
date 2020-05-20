/* tslint:disable:no-unused-variable */

import { TestBed, async, inject } from '@angular/core/testing';
import { ChimeService } from './chime.service';

describe('Service: Chime', () => {
  beforeEach(() => {
    TestBed.configureTestingModule({
      providers: [ChimeService]
    });
  });

  it('should ...', inject([ChimeService], (service: ChimeService) => {
    expect(service).toBeTruthy();
  }));
});
