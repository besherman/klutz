import {provide} from "angular2/core";
import {HTTP_PROVIDERS} from "angular2/http";
import {ROUTER_PROVIDERS, LocationStrategy, HashLocationStrategy} from "angular2/router";
import {bootstrap} from "angular2/platform/browser";

import {ApplicationComponent} from "./components/application";


bootstrap(ApplicationComponent, [
    //ProductService,
    HTTP_PROVIDERS,
    ROUTER_PROVIDERS,
    provide(LocationStrategy, {useClass: HashLocationStrategy})
]);