"""
@author: chrisgoringe
@title: Image Filter
@nickname: Image Filter
@description: A custom node that pauses the flow while you choose which image or images to pass on to the rest of the workflow. Simplified and improved version of cg-image-picker.
"""

from .image_filter_nodes import ImageFilter, MaskImageFilter, TextImageFilterWithExtras
from .utility_nodes.list_utility_nodes import PickFromList, BatchFromImageList, ImageListFromBatch
from .utility_nodes.string_utility_nodes import SplitByCommas, StringToFloat, StringToInt, AnyListToString, StringToStringList
from .utility_nodes.mask_utility_nodes import MaskedSection

VERSION = "1.7"
WEB_DIRECTORY = "./js"

NODE_CLASS_MAPPINGS= {
    "Image Filter": ImageFilter,
    "Text Image Filter": TextImageFilterWithExtras,
    "Text Image Filter with Extras": TextImageFilterWithExtras,
    "Mask Image Filter": MaskImageFilter,
    "Split String by Commas": SplitByCommas,
    "String to String List": StringToStringList,
    "String to Int": StringToInt,
    "String to Float": StringToFloat,
    "Pick from List": PickFromList,
    "Any List to String": AnyListToString,
    "Batch from Image List": BatchFromImageList,
    "Image List From Batch": ImageListFromBatch,
    "Masked Section": MaskedSection,
}

__all__ = ["NODE_CLASS_MAPPINGS", "WEB_DIRECTORY"]
