import { MediaPlacement } from './MeetingPlacement';

export interface Meeting {
    externalMeetingId: string;
    mediaPlacement: MediaPlacement;
    mediaRegion: string;
    meetingId: string;
}
