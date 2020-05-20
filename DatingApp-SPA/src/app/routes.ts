import {Routes} from '@angular/router';
import { HomeComponent } from './home/home.component';
import { MeetingsComponent } from './meetings/meetings.component';
import { AttendeesComponent } from './attendees/attendees.component';

export const appRoutes: Routes = [
    { path: 'home', component: HomeComponent},
    { path: 'meetings', component: MeetingsComponent},
    { path: 'attendees', component: AttendeesComponent},
    { path: '**', redirectTo: 'home', pathMatch: 'full'}
];
