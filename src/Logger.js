import LogLevel from './LogLevel';

function prefix() {
  const dateFormatter = new Intl.DateTimeFormat('en-US', { hour: '2-digit', minute: '2-digit', second: '2-digit', hour12: false });
  const time = dateFormatter.format(new Date());

  return `[fgql][${time}]`;
}

const levels = [LogLevel.Verbose, LogLevel.Debug, LogLevel.Info, LogLevel.Warn, LogLevel.None];

function logMessage(method, message, level, color, fontSize) {
  if (levels.indexOf(level) >= levels.indexOf(Logger.logLevel)) {
      let style = '';
      if (color) style += `color: ${color};`;
      if (fontSize) style += `font-size: ${fontSize};`;

      message = (typeof message === 'function') ? message() : message;

      console[method](`%c ${prefix()} ${message}`, style);
  }
}

const Logger = {
  logLevel: LogLevel.None,

  verbose: function(message) {
    logMessage('log', message, LogLevel.Verbose, 'darkgray');
  },

  debug: function(message) {
    logMessage('log', message, LogLevel.Debug, 'wheat');
  },

  info: function(message) {
    logMessage('log', message, LogLevel.Info, 'cyan');
  },

  warn: function(message) {
    logMessage('log', message, LogLevel.Warn, 'darkorange');
  }
};

export default Logger;
