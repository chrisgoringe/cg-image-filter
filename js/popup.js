import { app, ComfyApp } from "../../scripts/app.js";
import { api } from "../../scripts/api.js";

import { create } from "./utils.js";

class Popup extends HTMLSpanElement {
    constructor() {
        super()
        this.audio = new Audio('extensions/cg-image-filter/ding.mp3');

        this.classList.add('cg_popup')
        
        this.counter            = create('span', 'cg_counter hidden', document.body)
        this.grid               = create('span', 'grid', this)
        this.text_edit          = create()
        this.title_bar          = create('span', 'title', this)
        this.buttons            = create('span', 'buttons', this)
        this.checkboxes         = create('span', null, this.buttons)
        this.click_sends        = create('input', 'control', this.checkboxes, {type:"checkbox", id:"click_sends"})
        this.click_sends_label  = create('label', 'control_text', this.checkboxes, {for:"click_sends", innerText:"click to send"})
        this.auto_send          = create('input', 'control', this.checkboxes, {type:"checkbox", id:"auto_send"})
        this.auto_sends_label   = create('label', 'control_text', this.checkboxes, {for:"auto_send", innerText:"auto send if identical"})
        this.play_sound         = create('input', 'control', this.checkboxes, {type:"checkbox", id:"play_sound"})
        this.play_sound_label   = create('label', 'control_text', this.checkboxes, {for:"play_sound", innerText:"play sound"})
        this.send_button        = create('button', 'control', this.buttons, {innerText:"Send (S)"} )
        this.cancel_button      = create('button', 'control', this.buttons, {innerText:"Cancel (X)"} )
        this.extras             = create('span', 'extras', this.buttons)
    
        this.send_button.addEventListener(  'click', this.send_current_state.bind(this) )
        this.cancel_button.addEventListener('click', this.send_cancel.bind(this) )

        document.addEventListener('keydown', (e)=>{ this.on_keydown(e) })
        document.body.appendChild(this)
        this.close()
    }

    _send_response(msg) {
        const body = new FormData();
        var response = msg
        Array.from(this.extras.children).forEach((e)=>{ response = response + "|||" + e.value })
        body.append('response', response);
        api.fetchApi("/cg-image-filter-message", { method: "POST", body, });
        this.close()
    }

    maybe_play_sound() {
        if (this.play_sound.checked) this.audio.play();
    }
    
    send_current_state() {
        if (this.doing_text) { this._send_response(this.text_edit.value) }
        else                 { this._send_response(Array.from(this.picked).join()) }
    }
    
    send_cancel() { this._send_response('') }

    close() { 
        this.classList.add('hidden') 
        this.counter.classList.add('hidden') 
        this.active = false
        if (document.getElementById('maskEditor')) document.getElementById('maskEditor').style.display = 'none'
    }

    handle_message(message) { 
        const detail = message.detail
        if (detail.timeout)       this.handle_timeout(detail)
        else if (detail.tick)     this.handle_tick(detail)
        else if (detail.maskedit) this.handle_maskedit(detail) 
        else if (detail.urls)     this.handle_urls(detail)
    }

    handle_timeout(detail) { this.close() }

    handle_tick(detail) { this.counter.innerText = `${detail.tick} s` }

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
        setTimeout(this.respond_after_maskeditor.bind(this), 1000)
    }

    respond_after_maskeditor() {
        if (document.getElementById('maskEditor').style.display == 'none') {
            this._send_response(this.node.imgs[0].src)
        } else {
            setTimeout(this.respond_after_maskeditor.bind(this), 100)
        }
    }

    handle_urls(detail) {
        this.n_extras = detail.extras ? detail.extras.length : 0
        this.extras.innerHTML = ''
        for (let i=0; i<this.n_extras; i++) {
            const extra = create('input', 'extra', this.extras, {value:detail.extras[i]})
        }

        this.doing_text = (detail.text != null)
        this.n_images = detail.urls?.length
    
        this.active = true
        this.laidOut = false
        this.title_bar.innerText = app.graph._nodes_by_id[detail.uid].title ?? "Image Filter"
    
        this.picked = new Set()
        if (this.n_images==1) this.picked.add('0')

        this.grid.innerHTML = ''
        detail.urls.forEach((url, i)=>{
            console.log(url)
            const full_url = api.apiURL( `/view?filename=${encodeURIComponent(url.filename ?? v)}&type=${url.type ?? "input"}&subfolder=${url.subfolder ?? ""}`)
            const img = create('img', null, this.grid, {src:full_url})
            img.onload = this.layout.bind(this)
            if (!this.doing_text && this.n_images>1) {
                img.addEventListener('click', (e)=>{
                    const s = `${i}`
                    if (this.click_sends.checked) {
                        this._send_response(s)
                    } else {
                        if (this.picked.has(s)) this.picked.delete(s)
                        else this.picked.add(s)
                        this.redraw()
                    }
                })
            }
        })
        
        if (this.doing_text) { this.text_edit = create('textarea', 'text_edit', this.grid, {"innerHTML":detail.text}) }
        this.layout()
        this.classList.remove('hidden')
        this.counter.classList.remove('hidden')
        this.maybe_play_sound()
    }

    on_keydown(e) {
        if (!this.active) return
        if (this.doing_text) return
        if (e.key=='x') {
            e.stopPropagation()
            e.preventDefault()
            this.send_cancel()
        } else if (e.key=='s' && picked.size>0) {
            e.stopPropagation()
            e.preventDefault()
            this.send_current_state()
        }
    }

    layout() {
        if (this.auto_send.checked) {
            // check for all the same
        }
        if (this.laidOut) return

        const im_w = this.grid.firstChild.naturalWidth
        const im_h = this.grid.firstChild.naturalHeight
        const box = this.grid.getBoundingClientRect()
        var per_row
        if (!im_w || !im_h || !box.width || !box.height) {
            per_row = Math.ceil(Math.sqrt(this.n_images))
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

        this.redraw()
    }

    redraw() {
        Array.from(this.grid.children).forEach((c,i)=>{
            if (this.picked.has(`${i}`)) c.classList.add('selected')
            else c.classList.remove('selected')
        }) 
        this.send_button.disabled = (!this.doing_text && (this.click_sends.checked || this.picked.size==0))
        this.cancel_button.style.visibility = (this.doing_text) ? 'hidden' : 'visible'
        this.checkboxes.style.visibility = (this.doing_text) ? 'hidden' : 'visible'
        this.send_button.innerText = (this.doing_text) ? 'Send' : 'Send (S)'
    }

}

customElements.define('cg-imgae-filter-popup', Popup, {extends: 'span'})

export const popup = new Popup()