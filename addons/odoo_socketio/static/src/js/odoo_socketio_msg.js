/** @odoo-module **/
import { registry } from "@web/core/registry";

export const odooSocketIoUserMessageTest = {
    dependencies: ["socketio_service", "notification"],

    start(env) {
        const self = this;
        const socketio_service = env.services.socketio_service;
        const notification = env.services.notification;

        function onUserTestEvent(msg) {
            notification.add(msg.text, { type: 'info' });
        }

        const eventHandlers = {
            "odoo_user_test_event": onUserTestEvent,
        };

        for (const [eventName, handler] of Object.entries(eventHandlers)) {
            socketio_service.on(eventName, handler.bind(self));
        }

        return {
            destroy() {
                for (const [eventName, handler] of Object.entries(eventHandlers)) {
                    socketio_service.off(eventName, handler.bind(self));
                }
            }
        };
    }
};

registry.category("services").add("odoo_socketio_user_msg_t", odooSocketIoUserMessageTest);