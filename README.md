# cg-image-filter

A set of three nodes designed to pause execution of the workflow to allow you to make selections and/or edits before continuing.

## Image Filter

The image filter node pauses execution of the workflow while you choose which, if any, of the images produced, you want to progress.

Insert it like this:

![image](images/basic.png)

When you run the workflow, and get to this point, a popup window will appear displaying the image(s) for you to select which, if any, 
you want to progress:

![image](images/popup.png)

Click the images that you want to keep (their border will turn green) and then click 'Send' (or press 's') to continue the workflow. 
If you don't want to keep any of the images, click 'Cancel' (or press 'x') to terminate the workflow. 

The node also has a timeout specified, and a countdown is shown on the left hand side. If you don't Send or Cancel before the timeout, 
the node will either cancel or send all the images, depending on the option you have selected.

Here's a simple use: generate a batch of images and pick which ones you want to save:

![workflow](images/workflow.png)

### Extra bits

The "Click to send" option can be used when you know you want to send at most one image. 
When checked, clicking an image selects it and sends it in a single action.

The Latent and Mask inputs are optional. If used, they should have the same number of latents (or masks) as the image batch, 
and the latents (or masks) corresponding to the selected images will also be output. Use this if (for instance) you want to 
select from a batch of images, but the next stage uses the latent - that way you avoid the decode-recode loss.

## Mask Image Filter

Designed for a single image, when executed the Mask Image Filter node will automatically launch the mask editor. 

![mask](images/mask.png)

When you finish mask editing the image and mask will be output. Here's a simple use - generate an image, and then 
mask the bit you don't like, before doing an img2img step.

![mask workflow](images/mask%20workflow.png)

Again, there is a timeout, and if you don't save a mask before the end of the timeout (or if you press the cancel button in the mask editor), 
it will either cancel, or send a blank mask, depending on the option chosen.

## Text Image Filter

Also designed for a single image, this node will show the image and a string of text; you can edit the text and then press send. 

![text](images/text.png)

The image and (edited) text are output. The intended use is for captioning workflows; you can read and edit each caption as it is
generated. Here's a trivial workflow:

![text workflow](images/text%20workflow.png)

## Feedback

Bugs and ideas welcome in the [GitHub](https://github.com/chrisgoringe/cg-image-filter/issues)