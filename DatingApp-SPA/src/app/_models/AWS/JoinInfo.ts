import { Attendee } from './Attendee';
import { Meeting } from './Meeting';

export interface JoinInfo {
    Attendee: Attendee,
    Meeting: Meeting,
    Title: string
}