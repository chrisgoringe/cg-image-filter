import { app } from "../../scripts/app.js";
import { api } from "../../scripts/api.js";

import { create } from "./utils.js";
import { popup } from "./popup.js";
import { ComfyWidgets } from "../../scripts/widgets.js";

const FILTER_TYPES = ["Image Filter","Text Image Filter","Text Image Filter with Extras","Mask Image Filter"]

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
            id: "ImageFilter.ClickSends",
            name: "In Image Filter clicking an image sends it",
            type: "boolean",
            defaultValue: false
        },
        {
            id: "ImageFilter.AutosendIdentical",
            name: "In Image Filter, if all images are identical, autosend one",
            type: "boolean",
            defaultValue: false
        },
        {
            id: "ImageFilter.SmallWindow",
            name: "Initially show a small popup instead of covering the screen",
            type: "boolean",
            defaultValue: false
        },
        {
            id: "ImageFilter.DetailedLogging",
            name: "Turn on detailed logging",
            type: "boolean",
            defaultValue: false
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
        if (FILTER_TYPES.includes(nodeType.comfyClass )) {
            nodeType.prototype.choose_id = function() { this._ni_widget.value = Math.floor(Math.random() * 1000000) }

            const onNodeCreated = nodeType.prototype.onNodeCreated;
            nodeType.prototype.onNodeCreated = function () {
                this._ni_widget = this.widgets.find((n)=>n.name=='node_identifier')
                if (!(this._ni_widget)) {
                    this._ni_widget = ComfyWidgets["INT"](this, "node_identifier", ["INT", { "default":0 }], app).widget
                }
                this._ni_widget.hidden = true
                this._ni_widget.computeSize = () => [0,0]

                this.choose_id()
                return onNodeCreated ? onNodeCreated.apply(this, arguments) : undefined;
            }
        }
    },

})