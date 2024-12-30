# cg-image-filter
 
A simple node that pauses execution of the workflow while you choose which, if any, of the images produced, you want to progress.

So you can look at an image before passing it into upscaling etc., and reject ones you don't like.

This is a work in progress replacement for most functions of the cg-image-picker nodes. 

It aims to be:

- simpler code
- easier to use for the most frequent use cases
- more visual
- compatible with the controller (https://github.com/chrisgoringe/cg-controller)

It will not have all the features of the original (overbloated!) nodes.

## Basic use

Put the Image Filter node into your workflow where you want to pause:

![image](images/basic.png)

When the workflow reaches this node, a big panel will appear showing the image or images. You select the images you want by clicking on them (their border turns green) and then clicking the 'Send' button (or pressing 's'). Those images will be rebatched and sent on.

If you click 'Cancel' (or press 'x'), the workflow will terminate. Combine this with the Comfy Queue (Instant) setting and a new image will be generated.

If you tick the 'click to send' checkbox, clicking an image will automatically send just that one - good for when you are picking one option from a batch.

If you do nothing, and the number of seconds specified in the timeout is exceeded, the run will be cancelled.

## Future plans

- a node that takes a single image as input, and when executed, activates the mask editor, then outputs an image and the on-the-fly mask
- a node that takes an image and a string, and allows you to edit the string before passing it on