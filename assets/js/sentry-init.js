/*
 * Production browser-error detection for Soul Trip.
 *
 * The released page supplies the public browser ingest DSN in
 * #sentry-sdk[data-dsn]. A missing DSN keeps this fail-safe guard inert.
 * Keep the auth token out of the browser and do not add tracing, replay,
 * breadcrumbs, or user data.
 */
(function () {
  "use strict";

  var sdkScript = document.getElementById("sentry-sdk");
  var dsn = sdkScript && sdkScript.getAttribute("data-dsn");

  if (!dsn || !window.Sentry) return;

  var firstPartyOrigin = window.location.origin;

  function isFirstPartyFrame(filename) {
    if (!filename) return false;

    try {
      return new URL(filename, firstPartyOrigin).origin === firstPartyOrigin;
    } catch (error) {
      return false;
    }
  }

  function redactEvent(event) {
    var values = event.exception && event.exception.values;

    // Error text can contain form values or contact details. Retain only the
    // exception type and a first-party stack so errors can be grouped safely.
    if (Array.isArray(values)) {
      values.forEach(function (exception) {
        exception.value = "Redacted browser exception";
        delete exception.mechanism;

        if (exception.stacktrace && Array.isArray(exception.stacktrace.frames)) {
          exception.stacktrace.frames.forEach(function (frame) {
            if (frame.filename) {
              try {
                frame.filename = new URL(frame.filename, firstPartyOrigin).pathname;
              } catch (error) {
                delete frame.filename;
              }
            }

            delete frame.abs_path;
            delete frame.pre_context;
            delete frame.context_line;
            delete frame.post_context;
            delete frame.vars;
          });
        }
      });
    }

    event.message = "Redacted browser error";
    delete event.request;
    delete event.user;
    delete event.breadcrumbs;
    delete event.contexts;
    delete event.extra;
    delete event.tags;
    delete event.transaction;
    return event;
  }

  window.Sentry.init({
    dsn: dsn,
    environment: "production",
    sendDefaultPii: false,
    tracesSampleRate: 0,
    profilesSampleRate: 0,
    maxBreadcrumbs: 0,
    integrations: function (defaultIntegrations) {
      return defaultIntegrations.filter(function (integration) {
        return integration.name !== "Breadcrumbs" && integration.name !== "BrowserSession";
      });
    },
    beforeBreadcrumb: function () {
      return null;
    },
    beforeSend: function (event) {
      var values = event.exception && event.exception.values;
      var frames = [];

      if (Array.isArray(values)) {
        values.forEach(function (exception) {
          if (exception.stacktrace && Array.isArray(exception.stacktrace.frames)) {
            frames = frames.concat(exception.stacktrace.frames);
          }
        });
      }

      // This site only monitors errors raised by its own JavaScript. Events
      // without a first-party stack, including third-party widget errors, are
      // discarded before any data leaves the browser.
      if (!frames.length || frames.some(function (frame) {
        return !isFirstPartyFrame(frame.filename);
      })) {
        return null;
      }

      return redactEvent(event);
    }
  });
})();
