import { MediaPlacement } from './MediaPlacement';

export interface Meeting {
    ExternalMeetingId: string;
    MediaPlacement: MediaPlacement;
    MediaRegion: string;
    MeetingId: string;
}
