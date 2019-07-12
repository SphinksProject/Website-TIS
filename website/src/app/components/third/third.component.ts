import { Component, OnInit } from '@angular/core';

@Component({
  selector: 'app-third',
  templateUrl: './third.component.html',
  styleUrls: ['./third.component.css']
})
export class ThirdComponent implements OnInit {

  //download = "http://" + location.hostname + ":8080/api/wallet";
  download = "http://sphinks.org:8080/api/wallet";
 
	

  constructor() { }

  ngOnInit() {
  }

}
