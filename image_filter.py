from server import PromptServer
from aiohttp import web
from nodes import PreviewImage
from comfy.model_management import InterruptProcessingException
import time
import torch

##
#
# response should be a dict just containing key 'response' 
# which holds a comma separated list of integers of selected images (0 indexed)
# where '' indicates cancel
#
##

@PromptServer.instance.routes.post('/cg-image-filter-message')
async def cg_image_filter_message(request):
    post = await request.post()
    ImageFilter.data = post.get("response")
    return web.json_response({})

class ImageFilter(PreviewImage):
    RETURN_TYPES = ("IMAGE","LATENT","MASK")
    RETURN_NAMES = ("images","latents","masks")
    FUNCTION = "func"
    CATEGORY = "image_filter"
    OUTPUT_NODE = False

    data:str = None

    @classmethod
    def INPUT_TYPES(s):
        return {
            "required": { 
                "images" : ("IMAGE", ), 
                "timeout": ("INT", {"default": 60, "tooltip": "Timeout in seconds."}),
                "ontimeout": (["send none", "send all"]),
            },
            "optional": {
                "latents" : ("LATENT", {"tooltip": "Optional - if provided, will be output"}),
                "masks" : ("MASK", {"tooltip": "Optional - if provided, will be output"}),
            },
            "hidden": {
                "prompt": "PROMPT", 
                "extra_pnginfo": "EXTRA_PNGINFO", 
                "uid":"UNIQUE_ID"
            },
        }
    
    @classmethod
    def IS_CHANGED(cls, **kwargs):
        return float("NaN")
    
    def func(self, images, timeout, ontimeout, uid, latents=None, masks=None, **kwargs):
        urls:list[str] = self.save_images(images=images, **kwargs)['ui']['images']
        PromptServer.instance.send_sync("cg-image-filter-images", {"uid": uid, "urls":urls})

        ImageFilter.data = None
        end_time = time.monotonic() + timeout
        while(time.monotonic() < end_time and ImageFilter.data is None): time.sleep(1)
        response = ImageFilter.data or ('' if ontimeout=='send none' else ",".join(list(str(x) for x in range(len(images)))))
        ImageFilter.data = None

        images_to_return = list(int(x) for x in response.split(",") if x)

        if len(images_to_return) == 0: raise InterruptProcessingException()

        images = torch.stack(list(images[i] for i in images_to_return))
        latents = {"samples": torch.stack(list(latents['samples'][i] for i in images_to_return))} if latents is not None else None
        masks = torch.stack(list(masks[i] for i in images_to_return)) if masks is not None else None
                
        return (images, latents, masks)