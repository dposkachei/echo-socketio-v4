"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.HttpApi = void 0;
var log_1 = require("./../log");
var database_1 = require("./../database");
var url = require('url');
var _ = require("lodash");
var HttpApi = (function () {
    function HttpApi(io, channel, express, options, dbOptions) {
        this.io = io;
        this.channel = channel;
        this.express = express;
        this.options = options;
        this.db = null;
        if (dbOptions !== undefined) {
            this.db = new database_1.Database(dbOptions);
        }
    }
    HttpApi.prototype.init = function () {
        var _this = this;
        this.corsMiddleware();
        this.express.get('/', function (req, res) { return _this.getRoot(req, res); });
        this.express.get('/apps/:appId/status', function (req, res) { return _this.getStatus(req, res); });
        this.express.get('/apps/:appId/channels', function (req, res) { return _this.getChannels(req, res); });
        this.express.get('/apps/:appId/channels/:channelName', function (req, res) { return _this.getChannel(req, res); });
        this.express.get('/apps/:appId/channels/:channelName/users', function (req, res) { return _this.getChannelUsers(req, res); });
    };
    HttpApi.prototype.corsMiddleware = function () {
        var _this = this;
        if (this.options.allowCors) {
            this.express.use(function (req, res, next) {
                res.header('Access-Control-Allow-Origin', _this.options.allowOrigin);
                res.header('Access-Control-Allow-Methods', _this.options.allowMethods);
                res.header('Access-Control-Allow-Headers', _this.options.allowHeaders);
                next();
            });
        }
    };
    HttpApi.prototype.getRoot = function (req, res) {
        res.send('OK');
    };
    HttpApi.prototype.getStatus = function (req, res) {
        res.json({
            subscription_count: this.io.engine.clientsCount,
            uptime: process.uptime(),
            memory_usage: process.memoryUsage(),
        });
    };
    HttpApi.prototype.getChannels = function (req, res) {
        var _this = this;
        var prefix = url.parse(req.url, true).query.filter_by_prefix;
        var rooms = this.io.sockets.adapter.rooms;

        var channels = {};
        rooms.forEach(function (channelName, key) {
            if (prefix && !key.startsWith(prefix)) {
                return;
            }
            channels[key] = {
                subscription_count: rooms.get(key).size,
                occupied: true,
                version: null,
            };

        });
        _this.db.get("private:versions").then(function (versions) {
            console.log(versions);
            var ar = {};
            versions.forEach(function (version) {
                ar[version.key] = version.value;
            });
            Object.keys(channels).forEach(function (key) {
                if (ar[key] !== undefined) {
                    channels[key].version = ar[key];
                }
            });
            res.json({ channels: channels });
        });

    };
    HttpApi.prototype.getChannel = function (req, res) {
        var channelName = req.params.channelName;
        var room = this.io.sockets.adapter.rooms.get(channelName);
        var subscriptionCount = room ? room.size : 0;
        var result = {
            subscription_count: subscriptionCount,
            occupied: !!subscriptionCount
        };
        if (this.channel.isPresence(channelName)) {
            this.channel.presence.getMembers(channelName).then(function (members) {
                result['user_count'] = _.uniqBy(members, 'user_id').length;
                res.json(result);
            });
        }
        else {
            res.json(result);
        }
    };
    HttpApi.prototype.getChannelUsers = function (req, res) {
        var channelName = req.params.channelName;
        if (!this.channel.isPresence(channelName)) {
            return this.badResponse(req, res, 'User list is only possible for Presence Channels');
        }
        this.channel.presence.getMembers(channelName).then(function (members) {
            var users = [];
            _.uniqBy(members, 'user_id').forEach(function (member) {
                users.push({ id: member.user_id, user_info: member.user_info });
            });
            res.json({ users: users });
        }, function (error) { return log_1.Log.error(error); });
    };
    HttpApi.prototype.badResponse = function (req, res, message) {
        res.statusCode = 400;
        res.json({ error: message });
        return false;
    };
    return HttpApi;
}());
exports.HttpApi = HttpApi;
