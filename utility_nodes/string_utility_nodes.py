from comfy_api.latest import io
from typing import Any

class StringToStringList(io.ComfyNode):
    @classmethod
    def define_schema(cls):
        return io.Schema(
            node_id      = "StringToStringList",
            display_name = "String to String List",
            category     = "image_filter/helpers",
            inputs       = [
                io.String.Input("string"),
                io.String.Input("split",default=",", tooltip="Split on this substring (or linebreak)"),
            ],
            outputs = [
                io.String.Output("string_list", is_output_list=True),
             ],
        )
    
    @classmethod
    def execute(cls, string, split): # type: ignore
        if split == "linebreak": split = "\n"
        bits:list[str] = [r.strip() for r in string.split(split)] 
        return io.NodeOutput(bits)

class SplitByCommas(io.ComfyNode):
    @classmethod
    def define_schema(cls):
        return io.Schema(
            node_id      = "Split String by Commas",
            display_name = "Split String on character",
            inputs = [
                io.String.Input("string"),
                io.String.Input("split", default=",", tooltip="Split on this substring (or linebreak)"),                
            ],
            outputs = [
                io.String.Output("string1", display_name="string"),
                io.String.Output("string2", display_name="string"),
                io.String.Output("string3", display_name="string"),
                io.String.Output("string4", display_name="string"),
                io.String.Output("string5", display_name="string"),
                io.String.Output("all_as_list", display_name="all", is_output_list=True),
            ],
            category = "image_filter/helpers",
            description = "Split the input string and strips whitespace."
        )

    @classmethod
    def execute(cls, string, split): # type: ignore
        if split == "linebreak": split = "\n"
        bits:list[str] = [r.strip() for r in string.split(split)] 
        five = (bits + [""*5])[:5]
        return io.NodeOutput(*five, bits)
    
class AnyListToString(io.ComfyNode):
    @classmethod
    def define_schema(cls):
        return io.Schema(
            node_id      = "Any List to String",
            display_name = "Any List to String",
            inputs       = [
                io.AnyType.Input("anything"),
                io.String.Input("join", default="")
            ],
            outputs = [
                io.String.Output("string")
            ],
            is_input_list = True,
            category = "image_filter/helpers",
        )

    @classmethod
    def execute(cls, anything:list[Any], join:list[str]): # type: ignore
        return io.NodeOutput( join[0].join( [f"{x}" for x in anything] ), )
    
class StringToInt(io.ComfyNode):
    @classmethod
    def define_schema(cls):
        return io.Schema(
            node_id      = "String to Int",
            display_name = "String to Int",
            inputs       = [
                io.String.Input("string"),
                io.Int.Input("default")
            ],
            outputs = [
                io.Int.Output("int")
            ],
            category = "image_filter/helpers",
        )

    @classmethod
    def execute(cls, string:str, default:int): # type: ignore
        try:    return io.NodeOutput(int(string.strip()),)
        except: return io.NodeOutput(default,)

class StringToFloat(io.ComfyNode):
    @classmethod
    def define_schema(cls):
        return io.Schema(
            node_id      = "String to Float",
            display_name = "String to Float",
            inputs       = [
                io.String.Input("string"),
                io.Float.Input("default")
            ],
            outputs = [
                io.Float.Output("float")
            ],
            category = "image_filter/helpers",
        )

    @classmethod
    def execute(cls, string:str, default:float): # type: ignore
        try:    return io.NodeOutput(float(string.strip()),)
        except: return io.NodeOutput(default,)