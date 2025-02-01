from server import PromptServer
from aiohttp import web
from nodes import PreviewImage, LoadImage
from comfy.model_management import InterruptProcessingException, throw_exception_if_processing_interrupted
import time, os
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
    while(time.monotonic() < end_time and Message.data is None): 
        throw_exception_if_processing_interrupted()
        PromptServer.instance.send_sync("cg-image-filter-images", {"tick": int(end_time - time.monotonic())})
        time.sleep(0.2)
    response = Message.data
    if response is None:
        PromptServer.instance.send_sync("cg-image-filter-images", {"timeout": True})
    Message.data = None
    return response

def send_with_resend(payload, timeout):
    response = "-1"
    while response == "-1":
        PromptServer.instance.send_sync("cg-image-filter-images", payload)
        response = wait(timeout)
    return response

def mask_to_image(mask:torch.Tensor):
    return torch.stack([mask, mask, mask, 1.0-mask], -1)

class Message:
    data:str = None

HIDDEN = {
            "prompt": "PROMPT", 
            "extra_pnginfo": "EXTRA_PNGINFO", 
            "uid":"UNIQUE_ID"
        }

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
                "ontimeout": (["send none", "send all", "send first", "send last"], {}),
            },
            "optional": {
                "latents" : ("LATENT", {"tooltip": "Optional - if provided, will be output"}),
                "masks" : ("MASK", {"tooltip": "Optional - if provided, will be output"}),
            },
            "hidden": HIDDEN,
        }
    
    @classmethod
    def IS_CHANGED(cls, **kwargs):
        return float("NaN")
    
    def func(self, images, timeout, ontimeout, uid, latents=None, masks=None, **kwargs):
        B = images.shape[0]
        all_the_same = ( B and all( (images[i]==images[0]).all() for i in range(1,B) )) 
        urls:list[str] = self.save_images(images=images, **kwargs)['ui']['images']
        payload = {"uid": uid, "urls":urls, "allsame":all_the_same}

        response = send_with_resend(payload, timeout)

        if not response:
            if ontimeout=='send none': response = ""
            if ontimeout=='send all': response = ",".join(list(str(x) for x in range(len(images))))
            if ontimeout=='send first': response = "0"
            if ontimeout=='send last': response = str(len(images)-1)

        images_to_return = list(int(x) for x in response.split(",") if x)

        if len(images_to_return) == 0: 
            raise InterruptProcessingException()

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
                "text" : ("STRING", {"default":""}),
                "timeout": ("INT", {"default": 60, "tooltip": "Timeout in seconds."}),
            },
            "optional": {
                "mask" : ("MASK", {"tooltip": "Optional - if provided, will be overlaid on image"}),
            },
            "hidden": HIDDEN,
        }
    
    @classmethod
    def IS_CHANGED(cls, **kwargs):
        return float("NaN")
    
    def func(self, image, text, timeout, uid, mask=None, **kwargs):
        urls:list[str] = self.save_images(images=image, **kwargs)['ui']['images']
        payload = {"uid": uid, "urls":urls, "text":text}
        if mask is not None: payload['mask_urls'] = self.save_images(images=mask_to_image(mask), **kwargs)['ui']['images']

        response = send_with_resend(payload, timeout)

        return (image, response)
    
class TextImageFilterWithExtras(PreviewImage):
    RETURN_TYPES = ("IMAGE","STRING","STRING","STRING","STRING")
    RETURN_NAMES = ("image","text","extra1","extra2","extra3")
    FUNCTION = "func"
    CATEGORY = "image_filter"
    OUTPUT_NODE = False

    @classmethod
    def INPUT_TYPES(s):
        return {
            "required": { 
                "image" : ("IMAGE", ), 
                "text" : ("STRING", {"default":""}),
                "extra1" : ("STRING", {"default":""}),
                "extra2" : ("STRING", {"default":""}),
                "extra3" : ("STRING", {"default":""}),
                "timeout": ("INT", {"default": 60, "tooltip": "Timeout in seconds."}),
            },
            "optional": {
                "mask" : ("MASK", {"tooltip": "Optional - if provided, will be overlaid on image"}),
            },
            "hidden": HIDDEN,
        }
    
    @classmethod
    def IS_CHANGED(cls, **kwargs):
        return float("NaN")
    
    def func(self, image, text, extra1, extra2, extra3, timeout, uid, mask=None, **kwargs):
        urls:list[str] = self.save_images(images=image, **kwargs)['ui']['images']
        payload = {"uid": uid, "urls":urls, "text":text, "extras":[extra1, extra2, extra3]}
        if mask is not None: payload['mask_urls'] = self.save_images(images=mask_to_image(mask), **kwargs)['ui']['images']

        response = send_with_resend(payload, timeout)
        response = response.split("|||") if response else [text, extra1, extra2, extra3]

        return (image, *response) 

    
class MaskImageFilter(PreviewImage, LoadImage):
    RETURN_TYPES = ("IMAGE","MASK")
    RETURN_NAMES = ("image","mask")
    FUNCTION = "func"
    CATEGORY = "image_filter"
    OUTPUT_NODE = False

    @classmethod
    def INPUT_TYPES(s):
        return {
            "required": { 
                "image" : ("IMAGE", ), 
                "timeout": ("INT", {"default": 600, "tooltip": "Timeout in seconds."}),
                "if_no_mask": (["cancel", "send blank"], {}),
            },
            "hidden": HIDDEN,
        }
    
    @classmethod
    def IS_CHANGED(cls, **kwargs):
        return float("NaN")
    
    @classmethod
    def VALIDATE_INPUTS(cls, **kwargs): return True
    
    def func(self, image, timeout, uid, if_no_mask, **kwargs):
        urls:list[str] = self.save_images(images=image, **kwargs)['ui']['images']
        payload = {"uid": uid, "urls":urls, "maskedit":True}
        response = send_with_resend(payload, timeout)
        
        if (response):
            try:
                filename = response.split('=')[1].split('&')[0]
                return self.load_image(os.path.join('clipspace', filename)+" [input]")
            except FileNotFoundError:
                pass

        if if_no_mask == 'cancel': raise InterruptProcessingException()
        return self.load_image(urls[0]['filename']+" [temp]")
