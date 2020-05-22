import { BrowserModule } from '@angular/platform-browser';
import { NgModule } from '@angular/core';
import { HttpClientModule } from '@angular/common/http';
import { RouterModule } from '@angular/router';
import { FormsModule, ReactiveFormsModule } from '@angular/forms';

import { AppComponent } from './app.component';
import { ValueComponent } from './value/value.component';
import { NavComponent } from './nav/nav.component';
import { HomeComponent } from './home/home.component';
import { MeetingsComponent } from './meetings/meetings.component';
import { AttendeesComponent } from './attendees/attendees.component';
import { appRoutes } from './routes';
import { ChimeService } from './_services/chime.service';

@NgModule({
   declarations: [
      AppComponent,
      ValueComponent,
      NavComponent,
      HomeComponent,
      MeetingsComponent,
      AttendeesComponent
   ],
   imports: [
      BrowserModule,
      HttpClientModule,
      RouterModule.forRoot(appRoutes),
      FormsModule,
      ReactiveFormsModule
   ],
   providers: [
      ChimeService
   ],
   bootstrap: [
      AppComponent
   ]
})
export class AppModule { }
