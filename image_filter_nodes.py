from nodes import PreviewImage, LoadImage
from comfy.model_management import InterruptProcessingException
import os, random
import torch
from typing import Any

import base64
from io import BytesIO
from PIL import Image
import numpy as np

from .image_filter_messaging import send_and_wait, Response, TimeoutResponse
from comfy_api.latest import io

class FilterNodeBase:
    _preview_image = PreviewImage()
    _load_image = LoadImage()

    @classmethod
    def save_images_return_urls(cls, images:torch.Tensor, **kwargs) -> list[dict[str,str]]:
        return cls._preview_image.save_images(images, **kwargs)['ui']['images']

    @classmethod
    def load_mask(cls, file:str, type:str="clipspace", append=" [input]") -> torch.Tensor:
        return cls._load_image.load_image(os.path.join(type, file)+append)[1]
    
    @classmethod
    def fingerprint_inputs(cls, **kwargs): # type: ignore
        return random.random()
    
    @classmethod
    def VALIDATE_INPUTS(cls, *args, **kwargs): return True

    @classmethod
    def stack_latents(cls, latents:dict[str,torch.Tensor]|None, images_to_return:list[int]) -> dict[str,torch.Tensor]|None:
        if latents is None: return None
        try:
            return {"samples": torch.stack(list(latents['samples'][int(i)] for i in images_to_return))} if latents is not None else None
        except IndexError:
            print(f"Index error stacking latents: {images_to_return}")
            return None
        
    @classmethod
    def stack_images(cls, images:torch.Tensor|None, images_to_return:list[int]) -> torch.Tensor|None:
        if images is None: return None
        try:
            return torch.stack(list(images[i] for i in images_to_return))
        except IndexError:
            print(f"Index error stacking images: {images_to_return}")
            return None
        
    @classmethod
    def stack_masks(cls, masks:torch.Tensor|None, images_to_return:list[int]) -> torch.Tensor|None:
        return cls.stack_images(masks, images_to_return)


