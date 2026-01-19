import { app } from "../../scripts/app.js";
import { api } from "../../scripts/api.js";

import { create } from "./utils.js";
import { popup } from "./popup.js";
import { graph_id_to_tab } from "./weak_map.js";
import { Log } from "./log.js";

const FILTER_TYPES = ["Image Filter","Text Image Filter","Text Image Filter with Extras","Mask Image Filter"]

app.registerExtension({
	name: "cg.image_filter",
    settings: [
        {
            id: "Image Filter. Image Filter",
            name: "Version 1.7",
            type: () => {
                const x = document.createElement('span')
                const a = document.createElement('a')
                a.innerText = "Report issues or request features"
                a.href = "https://github.com/chrisgoringe/cg-image-filter/issues"
                a.target = "_blank"
                a.style.paddingRight = "12px"
                x.appendChild(a)
                return x
            },
        },
        {
            id: "Image Filter.UI.Play Sound",
            name: "Play sound when activating",
            type: "boolean",
            defaultValue: true
        },
        {
            id: "Image Filter.UI.Enlarge Small Images",
            name: "Enlarge small images in grid",
            type: "boolean",
            defaultValue: true
        },
        {
            id: "Image Filter.Actions.Click Sends",
            name: "Clicking an image sends it",
            tooltip: "Use if you always want to send exactly one image.",
            type: "boolean",
            defaultValue: false
        },
        {
            id: "Image Filter.Actions.Autosend Identical",
            name: "If all images are identical, autosend one",
            type: "boolean",
            defaultValue: false
        },
        {
            id: "Image Filter.UI.Start Zoomed",
            name: "Enter the Image Filter node with an image zoomed",
            type: "combo",
            options: [ {value:0, text:"No"}, {value:"1", text:"first"}, {value:"-1", text:"last"} ],
            default: 0,
        },
        {
            id: "Image Filter.UI.Small Window",
            name: "Show a small popup instead of covering the screen",
            type: "boolean",
            tooltip: "Click the small popup to activate it",
            defaultValue: false
        },
        {
            id: "Image Filter.Z.Detailed Logging",
            name: "Turn on detailed logging",
            tooltip: "If you are asked to for debugging!",
            type: "boolean",
            defaultValue: false
        },
        {
            id: "Image Filter.Video.FPS",
            name: "Video Frames per Second",
            type: "int",
            defaultValue: 5,
        }
    ],
    setup() {
        create('link', null, document.getElementsByTagName('HEAD')[0], 
            {'rel':'stylesheet', 'type':'text/css', 'href': new URL("./filter.css", import.meta.url).href } )
        create('link', null, document.getElementsByTagName('HEAD')[0], 
            {'rel':'stylesheet', 'type':'text/css', 'href': new URL("./floating_window.css", import.meta.url).href } )
        create('link', null, document.getElementsByTagName('HEAD')[0], 
            {'rel':'stylesheet', 'type':'text/css', 'href': new URL("./zoomed.css", import.meta.url).href } )
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
                return onConnectionsChange ? onConnectionsChange.apply(this, arguments) : undefined;
            }
        }
        if (FILTER_TYPES.includes(nodeType.comfyClass )) {
            const onNodeCreated = nodeType.prototype.onNodeCreated;
            nodeType.prototype.onNodeCreated = function () {
                set_graph_id_widget(this)
                return onNodeCreated ? onNodeCreated.apply(this, arguments) : undefined;
            }
        }
    },

    afterConfigureGraph() {
        setTimeout( ()=> { app.graph.nodes.forEach( set_graph_id_widget ) }, 1000 )
        link_to_tab(3)
    }
})

function set_graph_id_widget(node) {
    const graph_id_widget = node.widgets?.find((n)=>n.name=='graph_id')
    if (graph_id_widget) {
        graph_id_widget.hidden = true
        graph_id_widget.value = `${app.graph.id}`     // app.graph.id is unique per tab, regardless of subgraph
        graph_id_widget.computeSize = () => [0,0]  
    }
}

function link_to_tab(tries) {
    const tab = document.getElementsByClassName('p-togglebutton-checked')[0]
    if (tab && app.graph.id) {
        graph_id_to_tab.set(app.graph.id, tab )
    } else if (tries>0) {
        setTimeout( ()=> { link_to_tab(tries-1) }, 500 )
    } else {
        Log.log(`cg-image-filter: could not link graph to tab`)
    }
}