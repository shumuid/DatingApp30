import { Attendee } from './Attendee';
import { Meeting } from './Meeting';

export interface JoinInfo {
    attendee: Attendee,
    meeting: Meeting,
    title: string
}