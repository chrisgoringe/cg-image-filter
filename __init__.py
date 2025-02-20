"""
@author: chrisgoringe
@title: Image Filter
@nickname: Image Filter
@description: A custom node that pauses the flow while you choose which image or images to pass on to the rest of the workflow. Simplified and improved version of cg-image-picker.
"""

from .image_filter import ImageFilter, MaskImageFilter, TextImageFilterWithExtras
from .split_by_commas import SplitByCommas, StringToFloat, StringToInt

VERSION = "1.1.5"
WEB_DIRECTORY = "./js"

NODE_CLASS_MAPPINGS= {
    "Image Filter": ImageFilter,
    "Text Image Filter": TextImageFilterWithExtras,
    "Text Image Filter with Extras": TextImageFilterWithExtras,
    "Mask Image Filter": MaskImageFilter,
    "Split String by Commas": SplitByCommas,
    "String to Int": StringToInt,
    "String to Float": StringToFloat,
}

__all__ = ["NODE_CLASS_MAPPINGS", "WEB_DIRECTORY"]
