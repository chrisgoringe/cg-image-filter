class SplitByCommas:
    RETURN_TYPES = ("STRING","STRING","STRING","STRING","STRING")
    FUNCTION = "func"
    CATEGORY = "image_filter"
    OUTPUT_NODE = False

    DESCRIPTION = "Split the input string into up to five pieces. Splits on commas and then strips whitespace from front and end."

    @classmethod
    def INPUT_TYPES(s):
        return {"required": {"string" : ("STRING", {"default":""})}}
    
    def func(self, string:str):
        bits = [r.strip() for r in string.split(",",5)] + [""]*5
        return tuple(bits[:5])