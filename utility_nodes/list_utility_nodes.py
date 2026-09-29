import torch
from comfy_api.latest import io
from typing import Iterable
    
class BatchFromImageList(io.ComfyNode):
    @classmethod
    def define_schema(cls):
        return io.Schema(
            node_id      = "Batch from Image List",
            display_name = "Batch from Image List",
            inputs       = [
                io.Image.Input("images")
            ],
            outputs      = [
                io.Image.Output("image")
            ],
            is_input_list = True,
            category     = "image_filter/helpers"
        )

    @classmethod
    def execute(cls, images): # type: ignore
        if len(images) <= 1:
            return io.NodeOutput(images[0],)
        else:
            return io.NodeOutput(torch.cat(list(i for i in images), dim=0),)
        
class ImageListFromBatch(io.ComfyNode):
    @classmethod
    def define_schema(cls):
        return io.Schema(
            node_id      = "Image List From Batch",
            display_name = "Image List From Batch",
            inputs       = [
                io.Image.Input("images")
            ],
            outputs      = [
                io.Image.Output("image", is_output_list=True)
            ],
            category = "image_filter/helpers"
        )
    
    @classmethod
    def execute(cls, images): # type: ignore
        image_list = list( i.unsqueeze(0) for i in images )
        return io.NodeOutput(image_list,) 

template = io.MatchType.Template("pick_from_list")

class PickFromList(io.ComfyNode):
    @classmethod
    def define_schema(cls):
        return io.Schema(
            node_id      = "Pick from List",
            display_name = "Pick from List",
            description  = "Given a comma separated list of indexes, return only those entries from the input list.",
            inputs       = [
                io.MatchType.Input("anything", template=template, tooltip="note that a list is expected (or an image batch)"),
                io.String.Input("indexes", display_name="indexes", tooltip="comma separated list of indexes. Whitespace stripped. Only these entries will be included."),
                io.Combo.Input("indexing", options=['0','1'], default='0', tooltip="is the first item number 0 or number 1?")
            ],
            outputs      = [
                io.MatchType.Output(template=template, display_name="picks", is_output_list=True)
            ],
            category     = "image_filter/helpers",
            is_input_list=True
        )


    @classmethod
    def execute(cls, anything:list, indexes:list[str], indexing:list[str|int]=[0,]): # type: ignore

        is_image_batch = False
        if len(anything)==1:
            if isinstance(anything[0],list): 
                print("Warning: PickFromList received length 1 list of lists. Processing anything[0]")
                anything = anything[0]
            elif isinstance(anything[0], torch.Tensor) and len(anything[0].shape) == 4:
                anything = anything[0]       # type: ignore
                is_image_batch = True

        index_str:str = indexes[0]
        offset:int    = int(indexing[0])

        try:
            index_ns = [int(x.strip())-offset for x in index_str.split(',') if x.strip()]
            result   = [anything[x] for x in index_ns]
            if is_image_batch: result = [torch.stack(result),]
            return io.NodeOutput(result, )
        except Exception as e:
            print(f"{e} when processing {index_str}")
            raise 