class ImageFilter(io.ComfyNode, FilterNodeBase):
    @classmethod
    def define_schema(cls):
        return io.Schema(
            node_id      = "Image Filter",
            display_name = "Image Filter",
            inputs       = [
                io.Image.Input("images"),
                io.Latent.Input("latents", optional=True, tooltip="optional"),
                io.Mask.Input("masks", optional=True, tooltip="optional"),
                io.Int.Input("timeout", default=600, min=1, max=1000000, tooltip="timeout in seconds"),
                io.Combo.Input("ontimeout", options=["send none", "send all", "send first", "send last"]),
                io.String.Input("tip", default="", optional=True),
                io.String.Input("extra1", default="", optional=True),
                io.String.Input("extra2", default="", optional=True),
                io.String.Input("extra3", default="", optional=True),
                io.Int.Input("pick_list_start", optional=True, default=0, tooltip="The index of the first image (normally 0 or 1)"),
                io.String.Input("pick_list", optional=True, default="", tooltip="If a comma separated list of integers is provided, the images with these indices will be selected automatically."),
                io.Int.Input("video_frames", optional=True, default=1, tooltip="Treat each block of n images as a video"),
                io.String.Input("graph_id", default="")
            ],
            outputs = [
                io.Image.Output("images", display_name="images"),
                io.Latent.Output("latents", display_name="latents"),
                io.Mask.Output("masks", display_name="masks"),
                io.String.Output("extra1", display_name="extra1"),
                io.String.Output("extra2", display_name="extra2"),
                io.String.Output("extra3", display_name="extra3"),
                io.String.Output("indexes", display_name="indexes")
            ],
            category = "image_filter"
        )

    @classmethod
    def parse_picklist(cls, pick_list:str, B:int=1) -> list[int]:
        return [ int(x.strip())%B for x in pick_list.split(',') ] if pick_list else []

    @classmethod
    def fingerprint_inputs(cls, pick_list:str, **kwargs): # type: ignore
        try:
            if (pl:=cls.parse_picklist(pick_list)): return ",".join([str(p) for p in pl])
        except:
            pass
        return random.random()
    
    @classmethod
    def execute( # type: ignore
        cls, 
        images: torch.Tensor|None, latents=None, masks=None, 
        timeout:int=600, ontimeout:str="send none", 
        graph_id:str="", 
        tip:str="", extra1:str="", extra2:str="", extra3:str="", 
        pick_list_start:int=0, pick_list:str="", video_frames:int=1,
        **kwargs
    ) -> io.NodeOutput:
        assert images is not None, "Image Filter received None for images"
        e1, e2, e3 = extra1, extra2, extra3
        B = images.shape[0]

        if video_frames>B: video_frames=1
            
        try:    
            images_to_return:list[int] = cls.parse_picklist(pick_list, B)
        except Exception as e: 
            print(f"{e} parsing pick_list - will manually select")
            images_to_return = []

        if len(images_to_return) == 0:
            all_the_same = ( B and all( (images[i]==images[0]).all() for i in range(1,B) )) 
            urls:list[dict[str,str]] = cls.save_images_return_urls(images=images, **kwargs)
            payload = { "urls":urls, "allsame":all_the_same, "extras":[extra1, extra2, extra3], "tip":tip, "video_frames":video_frames }

            response:Response = send_and_wait(payload, timeout, graph_id)
            images_to_return:list[int]

            if isinstance(response, TimeoutResponse):
                if ontimeout=='send none':  images_to_return = []
                if ontimeout=='send all':   images_to_return = [*range(len(images)//video_frames)]
                if ontimeout=='send first': images_to_return = [0,]
                if ontimeout=='send last':  images_to_return = [(len(images)//video_frames)-1,]
            else:
                e1, e2, e3 = response.get_extras((extra1, extra2, extra3))
                images_to_return = response.selection or []

        if not images_to_return: raise InterruptProcessingException()

        if video_frames>1:
            images_to_return = [ key*video_frames + frm  for key in images_to_return for frm in range(video_frames) ]

        images  = cls.stack_images (images,  images_to_return) 
        latents = cls.stack_latents(latents, images_to_return)
        masks   = cls.stack_masks  (masks,   images_to_return)
                
        return io.NodeOutput(images, latents, masks, e1, e2, e3, ",".join(str(x+pick_list_start) for x in images_to_return))
    
class TextImageFilterWithExtras(io.ComfyNode, FilterNodeBase):

    @classmethod
    def define_schema(cls):
        return io.Schema(
            node_id      = "Text Image Filter",
            display_name = "Text Image Filter",
            inputs       = [
                io.Image.Input("image"),
                io.String.Input("text", default=""),
                io.Int.Input("timeout", default=600, min=1, max=1000000, tooltip="timeout in seconds"),
                io.Mask.Input("mask", optional=True, tooltip="optional"),
                io.String.Input("tip", default="", optional=True),
                io.String.Input("extra1", default="", optional=True),
                io.String.Input("extra2", default="", optional=True),
                io.String.Input("extra3", default="", optional=True),
                io.Int.Input("textareaheight", default=150, min=30, max=500),
                io.String.Input("graph_id", default="")
            ],
            outputs = [
                io.Image.Output("images", display_name="images"),
                io.String.Output("text", display_name="text"),
                io.String.Output("extra1", display_name="extra1"),
                io.String.Output("extra2", display_name="extra2"),
                io.String.Output("extra3", display_name="extra3"),
            ],
            category = "image_filter"
        )
    
    @classmethod
    def execute(cls, image, text, timeout, graph_id, extra1="", extra2="", extra3="", mask=None, tip="", textareaheight=None, **kwargs): # type: ignore
        if image is None: image = torch.zeros((1,64,64,3))
        urls:list[dict[str,str]] = cls.save_images_return_urls(images=image, **kwargs)
        payload = {"urls":urls, "text":text, "extras":[extra1, extra2, extra3], "tip":tip}
        if textareaheight is not None: payload['textareaheight'] = textareaheight
        if mask is not None: payload['mask_urls'] = cls.save_images_return_urls(images=mask_to_image(mask), **kwargs)

        response = send_and_wait(payload, timeout, graph_id)
        if isinstance(response, TimeoutResponse):
            return io.NodeOutput(image, text, extra1, extra2, extra3)

        return io.NodeOutput(image, response.text, *response.get_extras((extra1, extra2, extra3)))
    

def mask_to_image(mask:torch.Tensor):
    return torch.stack([mask, mask, mask, 1.0-mask], -1)

def mask_from_data(data) -> torch.Tensor:
    bytes_data = data.encode('utf-8')
    image_data = base64.decodebytes(bytes_data)
    data_io = BytesIO(image_data)
    img = Image.open(data_io)

    mask = np.array(img.getchannel('A')).astype(np.float32) / 255.0
    mask = 1. - torch.from_numpy(mask)
    return mask.unsqueeze(0)

class InOutStore:
    previous_inputs:list[Any] = []
    last_output:tuple[torch.Tensor, torch.Tensor|None, str, str, str]|None = None

    @classmethod
    def check_input_unchanged(cls, *args) -> bool:
        def make_copy(x): return x.clone() if isinstance(x, torch.Tensor) else x
        try:
            if len(cls.previous_inputs)!=len(args): return False
            for prev, new in zip(cls.previous_inputs, args):
                if isinstance(prev, torch.Tensor) and isinstance(new, torch.Tensor):
                    if not torch.equal(prev, new): return False
                else:
                    if prev != new: return False
            return True
        finally:
            cls.previous_inputs = [ make_copy(x) for x in args ]
    
class MaskImageFilter(io.ComfyNode, FilterNodeBase):
    @classmethod
    def define_schema(cls):
        return io.Schema(
            node_id      = "Mask Image Filter",
            display_name = "Mask Image Filter",
            inputs       = [
                io.Image.Input("image"),
                io.Int.Input("timeout", default=600, min=1, max=1000000, tooltip="timeout in seconds"),
                io.Combo.Input("if_no_mask", options=["cancel", "send blank"], default="send blank"),
                io.Combo.Input("if_inputs_unchanged", options=["Run normally", "Start with last output", "Resend last output"], default="Run normally"),
                io.Mask.Input("mask", optional=True, tooltip="optional"),
                io.String.Input("tip", default="", optional=True),
                io.String.Input("extra1", default="", optional=True),
                io.String.Input("extra2", default="", optional=True),
                io.String.Input("extra3", default="", optional=True),
                io.String.Input("graph_id", default="")
            ],
            outputs = [
                io.Image.Output("image", display_name="image"),
                io.Mask.Output("mask", display_name="mask"),
                io.String.Output("extra1", display_name="extra1"),
                io.String.Output("extra2", display_name="extra2"),
                io.String.Output("extra3", display_name="extra3"),
            ],
            category = "image_filter"
        )

    @classmethod
    def execute(cls, image, timeout, if_no_mask, graph_id, if_inputs_unchanged="Run normally", mask=None, extra1="", extra2="", extra3="", tip="", **kwargs): # type: ignore
        # check if everything is unchanged (and store these inputs for next check)
        if InOutStore.check_input_unchanged(image, timeout, if_no_mask, graph_id, mask, extra1, extra2, extra3, tip) and InOutStore.last_output is not None:
            if if_inputs_unchanged == "Start with last output":
                image, mask, extra1, extra2, extra3 = InOutStore.last_output
                mask = 1.0 - mask if mask is not None else None  # The mask editor works in inverse
            elif if_inputs_unchanged == "Resend last output":
                return io.NodeOutput( *InOutStore.last_output )
            
        if mask is not None and mask.shape[:3] == image.shape[:3] and not torch.all(mask==0):
            input_to_send = torch.cat((image, mask.unsqueeze(-1)), dim=-1)
        else:
            input_to_send = image

        urls = cls.save_images_return_urls(images=input_to_send, **kwargs)
        payload = { "urls":urls, "maskedit":True, "extras":[extra1, extra2, extra3], "tip":tip}
        response = send_and_wait(payload, timeout, graph_id)
        
        if (response.masked_image): # old mask editor - uploads
            try:
                mask = cls.load_mask(response.masked_image)
            except FileNotFoundError: # no mask was uploaded; reload the input mask, or the mask in the input image
                mask = mask if mask is not None else cls.load_mask(urls[0]['filename']+" [temp]")
                
        elif (response.masked_data): # new mask editor - sends the blob
            data = response.masked_data.split(',',1)[-1]
            mask = mask_from_data(data)

        if if_no_mask == 'cancel' and torch.all(mask==0): raise InterruptProcessingException()
        if mask is None: mask = torch.zeros_like(image[...,0])  

        InOutStore.last_output = ( image.clone(), mask.clone(), *response.get_extras((extra1, extra2, extra3)) )
        return io.NodeOutput( *InOutStore.last_output )

    @classmethod
    def fingerprint_inputs(cls, **kwargs) -> Any:
        return random.random()