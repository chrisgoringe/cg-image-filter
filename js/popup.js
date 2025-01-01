import { app } from "../../scripts/app.js";
import { api } from "../../scripts/api.js";

import { create } from "./utils.js";

class Popup extends HTMLSpanElement {
    constructor() {
        super()
        this.hide()
        this.classList.add('cg_popup')
        document.body.appendChild(this)
        
        this.grid               = create('span', 'grid', this)
        this.title_bar          = create('span', 'title', this)
        this.buttons            = create('span', 'buttons', this)
        this.click_sends_pane   = create('span', null, this.buttons)
        this.click_sends        = create('input', 'control', this.click_sends_pane, {type:"checkbox", id:"click_sends"})
        this.click_sends_label  = create('label', 'control_text', this.click_sends_pane, {for:"click_sends", innerText:"click to send"})
        this.send_button        = create('button', 'control', this.buttons, {innerText:"Send (S)"} )
        this.cancel_button      = create('button', 'control', this.buttons, {innerText:"Cancel (X)"} )
    
        this.send_button.addEventListener(  'click', this.send_current_state.bind(this) )
        this.cancel_button.addEventListener('click', this.send_cancel.bind(this) )

        document.addEventListener('keydown', (e)=>{ this.on_keydown(e) })
    }

    _send_response(msg) {
        const body = new FormData();
        body.append('response', msg);
        api.fetchApi("/cg-image-filter-message", { method: "POST", body, });
        this.hide()
    }
    
    send_current_state() {
        if (this.doing_text) { this._send_response(this.text_edit.value) }
        else                 { this._send_response(Array.from(this.picked).join()) }
    }
    
    send_cancel() { this._send_response('') }

    hide() { 
        this.classList.add('hidden') 
        this.active = false
    }

    show(details) { 
        const detail = details.detail
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
        
        if (detail.text) { this.text_edit = create('textarea', 'text_edit', this.grid, {"innerText":detail.text}) }
        this.layout()
        this.classList.remove('hidden')
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
        this.click_sends_pane.style.visibility = (this.doing_text) ? 'hidden' : 'visible'
        this.send_button.innerText = (this.doing_text) ? 'Send' : 'Send (S)'
    }

}

customElements.define('cg-imgae-filter-popup', Popup, {extends: 'span'})

export const popup = new Popup()