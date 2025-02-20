class SplitByCommas:
    RETURN_TYPES = ("STRING","STRING","STRING","STRING","STRING")
    FUNCTION = "func"
    CATEGORY = "image_filter/helpers"
    OUTPUT_NODE = False

    DESCRIPTION = "Split the input string into up to five pieces. Splits on commas (or | or ^) and then strips whitespace from front and end."

    @classmethod
    def INPUT_TYPES(s):
        return {
            "required": { "string" : ("STRING", {"default":""}), },
            "optional": { "split": ([",", "|", "^"], {}), },
        }
    
    def func(self, string:str, split:str=","):
        bits = [r.strip() for r in string.split(split,5)] + [""]*5
        return tuple(bits[:5])
    
class StringToInt:
    RETURN_TYPES = ("INT",)
    FUNCTION = "func"
    CATEGORY = "image_filter/helpers"

    @classmethod
    def INPUT_TYPES(s):
        return {
            "required": { "string" : ("STRING", {"default":"", "forceInput":True, "tooltip":"whitespace will be stripped before parsing"}), },
            "required": { "default" : ("INT", {"default":0}), "tooltip":"used if the string can't be parsed as an integer"}
        }
    
    def func(self, string:str, default:int):
        try:    return (int(string.strip()),)
        except: return (default,)

class StringToFloat:
    RETURN_TYPES = ("FLOAT",)
    FUNCTION = "func"
    CATEGORY = "image_filter/helpers"

    @classmethod
    def INPUT_TYPES(s):
        return {
            "required": { "string" : ("STRING", {"default":"", "forceInput":True, "tooltip":"whitespace will be stripped before parsing"}), },
            "required": { "default" : ("FLOAT", {"default":0.0}), "tooltip":"used if the string can't be parsed as an integer"}
        }
    
    def func(self, string:str, default:float):
        try:    return (float(string.strip()),)
        except: return (default,)