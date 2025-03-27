import { app, ComfyApp } from "../../scripts/app.js";
import { api } from "../../scripts/api.js";

import { create } from "./utils.js";

const EXTENSION_NODES = ["Image Filter", "Text Image Filter", "Mask Image Filter", "Text Image Filter with Extras",]
const POPUP_NODES = ["Image Filter", "Text Image Filter", "Text Image Filter with Extras",]
const MASK_NODES = ["Mask Image Filter",]

const REQUEST_RESHOW = "-1"
const CANCEL = "-3"

class Log {
    static log(s) { if (s) console.log(s) }
    static error(e) { console.error(e) }
    static message_in(message, extra) {
        if (message.detail && !message.detail.tick) Log.log(`--> ${JSON.stringify(message.detail)}` + (extra ? ` ${extra}` : ""))
    }
    static message_out(response, extra) {
        Log.log(`"<-- ${JSON.stringify(response)}` + (extra ? ` ${extra}` : ""))
    }
}

function get_full_url(url) {
    return api.apiURL( `/view?filename=${encodeURIComponent(url.filename ?? v)}&type=${url.type ?? "input"}&subfolder=${url.subfolder ?? ""}&r=${Math.random()}`)
}

class State {
    static INACTIVE = 0
    static TINY = 1
    static MASK = 2
    static FILTER = 3
    static TEXT = 4
    static ZOOMED = 5

    static visible(item, value) {
        if (value) item.classList.remove('hidden')
        else item.classList.add('hidden')
    }

    static render(popup) {
        const state = popup.state
        State.visible(popup, (state==State.FILTER || state==State.TEXT || state==State.ZOOMED))
        State.visible(popup.tiny_window, state==State.TINY)
        State.visible(popup.counter, (state==State.FILTER || state==State.ZOOMED || state==State.TEXT || state==State.MASK))
        State.visible(popup.zoomed, state==State.ZOOMED)
        State.visible(popup.text_edit, state==State.TEXT)
        State.visible(popup.send_button, true /*!app.ui.settings.getSettingValue("ImageFilter.ClickSends")*/)

        if (document.getElementById('maskEditor') && state!=State.MASK) {
            document.getElementById('maskEditor').style.display = 'none'
        }
    }
}

class Popup extends HTMLSpanElement {
    constructor() {
        super()
        this.audio = new Audio('extensions/cg-image-filter/ding.mp3');

        this.classList.add('cg_popup')
        
        this.grid               = create('span', 'grid', this)
        this.overlaygrid        = create('span', 'grid overlaygrid', this)
        this.zoomed             = create('span', 'zoomed', this)
        this.zoomed_image       = create('img', 'zoomed_image', this.zoomed)
        this.text_edit          = create('textarea', 'text_edit', this)
        this.title_bar          = create('span', 'title', this)
        this.buttons            = create('span', 'buttons', this)
        this.checkboxes         = create('span', null, this.buttons)

        this.send_button        = create('button', 'control', this.buttons, {innerText:"Send"} )
        this.cancel_button      = create('button', 'control', this.buttons, {innerText:"Cancel"} )
        this.extras             = create('span', 'extras', this.buttons)
        this.tip                = create('span', 'tip', this.buttons)

        this.tiny_window        = create('span', 'tiny_window hidden', document.body)
        this.tiny_image         = create('img', 'tiny_image', this.tiny_window)
        this.tiny_window.addEventListener('click', this.handle_deferred_message.bind(this))

        this.counter            = create('span', 'cg_counter hidden', document.body)
        this.counter_text       = create('span', 'counter_text', this.counter)
        this.counter_reset_button = create('button', 'counter_reset', this.counter, {innerText:"Reset"} )

        this.grid.addEventListener('click', this.on_click.bind(this))
        this.send_button.addEventListener(  'click', this.send_current_state.bind(this) )
        this.cancel_button.addEventListener('click', this.send_cancel.bind(this) )
        this.counter_reset_button.addEventListener('click', this.request_reset.bind(this) )

        document.addEventListener("keypress", this.on_key_press.bind(this))

        document.body.appendChild(this)
        this.last_response_sent = 0
        this.state = State.INACTIVE
        State.render(this)
    }

    _send_response(msg, special_message, keep_open) {
        if (Date.now()-this.last_response_sent < 1000) Log.message_out(response, "(throttled)")

        if (!special_message) {
            Array.from(this.extras.children).forEach((e)=>{ msg = msg + "|||" + e.value })
            this.last_response_sent = Date.now()
        }

        try {
            const body = new FormData();
            body.append('response', msg);
            api.fetchApi("/cg-image-filter-message", { method: "POST", body, });
            Log.message_out(msg)
        } catch (e) { Log.error(e) }
        finally { if (!keep_open) this.close() }

    }

