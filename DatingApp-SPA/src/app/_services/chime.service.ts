import { Injectable } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { environment } from 'src/environments/environment';

@Injectable({
  providedIn: 'root'
})
export class ChimeService {
  baseUrl = environment.apiUrl;

constructor(private http: HttpClient) { }

  createMeeting(mediaRegion: string) {
    return this.http.post(`${this.baseUrl}meeting/createMeeting/${mediaRegion}`, {});
  }

  createAttendee(meetingId: string) {
    return this.http.post(`${this.baseUrl}meeting/createAttendee/${meetingId}`, {});
  }

  joinMeeting(mediaRegion: string, meetingTitle: string) {
    return this.http.post(`${this.baseUrl}meeting/joinMeeting/${mediaRegion}/${meetingTitle}`, {});
  }

  getAttendee(meetingId: string, attendeeId: string, name: string) {
    return this.http.get(`${this.baseUrl}meeting/getAttendee/${meetingId}/${attendeeId}/${name}`);
  }
}
