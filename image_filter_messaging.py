from server import PromptServer
from aiohttp import web
from comfy.model_management import InterruptProcessingException, throw_exception_if_processing_interrupted
import time, json
from typing import Optional

REQUEST_RESHOW = "-1"
REQUEST_TIMER_RESET = "-2"
CANCEL = "-3"
WAITING_FOR_RESPONSE = "-9"

SPECIALS = [REQUEST_RESHOW, REQUEST_TIMER_RESET, CANCEL, WAITING_FOR_RESPONSE]

class Response:
    def __init__(self, selection:Optional[list[int]] = None, text:Optional[str] = None,
                        masked_image:Optional[str] = None, extras:Optional[list[str]] = None):
        self.selection = selection
        self.text = text
        self.masked_image = masked_image
        self.extras = extras
        self.timeout = False

    def get_extras(self,defaults:list[str]) -> list[str]:
         return self.extras or defaults  

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
    def waiting_state(cls): return MessageState(data={'special':WAITING_FOR_RESPONSE})

    @classmethod
    def start_waiting(cls): cls.latest = cls.waiting_state()

    @classmethod
    def get_response(cls) -> Response:  
        if cls.waiting(): return TimeoutResponse()
        return cls.latest.response

    @classmethod
    def stop_waiting(cls): cls.latest = MessageState()

    @classmethod
    def waiting(cls): return cls.latest.special == WAITING_FOR_RESPONSE

    @classmethod
    def cancelled(cls): return cls.latest.special == CANCEL

    @property
    def real(self): return self.special is None


@PromptServer.instance.routes.post('/cg-image-filter-message')
async def cg_image_filter_message(request):
    post     = await request.post()
    response = post.get("response")
    message  = MessageState(response)

    if (MessageState.waiting()):
        MessageState.latest = message
    elif (message.real and not MessageState.cancelled()):
        MessageState.latest = message
    else:
        print(f"Ignoring response {response}")

    return web.json_response({})

def wait_for_response(secs, uid, unique) -> Response:
    MessageState.start_waiting()
    try:
        end_time = time.monotonic() + secs
        while(time.monotonic() < end_time and MessageState.waiting()): 
            throw_exception_if_processing_interrupted()
            PromptServer.instance.send_sync("cg-image-filter-images", {"tick": int(end_time - time.monotonic()), "uid": uid, "unique":unique})
            time.sleep(0.2)
        if MessageState.waiting():
            PromptServer.instance.send_sync("cg-image-filter-images", {"timeout": True, "uid": uid, "unique":unique})
        if MessageState.cancelled():
            raise InterruptProcessingException()
        if str(MessageState.latest.unique)!=str(unique):
            print("Mismatched uniques...")
        return MessageState.get_response()
    finally: MessageState.stop_waiting()
    
def send_and_wait(payload, timeout, uid, unique) -> Response:
    payload['uid'] = uid
    payload['unique'] = unique
    PromptServer.instance.send_sync("cg-image-filter-images", payload)
    return wait_for_response(timeout, uid, unique)
        



            