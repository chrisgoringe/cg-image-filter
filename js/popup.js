import { app, ComfyApp } from "../../scripts/app.js";
import { api } from "../../scripts/api.js"

import { mask_editor_listen_for_cancel, mask_editor_showing, hide_mask_editor, press_maskeditor_cancel, press_maskeditor_save } from "./mask_utils.js";
import { Log } from "./log.js";
import { create } from "./utils.js";
import { FloatingWindow } from "./floating_window.js";

//const EXTENSION_NODES = ["Image Filter", "Text Image Filter", "Mask Image Filter", "Text Image Filter with Extras",]
const POPUP_NODES = ["Image Filter", "Text Image Filter", "Text Image Filter with Extras",]
const MASK_NODES = ["Mask Image Filter",]

const REQUEST_RESHOW = "-1"
const CANCEL = "-3"

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
    static disabled(item, value) {
        item.disabled = value
    }
    static highlighted(item, value) {
        if (value) item.classList.add('highlighted')
        else item.classList.remove('highlighted')
    }

    static render(popup) {
        const state = popup.state
        State.visible(popup, (state==State.FILTER || state==State.TEXT || state==State.ZOOMED))

        State.visible(popup.tiny_window, state==State.TINY)

        State.visible(popup.zoomed, state==State.ZOOMED)

        State.visible(popup.floating_window, (state==State.FILTER || state==State.ZOOMED || state==State.TEXT || state==State.MASK))
            State.visible(popup.button_row, state!=State.MASK)
                State.disabled(popup.send_button, (state==State.FILTER || state==State.ZOOMED) && popup.picked.size==0)
            State.visible(popup.mask_button_row, state==State.MASK)
            State.visible(popup.extras_row, popup.n_extras>0)
            State.visible(popup.tip_row, popup.tip_row.innerHTML.length>0)
            State.visible(popup.text_edit, state==State.TEXT)
        
        if (state==State.ZOOMED) {
            const img_index = popup.zoomed_image_holder.image_index
            State.highlighted(popup.zoomed, popup.picked.has(`${img_index}`))
            popup.zoomed_number.innerHTML = `${img_index+1}/${popup.n_images}`
        }

        if (state!=State.MASK) hide_mask_editor()
    }
}


class Popup extends HTMLSpanElement {
    constructor() {
        super()
        this.audio = new Audio('extensions/cg-image-filter/ding.mp3');

        this.classList.add('cg_popup')
        
        this.grid               = create('span', 'grid', this)
        this.overlaygrid        = create('span', 'grid overlaygrid', this)
        this.grid.addEventListener('click', this.on_click.bind(this))

        this.zoomed             = create('span', 'zoomed', this)
        this.zoomed_image       = create('img', 'zoomed_image', this.zoomed)
        this.zoomed_number      = create('span', 'zoomed_number', this.zoomed)

        //this.text_edit          = create('textarea', 'text_edit', this)
        //this.buttons            = create('span', 'buttons', this)

        //this.tip                = create('span', 'tip', this.buttons)

        this.tiny_window        = create('span', 'tiny_window hidden', document.body)
        this.tiny_image         = create('img', 'tiny_image', this.tiny_window)
        this.tiny_window.addEventListener('click', this.handle_deferred_message.bind(this))


        this.floating_window = new FloatingWindow('', 100, 100)
        document.body.append(this.floating_window)

        this.counter_row          = create('span', 'counter row', this.floating_window.body)
        this.counter_reset_button = create('button', 'counter_reset', this.counter_row, {innerText:"Reset"} )
        this.counter_text         = create('span', 'counter_text', this.counter_row)
        this.counter_reset_button.addEventListener('click', this.request_reset.bind(this) ) 

        this.extras_row = create('span', 'extras row', this.floating_window.body)

        this.tip_row = create('span', 'tip row', this.floating_window.body)

        this.button_row    = create('span', 'buttons row', this.floating_window.body)
        this.send_button   = create('button', 'control', this.button_row, {innerText:"Send"} )
        this.cancel_button = create('button', 'control', this.button_row, {innerText:"Cancel"} )
        this.send_button.addEventListener(  'click', this.send_current_state.bind(this) )
        this.cancel_button.addEventListener('click', this.send_cancel.bind(this) )

        this.mask_button_row    = create('span', 'buttons row', this.floating_window.body)
        this.mask_send_button   = create('button', 'control', this.mask_button_row, {innerText:"Send"} )
        this.mask_cancel_button = create('button', 'control', this.mask_button_row, {innerText:"Cancel"} )
        this.mask_send_button.addEventListener(  'click', press_maskeditor_save )
        this.mask_cancel_button.addEventListener('click', press_maskeditor_cancel )

        this.text_edit = create('textarea', 'text_edit row', this.floating_window.body)

        this.picked = new Set()
    
        document.addEventListener("keydown", this.on_key_down.bind(this))

        document.body.appendChild(this)
        this.last_response_sent = 0
        this.state = State.INACTIVE
        State.render(this)
    }

