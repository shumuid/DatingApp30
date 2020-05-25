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
  MeetingSessionConfiguration,
  AudioVideoFacade,
  DefaultAudioMixController,
  TimeoutScheduler
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
  audioInputDevices: MediaDeviceInfo[];
  audioOutputDevices: MediaDeviceInfo[];
  videoInputDevices: MediaDeviceInfo[];

  selectedAudioInputDeviceId: string;
  selectedAudioInputDeviceInfo: MediaDeviceInfo;
  selectedVideoInputDeviceId: string;
  selectedVideoInputDeviceInfo: MediaDeviceInfo;
  selectedAudioOutputDeviceId: string;
  selectedAudioOutputDeviceInfo: MediaDeviceInfo;

  audioPreviewAriaValueNow: number;
  audioPreviewWitdh: string;
  audioPreviewTransitionDuration: string;

  audioVideo: AudioVideoFacade | null = null;

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
    this.audioVideo = this.meetingSession.audioVideo;

    this.getAudioVideoDevices();

    console.log(this.meetingSession);

  }

  getAudioVideoDevices = async () => {
    this.audioInputDevices = await this.meetingSession.audioVideo.listAudioInputDevices();
    this.audioOutputDevices = await this.meetingSession.audioVideo.listAudioOutputDevices();
    this.videoInputDevices = await this.meetingSession.audioVideo.listVideoInputDevices();

    console.log('audio input devices', this.audioInputDevices);
    console.log('audio output devices', this.audioOutputDevices);
    console.log('video input devices', this.videoInputDevices);

    // to do alert user if there is no mic device detected
    if(this.audioInputDevices.length > 0){
      this.selectedAudioInputDeviceId = this.audioInputDevices[0].deviceId;
      this.selectedAudioInputDeviceInfo = this.audioInputDevices[0];

      await this.getInputDevicePermission(this.selectedAudioInputDeviceId, 'audioInput');

      this.startAudioPreview();
    }

    // to do alert user if there is no video device detected
    if(this.videoInputDevices.length > 0){
      this.selectedVideoInputDeviceId = this.videoInputDevices[0].deviceId;
      this.selectedVideoInputDeviceInfo = this.videoInputDevices[0];

      await this.getInputDevicePermission(this.selectedVideoInputDeviceId, 'videoInput');

      this.startVideoPreview();
    }

    // to do alert user if there is no audio output device detected
    if(this.audioOutputDevices.length > 0){
      this.selectedAudioOutputDeviceId = this.audioOutputDevices[0].deviceId;
      this.selectedAudioOutputDeviceInfo = this.audioOutputDevices[0];

      await this.getInputDevicePermission(this.selectedAudioOutputDeviceId, 'audioOutput');
    }
  }

  onAudioInputChange = async (deviceId: string) => {
    this.selectedAudioInputDeviceInfo = this.audioInputDevices.filter(x=> x.deviceId === deviceId)[0];

    console.log('selectedAudioInputDeviceInfo: ',this.selectedAudioInputDeviceInfo);

    await this.getInputDevicePermission(deviceId, 'audioInput');

    this.startAudioPreview();
  }

  onVideoInputChange = async (deviceId: string) => {
    this.selectedVideoInputDeviceInfo = this.videoInputDevices.filter(x=> x.deviceId === deviceId)[0];

    console.log('selectedVideoInputDeviceInfo: ',this.selectedVideoInputDeviceInfo);

    await this.getInputDevicePermission(deviceId, 'videoInput');

    this.startVideoPreview();
  }

  onAudioOutputChange = async (deviceId: string) => {
    this.selectedAudioOutputDeviceInfo = this.audioOutputDevices.filter(x=> x.deviceId === deviceId)[0];

    console.log('selectedAudioOutputDeviceInfo: ',this.selectedAudioOutputDeviceInfo);

    await this.getInputDevicePermission(deviceId, 'audioOutput');
  }

  onVideoInputQualityChange = (qualityValue: string) => {
    switch (qualityValue) {
      case '360p':
        this.audioVideo.chooseVideoInputQuality(640, 360, 15, 600);
        break;
      case '540p':
        this.audioVideo.chooseVideoInputQuality(960, 540, 15, 1400);
        break;
      case '720p':
        this.audioVideo.chooseVideoInputQuality(1280, 720, 15, 1400);
        break;
    }
    console.log('video qualityValue: ', qualityValue);
    console.log('audioVideo: ', this.audioVideo);
    this.startVideoPreview();
  }

  testSound = () => {
    const audioOutput = document.getElementById('audio-output') as HTMLSelectElement;
    // tslint:disable-next-line: no-unused-expression
    console.log(audioOutput.value);
    new TestSound(audioOutput.value);
  }

  private getInputDevicePermission = async (deviceId: string, deviceType: string) => {
    switch(deviceType){
      case 'audioInput':
        const audioInputDevicePermissionInfo = await this.meetingSession.audioVideo.chooseAudioInputDevice(deviceId);
        console.log('audioInputDevicePermissionInfo: ', audioInputDevicePermissionInfo);
      break;
      case 'videoInput':
        const videoInputDevicePermissionInfo = await this.meetingSession.audioVideo.chooseVideoInputDevice(deviceId);
        console.log('videoInputDevicePermissionInfo: ', videoInputDevicePermissionInfo);
      break;
      case 'audioOutput':
        const audioOutPutDevicePermissionInfo = await this.meetingSession.audioVideo.chooseAudioOutputDevice(deviceId);
        console.log('audioOutputDevicePermissionInfo: ', audioOutPutDevicePermissionInfo);
      break;
      default: break;
    }
  }

  private setAudioPreviewPercent = (percent: number) => {
    if(this.audioPreviewAriaValueNow !== percent)
    {
      this.audioPreviewWitdh = `${percent}%`
      this.audioPreviewAriaValueNow = percent;
    }
    const transitionDuration = '33ms';
    if (this.audioPreviewTransitionDuration !== transitionDuration) {
      this.audioPreviewTransitionDuration = transitionDuration;
    }
  }

  private startAudioPreview = (): void => {
    this.setAudioPreviewPercent(0);
    const analyserNode = this.audioVideo.createAnalyserNodeForAudioInput();
    if (!analyserNode) {
      return;
    }
    if (!analyserNode.getFloatTimeDomainData) {
      return;
    }
    const data = new Float32Array(analyserNode.fftSize);
    let frameIndex = 0;
    this.analyserNodeCallback = () => {
      if (frameIndex === 0) {
        analyserNode.getFloatTimeDomainData(data);
        const lowest = 0.01;
        let max = lowest;
        for (const f of data) {
          max = Math.max(max, Math.abs(f));
        }
        const normalized = (Math.log(lowest) - Math.log(max)) / Math.log(lowest);
        const percent = Math.min(Math.max(normalized * 100, 0), 100);
        this.setAudioPreviewPercent(percent);
      }
      frameIndex = (frameIndex + 1) % 2;
      requestAnimationFrame(this.analyserNodeCallback);
    };
    requestAnimationFrame(this.analyserNodeCallback);
  }

  private analyserNodeCallback = () => {};

  private startVideoPreview = () => {
    const htmlVideoPreviewElement = document.getElementById('video-preview') as HTMLVideoElement;
    this.audioVideo.startVideoPreviewForVideoInput(htmlVideoPreviewElement);
  }
}


