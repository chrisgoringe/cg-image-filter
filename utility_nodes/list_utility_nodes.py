import torch
from comfy_api.latest import io
    
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
   
class PickFromList(io.ComfyNode):
    @classmethod
    def define_schema(cls):
        return io.Schema(
            node_id      = "Pick from List",
            display_name = "Pick from List",
            inputs       = [
                io.AnyType.Input("anything"),
                io.String.Input("indexes", display_name="indexes", tooltip="comma separated list of indexes. Whitespace stripped. Only these entries will be included. Zero indexed.")
            ],
            outputs      = [
                io.String.Output("picks", display_name="picks", is_output_list=True)
            ],
            category     = "image_filter/helpers",
            is_input_list=True
        )


    @classmethod
    def execute(cls, anything:list, indexes:list[str]): # type: ignore

        if len(anything)==1 and isinstance(anything[0],list): 
            print("Warning: received list of lists. Processing just anything[0]")
            anything = anything[0]

        index_str:str = indexes[0]

        result = []
        for x in [x.strip() for x in index_str.split(',')]:
            try:
                result.append(anything[int(x)])
            except Exception as e:
                print(f"{e} when processing {x} from {index_str}")

        return io.NodeOutput(result, )