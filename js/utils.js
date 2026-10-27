import { app  } from "../../scripts/app.js";

export function create( tag, clss, parent, properties ) {
    const nd = document.createElement(tag);
    if (clss)       clss.split(" ").forEach((s) => nd.classList.add(s))
    if (parent)     parent.appendChild(nd);
    if (properties) Object.assign(nd, properties);
    return nd;
}

export function running_nodes2() {
    return app.ui.settings.getSettingValue('Comfy.VueNodes.Enabled')
}

/** @param {node_object} node
*/
export function supress_preview_image(node) {
    if (!app.ui.settings.getSettingValue("Image Filter.UI.Supress Preview")) return
    if (running_nodes2()) remove_preview_nodes2(node)
    else remove_preview_nodes1(node)
    node.imgs = []
}

// probably works for Nodes 1
function remove_preview_nodes1(node, previous_tries=0, delay=50) {
    const w = node?.widgets?.find((w)=>{return w.name=='$$canvas-image-preview'})
    if (w && !w.hidden) {
        w.hidden = true
        node.setSize( [node.size[0], node.computeSize()[1]] )
        app.canvas.setDirty(true,true)
        console.log(`Removed preview from node ${node.id} after ${previous_tries} tries`)
    } else {
        if (previous_tries<6) setTimeout(remove_preview, delay, node, previous_tries+1, delay*2)
    }
}

function remove_preview_nodes2(node) {
    if (node.imgs) {
        const el = document.querySelector(`[data-node-id="${node.id}"]`)?.querySelector(`.image-preview`)
        if (el) {
            el.style.display = "none"
            el.style.height = "0px"
        } else {
            console.log(`Couldn't find an image element on ${node.id}`)
        } 
    }
    node.setSize(node.computeSize())
    app.graph.setDirtyCanvas(true, true)
}


const default_audio_folder = 'extensions/cg-image-filter/audio/'
const default_audio_file = 'ding.mp3';

export class AudioHandler {

    constructor() {
        this.audiopath = default_audio_folder + default_audio_file
        this.last_uid_to_ping  = undefined
        this.next_ping_allowed = Date.now()
        this.executing_uid = undefined
    }

    on_message(detail) {
        if (detail.audiopath) this.audiopath = detail.audiopath
        if (this.last_uid_to_ping != this.executing_uid) {
            this._log(`uid was ${this.last_uid_to_ping}, now ${this.executing_uid}`)
            this.next_ping_allowed = Date.now()
            this.last_uid_to_ping = this.executing_uid
        }

        const ntw = this._need_to_wait()
        //this._log(`_request - need to wait ${ntw}`)
        if (ntw <= 0) {
            this._maybe_play_sound()
            this._apply_delay(true)
        }
    }

    on_execution_start() { 
        this._log("Clear uid on execution ended")
        this.last_uid_to_ping = undefined
    }

    on_executing(e) { 
        this.executing_uid = e.detail 
        this._log(`on_executing ${this.executing_uid}`)
    }

    on_activity() { this._apply_delay(false) }

    async _maybe_play_sound() { 
        if (app.ui.settings.getSettingValue("Image Filter.UI.Play Sound")) {
            await this._try_to_play_sound(this.audiopath) || 
            await this._try_to_play_sound(default_audio_folder + this.audiopath) ||
            await this._try_to_play_sound(default_audio_folder + default_audio_file)
        }
    }

    async _try_to_play_sound(path) {
        if (!path) return false
        try {
            const resp = await fetch(path);
            if (!resp.ok) return false
            const blob = await resp.blob();
            const blobUrl = URL.createObjectURL(new Blob([blob], { type: 'audio/mpeg' }));
            const audio = new Audio(blobUrl);
            await audio.play();
            this.audiopath = path
            return true
        } catch (e) {
            return false
        }
    }

    _log(m) {
        if ((app.ui.settings.getSettingValue("Image Filter.Z.Detailed Logging"))) console.log(m)
    }

    _apply_delay(loggit) { 
        var delay = app.ui.settings.getSettingValue("Image Filter.UI.Sound Timeout")
        if (delay<=0) delay = 9999999
        this.next_ping_allowed = Date.now() + delay*1000
        if (loggit) this._log(`_apply_delay`)
    }

    _need_to_wait() {
        return this.next_ping_allowed - Date.now()
    }

}

export const sound_maker = new AudioHandler()

document.addEventListener("click",    sound_maker.on_activity.bind(sound_maker))
document.addEventListener("keypress", sound_maker.on_activity.bind(sound_maker))