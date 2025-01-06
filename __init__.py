"""
@author: chrisgoringe
@title: Image Filter
@nickname: Image Filter
@description: A custom node that pauses the flow while you choose which image or images to pass on to the rest of the workflow. Simplified and improved version of cg-image-picker.
"""

from .image_filter import ImageFilter, TextImageFilter, MaskImageFilter

VERSION = "1.0.1"
WEB_DIRECTORY = "./js"

NODE_CLASS_MAPPINGS= {
    "Image Filter": ImageFilter,
    "Text Image Filter": TextImageFilter,
    "Mask Image Filter": MaskImageFilter
}

__all__ = ["NODE_CLASS_MAPPINGS", "WEB_DIRECTORY"]
