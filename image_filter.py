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
    Message.data = post.get("response")
    return web.json_response({})

def wait(secs):
    Message.data = None
    end_time = time.monotonic() + secs
    while(time.monotonic() < end_time and Message.data is None): time.sleep(1)
    response = Message.data
    Message.data = None
    return response

class Message:
    data:str = None

class ImageFilter(PreviewImage):
    RETURN_TYPES = ("IMAGE","LATENT","MASK")
    RETURN_NAMES = ("images","latents","masks")
    FUNCTION = "func"
    CATEGORY = "image_filter"
    OUTPUT_NODE = False

    @classmethod
    def INPUT_TYPES(s):
        return {
            "required": { 
                "images" : ("IMAGE", ), 
                "timeout": ("INT", {"default": 60, "tooltip": "Timeout in seconds."}),
                "ontimeout": (["send none", "send all"], {}),
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

        response = wait(timeout) or ('' if ontimeout=='send none' else ",".join(list(str(x) for x in range(len(images)))))
        images_to_return = list(int(x) for x in response.split(",") if x)

        if len(images_to_return) == 0: raise InterruptProcessingException()

        images = torch.stack(list(images[i] for i in images_to_return))
        latents = {"samples": torch.stack(list(latents['samples'][i] for i in images_to_return))} if latents is not None else None
        masks = torch.stack(list(masks[i] for i in images_to_return)) if masks is not None else None
                
        return (images, latents, masks)
    
class TextImageFilter(PreviewImage):
    RETURN_TYPES = ("IMAGE","STRING")
    RETURN_NAMES = ("image","text")
    FUNCTION = "func"
    CATEGORY = "image_filter"
    OUTPUT_NODE = False

    @classmethod
    def INPUT_TYPES(s):
        return {
            "required": { 
                "image" : ("IMAGE", ), 
                "text" : ("STRING", {"forceInput":True, "default":""}),
                "timeout": ("INT", {"default": 60, "tooltip": "Timeout in seconds."}),
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
    
    def func(self, image, text, timeout, uid, **kwargs):
        urls:list[str] = self.save_images(images=image, **kwargs)['ui']['images']
        PromptServer.instance.send_sync("cg-image-filter-images", {"uid": uid, "urls":urls, "text":text})

        response = wait(timeout) or text
        return (image, response)