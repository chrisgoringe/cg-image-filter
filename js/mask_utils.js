import { app, ComfyApp } from "../../scripts/app.js";

export function new_editor() {
    return app.ui.settings.getSettingValue('Comfy.MaskEditor.UseNewEditor')
}

function get_mask_editor_element() {
    const newer = document.getElementsByClassName('p-dialog-mask')
    if (newer.length==1) return newer[0]
    return new_editor() ? document.getElementById('maskEditor') : document.getElementById('maskCanvas')?.parentElement
}

export function mask_editor_showing() {
    return get_mask_editor_element() && get_mask_editor_element().style.display != 'none'
}

export function hide_mask_editor() {
    if (mask_editor_showing() && document.getElementById('maskEditor')) document.getElementById('maskEditor').style.display = 'none'
}

function get_mask_editor_cancel_button() {
    var button = document.getElementById("maskEditor_topBarCancelButton")
    if (button) return button
    try {
        button = Array.from(get_mask_editor_element().getElementsByTagName('button')).find((b)=>(b.ariaLabel=='Cancel'))
        if (button) return button
    } catch {}

    return get_mask_editor_element().parentElement.lastChild.childNodes[2]

}

function get_mask_editor_save_button() {
    var button = document.getElementById("maskEditor_topBarSaveButton")
    if (button) return button
    try {
        button = Array.from(get_mask_editor_element().getElementsByTagName('button')).find((b)=>(b.ariaLabel=='Save'))
        if (button) return button
    } catch {}

    return get_mask_editor_element?.parentElement?.lastChild?.childNodes[1]
}

export function mask_editor_listen_for_cancel(callback) {
    const cancel_button = get_mask_editor_cancel_button()
    if (cancel_button && !cancel_button.filter_listener_added) {
        cancel_button.addEventListener('click', callback )
        cancel_button.filter_listener_added = true
    }
}

export function press_maskeditor_save() {
    get_mask_editor_save_button()?.click()
}

export function press_maskeditor_cancel() {
    get_mask_editor_cancel_button()?.click()
}

export function open_maskeditor(node) {
    if (ComfyApp.open_maskeditor) { 
        ComfyApp.copyToClipspace(node)
        ComfyApp.clipspace_return_node = node
        ComfyApp.open_maskeditor()
    } else {
        const me_extension = app.extensions.find((e)=>(e.name=='Comfy.MaskEditor'))
        const me_command = me_extension.commands.find((c)=>(c.id=='Comfy.MaskEditor.OpenMaskEditor'))
        app.canvas.selected_nodes = [node,]
        me_command.function()
    }
}