import {Component} from "angular2/core";
import {BoardComponent} from "../board/board";

@Component({
    selector: "application",
    directives: [BoardComponent],
    templateUrl: "./app/components/application/application.html",
    styleUrls: ["./app/components/application/application.css"]
})
export class ApplicationComponent {

}