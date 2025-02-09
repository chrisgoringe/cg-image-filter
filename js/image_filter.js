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
    ],
    setup() {
        create('link', null, document.getElementsByTagName('HEAD')[0], 
            {'rel':'stylesheet', 'type':'text/css', 'href': new URL("./filter.css", import.meta.url).href } )
        api.addEventListener("execution_interrupted", popup.send_cancel.bind(popup));
        api.addEventListener("cg-image-filter-images",popup.handle_message.bind(popup));
    }
})