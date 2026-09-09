import React from 'react';
import ReactDOM from 'react-dom';
import {Root} from './Root';
import 'moment/locale/de';
import 'moment/locale/en-au';
import 'moment/locale/en-gb';
import * as serviceWorker from './serviceWorker';

ReactDOM.render(<Root />, document.getElementById('root'));

serviceWorker.register();
