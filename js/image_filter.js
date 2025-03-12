import { app } from "../../scripts/app.js";
import { api } from "../../scripts/api.js";

import { create } from "./utils.js";
import { popup } from "./popup.js";

app.registerExtension({
	name: "cg.image_filter",
    settings: [
        {
            id: "ImageFilter.PlaySound",
            name: "Play sound when activating",
            type: "boolean",
            defaultValue: true
        },
        {
            id: "ImageFilter.ReshowWindow",
            name: "Pressing '!' reshows the window",
            type: "boolean",
            defaultValue: true
        },
    ],
    setup() {
        create('link', null, document.getElementsByTagName('HEAD')[0], 
            {'rel':'stylesheet', 'type':'text/css', 'href': new URL("./filter.css", import.meta.url).href } )
        api.addEventListener("execution_interrupted", popup.send_cancel.bind(popup));
        api.addEventListener("cg-image-filter-images",popup.handle_message.bind(popup));
    },
    async beforeRegisterNodeDef(nodeType) {
        if (nodeType.comfyClass == "Pick from List") {
            const onConnectionsChange = nodeType.prototype.onConnectionsChange;
            nodeType.prototype.onConnectionsChange = function (side,slot,connect,link_info,output) {
                if (side==1 && slot==0 && link_info && connect) {
                    const type = this.graph._nodes_by_id[link_info.origin_id].outputs[link_info.origin_slot].type
                    this.outputs[0].type = type
                    this.inputs[0].type = type
                } else if (side==1 && slot==0 && !connect) {
                    const type = "*"
                    this.outputs[0].type = type
                    this.inputs[0].type = type
                }
            }
        }
    }
})