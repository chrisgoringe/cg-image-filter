import torch
from json import JSONEncoder

def _default(self, obj): return getattr(obj.__class__, "to_json", _default.default)(obj)
_default.default = JSONEncoder().default
JSONEncoder.default = _default

class AlwaysEqual:
    def to_json(self): return "*"
    def __ne__(self, __value: object) -> bool: return False
    def __eq__(self, __value: object) -> bool: return True
    
class BatchFromImageList:
    @classmethod
    def INPUT_TYPES(s):
        return {"required": { "images": ("IMAGE", ), } }
    INPUT_IS_LIST = True
    RETURN_TYPES = ("IMAGE", )
    FUNCTION = "func"

    CATEGORY = "image_filter/helpers"

    def func(self, images):
        if len(images) <= 1:
            return (images[0],)
        else:
            return (torch.cat(list(i for i in images), dim=0),)
        
class ImageListFromBatch:
    @classmethod
    def INPUT_TYPES(s):
        return {"required": { "images": ("IMAGE", ), } }
    INPUT_IS_LIST = False
    OUTPUT_IS_LIST = [True,]
    RETURN_TYPES = ("IMAGE", )
    FUNCTION = "func"

    CATEGORY = "image_filter/helpers"

    def func(self, images):
        image_list = list( i.unsqueeze(0) for i in images )
        return (image_list,) 


class PickFromList:
    @classmethod
    def INPUT_TYPES(s):
        return {
            "required": { 
                "anything" : (AlwaysEqual(), ), 
                "indexes": ("STRING", {"default": ""})
            },
        }
    RETURN_TYPES = (AlwaysEqual(),)
    RETURN_NAMES = ("picks",)

    FUNCTION = "func"
    CATEGORY = "image_filter/helpers"
    INPUT_IS_LIST = True
    OUTPUT_IS_LIST = [True,]

    def func(self, anything, indexes):
        try:
            indexes = [int(x.strip()) for x in indexes[0].split(',') if x.strip()]
        except Exception as e:
            print(e)
            indexes = []

        return ([anything[i] for i in indexes], )