import torch
from comfy_api.latest import io

class MaskedSection(io.ComfyNode):
    @classmethod
    def define_schema(cls):
        return io.Schema(
            node_id      = "Masked Section",
            display_name = "Masked Section",
            inputs       = [
                io.Mask.Input("mask"),
                io.Image.Input("image"),
                io.Int.Input("minimum", default=512, min=16, max=16384, tooltip="Minimum image size to output")
            ],
            outputs = [
                io.Image.Output("image")
            ],
            category = "image_filter/helpers",
            description = "return the image cropped to only include the masked section"
        )    
    
    @classmethod
    def execute(cls, mask:torch.Tensor, image, minimum=512): # type: ignore
        mbb = mask.squeeze()
        H,W = mbb.shape
        masked = mbb > 0.5

        non_zero_positions = torch.nonzero(masked)
        if len(non_zero_positions) < 2: return (image,)

        min_x = int(torch.min(non_zero_positions[:, 1]))
        max_x = int(torch.max(non_zero_positions[:, 1]))
        min_y = int(torch.min(non_zero_positions[:, 0]))
        max_y = int(torch.max(non_zero_positions[:, 0]))

        if (x:=(minimum-(max_x-min_x))//2)>0:
            min_x = max(min_x-x, 0)
            max_x = min(max_x+x, W)
        if (y:=(minimum-(max_y-min_y))//2)>0:
            min_y = max(min_y-y, 0)
            max_y = min(max_y+y, H)       

        return io.NodeOutput(image[:,min_y:max_y,min_x:max_x,:],)

