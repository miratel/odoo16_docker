/** @odoo-module **/
//odoo.define('odoo_socketio.socketio_service', function (require) {
"use strict";

const { registry } = require("@web/core/registry");
const rpc = require("web.rpc");
const { EventBus } = require("@odoo/owl");
const session = require("web.session");

class SocketIoClient {
    constructor(env) {
        this.env = env;
        this.socketio = null;
        this.hostUrl = null;
        this.uid = null;
        this.bus = new EventBus();
        this.isConnected = false;
        this.wait_ons = [];
        this.room = "odoo_browser_room";
    }

    async _start() {
        try {
            const port = await rpc.query({
                model: "odoo.socketio",
                method: "get_socketio_port",
                args: [],
                kwargs: {}
            });
            // if (!port || typeof io === 'undefined') return;
            // this.hostUrl = window.location.hostname + ':' + port;
            this.hostUrl = '10.1.1.103:3001'
            // this.hostUrl = port;
            this.uid = session.user_id;
            this.socketio = io(this.hostUrl, {
                rememberUpgrade: true,
                transports: ['websocket', 'long-polling'],
                upgrade: true,
                query: { uid: this.uid, room: this.room }
            });
            this._registerSocketIOEvents();
            this._processWaitOns();
        } catch (error) {
            console.error("Failed to initialize Socket.IO service:", error);
        }
    }
    _registerSocketIOEvents() {
        if (!this.socketio) return;

        this.socketio.on('connect', () => {
            this.isConnected = true;
            console.log(`Successfully Connected To The SocketIo Service：${this.hostUrl}`);
            this.bus.trigger('odoo_socketio_connect');
            this._processWaitOns();
        });

        this.socketio.on('disconnect', () => {
            this.isConnected = false;
            console.log(`Communication With SocketIo Has Been Disconnect: ${this.hostUrl}`);
            this.bus.trigger('odoo_socketio_disconnect');
        });

        this.socketio.on('connect_error', (error) => {
            this.bus.trigger('odoo_socketio_connect_error', error);
        });

        this.socketio.on('odoo_server_event', (msg) => {
            this.bus.trigger('odoo_server_event', msg);
        });
    }
    _processWaitOns() {
        if (this.socketio && this.isConnected) {
            while (this.wait_ons.length > 0) {
                const [eventName, callback, once] = this.wait_ons.shift();
                if (once) {
                    this.socketio.once(eventName, callback);
                } else {
                    this.socketio.on(eventName, callback);
                }
            }
        }
    }
    on(eventName, callback, once = false) {
        if (this.socketio && this.isConnected) {
            if (once) {
                this.socketio.once(eventName, callback);
            } else {
                this.socketio.on(eventName, callback);
            }
        } else {
            this.wait_ons.push([eventName, callback, once]);
        }
    }

    off(eventName, callback) {
        if (this.socketio) {
            this.socketio.off(eventName, callback);
        } else {
            this.wait_ons = this.wait_ons.filter(([name, cb, once]) => !(name === eventName && cb === callback));
        }
    }

    emit(eventName, data) {
        if (this.socketio && this.isConnected) {
            this.socketio.emit(eventName, data);
        } else {
            console.warn("Socket.IO is not connected. Cannot emit event:", eventName);
        }
    }

    _stop() {
        if (this.socketio) {
            this.socketio.disconnect();
            this.socketio = null;
        }
        this.wait_ons = [];
        this.bus.destroy();
    }

    onServiceEvent(eventName, callback) {
        this.bus.on(eventName, this, callback);
    }

    offServiceEvent(eventName, callback) {
        this.bus.off(eventName, this, callback);
    }



}

const socketIOService = {
    dependencies: [],

    start(env) {
        const socketioClient = new SocketIoClient(env);
        socketioClient._start().then();

        return {
            on: socketioClient.on.bind(socketioClient),
            off: socketioClient.off.bind(socketioClient),
            emit: socketioClient.emit.bind(socketioClient),
            onServiceEvent: socketioClient.onServiceEvent.bind(socketioClient),
            offServiceEvent: socketioClient.offServiceEvent.bind(socketioClient),
            getIsConnected: () => socketioClient.isConnected,
        };
    },

    stop(env, socketioClient) {
        if (socketioClient && socketioClient._stop) {
            socketioClient._stop();
        }
    }
};

registry.category("services").add("socketio_service", socketIOService);
//});