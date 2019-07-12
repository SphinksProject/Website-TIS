import { BrowserModule } from '@angular/platform-browser';
import { NgModule } from '@angular/core';

import { AppRoutingModule } from './app-routing.module';
import { AppComponent } from './app.component';
import { FirstComponent } from './components/first/first.component';
import { SecondComponent } from './components/second/second.component';
import { ThirdComponent } from './components/third/third.component';
import { MenuComponent } from './components/menu/menu.component';
import { HomeComponent } from './components/home/home.component';
import { WhitepaperComponent } from './components/whitepaper/whitepaper.component';
import {RouterModule} from '@angular/router';
import { SocialComponent } from './components/social/social.component';
import { FaqComponent } from './components/faq/faq.component';

const routes = [
  {path: '', component: HomeComponent},
  {path: 'whitepaper', component: WhitepaperComponent},
  {path: 'faq', component: FaqComponent}
]

@NgModule({
  declarations: [
    AppComponent,
    FirstComponent,
    SecondComponent,
    ThirdComponent,
    MenuComponent,
    HomeComponent,
    WhitepaperComponent,
    SocialComponent,
    FaqComponent
  ],
  imports: [
    BrowserModule,
    AppRoutingModule,
    RouterModule.forRoot(routes)
  ],
  providers: [],
  bootstrap: [AppComponent]
})
export class AppModule { }