    _send_response(msg={}, keep_open=false) {
        /*
        msg is a dict. Valid keys are:
        *selection    (list[int])
        *text         (string)
         special      (int)
         masked_image (string)
        *extras       (list of strings)
        *unique       (string)
                (*) are added
        */
        if (Date.now()-this.last_response_sent < 1000) {
            Log.message_out(msg, "(throttled)")
            return
        }

        msg.unique = `${this.node._ni_widget?.value}`

        if (!msg.special) {
            if (this.n_extras>0) {
                msg.extras = []
                Array.from(this.extras_row.children).forEach((e)=>{ msg.extras.push(e.value) })
            }
            if (this.state==State.FILTER || this.state==State.ZOOMED) msg.selection = Array.from(this.picked)
            if (this.state==State.TEXT) msg.text = this.text_edit.value
            
            this.last_response_sent = Date.now()
        }

        try {
            const body = new FormData();
            body.append('response', JSON.stringify(msg));
            api.fetchApi("/cg-image-filter-message", { method: "POST", body, });
            Log.message_out(msg)
        } catch (e) { 
            Log.error(e) 
        } finally { 
            if (!keep_open) this.close() 
        }

    }

    send_current_state() { 
        if (this.state == State.TEXT) {
            this._send_response()
        } else {
            this._send_response()
        }
    }
    
    send_cancel() { this._send_response({special:CANCEL}) }

    request_reset() { this._send_response({special:REQUEST_RESHOW}, true) }

    close() { 
        this.state = State.INACTIVE
        State.render(this)
    }

