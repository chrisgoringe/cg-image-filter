import { app, ComfyApp } from "../../scripts/app.js";
import { api } from "../../scripts/api.js";

import { create } from "./utils.js";

const EXTENSION_NODES = ["Image Filter", "Text Image Filter", "Mask Image Filter", "Text Image Filter with Extras",]
const POPUP_NODES = ["Image Filter", "Text Image Filter", "Text Image Filter with Extras",]
const MASK_NODES = ["Mask Image Filter",]

const REQUEST_RESHOW = "-1"
const REQUEST_TIMER_RESET = "-2"
const CANCEL = "-3"

class Log {
    static log(s) {
        console.log(s)
    }
}

class Popup extends HTMLSpanElement {
    constructor() {
        super()
        this.audio = new Audio('extensions/cg-image-filter/ding.mp3');

        this.classList.add('cg_popup')
        
        this.counter            = create('span', 'cg_counter hidden', document.body)
        this.counter_text       = create('span', 'counter_text', this.counter)
        this.counter_reset_button = create('button', 'counter_reset', this.counter, {innerText:"Reset"} )
        this.grid               = create('span', 'grid', this)
        this.overlaygrid        = create('span', 'grid overlaygrid', this)
        this.zoomed             = create('span', 'zoomed', this)
        this.zoomed_image       = create('img', 'zoomed_image', this.zoomed)
        this.text_edit          = create('textarea', 'text_edit', this)
        this.title_bar          = create('span', 'title', this)
        this.buttons            = create('span', 'buttons', this)
        this.checkboxes         = create('span', null, this.buttons)
        this.click_sends        = create('input', 'control', this.checkboxes, {type:"checkbox", id:"click_sends"})
        this.click_sends_label  = create('label', 'control_text', this.checkboxes, {for:"click_sends", innerText:"click to send"})
        this.auto_send          = create('input', 'control', this.checkboxes, {type:"checkbox", id:"auto_send"})
        this.auto_send_label    = create('label', 'control_text', this.checkboxes, {for:"auto_send", innerText:"autosend one if identical"})
        this.send_button        = create('button', 'control', this.buttons, {innerText:"Send"} )
        this.cancel_button      = create('button', 'control', this.buttons, {innerText:"Cancel"} )
        this.extras             = create('span', 'extras', this.buttons)
        this.tip                = create('span', 'tip', this.buttons)

        this.grid.addEventListener('click', this.on_click.bind(this))
        this.send_button.addEventListener(  'click', this.send_current_state.bind(this) )
        this.cancel_button.addEventListener('click', this.send_cancel.bind(this) )
        this.counter_reset_button.addEventListener('click', this.send_reset.bind(this) )

        document.addEventListener("keypress", this.on_key_press.bind(this))

        document.body.appendChild(this)
        this.last_response_sent = 0
        this.close()
    }

    _send_response(msg, no_extras) {
        if (Date.now()-this.last_response_sent < 1000) return 
        const body = new FormData();
        var response = msg
        if (!no_extras) Array.from(this.extras.children).forEach((e)=>{ response = response + "|||" + e.value })
        body.append('response', response);
        api.fetchApi("/cg-image-filter-message", { method: "POST", body, });
        Log.log(`"Sent ${JSON.stringify(response)}`)
        if (!no_extras) this.last_response_sent = Date.now()
        this.close()
    }

    maybe_play_sound() {
        if (app.ui.settings.getSettingValue("ImageFilter.PlaySound")) this.audio.play();
    }
    
    send_current_state() {
        if (this.doing_text) { this._send_response(this.text_edit.value) }
        else                 { this._send_response(Array.from(this.picked).join()) }
    }
    
    send_cancel() { this._send_response(CANCEL, true) }

    send_reset() { 
        this.requested_resend = true
        this.close()
    }

    close() { 
        this.classList.add('hidden') 
        this.counter.classList.add('hidden') 
        this.tip.innerHTML = ""
        this.active = false
        if (document.getElementById('maskEditor')) document.getElementById('maskEditor').style.display = 'none'
        this.n_images = 0
        this.hide_zoom()
    }

    handle_message(message) { 

        if (!message.detail?.tick) {
            this.requested_resend = false
            Log.log(`Got ${JSON.stringify(message.detail)}`)
        }
        if (Date.now()-this.last_response_sent < 1000) {
            Log.log(`Ignoring message because we just responded`)
            return 
        }        
        if (this.handling_message && !detail.timeout) {
            Log.log(`Already handling a message, so dropped message`)
            return
        }
        this.handling_message = true
        try {
            const detail = message.detail
            this.allsame = detail.allsame || false

            if (detail.uid) {
                const node = app.graph._nodes_by_id[detail.uid]
                if (!node) return
                if (!EXTENSION_NODES.includes(node.type)) return
            } else {
                Log.log("Alien message")
            }

            if (detail.timeout)       this.handle_timeout(detail)
            else if (detail.tick)     this.handle_tick(detail)
            else if (detail.maskedit) this.handle_maskedit(detail) 
            else if (detail.urls)     this.handle_urls(detail)

            if (detail.tip) this.handle_tip(detail)
            

        } finally { this.handling_message = false }  
    }

    reshow_window() {
        Log.log('requesting reshow')
        this._send_response(REQUEST_RESHOW, true)
    }

    handle_timeout(detail) { this.close() }

    handle_tip(detail) { this.tip.innerHTML = detail.tip.replace(/(?:\r\n|\r|\n)/g, '<br/>') }

