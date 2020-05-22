import { Component, OnInit } from '@angular/core';
import { ChimeService } from '../_services/chime.service';
import { MeetingResponse } from '../_models/MeetingResponse';
import { AttendeeResponse } from '../_models/AttendeeResponse';
import { Meeting } from '../_models/Meeting';
import { Attendee } from '../_models/Attendee';
import {
  ConsoleLogger,
  DefaultDeviceController,
  DefaultMeetingSession,
  LogLevel,
  MeetingSessionConfiguration
} from 'amazon-chime-sdk-js';

@Component({
  selector: 'app-meetings',
  templateUrl: './meetings.component.html',
  styleUrls: ['./meetings.component.css']
})
export class MeetingsComponent implements OnInit {
  // form meeting variables
  meetingId: string;
  name: string;
  region: string;

  // chime meeting and attendee objects
  meeting: Meeting;
  attendee: Attendee;
  jsonMeetingResponse: string;
  jsonAttendeeResponse: string;

  // show/hide divs
  showMeetingForm = true;
  showSelectDevicesForm = false;

  // aws chime sdk objects
  logger = new ConsoleLogger('MyLogger', LogLevel.INFO);
  deviceController = new DefaultDeviceController(this.logger);
  configuration: MeetingSessionConfiguration;
  meetingSession: DefaultMeetingSession;

  // audio input, audio outout, video input devices
  audioInputDevices: Promise<any[]>;
  audioOutputDevices: Promise<any[]>;
  videoInputDevices: Promise<any[]>;

  constructor(private chimeService: ChimeService) { }

  ngOnInit() {
  }

  createMeeting = () => {
    this.chimeService.createMeeting(this.region).subscribe((meetingResponse: MeetingResponse) => {
      this.jsonMeetingResponse = JSON.stringify(meetingResponse);
      this.meeting = meetingResponse.meeting;

      this.createAttendee(this.meeting.meetingId);
    }, error => {
      console.log(error);
    });
  }

  createAttendee = (meetingId: string) => {
    this.chimeService.createAttendee(this.meeting.meetingId).subscribe((attendeeResponse: AttendeeResponse) => {
      this.jsonAttendeeResponse = JSON.stringify(attendeeResponse);
      this.showMeetingForm = false;
      this.showSelectDevicesForm = true;
      this.setMeetingSessionConfiguration(attendeeResponse);
    }, error => {
      console.log(error);
    });
  }

  setMeetingSessionConfiguration = (attendeeResponse: AttendeeResponse) => {
    this.configuration = new MeetingSessionConfiguration(
      {
        Meeting: {
        MeetingId: this.meeting.meetingId,
        MediaPlacement: {
          AudioHostUrl: this.meeting.mediaPlacement.audioHostUrl,
          ScreenDataUrl: this.meeting.mediaPlacement.screenDataUrl,
          ScreenSharingUrl: this.meeting.mediaPlacement.screenSharingUrl,
          ScreenViewingUrl: this.meeting.mediaPlacement.screenViewingUrl,
          SignalingUrl: this.meeting.mediaPlacement.signalingUrl,
          TurnControlUrl: this.meeting.mediaPlacement.turnControlUrl
        }}},
      {
        Attendee: {
          ExternalUserId: attendeeResponse.attendee.externalUserId,
          AttendeeId: attendeeResponse.attendee.attendeeId,
          JoinToken: attendeeResponse.attendee.joinToken
        }
      });

    this.meetingSession = new DefaultMeetingSession(this.configuration, this.logger, this.deviceController);

    this.getAudioVideoDevices();

    console.log(this.meetingSession);
  }

  getAudioVideoDevices = async () => {
    const audioInputDevices = await this.meetingSession.audioVideo.listAudioInputDevices();
    const audioOutputDevices = await this.meetingSession.audioVideo.listAudioOutputDevices();
    const videoInputDevices = await this.meetingSession.audioVideo.listVideoInputDevices();

    console.log('audio devices', audioInputDevices);

    // An array of MediaDeviceInfo objects
    audioInputDevices.forEach(mediaDeviceInfo => {
      console.log(`Device ID: ${mediaDeviceInfo.deviceId} Microphone: ${mediaDeviceInfo.label}`);
    });

    videoInputDevices.forEach(mediaDeviceInfo => {
      console.log(`Device ID: ${mediaDeviceInfo.deviceId} Video: ${mediaDeviceInfo.label}`);
    });

  }

}