    maybe_play_sound() { if (app.ui.settings.getSettingValue("Image Filter.UI.Play Sound")) this.audio.play(); }

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
        return (app.ui.settings.getSettingValue("ImageFilter.Actions.AutosendIdentical") && this.allsame)
    }

    _handle_message(message, use_saved) {

        const uid = message.detail.uid
        const node = app.graph._nodes_by_id[uid]

        if (!node) {
            console.log(`Message was for ${uid} which doesn't exist`)
            return
        }

        if  (node._ni_widget?.value != message.detail.unique) {
            console.log(`Message unique id wasn't mine`)
            return
        }

        this.node = node

        if (this.state==State.INACTIVE && message.detail.urls && app.ui.settings.getSettingValue("Image Filter.UI.Small Window") && !use_saved && !this.autosend()) {
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

            if (detail.tick) {
                this.counter_text.innerText = `${detail.tick}s`
                if (this.state==State.INACTIVE) this.request_reset()
                return
            }

            if (detail.timeout) {
                this.close()
                return `Timeout` 
            }

            this.allsame = detail.allsame || false
            this.n_extras = detail.extras ? message.detail.extras.length : 0 

            this.extras_row.innerHTML = ''
            for (let i=0; i<this.n_extras; i++) { create('input', 'extra', this.extras_row, {value:detail.extras[i]}) }

            this.set_title(detail)
            
            if (!use_saved && !this.autosend()) this.maybe_play_sound()

            if (detail.maskedit)   this.handle_maskedit(detail) 
            else if (detail.urls)  this.handle_urls(detail)

            if (detail.tip) this.tip_row.innerHTML = detail.tip.replace(/(?:\r\n|\r|\n)/g, '<br/>')
            else this.tip_row.innerHTML = ""
            
        } finally { this.handling_message = false }  
    }



    window_not_showing(uid) {
        const node = app.graph._nodes_by_id[uid]
        return (
            (POPUP_NODES.includes(node.type) && this.classList.contains('hidden')) ||
            (MASK_NODES.includes(node.type) && !mask_editor_showing())
        )
    }

    set_title(detail) {
        const title = app.graph._nodes_by_id[detail.uid]?.title ?? "Image Filter"
        this.floating_window.set_title(title)
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
        this.seen_editor = false
        setTimeout(this.wait_while_mask_editing.bind(this), 200)
    }

    wait_while_mask_editing() {
        if (!this.seen_editor && mask_editor_showing()) {
            mask_editor_listen_for_cancel( this.send_cancel.bind(this) )
            State.render(this)
            this.seen_editor = true
        }

        if (mask_editor_showing()) {
            setTimeout(this.wait_while_mask_editing.bind(this), 100)
        } else {
            this._send_response({masked_image:this.extract_filename(this.node.imgs[0].src)})
        } 
    }

    extract_filename(url_string) {
        return (new URL(url_string)).searchParams.get('filename')
    }

    handle_urls(detail) {
        
        this.video_frames = detail.video_frames || 1



        // do this after the extras are set up so that we send the right extras
        if (this.autosend()) {
            this.picked.add(0)
            this._send_response()
            return
        }

        if (detail.text != null) {
            this.state = State.TEXT
            //this.text_edit.innerHTML = detail.text
            this.text_edit.value = detail.text
            if (detail.textareaheight) this.text_edit.style.height = `${detail.textareaheight}px`
        } else {
            this.state = State.FILTER
        }

        this.n_images = detail.urls?.length

        this.laidOut = -1

    
        this.picked = new Set()
        if (this.n_images==1) this.picked.add('0')

        this.grid.innerHTML = ''
        this.overlaygrid.innerHTML = ''
        var latestImage = null

        detail.urls.forEach((url, i)=>{
            console.log(url)
            if (i%this.video_frames == 0) {
                const thisImage = create('img', null, this.grid, {src:get_full_url(url)})
                latestImage = thisImage
                latestImage.onload = this.layout.bind(this)
                latestImage.image_index = i/this.video_frames
                latestImage.addEventListener('mouseover', (e)=>this.on_mouse_enter(thisImage))
                latestImage.addEventListener('mouseout', (e)=>this.on_mouse_out(thisImage))
                latestImage.frames = [get_full_url(url),]
            } else {
                latestImage.frames.push(get_full_url(url))
            }
            if (detail.mask_urls) { create('img', null, this.overlaygrid, {src:get_full_url(detail.mask_urls[i])})}

        })

        this.layout()

        if (this.video_frames>1) {
            this.frame = 0
            setTimeout(this.advance_videos.bind(this), 1000)
        }
        
    }

    advance_videos() {
        if (this.state == State.INACTIVE) return
        
        this.frame = (this.frame+1)%this.video_frames
        Array.from(this.grid.children).forEach((img)=>{img.src = img.frames[this.frame]})

        const fps = app.ui.settings.getSettingValue("Image Filter.Video.FPS")
        const delay = (fps>0) ? 1000/fps : 1000
        setTimeout(this.advance_videos.bind(this), delay)
    }

    on_mouse_enter(img) {
        this.mouse_is_over = img
        this.redraw()
    }

    on_mouse_out(img) {
        this.mouse_is_over = null
        this.redraw()       
    }

    on_key_down(e) {
        var used_keypress = false;

        if (this.state==State.FILTER || this.state==State.TEXT) {
            if (document.activeElement?.type=='text' || document.activeElement?.type=='textarea') {
                return
                // don't capture keys when editing text
            } else {
                if (e.key=='Enter') {
                    this.send_current_state()
                    used_keypress = true
                }
                if (e.key=='Escape') {
                    this.send_cancel()
                    used_keypress = true
                }
                if (`${parseInt(e.key)}`==e.key) {
                    this.select_unselect(parseInt(e.key))
                    used_keypress = true
                }
            }
        }

        if (this.state==State.FILTER && !used_keypress) {
            if (e.key==' ' && this.mouse_is_over) {
                this.state = State.ZOOMED
                this.zoomed_image_holder = this.mouse_is_over
                this.on_mouse_out(this.mouse_is_over)
                used_keypress = true
            }
        }
        
        if (this.state==State.ZOOMED && !used_keypress) {
            if (e.key==' ') {
                this.state = State.FILTER
                this.zoomed_image_holder = null
                used_keypress = true
            } else if (e.key=='ArrowUp') {
                const fake_event = { target:this.zoomed_image_holder}
                this.on_click(fake_event)
            } else if (e.key=='ArrowDown') {
                // select or unselect    
            } else if (e.key=='ArrowRight') {
                this.zoomed_image_holder = this.zoomed_image_holder.nextSibling || this.zoomed_image_holder.parentNode.firstChild
                used_keypress = true     
            } else if (e.key=='ArrowLeft') {
                this.zoomed_image_holder = this.zoomed_image_holder.previousSibling || this.zoomed_image_holder.parentNode.lastChild
                used_keypress = true         
            }
        }



        if (used_keypress) {
            e.stopPropagation()
            e.preventDefault()
            if (this.zoomed_image_holder) this.zoomed_image.src = this.zoomed_image_holder.src
            State.render(this) 
        }
    }

    select_unselect(n) {
        if (n<0 || n>this.n_images) {
            return
        }
        const s = `${n}`
        if (app.ui.settings.getSettingValue("Image Filter.Actions.Click Sends")) {
            this.picked.add(s)
            this._send_response()
        } else {
            if (this.picked.has(s)) this.picked.delete(s)
            else this.picked.add(s)
            this.redraw()
        }
    }

    on_click(e) {
        if (e.target.image_index != undefined) {
            this.select_unselect(e.target.image_index)
        }
    }

    layout() {
        const box = this.grid.getBoundingClientRect()
        if (this.laidOut==box.width) return

        const im_w = this.grid.firstChild.naturalWidth
        const im_h = this.grid.firstChild.naturalHeight
        
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
            this.laidOut = box.width
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