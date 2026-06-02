import torch
from typing import Any

outputs_type = tuple[torch.Tensor, torch.Tensor|None, str, str, str]

def types(l:list[Any]) -> str: return ":".join(str(x.__class__) for x in l)

def make_copy(x): return x.clone() if isinstance(x, torch.Tensor) else x

class InOutStore:
    stores:dict[str, "InOutStore"] = {}
    @classmethod
    def get_store(cls, graph_id:str) -> "InOutStore":
        if graph_id not in cls.stores:
            cls.stores[graph_id] = InOutStore()
        return cls.stores[graph_id]

    def __init__(self): 
        self.last_inputs:list[Any]|None = None
        self.last_output:outputs_type|None = None

    @property
    def have_last_output(self): return self.last_output is not None

    @property
    def last_input_tensors(self): 
        assert self.last_inputs is not None
        return [ x for x in self.last_inputs if isinstance(x,torch.Tensor) ]

    def get_last_outputs(self) -> outputs_type:
        assert self.last_output is not None, "No last output stored"
        return self.last_output
    
    def update_last_outputs(self, outputs:outputs_type):
        self.last_output = [ make_copy(x) for x in outputs ]

    def update_last_inputs(self, *args):
        self.last_inputs = [ make_copy(x) for x in args ]

    def compare_with_last_inputs(self, *args) -> bool:
        if self.last_inputs is None: return False   # first time we've been called
        if not types(self.last_inputs) == types(args):
            assert False, "Called compare_with_last_inputs with different classes"

        # compare the tensors
        for prev, new in zip(self.last_inputs, args):
            if isinstance(prev, torch.Tensor) and not torch.equal(prev, new) and not torch.equal(1-prev, new): 
                print("Tensor input changed")
                return False

        # compare the non-tensors
        if self.tensor_free_hash(*args) != self.tensor_free_hash(self.last_inputs): 
            print("Non tensor input changed")
            return False

        return True

    def check_input_tensors_congruent(self, *args) -> bool:
        if self.last_inputs is None: return False
        for a,i in enumerate(args):
            assert isinstance(a,torch.Tensor)
            if self.last_input_tensors[i].shape != a.shape: return False
        return True
    
    def tensor_free_hash(self, *args):
        tf = ",".join( str(v) for v in flatten(args) if not isinstance(v, torch.Tensor) and v )
        print(f"Hashing {tf} ... ")
        return hash( tf )

def flatten(args) -> list[Any]:
    f = []
    for arg in args:
        f.extend(flatten(arg)) if (isinstance(arg, list) or isinstance(arg,tuple)) else f.append(arg)
    return f
