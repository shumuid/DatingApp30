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
  TimeoutScheduler,
  VideoTileState
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
  showMeetingScreen = false;

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

  // enable/disable mic, video, screen sharing
  isMicrophoneEnabled = true;
  isCameraEnabled = false;
  activeSpeakerLayout = true;
  tileOrganizer: DemoTileOrganizer = new DemoTileOrganizer();
  tileIndexToTileId: { [id: number]: number } = {};
  tileIdToTileIndex: { [id: number]: number } = {};

  // Add an observer to receive session lifecycle events: connecting, start, and stop
  observer = {
    audioVideoDidStart: () => {
      console.log('Started audio video');
    },
    audioVideoDidStop: sessionStatus => {
      // See the "Stopping a session" section for details.
      console.log('Stopped with a session status code: ', sessionStatus.statusCode());
    },
    audioVideoDidStartConnecting: reconnecting => {
      if (reconnecting) {
        // e.g. the WiFi connection is dropped.
        console.log('Attempting to reconnect');
      }
    },
    // videoTileDidUpdate is called whenever a new tile is created or tileState changes.
    videoTileDidUpdate: (tileState: VideoTileState) => {
      console.log(`video tile updated: ${JSON.stringify(tileState, null, '  ')}`);
      const tileIndex = tileState.localTile
      ? 16
      : this.tileOrganizer.acquireTileIndex(tileState.tileId);
      const tileElement = document.getElementById(`tile-${tileIndex}`) as HTMLDivElement;
      const videoElement = document.getElementById(`video-${tileIndex}`) as HTMLVideoElement;
      const nameplateElement = document.getElementById(`nameplate-${tileIndex}`) as HTMLDivElement;

      const pauseButtonElement = document.getElementById(`video-pause-${tileIndex}`) as HTMLButtonElement;
      const resumeButtonElement = document.getElementById(`video-resume-${tileIndex}`) as HTMLButtonElement;
      pauseButtonElement.addEventListener('click', () => {
        if (!tileState.paused) {
          this.audioVideo.pauseVideoTile(tileState.tileId);
        }
      });
      resumeButtonElement.addEventListener('click', () => {
        if (tileState.paused) {
          this.audioVideo.unpauseVideoTile(tileState.tileId);
        }
      });

      console.log(`binding video tile ${tileState.tileId} to ${videoElement.id}`);
      this.audioVideo.bindVideoElement(tileState.tileId, videoElement);
      this.tileIndexToTileId[tileIndex] = tileState.tileId;
      this.tileIdToTileIndex[tileState.tileId] = tileIndex;
      // TODO: enforce roster names
      // new TimeoutScheduler(200).start(() => {
      //   const rosterName = this.roster[tileState.boundAttendeeId]
      //     ? this.roster[tileState.boundAttendeeId].name
      //     : '';
      //   if (nameplateElement.innerHTML !== rosterName) {
      //     nameplateElement.innerHTML = rosterName;
      //   }
      // });
      tileElement.style.display = 'block';
      this.layoutVideoTiles();
    }
  };

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
      this.attendee = attendeeResponse.attendee;
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

  joinMeeting = () => {
    console.log('join meeting');

    // stop video preview
    const videoElement = document.getElementById('video-preview') as HTMLVideoElement;
    this.audioVideo.stopVideoPreviewForVideoInput(videoElement);

    this.showSelectDevicesForm = false;
    this.showMeetingScreen = true;

    const audioElement = document.getElementById('meeting-audio') as HTMLAudioElement;
    this.meetingSession.audioVideo.bindAudioElement(audioElement);
    this.meetingSession.audioVideo.addObserver(this.observer);
  }

  // mute unmute microphone
  toggleMicrophone = () => {
    this.isMicrophoneEnabled = !this.isMicrophoneEnabled;
    console.log('toggle mic', this.isMicrophoneEnabled);

    if(this.isMicrophoneEnabled)
    {
      const unmuted = this.meetingSession.audioVideo.realtimeUnmuteLocalAudio();
      if (unmuted) {
        console.log('Other attendees can hear your audio');
      } else {
        // See the realtimeSetCanUnmuteLocalAudio use case below.
        console.log('You cannot unmute yourself');
      }
    }
    else
    {
      this.meetingSession.audioVideo.realtimeMuteLocalAudio();
    }
  }

  // enable disable camera
  toggleCamera = async () => {
    this.isCameraEnabled = !this.isCameraEnabled;
    console.log('toggle camera', this.isCameraEnabled);
    if(this.isCameraEnabled)
    {
      await this.meetingSession.audioVideo.chooseVideoInputDevice(this.selectedVideoInputDeviceId);

      // const videoObserver = { };

      this.meetingSession.audioVideo.addObserver(this.observer);

      const startedLocalVideoTile = this.audioVideo.startLocalVideoTile();

      console.log('startedLocalVideoTile:', startedLocalVideoTile);

      // to do remove
      // const htmlVideoPreviewElement = document.getElementById('video-16') as HTMLVideoElement;
      // this.audioVideo.startVideoPreviewForVideoInput(htmlVideoPreviewElement);
    }
    else
    {
      console.log('stop video');
    }
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

  layoutVideoTiles(): void {
    if (!this.meetingSession) {
      return;
    }
    const selfAttendeeId = this.meetingSession.configuration.credentials.attendeeId;
    const selfTileId = this.tileIdForAttendeeId(selfAttendeeId);
    const visibleTileIndices = this.visibleTileIndices();
    let activeTileId = this.activeTileId();
    const selfIsVisible = visibleTileIndices.includes(this.tileIdToTileIndex[selfTileId]);
    if (visibleTileIndices.length === 2 && selfIsVisible) {
      activeTileId = this.tileIndexToTileId[
        visibleTileIndices[0] === selfTileId ? visibleTileIndices[1] : visibleTileIndices[0]
      ];
    }
    const hasVisibleActiveSpeaker = visibleTileIndices.includes(
      this.tileIdToTileIndex[activeTileId]
    );
    if (this.activeSpeakerLayout && hasVisibleActiveSpeaker) {
      this.layoutVideoTilesActiveSpeaker(visibleTileIndices, activeTileId);
    } else {
      this.layoutVideoTilesGrid(visibleTileIndices);
    }
  }

  tileIdForAttendeeId(attendeeId: string): number | null {
    for (const tile of this.audioVideo.getAllVideoTiles()) {
      const state = tile.state();
      if (state.boundAttendeeId === attendeeId) {
        return state.tileId;
      }
    }
    return null;
  }

  activeTileId(): number | null {
    // to do
    // for (const attendeeId in this.roster) {
    //   if (this.roster[attendeeId].active) {
            // return this.tileIdForAttendeeId(attendeeId);
    //   }
    // }
    // return null;

    return this.tileIdForAttendeeId(this.attendee.attendeeId);
  }

  visibleTileIndices(): number[] {
    let tiles: number[] = [];
    const screenViewTileIndex = 17;
    for (let tileIndex = 0; tileIndex <= screenViewTileIndex; tileIndex++) {
      const tileElement = document.getElementById(`tile-${tileIndex}`) as HTMLDivElement;
      if (tileElement.style.display === 'block') {
        if (tileIndex === screenViewTileIndex) {
          // Hide videos when viewing screen
          for (const tile of tiles) {
            const tileToSuppress = document.getElementById(`tile-${tile}`) as HTMLDivElement;
            tileToSuppress.style.visibility = 'hidden';
          }
          tiles = [screenViewTileIndex];
        } else {
          tiles.push(tileIndex);
        }
      }
    }
    return tiles;
  }

  layoutVideoTilesGrid(visibleTileIndices: number[]): void {
    const tileArea = document.getElementById('tile-area') as HTMLDivElement;
    const width = tileArea.clientWidth;
    const height = tileArea.clientHeight;
    const widthToHeightAspectRatio = 16 / 9;
    let columns = 1;
    let totalHeight = 0;
    let rowHeight = 0;
    for (; columns < 18; columns++) {
      const rows = Math.ceil(visibleTileIndices.length / columns);
      rowHeight = width / columns / widthToHeightAspectRatio;
      totalHeight = rowHeight * rows;
      if (totalHeight <= height) {
        break;
      }
    }
    for (let i = 0; i < visibleTileIndices.length; i++) {
      const w = Math.floor(width / columns);
      const h = Math.floor(rowHeight);
      const x = (i % columns) * w;
      const y = Math.floor(i / columns) * h + (height / 2 - totalHeight / 2);
      this.updateTilePlacement(visibleTileIndices[i], x, y, w, h);
    }
  }

  updateTilePlacement(tileIndex: number, x: number, y: number, w: number, h: number): void {
    const tile = document.getElementById(`tile-${tileIndex}`) as HTMLDivElement;
    const insetWidthSize = 4;
    const insetHeightSize = insetWidthSize / (16 / 9);
    tile.style.position = 'absolute';
    tile.style.left = `${x + insetWidthSize}px`;
    tile.style.top = `${y + insetHeightSize}px`;
    tile.style.width = `${w - insetWidthSize * 2}px`;
    tile.style.height = `${h - insetHeightSize * 2}px`;
    tile.style.margin = '0';
    tile.style.padding = '0';
    tile.style.visibility = 'visible';
    const video = document.getElementById(`video-${tileIndex}`) as HTMLDivElement;
    if (video) {
      video.style.position = 'absolute';
      video.style.left = '0';
      video.style.top = '0';
      video.style.width = `${w}px`;
      video.style.height = `${h}px`;
      video.style.margin = '0';
      video.style.padding = '0';
      video.style.borderRadius = '8px';
    }
    const nameplate = document.getElementById(`nameplate-${tileIndex}`) as HTMLDivElement;
    const nameplateSize = 24;
    const nameplatePadding = 10;
    nameplate.style.position = 'absolute';
    nameplate.style.left = '0px';
    nameplate.style.top = `${h - nameplateSize - nameplatePadding}px`;
    nameplate.style.height = `${nameplateSize}px`;
    nameplate.style.width = `${w}px`;
    nameplate.style.margin = '0';
    nameplate.style.padding = '0';
    nameplate.style.paddingLeft = `${nameplatePadding}px`;
    nameplate.style.color = '#fff';
    nameplate.style.backgroundColor = 'rgba(0,0,0,0)';
    nameplate.style.textShadow = '0px 0px 5px black';
    nameplate.style.letterSpacing = '0.1em';
    nameplate.style.fontSize = `${nameplateSize - 6}px`;

    let button = document.getElementById(`video-pause-${tileIndex}`) as HTMLButtonElement;

    if (button) {
      button.style.position = 'absolute';
      button.style.display = 'inline-block';
      button.style.right = '0px';
      // button.style.top = `${h - nameplateSize - nameplatePadding}px`;
      button.style.height = `${nameplateSize}px`;
      // button.style.width = `${w}px`;
      button.style.margin = '0';
      button.style.padding = '0';
      button.style.paddingLeft = `${nameplatePadding}px`;
      button.style.color = '#fff';
      button.style.backgroundColor = 'rgba(0,0,0,0)';
      button.style.textShadow = '0px 0px 5px black';
      button.style.letterSpacing = '0.1em';
      button.style.fontSize = `${nameplateSize - 6}px`;
    }

    button = document.getElementById(`video-resume-${tileIndex}`) as HTMLButtonElement;

    if (button) {
      button.style.position = 'absolute';
      button.style.left = '0px';
      button.style.top = '0px';
      button.style.height = `${nameplateSize}px`;
      // button.style.width = `${w}px`;
      button.style.margin = '0';
      button.style.padding = '0';
      button.style.paddingLeft = `${nameplatePadding}px`;
      button.style.color = '#fff';
      button.style.backgroundColor = 'rgba(0,0,0,0)';
      button.style.textShadow = '0px 0px 5px black';
      button.style.letterSpacing = '0.1em';
      button.style.fontSize = `${nameplateSize - 6}px`;
    }
  }

  layoutVideoTilesActiveSpeaker(visibleTileIndices: number[], activeTileId: number): void {
    const tileArea = document.getElementById('tile-area') as HTMLDivElement;
    const width = tileArea.clientWidth;
    const height = tileArea.clientHeight;
    const widthToHeightAspectRatio = 16 / 9;
    const maximumRelativeHeightOfOthers = 0.3;

    const activeWidth = width;
    const activeHeight = width / widthToHeightAspectRatio;
    const othersCount = visibleTileIndices.length - 1;
    let othersWidth = width / othersCount;
    let othersHeight = width / widthToHeightAspectRatio;
    if (othersHeight / activeHeight > maximumRelativeHeightOfOthers) {
      othersHeight = activeHeight * maximumRelativeHeightOfOthers;
      othersWidth = othersHeight * widthToHeightAspectRatio;
    }
    if (othersCount === 0) {
      othersHeight = 0;
    }
    const totalHeight = activeHeight + othersHeight;
    const othersTotalWidth = othersWidth * othersCount;
    const othersXOffset = width / 2 - othersTotalWidth / 2;
    const activeYOffset = height / 2 - totalHeight / 2;
    const othersYOffset = activeYOffset + activeHeight;

    let othersIndex = 0;
    // tslint:disable-next-line: prefer-for-of
    for (let i = 0; i < visibleTileIndices.length; i++) {
      const tileIndex = visibleTileIndices[i];
      const tileId = this.tileIndexToTileId[tileIndex];
      // tslint:disable-next-line: one-variable-per-declaration
      let x = 0,
        y = 0,
        w = 0,
        h = 0;
      if (tileId === activeTileId) {
        x = 0;
        y = activeYOffset;
        w = activeWidth;
        h = activeHeight;
      } else {
        x = othersXOffset + othersIndex * othersWidth;
        y = othersYOffset;
        w = othersWidth;
        h = othersHeight;
        othersIndex += 1;
      }
      this.updateTilePlacement(tileIndex, x, y, w, h);
    }
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

class DemoTileOrganizer {
  private static MAX_TILES = 16;
  private tiles: { [id: number]: number } = {};
  public tileStates: { [id: number]: boolean } = {};

  acquireTileIndex(tileId: number): number {
    for (let index = 0; index < DemoTileOrganizer.MAX_TILES; index++) {
      if (this.tiles[index] === tileId) {
        return index;
      }
    }
    for (let index = 0; index < DemoTileOrganizer.MAX_TILES; index++) {
      if (!(index in this.tiles)) {
        this.tiles[index] = tileId;
        return index;
      }
    }
    throw new Error('no tiles are available');
  }

  releaseTileIndex(tileId: number): number {
    for (let index = 0; index < DemoTileOrganizer.MAX_TILES; index++) {
      if (this.tiles[index] === tileId) {
        delete this.tiles[index];
        return index;
      }
    }
    return DemoTileOrganizer.MAX_TILES;
  }
}