// helper classes
class TestSound {
  constructor(
    sinkId: string | null,
    frequency: number = 440,
    durationSec: number = 1,
    rampSec: number = 0.1,
    maxGainValue: number = 0.1
  ) {
    // @ts-ignore
    const audioContext: AudioContext = new (window.AudioContext || window.webkitAudioContext)();
    const gainNode = audioContext.createGain();
    gainNode.gain.value = 0;
    const oscillatorNode = audioContext.createOscillator();
    oscillatorNode.frequency.value = frequency;
    oscillatorNode.connect(gainNode);
    const destinationStream = audioContext.createMediaStreamDestination();
    gainNode.connect(destinationStream);
    const currentTime = audioContext.currentTime;
    const startTime = currentTime + 0.1;
    gainNode.gain.linearRampToValueAtTime(0, startTime);
    gainNode.gain.linearRampToValueAtTime(maxGainValue, startTime + rampSec);
    gainNode.gain.linearRampToValueAtTime(maxGainValue, startTime + rampSec + durationSec);
    gainNode.gain.linearRampToValueAtTime(0, startTime + rampSec * 2 + durationSec);
    oscillatorNode.start();
    const audioMixController = new DefaultAudioMixController();
    // @ts-ignore
    audioMixController.bindAudioDevice({ deviceId: sinkId });
    audioMixController.bindAudioElement(new Audio());
    audioMixController.bindAudioStream(destinationStream.stream);
    new TimeoutScheduler((rampSec * 2 + durationSec + 1) * 1000).start(() => {
      audioContext.close();
    });
  }
}