    send_current_state() { this._send_response( (this.state == State.TEXT) ? this.text_edit.value : Array.from(this.picked).join() ) }
    
    send_cancel() { this._send_response(CANCEL, true) }

    request_reset() { this._send_response(REQUEST_RESHOW, true, true) }

    close() { 
        this.state = State.INACTIVE
        State.render(this)
    }

    maybe_play_sound() { if (app.ui.settings.getSettingValue("ImageFilter.PlaySound")) this.audio.play(); }

    handle_message(message) { 
        Log.message_in(message)
        Log.log( this._handle_message(message, false) )
        State.render(this)
    }

    handle_deferred_message(e) {
        Log.message_in(this.saved_message, "(deferred)")
        Log.log( this._handle_message(this.saved_message, true) )
        State.render(this)
    }

    autosend() {
        return (app.ui.settings.getSettingValue("ImageFilter.AutosendIdentical") && this.allsame)
    }

    _handle_message(message, use_saved) {

        this.allsame = message.detail.allsame || false

        if (this.state==State.INACTIVE && message.detail.urls && app.ui.settings.getSettingValue("ImageFilter.SmallWindow") && !use_saved && !this.autosend()) {
            this.state = State.TINY
            this.saved_message = message
            this.tiny_image.src = get_full_url(message.detail.urls[message.detail.urls.length-1])
            this.maybe_play_sound()
            return `Deferring message and showing small window`
        }
        
        //if ((Date.now()-this.last_response_sent < 500)) return `Ignoring message because we just responded`
        if (this.handling_message && !detail.timeout) return `Ignoring message because we're already handling a message`
        this.handling_message = true

        try {
            const detail = message.detail

            if (detail.uid) {
                const node = app.graph._nodes_by_id[detail.uid]
                if (!node) return `Node ${detail.uid} not found`
                if (!EXTENSION_NODES.includes(node.type)) return `Node ${detail.uid} is not an image filter node`
            } else {
                return `No uid in message`
            }

            if (detail.tick) {
                this.counter_text.innerText = `${detail.tick}s`
                return
            }

            if (detail.timeout) {
                this.close()
                return `Timeout`
            }

            
            if (!use_saved && !this.autosend()) this.maybe_play_sound()

            if (detail.maskedit)   this.handle_maskedit(detail) 
            else if (detail.urls)  this.handle_urls(detail)

            if (detail.tip) this.tip.innerHTML = detail.tip.replace(/(?:\r\n|\r|\n)/g, '<br/>')
            else this.tip.innerHTML = ""
            
        } finally { this.handling_message = false }  
    }

    mask_editor_showing() {
        return document.getElementById('maskEditor')?.style.display != 'none'
    }

    window_not_showing(uid) {
        const node = app.graph._nodes_by_id[uid]
        return (
            (POPUP_NODES.includes(node.type) && this.classList.contains('hidden')) ||
            (MASK_NODES.includes(node.type) && !document.getElementById('maskEditor')) ||
            (MASK_NODES.includes(node.type) && document.getElementById('maskEditor')?.style.display == 'none') 
        )
    }

    handle_maskedit(detail) {
        this.state = State.MASK

        this.node = app.graph._nodes_by_id[detail.uid]
        this.node.imgs = []
        detail.urls.forEach((url, i)=>{ 
            this.node.imgs.push( new Image() );
            this.node.imgs[i].src = api.apiURL( `/view?filename=${encodeURIComponent(url.filename)}&type=${url.type}&subfolder=${url.subfolder}`) 
        })
        ComfyApp.copyToClipspace(this.node)
        ComfyApp.clipspace_return_node = this.node
        ComfyApp.open_maskeditor()

        setTimeout(this.wait_while_mask_editing.bind(this), 200)
    }

    wait_while_mask_editing() {
        const cancel_button = document.getElementById("maskEditor_topBarCancelButton")
        if (cancel_button && !cancel_button.filter_listener_added) {
            cancel_button.addEventListener('click', (e)=>{ this.send_cancel() })
            cancel_button.filter_listener_added = true
        }

        if (document.getElementById('maskEditor').style.display == 'none') {
            this._send_response(this.node.imgs[0].src)
        } else {
            setTimeout(this.wait_while_mask_editing.bind(this), 100)
        }
    }

