"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.PrivateChannel = void 0;
var request = require('request');
var url = require('url');
var log_1 = require("./../log");
var database_1 = require("./../database");
var PrivateChannel = (function () {
    function PrivateChannel(options) {
        this.options = options;
        this.request = request;
        this.db = new database_1.Database(options);
    }
    PrivateChannel.prototype.authenticate = function (socket, data) {
        var _this = this;
        var options = {
            url: this.authHost(socket) + this.options.authEndpoint,
            form: {
                channel_name: data.channel,
                properties: data.properties || {},
            },
            headers: (data.auth && data.auth.headers) ? data.auth.headers : {},
            rejectUnauthorized: false
        };
        if (data.properties !== undefined) {
            _this.db.get("private:properties").then(function (properties) {
                var ar = properties || [];
                var member = ar.find(function (property) { return property.key === data.channel; });
                if (member === undefined) {
                    ar.push({
                        key: data.channel,
                        value: data.properties,
                    });
                }
                _this.db.set("private:properties", ar);
            });
        }
        if (this.options.devMode) {
            log_1.Log.info("[".concat(new Date().toISOString(), "] - Sending auth request to: ").concat(options.url, "\n"));
        }
        return this.serverRequest(socket, options);
    };
    PrivateChannel.prototype.authHost = function (socket) {
        var authHosts = (this.options.authHost) ?
            this.options.authHost : this.options.host;
        if (typeof authHosts === "string") {
            authHosts = [authHosts];
        }
        var authHostSelected = authHosts[0] || 'http://localhost';
        if (socket.request.headers.referer) {
            var referer = url.parse(socket.request.headers.referer);
            for (var _i = 0, authHosts_1 = authHosts; _i < authHosts_1.length; _i++) {
                var authHost = authHosts_1[_i];
                authHostSelected = authHost;
                if (this.hasMatchingHost(referer, authHost)) {
                    authHostSelected = "".concat(referer.protocol, "//").concat(referer.host);
                    break;
                }
            }
            ;
        }
        if (this.options.devMode) {
            log_1.Log.error("[".concat(new Date().toISOString(), "] - Preparing authentication request to: ").concat(authHostSelected));
        }
        return authHostSelected;
    };
    PrivateChannel.prototype.hasMatchingHost = function (referer, host) {
        return (referer.hostname && referer.hostname.substr(referer.hostname.indexOf('.')) === host) ||
            "".concat(referer.protocol, "//").concat(referer.host) === host ||
            referer.host === host;
    };
    PrivateChannel.prototype.serverRequest = function (socket, options) {
        var _this = this;
        return new Promise(function (resolve, reject) {
            options.headers = _this.prepareHeaders(socket, options);
            var body;
            _this.request.post(options, function (error, response, body, next) {
                if (error) {
                    if (_this.options.devMode) {
                        log_1.Log.error("[".concat(new Date().toISOString(), "] - Error authenticating ").concat(socket.id, " for ").concat(options.form.channel_name));
                        log_1.Log.error(error);
                    }
                    reject({ reason: 'Error sending authentication request.', status: 0 });
                }
                else if (response.statusCode !== 200) {
                    if (_this.options.devMode) {
                        log_1.Log.warning("[".concat(new Date().toISOString(), "] - ").concat(socket.id, " could not be authenticated to ").concat(options.form.channel_name));
                        log_1.Log.error(response.body);
                    }
                    reject({ reason: 'Client can not be authenticated, got HTTP status ' + response.statusCode, status: response.statusCode });
                }
                else {
                    if (_this.options.devMode) {
                        log_1.Log.info("[".concat(new Date().toISOString(), "] - ").concat(socket.id, " authenticated for: ").concat(options.form.channel_name));
                    }
                    try {
                        body = JSON.parse(response.body);
                    }
                    catch (e) {
                        body = response.body;
                    }
                    resolve(body);
                }
            });
        });
    };
    PrivateChannel.prototype.prepareHeaders = function (socket, options) {
        options.headers['Cookie'] = options.headers['Cookie'] || socket.request.headers.cookie;
        options.headers['X-Requested-With'] = 'XMLHttpRequest';
        return options.headers;
    };
    return PrivateChannel;
}());
exports.PrivateChannel = PrivateChannel;
