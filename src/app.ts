import {bootstrap} from 'angular2/platform/browser';
import {HTTP_PROVIDERS} from 'angular2/http';
import {ROUTER_PROVIDERS} from 'angular2/router';

import {ApplicationComponent} from './app/components/application/application';
import {provide} from "angular2/core";
import {Engine} from "./app/chess/engine";

bootstrap(ApplicationComponent, [
    Engine,
    HTTP_PROVIDERS,
    ROUTER_PROVIDERS])
  .catch(err => console.error(err));