import { app  } from "../../scripts/app.js";

export function create( tag, clss, parent, properties ) {
    const nd = document.createElement(tag);
    if (clss)       clss.split(" ").forEach((s) => nd.classList.add(s))
    if (parent)     parent.appendChild(nd);
    if (properties) Object.assign(nd, properties);
    return nd;
}


const default_audio_folder = 'extensions/cg-image-filter/audio/'
const default_audio_file = 'ding.mp3';

export class AudioHandler {
    constructor() {
        this.audiopath = default_audio_folder + default_audio_file
        this.last_uid  = undefined
        this.next_allowed = Date.now()
    }

    on_message(detail) {
        if (detail.audiopath) this.audiopath = detail.audiopath
        const uid = app.runningNodeId
        if (this.last_uid != uid) {
            this.next_allowed = Date.now()
            this.last_uid = uid
        }

        const ntw = this._need_to_wait()
        this._log(`_request - need to wait ${ntw}`)
        if (ntw <= 0) {
            this._maybe_play_sound()
            this._apply_delay()
        }
    }

    on_execution_ended() { 
        this._log("Clear uid on execution ended")
        this.last_uid  = undefined
    }

    on_activity() { this._apply_delay() }

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

    _apply_delay() { 
        var delay = app.ui.settings.getSettingValue("Image Filter.UI.Sound Timeout")
        if (delay<=0) delay = 9999999
        this.next_allowed = Date.now() + delay*1000
        this._log(`_apply_delay - need to wait ${this._need_to_wait()}`)
    }

    _need_to_wait() {
        return this.next_allowed - Date.now()
    }

}

export const sound_maker = new AudioHandler()

document.addEventListener("click",    ()=>sound_maker.on_activity.bind(sound_maker))
document.addEventListener("keypress", ()=>sound_maker.on_activity.bind(sound_maker))