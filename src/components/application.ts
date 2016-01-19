import {Component} from "angular2/core";
import {BoardComponent} from "./board";

@Component({
    selector: "application",
    directives: [BoardComponent],
    templateUrl: "src/components/application.html",
    styleUrls: ["src/components/application.css"]
})
export class ApplicationComponent {

}