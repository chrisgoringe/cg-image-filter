"""
@author: chrisgoringe
@title: Image Filter
@nickname: Image Filter
@description: A custom node that pauses the flow while you choose which image or images to pass on to the rest of the workflow. Simplified and improved version of cg-image-picker.
"""

VERSION = "1.7"
WEB_DIRECTORY = "./js"
__all__ = ["WEB_DIRECTORY"]

from comfy_api.latest import ComfyExtension, io

from .image_filter_nodes import ImageFilter, MaskImageFilter, TextImageFilterWithExtras
from .utility_nodes.list_utility_nodes import PickFromList, BatchFromImageList, ImageListFromBatch
from .utility_nodes.string_utility_nodes import SplitByCommas, StringToFloat, StringToInt, AnyListToString, StringToStringList, cg_StringToFloat, cg_StringToInt
from .utility_nodes.mask_utility_nodes import MaskedSection

async def comfy_entrypoint() -> ComfyExtension:
    class cg_ImageFilterExtension(ComfyExtension):
        async def get_node_list(self) -> list[type[io.ComfyNode]]:
            return [
                ImageFilter, MaskImageFilter, TextImageFilterWithExtras,
                PickFromList, BatchFromImageList, ImageListFromBatch,
                SplitByCommas, StringToFloat, StringToInt, AnyListToString, StringToStringList, cg_StringToFloat, cg_StringToInt,
                MaskedSection,            
            ]
        
    return cg_ImageFilterExtension()