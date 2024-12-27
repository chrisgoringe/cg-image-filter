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
    RETURN_TYPES = ("IMAGE",)
    RETURN_NAMES = ("images",)
    FUNCTION = "func"
    CATEGORY = "image_filter"
    OUTPUT_NODE = False

    data:str = None

    @classmethod
    def INPUT_TYPES(s):
        return {
            "required": { 
                "images" : ("IMAGE", ), 
                "timeout": ("INT", {"default": 60, "tooltip": "Timeout in seconds before all images are passed on."}),
            },
            "hidden": {
                "prompt": "PROMPT", 
                "extra_pnginfo": "EXTRA_PNGINFO", 
                "uid":"UNIQUE_ID"
            },
        }
    
    def func(self, images, timeout, uid, **kwargs):
        urls:list[str] = self.save_images(images=images, **kwargs)['ui']['images']
        PromptServer.instance.send_sync("cg-image-filter-images", {"uid": uid, "urls":urls})

        ImageFilter.data = None
        end_time = time.monotonic() + timeout
        while(time.monotonic() < end_time and ImageFilter.data is None): time.sleep(1)
        response = ImageFilter.data or ''
        ImageFilter.data = None

        images_to_return = list(int(x) for x in response.split(",") if x)

        if len(images_to_return) == 0: raise InterruptProcessingException()
                
        return (torch.stack(list(images[i] for i in images_to_return)), )