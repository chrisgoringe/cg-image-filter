import { app, ComfyApp } from "../../scripts/app.js";

var mask_edit_window_open = false

export function setup_mask_events() {
    const SEL = '[data-testid="mask-editor-root"]';
    let open = false;

    const hasEditor = (nodes) =>
    [...nodes].some(
        (n) => n.nodeType === 1 && (n.matches?.(SEL) || n.querySelector?.(SEL))
    );

    new MutationObserver((mutations) => {
    for (const m of mutations) {
        if (!open && hasEditor(m.addedNodes)) {
        open = true;
        window.dispatchEvent(new CustomEvent("maskeditor:opened"));
        } else if (open && hasEditor(m.removedNodes)) {
        open = false;
        window.dispatchEvent(new CustomEvent("maskeditor:closed"));
        }
    }
    }).observe(document.body, { childList: true, subtree: true });

    let node, before;
    window.addEventListener("maskeditor:opened", () => {
        mask_edit_window_open = true
        //before = node?.widgets?.find((w) => w.name === "image")?.value;
    });
    window.addEventListener("maskeditor:closed", () => {
        // after = node?.widgets?.find((w) => w.name === "image")?.value;
        mask_edit_window_open = false
    });
}

export function new_editor() {
    return app.ui.settings.getSettingValue('Comfy.MaskEditor.UseNewEditor')
}

function get_mask_editor_element() {
    var newer = document.getElementsByClassName('p-dialog-mask')
    if (newer.length==1) return newer[0]
    newer = document.getElementsByClassName('mask-editor-dialog')
    if (newer.length==1) return newer[0]
    return new_editor() ? document.getElementById('maskEditor') : document.getElementById('maskCanvas')?.parentElement
}

var buttons = null

export function mask_editor_showing() {
    return mask_edit_window_open
    //const mee = get_mask_editor_element()
    //if (mee) buttons = Array.from(mee.getElementsByTagName('button'))
    //return mee && mee.style.display != 'none'
}

export function hide_mask_editor() {
    if (mask_editor_showing() && document.getElementById('maskEditor')) document.getElementById('maskEditor').style.display = 'none'
}

function get_mask_editor_cancel_button() {
    try {
        var button = document.getElementById("maskEditor_topBarCancelButton")
        if (button) return button
        //const buttonlist = get_mask_editor_element()?.getElementsByTagName('button')
        if (buttons) {
            //const buttons = Array.from(buttonlist)
            button = buttons.find((b)=>(b.ariaLabel=='Cancel'))
            if (button) return button
            button = buttons.find((b)=>(b.innerText=='Cancel' || b.innerText==' Cancel'))
            if (button) return button
        }
        button = get_mask_editor_element()?.parentElement?.lastChild?.childNodes[2]
        if (button) return button
    } catch (e) {
        console.error(e)
        return null
    }

    

}

function get_mask_editor_save_button() {
    var button = document.getElementById("maskEditor_topBarSaveButton")
    if (button) return button
    try {
        //const buttons = Array.from(get_mask_editor_element().getElementsByTagName('button'))
        if (buttons) {
            button = buttons.find((b)=>(b.ariaLabel=='Save'))
            if (button) return button
            button = buttons.find((b)=>(b.innerText=='Save' || b.innerText==' Save'))
            if (button) return button
        }
    } catch {
        let a;
    }

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