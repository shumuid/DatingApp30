import { Component, OnInit } from '@angular/core';
import {
  AsyncScheduler,
  AudioVideoFacade,
  AudioVideoObserver,
  ClientMetricReport,
  ConsoleLogger,
  DefaultActiveSpeakerPolicy,
  DefaultDeviceController,
  DefaultMeetingSession,
  Device,
  DeviceChangeObserver,
  LogLevel,
  Logger,
  MeetingSession,
  MeetingSessionConfiguration,
  MeetingSessionPOSTLogger,
  MeetingSessionStatus,
  MeetingSessionStatusCode,
  MeetingSessionVideoAvailability,
  ScreenMessageDetail,
  ScreenShareFacadeObserver,
  TimeoutScheduler,
  Versioning,
  VideoTileState,
  ClientVideoStreamReceivingReport,
} from 'amazon-chime-sdk-js';
import { ChimeService } from '../_services/chime.service';
import './style.scss'
import { JoinInfoDto } from '../_models/JoinInfoDto';
import { NameDto } from '../_models/NameDto';
import { DemoTileOrganizer } from '../_utils/DemoTileOrganizer';
import { TestSound } from '../_utils/TestSound';
import { environment } from 'src/environments/environment';

@Component({
  selector: 'app-attendees',
  templateUrl: './attendees.component.html',
  styleUrls: ['./attendees.component.css']
})
export class AttendeesComponent implements OnInit, AudioVideoObserver, DeviceChangeObserver {
  static readonly BASE_URL: string = [
    location.protocol,
    '//',
    location.host,
    location.pathname.replace(/\/*$/, '/'),
  ].join('');
  static readonly LOGGER_BATCH_SIZE: number = 85;
  static readonly LOGGER_INTERVAL_MS: number = 11500;

  showActiveSpeakerScores = false;
  activeSpeakerLayout = true;
  meeting: string | null = null;
  name: string | null = null;
  voiceConnectorId: string | null = null;
  region: string | null = null;
  meetingSession: MeetingSession | null = null;
  audioVideo: AudioVideoFacade | null = null;
  tileOrganizer: DemoTileOrganizer = new DemoTileOrganizer();
  canStartLocalVideo = true;
  roster: any = {};
  tileIndexToTileId: { [id: number]: number } = {};
  tileIdToTileIndex: { [id: number]: number } = {};
  chimeMeetingId: string;
  cameraDeviceIds: string[] = [];
  microphoneDeviceIds: string[] = [];
  meetingInfo: any = {};

  buttonStates: { [key: string]: boolean } = {
    'button-microphone': true,
    'button-camera': false,
    'button-screen-share': false,
    'button-screen-view': false,
  };

  enableWebAudio = false;

  constructor(private chimeService: ChimeService) {
  }

  ngOnInit() {
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      this.switchToFlow('flow-authenticate');
      (document.getElementById('sdk-version') as HTMLSpanElement).innerHTML =
        'amazon-chime-sdk-js@' + Versioning.sdkVersion;
      this.initEventListeners();
      this.initParameters();
  }

  initParameters(): void {
    const meeting = new URL(window.location.href).searchParams.get('m');
    if (meeting) {
      (document.getElementById('inputMeeting') as HTMLInputElement).value = meeting;
      (document.getElementById('inputName') as HTMLInputElement).focus();
    } else {
      (document.getElementById('inputMeeting') as HTMLInputElement).focus();
    }
  }

  initEventListeners(): void {
    window.addEventListener('resize', () => {
      this.layoutVideoTiles();
    });

    document.getElementById('form-authenticate').addEventListener('submit', e => {
      e.preventDefault();
      this.meeting = (document.getElementById('inputMeeting') as HTMLInputElement).value;
      this.name = (document.getElementById('inputName') as HTMLInputElement).value;
      this.region = (document.getElementById('inputRegion') as HTMLInputElement).value;
      new AsyncScheduler().start(
        async (): Promise<void> => {
          let chimeMeetingId = '';

          try {
            chimeMeetingId = await this.authenticate();
            this.chimeMeetingId = chimeMeetingId;
          } catch (error) {
            (document.getElementById(
              'failed-meeting'
            ) as HTMLDivElement).innerHTML = `Meeting ID: ${this.meeting}`;
            (document.getElementById('failed-meeting-error') as HTMLDivElement).innerHTML =
              error.message;
            this.switchToFlow('flow-failed-meeting');
            return;
          }
          (document.getElementById(
            'meeting-id'
          ) as HTMLSpanElement).innerHTML = `${this.meeting} (${this.region})`;
          (document.getElementById(
            'chime-meeting-id'
          ) as HTMLSpanElement).innerHTML = `${chimeMeetingId}`;
          (document.getElementById('info-meeting') as HTMLSpanElement).innerHTML = this.meeting;
          (document.getElementById('info-name') as HTMLSpanElement).innerHTML = this.name;

          console.log('switchToFlow', 'flow-devices');
          this.switchToFlow('flow-devices');

          await this.openAudioInputFromSelection();
          try {
            await this.openVideoInputFromSelection(
              (document.getElementById('video-input') as HTMLSelectElement).value,
              true
            );
          } catch (err) {
            this.log('no video input device selected');
          }
          await this.openAudioOutputFromSelection();
        }
      );
    });

    const audioInput = document.getElementById('audio-input') as HTMLSelectElement;
    audioInput.addEventListener('change', async (_ev: Event) => {
      this.log('audio input device is changed');
      await this.openAudioInputFromSelection();
    });

    const videoInput = document.getElementById('video-input') as HTMLSelectElement;
    videoInput.addEventListener('change', async (_ev: Event) => {
      this.log('video input device is changed');
      try {
        await this.openVideoInputFromSelection(videoInput.value, true);
      } catch (err) {
        this.log('no video input device selected');
      }
    });

    const videoInputQuality = document.getElementById('video-input-quality') as HTMLSelectElement;
    videoInputQuality.addEventListener('change', async (_ev: Event) => {
      this.log('Video input quality is changed');
      switch (videoInputQuality.value) {
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
      try {
        await this.openVideoInputFromSelection(videoInput.value, true);
      } catch (err) {
        this.log('no video input device selected');
      }
    });

    const audioOutput = document.getElementById('audio-output') as HTMLSelectElement;
    audioOutput.addEventListener('change', async (_ev: Event) => {
      this.log('audio output device is changed');
      await this.openAudioOutputFromSelection();
    });

    document.getElementById('button-test-sound').addEventListener('click', e => {
      e.preventDefault();
      // tslint:disable-next-line: no-shadowed-variable
      const audioOutput = document.getElementById('audio-output') as HTMLSelectElement;
      new TestSound(audioOutput.value);
    });

    document.getElementById('form-devices').addEventListener('submit', e => {
      e.preventDefault();
      new AsyncScheduler().start(async () => {
        try {
          await this.join();
          this.audioVideo.stopVideoPreviewForVideoInput(
            document.getElementById('video-preview') as HTMLVideoElement
          );
          this.audioVideo.chooseVideoInputDevice(null);
          // this.hideProgress('progress-join');
          this.displayButtonStates();
          this.switchToFlow('flow-meeting');
        } catch (error) {
          document.getElementById('failed-join').innerHTML = `Meeting ID: ${this.meeting}`;
          document.getElementById('failed-join-error').innerHTML = `Error: ${error.message}`;
        }
      });
    });

    const buttonMute = document.getElementById('button-microphone');
    buttonMute.addEventListener('mousedown', _e => {
      if (this.toggleButton('button-microphone')) {
        this.audioVideo.realtimeUnmuteLocalAudio();
      } else {
        this.audioVideo.realtimeMuteLocalAudio();
      }
    });

    const buttonVideo = document.getElementById('button-camera');
    buttonVideo.addEventListener('click', _e => {
      new AsyncScheduler().start(async () => {
        if (this.toggleButton('button-camera') && this.canStartLocalVideo) {
          try {
            let camera: string = videoInput.value;
            if (videoInput.value === 'None') {
              camera = this.cameraDeviceIds.length ? this.cameraDeviceIds[0] : 'None';
            }
            await this.openVideoInputFromSelection(camera, false);
            this.audioVideo.startLocalVideoTile();
          } catch (err) {
            this.log('no video input device selected');
          }
        } else {
          this.audioVideo.stopLocalVideoTile();
          this.hideTile(16);
        }
      });
    });

    const buttonScreenShare = document.getElementById('button-screen-share');
    buttonScreenShare.addEventListener('click', () => {
      new AsyncScheduler().start(async () => {
        const button1 = 'button-screen-share';
        if (this.buttonStates[button1]) {
          this.meetingSession.screenShare
            .stop()
            .catch(error => {
              this.log(error);
            })
            .finally(() => {
              this.buttonStates[button1] = false;
              this.displayButtonStates();
            });
        } else {
          const self = this;
          const observer: ScreenShareFacadeObserver = {
            didStopScreenSharing(): void {
              self.buttonStates[button1] = false;
              self.displayButtonStates();
            },
          };
          this.meetingSession.screenShare.registerObserver(observer);
          this.meetingSession.screenShare.start().then(() => {
            this.buttonStates[button1] = true;
            this.displayButtonStates();
          });
        }
      });
    });

    const buttonScreenView = document.getElementById('button-screen-view');
    buttonScreenView.addEventListener('click', _e => {
      new AsyncScheduler().start(async () => {
        if (this.toggleButton('button-screen-view')) {
          const screenViewDiv = document.getElementById('tile-17') as HTMLDivElement;
          screenViewDiv.style.display = 'block';
          this.meetingSession.screenShareView.start(screenViewDiv);
        } else {
          this.meetingSession.screenShareView
            .stop()
            .catch(error => {
              this.log(error);
            })
            .finally(() => this.hideTile(17));
        }
        this.layoutVideoTiles();
      });
    });

    const buttonMeetingEnd = document.getElementById('button-meeting-end');
    buttonMeetingEnd.addEventListener('click', _e => {
      const confirmEnd = new URL(window.location.href).searchParams.get('confirm-end') === 'true';
      const prompt =
        'Are you sure you want to end the meeting for everyone? The meeting cannot be used after ending it.';
      if (confirmEnd && !window.confirm(prompt)) {
        return;
      }
      new AsyncScheduler().start(async () => {
        (buttonMeetingEnd as HTMLButtonElement).disabled = true;
        await this.endMeeting();
        this.leave();
        (buttonMeetingEnd as HTMLButtonElement).disabled = false;
        // @ts-ignore
        window.location = window.location.pathname;
      });
    });

    const buttonMeetingLeave = document.getElementById('button-meeting-leave');
    buttonMeetingLeave.addEventListener('click', _e => {
      new AsyncScheduler().start(async () => {
        (buttonMeetingLeave as HTMLButtonElement).disabled = true;
        this.leave();
        (buttonMeetingLeave as HTMLButtonElement).disabled = false;
        // @ts-ignore
        window.location = window.location.pathname;
      });
    });
  }

  toggleButton(button: string, state?: 'on' | 'off'): boolean {
    if (state === 'on') {
      this.buttonStates[button] = true;
    } else if (state === 'off') {
      this.buttonStates[button] = false;
    } else {
      this.buttonStates[button] = !this.buttonStates[button];
    }
    this.displayButtonStates();
    return this.buttonStates[button];
  }

  displayButtonStates(): void {
    // tslint:disable-next-line: forin
    for (const button in this.buttonStates) {
      const element = document.getElementById(button);
      const drop = document.getElementById(`${button}-drop`);
      const on = this.buttonStates[button];
      element.classList.add(on ? 'btn-success' : 'btn-outline-secondary');
      element.classList.remove(on ? 'btn-outline-secondary' : 'btn-success');
      if (drop) {
        drop.classList.add(on ? 'btn-success' : 'btn-outline-secondary');
        drop.classList.remove(on ? 'btn-outline-secondary' : 'btn-success');
      }
    }
  }

  switchToFlow(flow: string): void {
    this.analyserNodeCallback = () => {};
    Array.from(document.getElementsByClassName('flow')).map(
      e => ((e as HTMLDivElement).style.display = 'none')
    );
    const element = document.getElementById(flow);
    if (flow === 'flow-meeting') {
      console.log('flow meeting:',element);
    }
    (document.getElementById(flow) as HTMLDivElement).style.display = 'block';
    if (flow === 'flow-devices') {
      console.log('startAudioPreview');
      this.startAudioPreview();
    }
  }

  audioInputsChanged(_freshAudioInputDeviceList: MediaDeviceInfo[]): void {
    this.populateAudioInputList();
  }

  videoInputsChanged(_freshVideoInputDeviceList: MediaDeviceInfo[]): void {
    this.populateVideoInputList();
  }

  audioOutputsChanged(_freshAudioOutputDeviceList: MediaDeviceInfo[]): void {
    this.populateAudioOutputList();
  }

  estimatedDownlinkBandwidthLessThanRequired(
    estimatedDownlinkBandwidthKbps: number,
    requiredVideoDownlinkBandwidthKbps: number
  ): void {
    this.log(
      `Estimated downlink bandwidth is ${estimatedDownlinkBandwidthKbps} is less than required bandwidth for video ${requiredVideoDownlinkBandwidthKbps}`
    );
  }

  videoNotReceivingEnoughData(videoReceivingReports: ClientVideoStreamReceivingReport[]): void {
    this.log(
      `One or more video streams are not receiving expected amounts of data ${JSON.stringify(
        videoReceivingReports
      )}`
    );
  }

  metricsDidReceive(clientMetricReport: ClientMetricReport): void {
    const metricReport = clientMetricReport.getObservableMetrics();
    if (
      typeof metricReport.availableSendBandwidth === 'number' &&
      !isNaN(metricReport.availableSendBandwidth)
    ) {
      (document.getElementById('video-uplink-bandwidth') as HTMLSpanElement).innerHTML =
        'Available Uplink Bandwidth: ' +
        String(metricReport.availableSendBandwidth / 1000) +
        ' Kbps';
    } else if (
      typeof metricReport.availableOutgoingBitrate === 'number' &&
      !isNaN(metricReport.availableOutgoingBitrate)
    ) {
      (document.getElementById('video-uplink-bandwidth') as HTMLSpanElement).innerHTML =
        'Available Uplink Bandwidth: ' +
        String(metricReport.availableOutgoingBitrate / 1000) +
        ' Kbps';
    } else {
      (document.getElementById('video-uplink-bandwidth') as HTMLSpanElement).innerHTML =
        'Available Uplink Bandwidth: Unknown';
    }

    if (
      typeof metricReport.availableReceiveBandwidth === 'number' &&
      !isNaN(metricReport.availableReceiveBandwidth)
    ) {
      (document.getElementById('video-downlink-bandwidth') as HTMLSpanElement).innerHTML =
        'Available Downlink Bandwidth: ' +
        String(metricReport.availableReceiveBandwidth / 1000) +
        ' Kbps';
    } else if (
      typeof metricReport.availableIncomingBitrate === 'number' &&
      !isNaN(metricReport.availableIncomingBitrate)
    ) {
      (document.getElementById('video-downlink-bandwidth') as HTMLSpanElement).innerHTML =
        'Available Downlink Bandwidth: ' +
        String(metricReport.availableIncomingBitrate / 1000) +
        ' Kbps';
    } else {
      (document.getElementById('video-downlink-bandwidth') as HTMLSpanElement).innerHTML =
        'Available Downlink Bandwidth: Unknown';
    }
  }

  async initializeMeetingSession(configuration: MeetingSessionConfiguration): Promise<void> {
    let logger: Logger;
    // if (location.hostname === 'localhost' || location.hostname === '127.0.0.1') {
    //   logger = new ConsoleLogger('SDK', LogLevel.INFO);
    // } else {
      logger = new MeetingSessionPOSTLogger(
        'SDK',
        configuration,
        AttendeesComponent.LOGGER_BATCH_SIZE,
        AttendeesComponent.LOGGER_INTERVAL_MS,
        `${environment.apiUrl}meeting/logs`,
        LogLevel.INFO
      );
    // }
    const deviceController = new DefaultDeviceController(logger);
    configuration.enableWebAudio = this.enableWebAudio;
    this.meetingSession = new DefaultMeetingSession(configuration, logger, deviceController);
    this.audioVideo = this.meetingSession.audioVideo;

    this.audioVideo.addDeviceChangeObserver(this);
    this.setupDeviceLabelTrigger();
    await this.populateAllDeviceLists();
    this.setupMuteHandler();
    this.setupCanUnmuteHandler();
    this.setupSubscribeToAttendeeIdPresenceHandler();
    this.setupScreenViewing();
    this.audioVideo.addObserver(this);
  }

  setClickHandler(elementId: string, f: () => void): void {
    document.getElementById(elementId).addEventListener('click', () => {
      f();
    });
  }

  async join(): Promise<void> {
    window.addEventListener('unhandledrejection', (event: PromiseRejectionEvent) => {
      this.log(event.reason);
    });
    await this.openAudioInputFromSelection();
    await this.openAudioOutputFromSelection();
    this.audioVideo.start();
    await this.meetingSession.screenShare.open();
    await this.meetingSession.screenShareView.open();
  }

  leave(): void {
    this.meetingSession.screenShare
      .stop()
      .catch(() => {})
      .finally(() => {
        return this.meetingSession.screenShare.close();
      });
    this.meetingSession.screenShareView.close();
    this.audioVideo.stop();
    this.roster = {};
  }

  setupMuteHandler(): void {
    // tslint:disable-next-line: no-shadowed-variable
    const handler = (isMuted: boolean): void => {
      this.log(`muted = ${isMuted}`);
    };
    this.audioVideo.realtimeSubscribeToMuteAndUnmuteLocalAudio(handler);
    const isMuted = this.audioVideo.realtimeIsLocalAudioMuted();
    handler(isMuted);
  }

  setupCanUnmuteHandler(): void {
    const handler = (canUnmute: boolean): void => {
      this.log(`canUnmute = ${canUnmute}`);
    };
    this.audioVideo.realtimeSubscribeToSetCanUnmuteLocalAudio(handler);
    handler(this.audioVideo.realtimeCanUnmuteLocalAudio());
  }

  updateRoster(): void {
    let rosterText = '';
    // tslint:disable-next-line: forin
    for (const attendeeId in this.roster) {
      rosterText +=
        '<li class="list-group-item d-flex justify-content-between align-items-center">';
      rosterText += this.roster[attendeeId].name;
      let score = this.roster[attendeeId].score;
      if (!score) {
        score = 0;
      }
      score = Math.floor(score * 100);
      if (score) {
        rosterText += ` (${score})`;
      }
      rosterText += '<span class="badge badge-pill ';
      let status = '';
      if (this.roster[attendeeId].signalStrength < 1) {
        status = '&nbsp;';
        rosterText += 'badge-warning';
      } else if (this.roster[attendeeId].signalStrength === 0) {
        status = '&nbsp;';
        rosterText += 'badge-danger';
      } else if (this.roster[attendeeId].muted) {
        status = 'MUTED';
        rosterText += 'badge-secondary';
      } else if (this.roster[attendeeId].active) {
        status = 'SPEAKING';
        rosterText += 'badge-success';
      } else if (this.roster[attendeeId].volume > 0) {
        status = '&nbsp;';
        rosterText += 'badge-success';
      }
      rosterText += `">${status}</span></li>`;
    }
    const roster = document.getElementById('roster');
    if (roster.innerHTML !== rosterText) {
      roster.innerHTML = rosterText;
    }
  }

  setupSubscribeToAttendeeIdPresenceHandler(): void {
    const handler = (attendeeId: string, present: boolean): void => {
      this.log(`${attendeeId} present = ${present}`);
      if (!present) {
        delete this.roster[attendeeId];
        this.updateRoster();
        return;
      }
      this.audioVideo.realtimeSubscribeToVolumeIndicator(
        attendeeId,
        async (
          // tslint:disable-next-line: no-shadowed-variable
          attendeeId: string,
          volume: number | null,
          muted: boolean | null,
          signalStrength: number | null
        ) => {
          if (!this.roster[attendeeId]) {
            this.roster[attendeeId] = { name: '' };
          }
          if (volume !== null) {
            this.roster[attendeeId].volume = Math.round(volume * 100);
          }
          if (muted !== null) {
            this.roster[attendeeId].muted = muted;
          }
          if (signalStrength !== null) {
            this.roster[attendeeId].signalStrength = Math.round(signalStrength * 100);
          }
          if (!this.roster[attendeeId].name) {
            const response = this.chimeService.getAttendee(attendeeId).toPromise();
            const json = await response as NameDto;
            this.roster[attendeeId].name = json.attendeeName ?  json.attendeeName: '';
          }
          this.updateRoster();
        }
      );
    };
    this.audioVideo.realtimeSubscribeToAttendeeIdPresence(handler);
    const activeSpeakerHandler = (attendeeIds: string[]): void => {
      // tslint:disable-next-line: forin
      for (const attendeeId in this.roster) {
        this.roster[attendeeId].active = false;
      }
      for (const attendeeId of attendeeIds) {
        if (this.roster[attendeeId]) {
          this.roster[attendeeId].active = true;
          break; // only show the most active speaker
        }
      }
      this.layoutVideoTiles();
    };
    this.audioVideo.subscribeToActiveSpeakerDetector(
      new DefaultActiveSpeakerPolicy(),
      activeSpeakerHandler,
      (scores: { [attendeeId: string]: number }) => {
        for (const attendeeId in scores) {
          if (this.roster[attendeeId]) {
            this.roster[attendeeId].score = scores[attendeeId];
          }
        }
        this.updateRoster();
      },
      this.showActiveSpeakerScores ? 100 : 0
    );
  }

  async joinMeeting(): Promise<any> {
    const response = this.chimeService.joinMeeting(this.region, this.meeting, this.name).toPromise();
    const json = await response as JoinInfoDto;
    let objectToReturn: any = {};
    objectToReturn = {
      JoinInfo: {
        Meeting: {
          MeetingId: json.joinInfo.meeting.meetingId,
          MediaPlacement: {
            AudioHostUrl: json.joinInfo.meeting.mediaPlacement.audioHostUrl,
            ScreenDataUrl: json.joinInfo.meeting.mediaPlacement.screenDataUrl,
            ScreenSharingUrl: json.joinInfo.meeting.mediaPlacement.screenSharingUrl,
            ScreenViewingUrl: json.joinInfo.meeting.mediaPlacement.screenViewingUrl,
            SignalingUrl: json.joinInfo.meeting.mediaPlacement.signalingUrl,
            TurnControlUrl: json.joinInfo.meeting.mediaPlacement.turnControlUrl
          }},
        Attendee: {
            ExternalUserId: json.joinInfo.attendee.externalUserId,
            AttendeeId: json.joinInfo.attendee.attendeeId,
            JoinToken: json.joinInfo.attendee.joinToken
          },
        Title: json.joinInfo.title
      }
    }
    this.meetingInfo = objectToReturn;
    alert('Pass this meetingId to join this meeting: ' + objectToReturn.JoinInfo.Meeting.MeetingId);
    return objectToReturn;
  }

  async endMeeting(): Promise<any> {
    // to do end meeting logic
    // await fetch(`${DemoMeetingApp.BASE_URL}end?title=${encodeURIComponent(this.meeting)}`, {
    //   method: 'POST',
    // });
  }

  setupDeviceLabelTrigger(): void {
    this.audioVideo.setDeviceLabelTrigger(
      async (): Promise<MediaStream> => {
        this.switchToFlow('flow-need-permission');
        const stream = await navigator.mediaDevices.getUserMedia({ audio: true, video: true });
        this.switchToFlow('flow-devices');
        return stream;
      }
    );
  }

  populateDeviceList(
    elementId: string,
    genericName: string,
    devices: MediaDeviceInfo[],
    additionalOptions: string[]
  ): void {
    const list = document.getElementById(elementId) as HTMLSelectElement;
    while (list.firstElementChild) {
      list.removeChild(list.firstElementChild);
    }
    for (let i = 0; i < devices.length; i++) {
      const option = document.createElement('option');
      list.appendChild(option);
      option.text = devices[i].label || `${genericName} ${i + 1}`;
      option.value = devices[i].deviceId;
    }
    if (additionalOptions.length > 0) {
      const separator = document.createElement('option');
      separator.disabled = true;
      separator.text = '──────────';
      list.appendChild(separator);
      for (const additionalOption of additionalOptions) {
        const option = document.createElement('option');
        list.appendChild(option);
        option.text = additionalOption;
        option.value = additionalOption;
      }
    }
    if (!list.firstElementChild) {
      const option = document.createElement('option');
      option.text = 'Device selection unavailable';
      list.appendChild(option);
    }
  }

  populateInMeetingDeviceList(
    elementId: string,
    genericName: string,
    devices: MediaDeviceInfo[],
    additionalOptions: string[],
    callback: (name: string) => void
  ): void {
    const menu = document.getElementById(elementId) as HTMLDivElement;
    while (menu.firstElementChild) {
      menu.removeChild(menu.firstElementChild);
    }
    for (let i = 0; i < devices.length; i++) {
      this.createDropdownMenuItem(menu, devices[i].label || `${genericName} ${i + 1}`, () => {
        callback(devices[i].deviceId);
      });
    }
    if (additionalOptions.length > 0) {
      this.createDropdownMenuItem(menu, '──────────', () => {}).classList.add('text-center');
      for (const additionalOption of additionalOptions) {
        this.createDropdownMenuItem(
          menu,
          additionalOption,
          () => {
            callback(additionalOption);
          },
          `${elementId}-${additionalOption.replace(/\s/g, '-')}`
        );
      }
    }
    if (!menu.firstElementChild) {
      this.createDropdownMenuItem(menu, 'Device selection unavailable', () => {});
    }
  }

  createDropdownMenuItem(
    menu: HTMLDivElement,
    title: string,
    clickHandler: () => void,
    id?: string
  ): HTMLButtonElement {
    const button = document.createElement('button') as HTMLButtonElement;
    menu.appendChild(button);
    button.innerHTML = title;
    button.classList.add('dropdown-item');
    if (id !== undefined) {
      button.id = id;
    }
    button.addEventListener('click', () => {
      clickHandler();
    });
    return button;
  }

  async populateAllDeviceLists(): Promise<void> {
    await this.populateAudioInputList();
    await this.populateVideoInputList();
    await this.populateAudioOutputList();
  }

  async populateAudioInputList(): Promise<void> {
    const genericName = 'Microphone';
    const additionalDevices = ['None', '440 Hz'];
    this.populateDeviceList(
      'audio-input',
      genericName,
      await this.audioVideo.listAudioInputDevices(),
      additionalDevices
    );
  }

  async populateVideoInputList(): Promise<void> {
    const genericName = 'Camera';
    const additionalDevices = ['None', 'Blue', 'SMPTE Color Bars'];
    this.populateDeviceList(
      'video-input',
      genericName,
      await this.audioVideo.listVideoInputDevices(),
      additionalDevices
    );
    const cameras = await this.audioVideo.listVideoInputDevices();
    this.cameraDeviceIds = cameras.map(deviceInfo => {
      return deviceInfo.deviceId;
    });
  }

  async populateAudioOutputList(): Promise<void> {
    const genericName = 'Speaker';
    const additionalDevices: string[] = [];
    this.populateDeviceList(
      'audio-output',
      genericName,
      await this.audioVideo.listAudioOutputDevices(),
      additionalDevices
    );
  }

  private analyserNodeCallback = () => {};

  async openAudioInputFromSelection(): Promise<void> {
    const audioInput = document.getElementById('audio-input') as HTMLSelectElement;
    await this.audioVideo.chooseAudioInputDevice(
      this.audioInputSelectionToDevice(audioInput.value)
    );
    this.startAudioPreview();
  }

  setAudioPreviewPercent(percent: number): void {
    const audioPreview = document.getElementById('audio-preview');
    if (audioPreview.getAttribute('aria-valuenow') !== `${percent}`) {
      audioPreview.style.width = `${percent}%`;
      audioPreview.setAttribute('aria-valuenow', `${percent}`);
    }
    const transitionDuration = '33ms';
    if (audioPreview.style.transitionDuration !== transitionDuration) {
      audioPreview.style.transitionDuration = transitionDuration;
    }
  }

  startAudioPreview(): void {
    this.setAudioPreviewPercent(0);
    const analyserNode = this.audioVideo.createAnalyserNodeForAudioInput();
    if (!analyserNode) {
      return;
    }
    if (!analyserNode.getFloatTimeDomainData) {
      document.getElementById('audio-preview').parentElement.style.visibility = 'hidden';
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

  async openAudioOutputFromSelection(): Promise<void> {
    const audioOutput = document.getElementById('audio-output') as HTMLSelectElement;
    await this.audioVideo.chooseAudioOutputDevice(audioOutput.value);
    const audioMix = document.getElementById('meeting-audio') as HTMLAudioElement;
    await this.audioVideo.bindAudioElement(audioMix);
  }

  // tslint:disable-next-line: member-ordering
  private selectedVideoInput: string | null = null;

  async openVideoInputFromSelection(selection: string | null, showPreview: boolean): Promise<void> {
    if (selection) {
      this.selectedVideoInput = selection;
    }
    this.log(`Switching to: ${this.selectedVideoInput}`);
    const device = this.videoInputSelectionToDevice(this.selectedVideoInput);
    if (device === null) {
      if (showPreview) {
        this.audioVideo.stopVideoPreviewForVideoInput(
          document.getElementById('video-preview') as HTMLVideoElement
        );
      }
      this.audioVideo.stopLocalVideoTile();
      this.toggleButton('button-camera', 'off');
      // choose video input null is redundant since we expect stopLocalVideoTile to clean up
      await this.audioVideo.chooseVideoInputDevice(device);
      throw new Error('no video device selected');
    }
    await this.audioVideo.chooseVideoInputDevice(device);
    if (showPreview) {
      this.audioVideo.startVideoPreviewForVideoInput(
        document.getElementById('video-preview') as HTMLVideoElement
      );
    }
  }

  private audioInputSelectionToDevice(value: string): Device {
    if (value === '440 Hz') {
      return DefaultDeviceController.synthesizeAudioDevice(440);
    } else if (value === 'None') {
      return null;
    }
    return value;
  }

  private videoInputSelectionToDevice(value: string): Device {
    if (value === 'Blue') {
      return DefaultDeviceController.synthesizeVideoDevice('blue');
    } else if (value === 'SMPTE Color Bars') {
      return DefaultDeviceController.synthesizeVideoDevice('smpte');
    } else if (value === 'None') {
      return null;
    }
    return value;
  }

  async authenticate(): Promise<string> {
    const joinInfo = (await this.joinMeeting()).JoinInfo;
    await this.initializeMeetingSession(
      new MeetingSessionConfiguration(joinInfo.Meeting, joinInfo.Attendee)
    );
    const url = new URL(window.location.href);
    url.searchParams.set('m', this.meeting);
    history.replaceState({}, `${this.meeting}`, url.toString());
    return joinInfo.Meeting.MeetingId;
  }

  log(str: string): void {
    console.log(`[DEMO] ${str}`);
  }

  audioVideoDidStartConnecting(reconnecting: boolean): void {
    this.log(`session connecting. reconnecting: ${reconnecting}`);
  }

  audioVideoDidStart(): void {
    this.log('session started');
  }

  audioVideoDidStop(sessionStatus: MeetingSessionStatus): void {
    this.log(`session stopped from ${JSON.stringify(sessionStatus)}`);
    if (sessionStatus.statusCode() === MeetingSessionStatusCode.AudioCallEnded) {
      this.log(`meeting ended`);
      // @ts-ignore
      window.location = window.location.pathname;
    }
  }

  videoTileDidUpdate(tileState: VideoTileState): void {
    this.log(`video tile updated: ${JSON.stringify(tileState, null, '  ')}`);
    const tileIndex = tileState.localTile
      ? 16
      : this.tileOrganizer.acquireTileIndex(tileState.tileId);
    const tileElement = document.getElementById(`tile-${tileIndex}`) as HTMLDivElement;
    const videoElement = document.getElementById(`video-${tileIndex}`) as HTMLVideoElement;
    const nameplateElement = document.getElementById(`nameplate-${tileIndex}`) as HTMLDivElement;
    this.log(`binding video tile ${tileState.tileId} to ${videoElement.id}`);
    this.audioVideo.bindVideoElement(tileState.tileId, videoElement);
    this.tileIndexToTileId[tileIndex] = tileState.tileId;
    this.tileIdToTileIndex[tileState.tileId] = tileIndex;
    new TimeoutScheduler(1600).start(() => {
      const rosterName = this.roster[tileState.boundAttendeeId]
        ? this.roster[tileState.boundAttendeeId].name
        : '';
      if (nameplateElement.innerHTML !== rosterName) {
        nameplateElement.innerHTML = rosterName;
      }
    });
    tileElement.style.display = 'block';
    this.layoutVideoTiles();
  }

  videoTileWasRemoved(tileId: number): void {
    this.log(`video tile removed: ${tileId}`);
    this.hideTile(this.tileOrganizer.releaseTileIndex(tileId));
  }

  videoAvailabilityDidChange(availability: MeetingSessionVideoAvailability): void {
    this.canStartLocalVideo = availability.canStartLocalVideo;
    this.log(`video availability changed: canStartLocalVideo  ${availability.canStartLocalVideo}`);
  }

  hideTile(tileIndex: number): void {
    const tileElement = document.getElementById(`tile-${tileIndex}`) as HTMLDivElement;
    tileElement.style.display = 'none';
    this.layoutVideoTiles();
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
    for (const attendeeId in this.roster) {
      if (this.roster[attendeeId].active) {
        return this.tileIdForAttendeeId(attendeeId);
      }
    }
    return null;
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

  visibleTileIndices(): number[] {
    let tiles: number[] = [];
    const screenViewTileIndex = 17;
    for (let tileIndex = 0; tileIndex <= screenViewTileIndex; tileIndex++) {
      const tileElement = document.getElementById(`tile-${tileIndex}`) as HTMLDivElement;
      if (tileElement.style.display === 'block') {
        if (tileIndex === screenViewTileIndex) {
          // Hide videos when viewing screen
          // for (const tile of tiles) {
          //   const tileToSuppress = document.getElementById(`tile-${tile}`) as HTMLDivElement;
          //   tileToSuppress.style.visibility = 'hidden';
          // }
          tiles = [screenViewTileIndex];
        } else {
          tiles.push(tileIndex);
        }
      }
    }
    return tiles;
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

  updateTilePlacement(tileIndex: number, x: number, y: number, w: number, h: number): void {
    const tile = document.getElementById(`tile-${tileIndex}`) as HTMLDivElement;
    if(tileIndex !== 17)
    {
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
        // video.style.position = 'absolute';
        // video.style.left = '0';
        // video.style.top = '40px';
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
    }
    else
    {
      // tile.style.position = 'absolute';
      // tile.style.right = '0px';
      // tile.style.top = '0px';
      tile.style.width = '700px';
      tile.style.height = '400px';
      tile.style.margin = '0';
      tile.style.padding = '0';
      tile.style.visibility = 'visible';
      tile.style.resize = 'both';
    }
  }

  layoutVideoTilesGrid(visibleTileIndices: number[]): void {
    const tileArea = document.getElementById('tile-area') as HTMLDivElement;
    const width = tileArea.clientWidth;
    const height = tileArea.clientHeight;
    const widthToHeightAspectRatio = 16 / 9;
    let columns = 1;
    let totalHeight = 0;
    let rowHeight = 0;
    // changed columns < 18
    for (; columns < 3; columns++) {
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

  private setupScreenViewing(): void {
    const self = this;
    this.meetingSession.screenShareView.registerObserver({
      streamDidStart(screenMessageDetail: ScreenMessageDetail): void {
        const rosterEntry = self.roster[screenMessageDetail.attendeeId];
        document.getElementById('nameplate-17').innerHTML = rosterEntry ? rosterEntry.name : '';
      },
      streamDidStop(_screenMessageDetail: ScreenMessageDetail): void {
        document.getElementById('nameplate-17').innerHTML = 'No one is sharing screen';
      },
    });
  }

  connectionDidBecomePoor(): void {
    this.log('connection is poor');
  }

  connectionDidSuggestStopVideo(): void {
    this.log('suggest turning the video off');
  }

  videoSendDidBecomeUnavailable(): void {
    this.log('sending video is not available');
  }
}