    handle_urls(detail) {
        this.n_extras = detail.extras ? detail.extras.length : 0
        this.extras.innerHTML = ''
        for (let i=0; i<this.n_extras; i++) { create('input', 'extra', this.extras, {value:detail.extras[i]}) }

        // do this after the extras are set up so that we send the right extras
        if (this.autosend()) {
            this._send_response("0")
            return
        }

        if (detail.text != null) {
            this.state = State.TEXT
            //this.text_edit.innerHTML = detail.text
            this.text_edit.value = detail.text
            if (detail.textareaheight) document.getElementsByClassName('cg_popup')[0].style.setProperty('--text_area_height', `${detail.textareaheight}px`)
        } else {
            this.state = State.FILTER
        }

        this.n_images = detail.urls?.length    
        this.laidOut = false
        this.title_bar.innerText = app.graph._nodes_by_id[detail.uid]?.title ?? "Image Filter"
    
        this.picked = new Set()
        if (this.n_images==1) this.picked.add('0')

        this.grid.innerHTML = ''
        this.overlaygrid.innerHTML = ''
        detail.urls.forEach((url, i)=>{
            console.log(url)
            const img = create('img', null, this.grid, {src:get_full_url(url)})
            if (detail.mask_urls) { create('img', null, this.overlaygrid, {src:get_full_url(detail.mask_urls[i])})}
            img.onload = this.layout.bind(this)
            img.image_index = i
            img.addEventListener('mouseover', (e)=>this.on_mouse_enter(img))
            img.addEventListener('mouseout', (e)=>this.on_mouse_out(img))
        })

        this.layout()
        
    }

    on_mouse_enter(img) {
        this.mouse_is_over = img
        this.redraw()
    }

    on_mouse_out(img) {
        this.mouse_is_over = null
        this.redraw()       
    }

    on_key_press(e) {
        if (e.key==' ') {
            if (this.state==State.ZOOMED) {
                this.state = State.FILTER
            } else if (this.mouse_is_over) {
                this.state = State.ZOOMED
                this.zoomed_image.src = this.mouse_is_over.src
                this.on_mouse_out(this.mouse_is_over)
            }
            State.render(this)
        }
    }

    on_click(e) {
        if (e.target.image_index != undefined) {
            const s = `${e.target.image_index}`
            if (app.ui.settings.getSettingValue("ImageFilter.ClickSends")) {
                this._send_response(s)
            } else {
                if (this.picked.has(s)) this.picked.delete(s)
                else this.picked.add(s)
                this.redraw()
            }
        }
    }

    layout() {
        if (this.laidOut) return

        const im_w = this.grid.firstChild.naturalWidth
        const im_h = this.grid.firstChild.naturalHeight
        const box = this.grid.getBoundingClientRect()
        var per_row
        if (!im_w || !im_h || !box.width || !box.height) {
            setTimeout(this.layout.bind(this), 100)
            return
        } else {
            var best_scale = 0
            var best_pick
            for (per_row=1; per_row<=this.n_images; per_row++) {
                const rows = Math.ceil(this.n_images/per_row)
                const scale = Math.min( box.width/(im_w*per_row), box.height/(im_h*rows) )
                if (scale>best_scale) {
                    best_scale = scale
                    best_pick = per_row
                }
            }
            per_row = best_pick
            this.laidOut = true
        }

        const rows = Math.ceil(this.n_images/per_row)    
        Array.from(this.grid.children).forEach((c,i)=>{
            c.style.gridArea = `${Math.floor(i/per_row) + 1} / ${i%per_row + 1} /  auto / auto`; 
            c.style.maxHeight = `${box.height / rows}px`
            c.style.maxWidth = `${box.width / per_row}px`
        })
        Array.from(this.overlaygrid.children).forEach((c,i)=>{
            c.style.gridArea = `${Math.floor(i/per_row) + 1} / ${i%per_row + 1} /  auto / auto`; 
            c.style.maxHeight = `${box.height / rows}px`
            c.style.maxWidth = `${box.width / per_row}px`
        })

        this.redraw()
    }

    redraw() {
        Array.from(this.grid.children).forEach((c,i)=>{
            if (this.picked.has(`${i}`)) c.classList.add('selected')
            else c.classList.remove('selected')

            if (c == this.mouse_is_over) c.classList.add('hover')
            else c.classList.remove('hover')
        }) 
    }

}

customElements.define('cg-imgae-filter-popup', Popup, {extends: 'span'})

export const popup = new Popup()