    window_not_showing(uid) {
        const node = app.graph._nodes_by_id[uid]
        return (
            (POPUP_NODES.includes(node.type) && this.classList.contains('hidden')) ||
            (MASK_NODES.includes(node.type) && !document.getElementById('maskEditor')) ||
            (MASK_NODES.includes(node.type) && document.getElementById('maskEditor')?.style.display == 'none') 
        )
    }

    handle_tick(detail) { 
        if (this.window_not_showing(detail.uid)) this.reshow_window()
        this.counter_text.innerText = `${detail.tick} s` 
    }

    handle_maskedit(detail) {
        this.close()
        this.node = app.graph._nodes_by_id[detail.uid]
        this.node.imgs = []
        detail.urls.forEach((url, i)=>{ 
            this.node.imgs.push( new Image() );
            this.node.imgs[i].src = api.apiURL( `/view?filename=${encodeURIComponent(url.filename)}&type=${url.type}&subfolder=${url.subfolder}`) 
        })
        ComfyApp.copyToClipspace(this.node)
        ComfyApp.clipspace_return_node = this.node
        this.maybe_play_sound()
        ComfyApp.open_maskeditor()
        this.counter.classList.remove('hidden')
        setTimeout(this.respond_after_maskeditor.bind(this), 200)
    }

    respond_after_maskeditor() {
        const cancel_button = document.getElementById("maskEditor_topBarCancelButton")
        if (!cancel_button.filter_listener_added) {
            cancel_button.addEventListener('click', (e)=>{ this.send_cancel() })
            cancel_button.filter_listener_added = true
        }

        if (document.getElementById('maskEditor').style.display == 'none' && !this.requested_resend) {
            this._send_response(this.node.imgs[0].src)
        } else {
            setTimeout(this.respond_after_maskeditor.bind(this), 100)
        }
    }

    get_full_url(url) {
        return api.apiURL( `/view?filename=${encodeURIComponent(url.filename ?? v)}&type=${url.type ?? "input"}&subfolder=${url.subfolder ?? ""}`)
    }

    set_text_area_height(h) {
        document.getElementsByClassName('cg_popup')[0].style.setProperty('--text_area_height', `${h}px`)
    }

    handle_urls(detail) {
        this.n_extras = detail.extras ? detail.extras.length : 0
        this.extras.innerHTML = ''
        for (let i=0; i<this.n_extras; i++) {
            const extra = create('input', 'extra', this.extras, {value:detail.extras[i]})
        }

        // do this after the extras are set up so that we send the right extras
        if (this.auto_send.checked && this.allsame) {
            this._send_response("0")
            return
        }

        this.doing_text = (detail.text != null)
        if (this.doing_text && detail.textareaheight) this.set_text_area_height(detail.textareaheight)
        this.text_edit.style.display = (this.doing_text) ? 'block' : 'none'
        this.text_edit.innerHTML = (this.doing_text) ? detail.text : ''
        this.text_edit.value = (this.doing_text) ? detail.text : ''
        this.n_images = detail.urls?.length
    
        this.active = true
        this.laidOut = false
        this.title_bar.innerText = app.graph._nodes_by_id[detail.uid]?.title ?? "Image Filter"
    
        this.picked = new Set()
        if (this.n_images==1) this.picked.add('0')

        this.grid.innerHTML = ''
        this.overlaygrid.innerHTML = ''
        detail.urls.forEach((url, i)=>{
            console.log(url)
            const full_url = this.get_full_url(url)
            const img = create('img', null, this.grid, {src:full_url})
            if (detail.mask_urls) {
                const mask_url = this.get_full_url(detail.mask_urls[i])
                create('img', null, this.overlaygrid, {src:mask_url})
            }
            img.onload = this.layout.bind(this)
            img.clickableImage = i
            img.addEventListener('mouseover', (e)=>this.on_mouse_enter(img))
            img.addEventListener('mouseout', (e)=>this.on_mouse_out(img))
        })
        

        this.layout()
        this.classList.remove('hidden')
        this.counter.classList.remove('hidden')
        this.maybe_play_sound()
    }

    on_mouse_enter(img) {
        this.mouse_is_over = img
        img.classList.add('hover')
    }

    on_mouse_out(img) {
        if (this.zoom_showing) return
        this.mouse_is_over = null
        img.classList.remove('hover')        
    }

    hide_zoom() {
        this.zoomed.style.display = "none"
        this.zoom_showing = null
        this.mouse_is_over = null
    }

    on_key_press(e) {
        if (e.key==' ') {
            if (this.zoom_showing) {
                this.hide_zoom()
            } else if (this.mouse_is_over) {
                this.zoom_showing = this.mouse_is_over
                this.zoomed.style.display = "block"
                this.zoomed_image.src = this.zoom_showing.src
            }
        }
    }

    on_click(e) {
        if (e.target.clickableImage != undefined) {
            const s = `${e.target.clickableImage}`
            if (this.click_sends.checked) {
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
        }) 
        this.send_button.disabled = (!this.doing_text && (this.click_sends.checked || this.picked.size==0))

        this.cancel_button.style.visibility = (this.doing_text) ? 'hidden' : 'visible'

        this.auto_send.style.visibility = (this.n_images>1) ? 'visible' : 'hidden'
        this.auto_send_label.style.visibility = (this.n_images>1) ? 'visible' : 'hidden'

        this.click_sends.style.visibility = (this.doing_text) ? 'hidden' : 'visible'
        this.click_sends_label.style.visibility = (this.doing_text) ? 'hidden' : 'visible'
    }

}

customElements.define('cg-imgae-filter-popup', Popup, {extends: 'span'})

export const popup = new Popup()