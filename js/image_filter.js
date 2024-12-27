import { app } from "../../scripts/app.js";
import { api } from "../../scripts/api.js";

function create( tag, clss, parent, properties ) {
    const nd = document.createElement(tag);
    if (clss)       clss.split(" ").forEach((s) => nd.classList.add(s))
    if (parent)     parent.appendChild(nd);
    if (properties) Object.assign(nd, properties);
    return nd;
}

function send_response(msg) {
    const body = new FormData();
    body.append('response', msg);
    api.fetchApi("/cg-image-filter-message", { method: "POST", body, });
    popup?.classList.add('hidden')
}

function executionInterrupted() {
    send_response('')
}

const picked = new Set()
var popup = null

function layout() {
    const n = popup.firstChild.children.length
    const im_w = popup.firstChild.firstChild.naturalWidth
    const im_h = popup.firstChild.firstChild.naturalHeight
    const box = popup.firstChild.getBoundingClientRect()
    var per_row
    if (!im_w || !im_h || !box.width || !box.height) {
        per_row = Math.ceil(Math.sqrt(n))
    } else {
        var best_scale = 0
        var best_pick
        for (per_row=1; per_row<=n; per_row++) {
            const rows = Math.ceil(n/per_row)
            const scale = Math.min( box.width/(im_w*per_row), box.height/(im_h*rows) )
            console.log(`${per_row} per row, ${rows} rows, scale ${scale}`)
            if (scale>best_scale) {
                best_scale = scale
                best_pick = per_row
            }
        }
        per_row = best_pick
    }

    const rows = Math.ceil(n/per_row)    
    const h = box.height / rows
    const w = box.width / per_row
    Array.from(popup.firstChild.children).forEach((c,i)=>{
        c.style.gridArea = `${Math.floor(i/per_row) + 1} / ${i%per_row + 1} /  auto / auto`; 
        c.style.maxHeight = `${h}px`
        c.style.maxWidth = `${w}px`
    })
    redraw_from_click()
}

function redraw_from_click() {
    Array.from(popup.firstChild.children).forEach((c,i)=>{
        if (picked.has(`${i}`)) c.classList.add('selected')
        else c.classList.remove('selected')
    }) 
}

function create_popup() {
    popup = create('span', 'cg_popup hidden', document.body)
    const grid = create('span', 'grid', popup)
    const buttons = create('span', 'buttons', popup)
    const send = create('button', null, buttons, {innerText:"Send"} )
    const cancel = create('button', null, buttons, {innerText:"Cancel"} )

    send.addEventListener('click', (e)=>{ send_response(Array.from(picked).join()) })
    cancel.addEventListener('click', (e)=>{ send_response('') })
}

function imageFilterImages(details) {
    const detail = details.detail
    if (app.graph._nodes_by_id[detail.uid].type=="Image Filter") {
        if (!popup) create_popup()

        picked.clear()
        if (detail.urls.length==1) picked.add('0')
        popup.firstChild.innerHTML = ''

        detail.urls.forEach((url, i)=>{
            console.log(url)
            const full_url = api.apiURL( `/view?filename=${encodeURIComponent(url.filename ?? v)}&type=${url.type ?? "input"}&subfolder=${url.subfolder ?? ""}`)
            const img = create('img', null, popup.firstChild, {src:full_url})
            img.onload = layout
            if (detail.urls.length>1) {
                img.addEventListener('click', (e)=>{
                    const s = `${i}`
                    if (picked.has(s)) picked.delete(s)
                    else picked.add(s)
                    redraw_from_click()
                })
            } 
        })
        popup.classList.remove('hidden')
    }
}

app.registerExtension({
	name: "cg.image_filter",
    setup() {
        create('link', null, document.getElementsByTagName('HEAD')[0], 
            {'rel':'stylesheet', 'type':'text/css', 'href': new URL("./filter.css", import.meta.url).href } )
        api.addEventListener("execution_interrupted", executionInterrupted);
        api.addEventListener("cg-image-filter-images",imageFilterImages);
    }
})