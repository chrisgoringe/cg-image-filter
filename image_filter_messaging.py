from server import PromptServer
from aiohttp import web
from comfy.model_management import InterruptProcessingException, throw_exception_if_processing_interrupted
import time, json
from typing import Optional
from dataclasses import dataclass

REQUEST_RESHOW = "-1"
REQUEST_TIMER_RESET = "-2"
CANCEL = "-3"
WAITING_FOR_RESPONSE = "-9"

SPECIALS = [REQUEST_RESHOW, REQUEST_TIMER_RESET, CANCEL, WAITING_FOR_RESPONSE]

@dataclass
class Response:
    selection:      Optional[list[int]] = None
    text:           Optional[str]       = None
    masked_image:   Optional[str]       = None
    extras:         Optional[list[str]] = None
    timeout = False

class TimeoutResponse(Response):
    def __init__(self):
        super().__init__()
        self.timeout = True

class MessageState:
    latest = None
    def __init__(self, data:dict|str={}):
        if not isinstance(data,dict): data = json.loads(data)
        self.unique:str            = data.pop('unique', None)
        self.special:Optional[int] = data.pop('special',None)
        self.response:Response     = Response(**data)

    @classmethod
    def start_waiting(cls): cls.latest = MessageState(data={'special':WAITING_FOR_RESPONSE})

    @classmethod
    def get_response(cls) -> Response:  
        if cls.waiting: return TimeoutResponse()
        return cls.latest.response

    @classmethod
    def stop_waiting(cls): cls.latest = MessageState()

    @property
    def waiting(self): return self.special == WAITING_FOR_RESPONSE

    @property
    def cancel(self): return self.special == CANCEL

    @property
    def real(self): return self.special is None


@PromptServer.instance.routes.post('/cg-image-filter-message')
async def cg_image_filter_message(request):
    post     = await request.post()
    response = post.get("response")
    message  = MessageState(response)

    if (MessageState.waiting):
        MessageState.latest = message
    elif (message.real and not MessageState.cancel):
        MessageState.latest = message
    else:
        print(f"Ignoring response {response} as current response is {MessageState.response}")

    return web.json_response({})

def wait(secs, uid, unique) -> MessageState:
    MessageState.start_waiting()
    try:
        end_time = time.monotonic() + secs
        while(time.monotonic() < end_time and MessageState.waiting): 
            throw_exception_if_processing_interrupted()
            PromptServer.instance.send_sync("cg-image-filter-images", {"tick": int(end_time - time.monotonic()), "uid": uid, "unique":unique})
            time.sleep(0.2)
        if MessageState.waiting:
            PromptServer.instance.send_sync("cg-image-filter-images", {"timeout": True, "uid": uid, "unique":unique})
        return MessageState.get_response()
    finally: MessageState.stop_waiting()
    
def send_and_wait(payload, timeout, uid, unique) -> Response:
    response = WAITING_FOR_RESPONSE
    payload['unique'] = unique
    while response in SPECIALS:
        PromptServer.instance.send_sync("cg-image-filter-images", payload)
        message = wait(timeout, uid, unique)
        if message.cancel:  
            raise InterruptProcessingException()
    if message.unique != unique:
        print("Mismatched uniques...")
    return message.response



            