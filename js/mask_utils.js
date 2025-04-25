import { app, ComfyApp } from "../../scripts/app.js";


function get_mask_editor_element() {
    if (document.getElementById('maskEditor')) {
        return document.getElementById('maskEditor')
    } else if (document.getElementById('maskCanvas') && document.getElementById('maskCanvas').parentElement) {
        return document.getElementById('maskCanvas').parentElement
    } else {
        return null
    }
}

export function mask_editor_showing() {
    return get_mask_editor_element() && get_mask_editor_element().style.display != 'none'
}

export function hide_mask_editor() {
    if (mask_editor_showing()) document.getElementById('maskEditor').style.display = 'none'
}

function get_mask_editor_cancel_button() {
    if (document.getElementById("maskEditor_topBarCancelButton")) return document.getElementById("maskEditor_topBarCancelButton")
    return get_mask_editor_element?.parentElement?.lastChild?.childNodes[2]
}

export function mask_editor_listen_for_cancel(callback) {
    const cancel_button = get_mask_editor_cancel_button()
    if (cancel_button && !cancel_button.filter_listener_added) {
        cancel_button.addEventListener('click', callback )
        cancel_button.filter_listener_added = true
    }
}