
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

    reset() { 
        this.last_reset = Date.now()
    }

    unreset() {
        this.last_reset = Date.now() - this.millisecs
    }

    request() {
        const elapsed = Date.now()-this.last_reset
        if (Date.now()-this.last_reset > this.millisecs) {
            console.log(`Callback`)
            this.callback()
            this.reset()
        }
    }
}