from server import PromptServer
from aiohttp import web
from nodes import PreviewImage, LoadImage
from comfy.model_management import InterruptProcessingException, throw_exception_if_processing_interrupted
import time, os
import torch

REQUEST_RESHOW = "-1"
REQUEST_TIMER_RESET = "-2"
CANCEL = "-3"
WAITING_FOR_RESPONSE = "-9"

SPECIALS = [REQUEST_RESHOW, REQUEST_TIMER_RESET, CANCEL, WAITING_FOR_RESPONSE]

class CancelledByUser(Exception): pass

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
    response = post.get("response")
    if (Message.data is None or response not in SPECIALS):
        Message.data = response
    return web.json_response({})

def wait(secs, uid):
    Message.data = None
    end_time = time.monotonic() + secs
    while(time.monotonic() < end_time and Message.data is None): 
        throw_exception_if_processing_interrupted()
        PromptServer.instance.send_sync("cg-image-filter-images", {"tick": int(end_time - time.monotonic()), "uid": uid})
        time.sleep(0.2)
    response = Message.data
    if response is None:
        PromptServer.instance.send_sync("cg-image-filter-images", {"timeout": True, "uid": uid})
    Message.data = None
    return response

def send_with_resend(payload, timeout, uid):
    response = WAITING_FOR_RESPONSE
    while response in SPECIALS:
        PromptServer.instance.send_sync("cg-image-filter-images", payload)
        response = wait(timeout, uid)
        if response == CANCEL:  raise InterruptProcessingException()
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
    RETURN_TYPES = ("IMAGE","LATENT","MASK","STRING","STRING","STRING")
    RETURN_NAMES = ("images","latents","masks","extra1","extra2","extra3")
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
                "tip" : ("STRING", {"default":"", "tooltip": "Optional - if provided, will be displayed in popup window"}),
                "extra1" : ("STRING", {"default":""}),
                "extra2" : ("STRING", {"default":""}),
                "extra3" : ("STRING", {"default":""}),
            },
            "hidden": HIDDEN,
        }
    
    @classmethod
    def IS_CHANGED(cls, **kwargs):
        return float("NaN")
    
    def func(self, images, timeout, ontimeout, uid, tip="", extra1="", extra2="", extra3="", latents=None, masks=None, **kwargs):
        B = images.shape[0]
        all_the_same = ( B and all( (images[i]==images[0]).all() for i in range(1,B) )) 
        urls:list[str] = self.save_images(images=images, **kwargs)['ui']['images']
        payload = {"uid": uid, "urls":urls, "allsame":all_the_same, "extras":[extra1, extra2, extra3], "tip":tip}

        response = send_with_resend(payload, timeout, uid)

        if not response:
            e1 = e2 = e3 = ""
            if ontimeout=='send none': response = ""
            if ontimeout=='send all': response = ",".join(list(str(x) for x in range(len(images))))
            if ontimeout=='send first': response = "0"
            if ontimeout=='send last': response = str(len(images)-1)
        else:
            response, e1, e2, e3 = response.split("|||")

        images_to_return = list(int(x) for x in response.split(",") if x)

        if len(images_to_return) == 0: 
            raise InterruptProcessingException()

        images = torch.stack(list(images[i] for i in images_to_return))
        latents = {"samples": torch.stack(list(latents['samples'][i] for i in images_to_return))} if latents is not None else None
        masks = torch.stack(list(masks[i] for i in images_to_return)) if masks is not None else None
                
        return (images, latents, masks, e1, e2, e3)
    
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
                "timeout": ("INT", {"default": 60, "tooltip": "Timeout in seconds."}),
            },
            "optional": {
                "mask" : ("MASK", {"tooltip": "Optional - if provided, will be overlaid on image"}),
                "tip" : ("STRING", {"default":"", "tooltip": "Optional - if provided, will be displayed in popup window"}),
                "extra1" : ("STRING", {"default":""}),
                "extra2" : ("STRING", {"default":""}),
                "extra3" : ("STRING", {"default":""}),
            },
            "hidden": HIDDEN,
        }
    
    @classmethod
    def IS_CHANGED(cls, **kwargs):
        return float("NaN")
    
    def func(self, image, text, timeout, uid, extra1="", extra2="", extra3="", mask=None, tip="", **kwargs):
        urls:list[str] = self.save_images(images=image, **kwargs)['ui']['images']
        payload = {"uid": uid, "urls":urls, "text":text, "extras":[extra1, extra2, extra3], "tip":tip}
        if mask is not None: payload['mask_urls'] = self.save_images(images=mask_to_image(mask), **kwargs)['ui']['images']

        response = send_with_resend(payload, timeout, uid)
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
        response = send_with_resend(payload, timeout, uid)
        
        if (response):
            try:
                filename = response.split('=')[1].split('&')[0]
                return self.load_image(os.path.join('clipspace', filename)+" [input]")
            except FileNotFoundError:
                pass

        if if_no_mask == 'cancel': raise InterruptProcessingException()
        return self.load_image(urls[0]['filename']+" [temp]")
