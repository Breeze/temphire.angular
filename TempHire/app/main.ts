import { platformBrowser } from '@angular/platform-browser';

import { AppModuleNgFactory } from '../aot/app/app.module.ngfactory';

import 'lodash';

platformBrowser().bootstrapModuleFactory(AppModuleNgFactory);
