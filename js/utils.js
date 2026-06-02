import { app  } from "../../scripts/app.js";

export function create( tag, clss, parent, properties ) {
    const nd = document.createElement(tag);
    if (clss)       clss.split(" ").forEach((s) => nd.classList.add(s))
    if (parent)     parent.appendChild(nd);
    if (properties) Object.assign(nd, properties);
    return nd;
}

export class CallbackThrottle {
    constructor(callback, min_period) {
        this.callback = callback
        this.millisecs = min_period*1000
        this.unreset()
    }

    log(m) {
        if ((app.ui.settings.getSettingValue("Image Filter.Z.Detailed Logging"))) console.log(m)
    }

    reset(msg) { 
        this.next_allowed = Date.now() + this.millisecs
        if (msg) this.log(`reset ${msg} - need to wait ${this.need_to_wait()}`)
    }

    unreset(msg) {
        this.next_allowed = Date.now()
        if (msg) this.log(`unreset ${msg} - need to wait ${this.need_to_wait()}`)
    }

    need_to_wait() {
        const ntw = this.next_allowed - Date.now()
        return (ntw>0) ? ntw : 0
    }

    request(msg) {
        if (msg) this.log(`request ${msg} - need to wait ${this.need_to_wait()}`)
        if (this.need_to_wait() <= 0) {
            if (msg) this.log(`Callback ${msg}`)
            this.callback()
            this.reset('after callback')
        }
    }
}