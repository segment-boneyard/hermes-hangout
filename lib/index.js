
/**
 * Module dependencies.
 */

var googleapis = require('googleapis');
var format = require('util').format;
var assert = require('assert');
var debug = require('debug')('hangouts');

/**
 * Expose `plugin`.
 *
 * @see https://github.com/hubot-scripts/hubot-google-hangouts
 */

module.exports = plugin;

/**
 * Create a google hangout.
 *
 * @param {Object} opts
 *   @property {String} key Calendar client id
 *   @property {String} secret Calendar secret
 *   @property {String} token Calendar refresh token
 *   @property {String} [id] Calendar id
 *   @property {String} [redirect] Calendar redirect uri
 *   @property {String} [duration] How long the calendar event will last (in ms)
 * @return {Function}
 */

function plugin(opts) {
  var opts = opts || {};
  opts.id = opts.id || 'primary';
  opts.redirect = opts.redirect || 'https://google-oauth2.herokuapp.com/oauth2fn';
  opts.duration = opts.duration || (1000 * 60 * 60) * 3; // hours

  // assert

  assert(opts.key, "Calendar client `id` is missing");
  assert(opts.secret, "Calendar client `secret` is missing.");
  assert(opts.refresh, "Calendar refresh token (`refresh`) is missing");

  return function(robot){
    robot.help('hangout me <title>', 'create a google calendar event named <title>');

    load(opts, function(err, client){
      if (err) return;

      robot.on('mention', /^hangout( me)?\s*(.+)?/, function(res){
        var summary = res[2] || 'Hangout';
        var description = format('Requested by %s', res.user.name);

        create(client, summary, description, opts, function(err, event){
          if (err) return res.error("I'm sorry. Something went wrong and I wasn't able to create a hangout :(");

          var msg = [
            "I've started a hangout titled '%s'",
            "Primary account: %s",
            "Secondary account: %s?authuser=1"
          ].join('\n');

          res.say(format(msg, summary, event.hangoutLink, event.hangoutLink));
        });
      });
    });
  };
}

/**
 * Create a google calendar event.
 *
 * @param {Object} client Google api client
 * @param {String} summary
 * @param {String} description
 * @param {Function} fn callback
 */

function create(client, summary, description, opts, fn) {
  var query = { calendarId: opts.id };
  var data = {
    summary: "Google Hangout: " + summary,
    description: description,
    reminders: {
      overrides: {
        method: 'popup',
        minutes: 0
      }
    },
    start: {
      dateTime: new Date().toISOString()
    },
    end: {
      dateTime: new Date(+new Date() + opts.duration).toISOString()
    }
  };

  var req = client.calendar.events.insert(query, data);

  req.withAuthClient(client.authClient).execute(fn);
}

/**
 * Lazy-load the google client.
 *
 * @param {Object} opts
 * @param {Function} fn
 */

function load(opts, fn) {
  googleapis.discover('calendar', 'v3').execute(function(err, client){
    if (err) {
      debug("Error connecting to google calendar");
      fn(err);
    } else {
      var authClient = new googleapis.OAuth2Client(
        opts.key,
        opts.secret,
        opts.redirect
      );

      authClient.credentials = { refresh_token: opts.refresh };
      client.authClient = authClient;

      fn(null, client);
    }
  });
}