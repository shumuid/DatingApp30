import { Component, OnInit } from '@angular/core';
import { ChimeService } from '../_services/chime.service';

@Component({
  selector: 'app-meetings',
  templateUrl: './meetings.component.html',
  styleUrls: ['./meetings.component.css']
})
export class MeetingsComponent implements OnInit {

  constructor(private chimeService: ChimeService) { }

  ngOnInit() {
  }

  createMeeting() {
    this.chimeService.createMeeting('us-east-1').subscribe(data => {
      console.log(data);
    }, error => {
      console.log(error);
    });
  }

}
